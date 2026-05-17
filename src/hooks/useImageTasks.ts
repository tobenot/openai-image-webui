import { useCallback, useEffect, useRef, useState } from "react";
import { editImage, generateImage, getImageGenerationDebug } from "../api/openaiImages";
import {
  cacheImageFromUrl,
  clearImageCache,
  deleteCachedImage,
  getCachedImage,
  getImageCacheStats,
  IMAGE_CACHE_WARNING_BYTES,
  type CachedImageRecord,
} from "../lib/imageCache";
import { toFriendlyError } from "../lib/errors";
import { buildCompatibleImageRequest } from "../lib/imageSizing";
import { loadTasks, saveTasks } from "../lib/storage";
import type { AppSettings, GenerateFormState, ImageCacheStats, ImageTask } from "../types";

interface PendingEditInputs {
  images: File[];
  mask: File | null;
}

function createTaskId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeConcurrency(value: number) {
  return Math.max(1, Math.floor(Number.isFinite(value) ? value : 1));
}

function createEmptyCacheStats(): ImageCacheStats {
  return {
    count: 0,
    size: 0,
    warningBytes: IMAGE_CACHE_WARNING_BYTES,
    overWarning: false,
  };
}

function isBlobUrl(value?: string) {
  return Boolean(value?.startsWith("blob:"));
}

function isDataUrl(value?: string) {
  return Boolean(value?.startsWith("data:"));
}

function isRemoteImageUrl(value?: string) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function imageSourceFromTask(task: ImageTask) {
  if (task.imageUrl) {
    return task.imageUrl;
  }

  if (task.b64Json) {
    return `data:image/png;base64,${task.b64Json}`;
  }

  return undefined;
}

