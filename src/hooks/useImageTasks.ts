import { useCallback, useEffect, useRef, useState } from "react";
import { generateImage } from "../api/openaiImages";
import { toFriendlyError } from "../lib/errors";
import { loadTasks, saveTasks } from "../lib/storage";
import type { AppSettings, GenerateFormState, ImageTask } from "../types";

function createTaskId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeConcurrency(value: number) {
  return Math.max(1, Math.floor(Number.isFinite(value) ? value : 1));
}

export function useImageTasks(settings: AppSettings) {
  const [tasks, setTasks] = useState<ImageTask[]>(() => loadTasks());
  const settingsRef = useRef(settings);
  const controllersRef = useRef(new Map<string, AbortController>());

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const startTask = useCallback((task: ImageTask) => {
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
            }
          : item,
      ),
    );

    void (async () => {
      try {
        const currentSettings = settingsRef.current;
        const result = await generateImage({
          apiKey: currentSettings.apiKey,
          baseUrl: currentSettings.baseUrl,
          model: task.model,
          prompt: task.prompt,
          size: task.size,
          responseFormat: task.responseFormat,
          extraParams: task.extraParams,
          signal: controller.signal,
        });

        setTasks((current) =>
          current.map((item) =>
            item.id === task.id
              ? {
                  ...item,
                  status: "success",
                  imageUrl: result.imageUrl,
                  b64Json: result.b64Json,
                  raw: result.raw,
                  error: undefined,
                  finishedAt: Date.now(),
                }
              : item,
          ),
        );
      } catch (error) {
        const wasAborted = controller.signal.aborted;
        setTasks((current) =>
          current.map((item) =>
            item.id === task.id
              ? {
                  ...item,
                  status: wasAborted ? "cancelled" : "error",
                  error: wasAborted ? "Task cancelled." : toFriendlyError(error),
                  finishedAt: Date.now(),
                }
              : item,
          ),
        );
      } finally {
        controllersRef.current.delete(task.id);
      }
    })();
  }, []);

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

  useEffect(() => {
    return () => {
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
    };
  }, []);

  function addTasks(form: GenerateFormState, extraParams: Record<string, unknown>) {
    const count = Math.max(1, Math.floor(form.count || 1));
    const now = Date.now();
    const currentSettings = settingsRef.current;
    const newTasks: ImageTask[] = Array.from({ length: count }, (_, index) => ({
      id: createTaskId(),
      prompt: form.prompt.trim(),
      model: currentSettings.model.trim(),
      size: form.size.trim(),
      responseFormat: currentSettings.responseFormat,
      status: "pending",
      createdAt: now + index,
      extraParams,
    }));

    setTasks((current) => [...current, ...newTasks]);
  }

  function retryTask(id: string) {
    if (controllersRef.current.has(id)) {
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
              raw: undefined,
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
              error: "Task cancelled.",
              finishedAt: Date.now(),
            }
          : task,
      ),
    );
  }

  function removeTask(id: string) {
    const controller = controllersRef.current.get(id);
    controller?.abort();
    controllersRef.current.delete(id);
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  function clearTasks() {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    setTasks([]);
  }

  return {
    tasks,
    addTasks,
    retryTask,
    cancelTask,
    removeTask,
    clearTasks,
  };
}