export function useImageTasks(settings: AppSettings) {
  const [tasks, setTasks] = useState<ImageTask[]>(() => loadTasks());
  const [cacheStats, setCacheStats] = useState<ImageCacheStats>(() => createEmptyCacheStats());
  const settingsRef = useRef(settings);
  const tasksRef = useRef(tasks);
  const controllersRef = useRef(new Map<string, AbortController>());
  const objectUrlsRef = useRef(new Set<string>());
  // Edit-mode inputs can't be persisted (they're raw File blobs). Keep them in
  // memory keyed by task id; drop entries once the task finishes or is removed.
  const pendingInputsRef = useRef(new Map<string, PendingEditInputs>());

  const revokeObjectUrl = useCallback((url?: string) => {
    if (!isBlobUrl(url)) {
      return;
    }

    URL.revokeObjectURL(url as string);
    objectUrlsRef.current.delete(url as string);
  }, []);

  const createObjectUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    return url;
  }, []);

  const refreshCacheStats = useCallback(async () => {
    try {
      setCacheStats(await getImageCacheStats());
    } catch {
      setCacheStats(createEmptyCacheStats());
    }
  }, []);

  const attachCachedImage = useCallback(
    (taskId: string, record: CachedImageRecord) => {
      const objectUrl = createObjectUrl(record.blob);

      setTasks((current) =>
        current.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          revokeObjectUrl(task.imageUrl);

          return {
            ...task,
            imageUrl: objectUrl,
            b64Json: undefined,
            imageCached: true,
            imageMimeType: record.mimeType,
            imageSize: record.size,
          };
        }),
      );
    },
    [createObjectUrl, revokeObjectUrl],
  );

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    tasksRef.current = tasks;
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    let active = true;

    void (async () => {
      await refreshCacheStats();

      for (const task of tasksRef.current) {
        if (!active) {
          return;
        }

        try {
          if (task.imageCached) {
            const cached = await getCachedImage(task.id);

            if (cached && active) {
              attachCachedImage(task.id, cached);
            }
            continue;
          }

          const source = imageSourceFromTask(task);
          // Prefer b64Json (never expires) for recovery; fall back to remote URL.
          const recoverableSource =
            task.b64Json
              ? `data:image/png;base64,${task.b64Json}`
              : source && (isDataUrl(source) || isRemoteImageUrl(source))
                ? source
                : null;

          if (!recoverableSource) {
            continue;
          }

          const cached = await cacheImageFromUrl(task.id, recoverableSource, {
            prompt: task.prompt,
            model: task.model,
            generationSize: task.size,
            responseFormat: task.responseFormat,
            taskCreatedAt: task.createdAt,
          });


          if (active) {
            attachCachedImage(task.id, cached);
            await refreshCacheStats();
          }
        } catch (error) {
          console.warn("[openai-image-webui] Failed to restore image cache", error);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [attachCachedImage, refreshCacheStats]);

  const cacheGeneratedImage = useCallback(
    async (task: ImageTask, imageUrl: string, b64Json: string | undefined, signal: AbortSignal) => {
      const metadata = {
        prompt: task.prompt,
        model: task.model,
        generationSize: task.size,
        responseFormat: task.responseFormat,
        taskCreatedAt: task.createdAt,
      };

      // Try caching from the primary imageUrl first. If it fails (e.g. the
      // remote URL expired while the tab was in the background) and we have a
      // b64_json fallback, try again with the data URL.
      const urlsToTry = [imageUrl];

      if (b64Json && !imageUrl.startsWith("data:")) {
        urlsToTry.push(`data:image/png;base64,${b64Json}`);
      }

      let lastError: unknown;

      for (const url of urlsToTry) {
        try {
          const cached = await cacheImageFromUrl(task.id, url, metadata, signal);
          await refreshCacheStats();
          return {
            imageUrl: createObjectUrl(cached.blob),
            imageCached: true,
            imageMimeType: cached.mimeType,
            imageSize: cached.size,
          };
        } catch (error) {
          if (signal.aborted) {
            throw error;
          }

          lastError = error;
          console.warn("[openai-image-webui] Cache attempt failed for", url, error);
        }
      }

      console.warn("[openai-image-webui] Failed to cache generated image (all attempts)", lastError);
      return {
        imageUrl,
        imageCached: false,
        imageMimeType: undefined,
        imageSize: undefined,
      };
    },
    [createObjectUrl, refreshCacheStats],
  );

  const startTask = useCallback(
    (task: ImageTask) => {
      if (task.status !== "pending" || controllersRef.current.has(task.id)) {
        return;
      }

      const controller = new AbortController();
      controllersRef.current.set(task.id, controller);
      const startedAt = Date.now();

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id && item.status === "pending"
            ? {
                ...item,
                status: "running",
                startedAt,
                finishedAt: undefined,
                error: undefined,
                debug: undefined,
              }
            : item,
        ),
      );

      void (async () => {
        try {
          const currentSettings = settingsRef.current;
          const pendingInputs = pendingInputsRef.current.get(task.id);
          const shouldEdit = task.mode === "edit";

          if (shouldEdit && (!pendingInputs || pendingInputs.images.length === 0)) {
            throw new Error(
              "Edit task is missing its input images. They are only kept in memory; please re-upload and try again.",
            );
          }

          const result = shouldEdit
            ? await editImage({
                apiKey: currentSettings.apiKey,
                baseUrl: currentSettings.baseUrl,
                model: task.model,
                prompt: task.prompt,
                size: task.size,
                responseFormat: task.responseFormat,
                extraParams: task.extraParams,
                images: pendingInputs!.images,
                mask: pendingInputs!.mask,
                signal: controller.signal,
              })
            : await generateImage({
                apiKey: currentSettings.apiKey,
                baseUrl: currentSettings.baseUrl,
                model: task.model,
                prompt: task.prompt,
                size: task.size,
                responseFormat: task.responseFormat,
                extraParams: task.extraParams,
                signal: controller.signal,
              });
          const cachedImage = await cacheGeneratedImage(task, result.imageUrl, result.b64Json, controller.signal);


          setTasks((current) =>
            current.map((item) =>
              item.id === task.id
                ? {
                    ...item,
                    status: "success",
                    imageUrl: cachedImage.imageUrl,
                    // Keep b64Json around when caching failed — it serves as a
                    // fallback source for the visibilitychange recovery path.
                    b64Json: cachedImage.imageCached ? undefined : result.b64Json,
                    imageCached: cachedImage.imageCached,
                    imageMimeType: cachedImage.imageMimeType,
                    imageSize: cachedImage.imageSize,
                    raw: result.raw,
                    debug: result.debug,
                    error: undefined,
                    finishedAt: Date.now(),
                  }
                : item,
            ),
          );
        } catch (error) {
          const wasAborted = controller.signal.aborted;
          const debug = wasAborted ? undefined : getImageGenerationDebug(error);
          setTasks((current) =>
            current.map((item) =>
              item.id === task.id
                ? {
                    ...item,
                    status: wasAborted ? "cancelled" : "error",
                    error: wasAborted ? "tasks.messages.taskCancelled" : toFriendlyError(error),
                    debug,
                    finishedAt: Date.now(),
                  }
                : item,
            ),
          );
        } finally {
          controllersRef.current.delete(task.id);
          pendingInputsRef.current.delete(task.id);
        }
      })();
    },
    [cacheGeneratedImage],
  );

  useEffect(() => {
    const concurrency = normalizeConcurrency(settings.concurrency);
    const availableSlots = concurrency - controllersRef.current.size;

    if (availableSlots <= 0) {
      return;
    }

    tasks
      .filter((task) => task.status === "pending" && !controllersRef.current.has(task.id))
      .slice(0, availableSlots)
      .forEach(startTask);
  }, [settings.concurrency, startTask, tasks]);

  // When the user switches back to this tab, refresh cache stats and try to
  // recover any tasks that finished while the tab was in the background but
  // whose images could not be cached (e.g. because the remote URL expired
  // before the fetch completed, or IndexedDB was temporarily unavailable).
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") {
        return;
      }

      void refreshCacheStats();

      // Look for completed tasks whose images haven't been cached yet.
      // This includes tasks with blob: URLs (image is in memory but IndexedDB
      // write failed earlier), data: URLs, and remote URLs.
      for (const task of tasksRef.current) {
        if (task.status !== "success" || task.imageCached) {
          continue;
        }

        // Build a prioritized list of sources to try. Prefer b64Json (local,
        // never expires) over blob: URLs (in-memory, valid for this session)
        // over remote URLs (may have expired).
        const sources: string[] = [];

        if (task.b64Json) {
          sources.push(`data:image/png;base64,${task.b64Json}`);
        }

        if (task.imageUrl) {
          sources.push(task.imageUrl);
        }

        if (sources.length === 0) {
          continue;
        }

        void (async () => {
          for (const source of sources) {
            try {
              const cached = await cacheImageFromUrl(task.id, source, {
                prompt: task.prompt,
                model: task.model,
                generationSize: task.size,
                responseFormat: task.responseFormat,
                taskCreatedAt: task.createdAt,
              });

              attachCachedImage(task.id, cached);
              await refreshCacheStats();
              return; // success — stop trying
            } catch (error) {
              console.warn("[openai-image-webui] Visibility-change recovery attempt failed for task", task.id, source.slice(0, 60), error);
            }
          }
        })();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [attachCachedImage, refreshCacheStats]);

  useEffect(() => {
    return () => {
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
      pendingInputsRef.current.clear();
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  function addTasks(form: GenerateFormState, extraParams: Record<string, unknown>) {
    const count = Math.max(1, Math.floor(form.count || 1));
    const now = Date.now();
    const currentSettings = settingsRef.current;
    const model = currentSettings.model.trim();
    const compatibleRequest = buildCompatibleImageRequest({
      model,
      prompt: form.prompt,
      size: form.size,
      extraParams,
    });
    const inputImageFiles = form.inputImages.map((item) => item.file);
    const maskFile = form.maskImage?.file ?? null;
    const isEdit = inputImageFiles.length > 0;

    const newTasks: ImageTask[] = Array.from({ length: count }, (_, index) => {
      const id = createTaskId();
      if (isEdit) {
        pendingInputsRef.current.set(id, {
          images: inputImageFiles,
          mask: maskFile,
        });
      }
      return {
        id,
        mode: isEdit ? "edit" : "generate",
        prompt: compatibleRequest.prompt,
        model,
        size: compatibleRequest.size,
        responseFormat: currentSettings.responseFormat,
        status: "pending",
        createdAt: now + index,
        extraParams: compatibleRequest.extraParams,
        inputImageCount: isEdit ? inputImageFiles.length : undefined,
        hasMask: isEdit && maskFile ? true : undefined,
      };
    });

    setTasks((current) => [...current, ...newTasks]);
  }

  function retryTask(id: string) {
    if (controllersRef.current.has(id)) {
      return;
    }

    const currentTask = tasksRef.current.find((task) => task.id === id);
    revokeObjectUrl(currentTask?.imageUrl);
    void deleteCachedImage(id).then(refreshCacheStats).catch(() => undefined);

    // Edit tasks can only be retried if the input File blobs are still in
    // memory (i.e. the task was never successful and pendingInputs was kept).
    // Otherwise we mark it as error-with-message — the user needs to re-upload.
    if (currentTask?.mode === "edit" && !pendingInputsRef.current.has(id)) {
      setTasks((current) =>
        current.map((task) =>
          task.id === id
            ? {
                ...task,
                status: "error",
                error: "tasks.messages.editInputsDropped",
                imageUrl: undefined,
                b64Json: undefined,
                imageCached: false,
                imageMimeType: undefined,
                imageSize: undefined,
                raw: undefined,
                finishedAt: Date.now(),
              }
            : task,
        ),
      );
      return;
    }

    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              status: "pending",
              imageUrl: undefined,
              b64Json: undefined,
              imageCached: false,
              imageMimeType: undefined,
              imageSize: undefined,
              raw: undefined,
              debug: undefined,
              error: undefined,
              startedAt: undefined,
              finishedAt: undefined,
              createdAt: Date.now(),
            }
          : task,
      ),
    );
  }

  function cancelTask(id: string) {
    const controller = controllersRef.current.get(id);

    if (controller) {
      controller.abort();
      return;
    }

    setTasks((current) =>
      current.map((task) =>
        task.id === id && task.status === "pending"
          ? {
              ...task,
              status: "cancelled",
              error: "tasks.messages.taskCancelled",
              finishedAt: Date.now(),
            }
          : task,
      ),
    );
  }

  function removeTask(id: string) {
    const controller = controllersRef.current.get(id);
    const currentTask = tasksRef.current.find((task) => task.id === id);

    controller?.abort();
    controllersRef.current.delete(id);
    pendingInputsRef.current.delete(id);
    revokeObjectUrl(currentTask?.imageUrl);
    setTasks((current) => current.filter((task) => task.id !== id));

  }

  function clearTaskImage(id: string) {
    const currentTask = tasksRef.current.find((task) => task.id === id);
    revokeObjectUrl(currentTask?.imageUrl);
    void deleteCachedImage(id).then(refreshCacheStats).catch(() => undefined);

    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              imageUrl: undefined,
              b64Json: undefined,
              imageCached: false,
              imageMimeType: undefined,
              imageSize: undefined,
            }
          : task,
      ),
    );
  }

  function clearCachedImages() {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
    void clearImageCache().then(refreshCacheStats).catch(() => undefined);

    setTasks((current) =>
      current.map((task) =>
        task.imageCached || isBlobUrl(task.imageUrl) || isDataUrl(task.imageUrl)
          ? {
              ...task,
              imageUrl: undefined,
              b64Json: undefined,
              imageCached: false,
              imageMimeType: undefined,
              imageSize: undefined,
            }
          : task,
      ),
    );
  }

  function clearTasks() {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    pendingInputsRef.current.clear();
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
    setTasks([]);
  }


  return {
    tasks,
    cacheStats,
    addTasks,
    retryTask,
    cancelTask,
    removeTask,
    clearTaskImage,
    clearCachedImages,
    clearTasks,
  };
}
