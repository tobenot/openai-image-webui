import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GenerationPanel } from "./components/GenerationPanel";
import { Header } from "./components/Header";
import { ImageLibrary } from "./components/ImageLibrary";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { Notice } from "./components/Notice";
import { SettingsPanel } from "./components/SettingsPanel";
import { TaskQueue } from "./components/TaskQueue";
import { VisionPanel } from "./components/VisionPanel";
import { BatchRenamePanel } from "./components/BatchRenamePanel";
import { BatchGenerationPanel } from "./components/BatchGenerationPanel";
import { StorageHealthBanner } from "./components/StorageHealthBanner";


import { useImageTasks } from "./hooks/useImageTasks";
import { useSettings } from "./hooks/useSettings";
import { toFriendlyError } from "./lib/errors";
import { parseAdvancedJson } from "./lib/parseAdvancedJson";
import { DEFAULT_BATCH_FORM, DEFAULT_FORM, DEFAULT_VISION_FORM, loadBatchPrompts, saveBatchPrompts } from "./lib/storage";
import { toInputImageFile } from "./lib/imageInput";
import { createBatchId, parsePromptList } from "./lib/promptList";
import { downloadBatchZip } from "./lib/batchExport";
import type { AppSettings, BatchFormState, GenerateFormState, ImageTask, InputImageFile, ReuseParamsPayload, VisionFormState } from "./types";


function validateRequest(
  settings: AppSettings,
  form: GenerateFormState,
  messages: {
    apiKeyRequired: string;
    apiBaseUrlRequired: string;
    modelRequired: string;
    promptRequired: string;
  },
) {
  if (!settings.apiKey.trim()) {
    throw new Error(messages.apiKeyRequired);
  }

  if (!settings.baseUrl.trim()) {
    throw new Error(messages.apiBaseUrlRequired);
  }

  if (!settings.model.trim()) {
    throw new Error(messages.modelRequired);
  }

  if (!form.prompt.trim()) {
    throw new Error(messages.promptRequired);
  }
}

function normalizeForm(form: GenerateFormState): GenerateFormState {
  return {
    ...form,
    prompt: form.prompt.trim(),
    count: Math.max(1, Math.floor(Number.isFinite(form.count) ? form.count : 1)),
    size: form.size.trim() || "1024x1024",
  };
}

function validateVisionRequest(
  settings: AppSettings,
  form: VisionFormState,
  messages: {
    apiKeyRequired: string;
    apiBaseUrlRequired: string;
    visionModelRequired: string;
    promptRequired: string;
    imageRequired: string;
  },
) {
  if (!settings.apiKey.trim()) {
    throw new Error(messages.apiKeyRequired);
  }

  if (!settings.baseUrl.trim()) {
    throw new Error(messages.apiBaseUrlRequired);
  }

  if (!settings.visionModel.trim()) {
    throw new Error(messages.visionModelRequired);
  }

  if (!form.prompt.trim()) {
    throw new Error(messages.promptRequired);
  }

  if (form.inputImages.length === 0) {
    throw new Error(messages.imageRequired);
  }
}

type WorkspacePanel = "tasks" | "library";
type WorkspaceMode = "generate" | "vision" | "rename" | "batch";

export default function App() {
  const { i18n, t } = useTranslation();
  const { settings, setSettings, resetSettings } = useSettings();
  const [form, setForm] = useState<GenerateFormState>(DEFAULT_FORM);
  const [visionForm, setVisionForm] = useState<VisionFormState>(DEFAULT_VISION_FORM);
  const [batchForm, setBatchForm] = useState<BatchFormState>(() => ({
    ...DEFAULT_BATCH_FORM,
    promptsText: loadBatchPrompts(),
  }));
  const [formError, setFormError] = useState("");
  const [visionError, setVisionError] = useState("");
  const [batchError, setBatchError] = useState("");
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("openai-image-webui:current-batch-id");
    } catch {
      return null;
    }
  });
  const [isExportingBatch, setIsExportingBatch] = useState(false);

  useEffect(() => {
    try {
      if (currentBatchId) {
        localStorage.setItem("openai-image-webui:current-batch-id", currentBatchId);
      } else {
        localStorage.removeItem("openai-image-webui:current-batch-id");
      }
    } catch {
      // Ignore localStorage failures.
    }
  }, [currentBatchId]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<WorkspacePanel>("tasks");
  const [activeMode, setActiveMode] = useState<WorkspaceMode>("generate");

  const {
    tasks,
    cacheStats,
    addTasks,
    addVisionTask,
    addBatchTasks,
    retryBatchErrors,
    retryTask,

    cancelTask,
    removeTask,
    clearTaskImage,
    clearCachedImages,
    clearTasks,
    getPendingInputs,
  } = useImageTasks(settings);

  const [toast, setToast] = useState<string>("");

  const closePreview = useCallback(() => setPreviewUrl(null), []);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const language = i18n.resolvedLanguage?.startsWith("zh") ? "zh-CN" : "en";
    document.documentElement.lang = language;
    document.title = t("meta.title");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t("meta.description"));
  }, [i18n.resolvedLanguage, t]);

  // These are passed to memo()-wrapped panels, so they must be stable —
  // otherwise every App render defeats the memoization entirely.
  const updateForm = useCallback((next: Partial<GenerateFormState>) => {
    setForm((current) => ({ ...current, ...next }));
  }, []);

  const updateVisionForm = useCallback((next: Partial<VisionFormState>) => {
    setVisionForm((current) => ({ ...current, ...next }));
  }, []);

  const updateBatchForm = useCallback((next: Partial<BatchFormState>) => {
    setBatchForm((current) => {
      const merged = { ...current, ...next };
      if (typeof next.promptsText === "string") {
        saveBatchPrompts(next.promptsText);
      }
      return merged;
    });
  }, []);

  const handleReuseParams = useCallback((payload: ReuseParamsPayload) => {

    // Update settings (model + responseFormat)
    setSettings({
      model: payload.model,
      responseFormat: payload.responseFormat,
    });

    // Update form (prompt + size + advancedJson + inputImages + maskImage).
    // The functional form lets us revoke the object URLs of the images we are
    // replacing — otherwise repeated "reuse params" leaks a blob every time.
    setForm((current) => {
      const nextImages = payload.inputImages ?? [];
      const nextMask = payload.maskImage ?? null;
      const keptUrls = new Set(nextImages.map((image) => image.previewUrl));

      if (nextMask) {
        keptUrls.add(nextMask.previewUrl);
      }

      for (const image of current.inputImages) {
        if (!keptUrls.has(image.previewUrl)) {
          URL.revokeObjectURL(image.previewUrl);
        }
      }

      if (current.maskImage && !keptUrls.has(current.maskImage.previewUrl)) {
        URL.revokeObjectURL(current.maskImage.previewUrl);
      }

      return {
        prompt: payload.prompt,
        count: 1,
        size: payload.size,
        advancedJson: payload.extraParams && Object.keys(payload.extraParams).length > 0
          ? JSON.stringify(payload.extraParams, null, 2)
          : "",
        inputImages: nextImages,
        maskImage: nextMask,
      };
    });

    // Switch to tasks panel so the user can see the form
    setActivePanel("tasks");
    setFormError("");

    // Show toast
    if (payload.inputImagesLost) {
      setToast(t("tasks.messages.paramsAppliedInputsLost"));
    } else {
      setToast(t("tasks.messages.paramsApplied"));
    }
  }, [setSettings, t]);

  /**
   * Build a ReuseParamsPayload from an ImageTask, checking in-memory inputs.
   * Async because recovered File blobs need decoding to recover their real
   * dimensions — GenerationPanel uses those for the native-resolution button
   * and for mask size validation.
   */
  const buildReusePayloadFromTask = useCallback(async (task: ImageTask): Promise<ReuseParamsPayload> => {
    const pending = getPendingInputs(task.id);
    const isEdit = task.mode === "edit";
    const hasInputs = isEdit && pending && pending.images.length > 0;

    // If the task was an edit but inputs are gone, mark them as lost
    const inputImagesLost = isEdit && !hasInputs;

    let inputImages: InputImageFile[] | undefined;
    let maskImage: InputImageFile | null | undefined;

    if (hasInputs && pending) {
      inputImages = await Promise.all(pending.images.map((file: File) => toInputImageFile(file)));
      maskImage = pending.mask ? await toInputImageFile(pending.mask) : null;
    }

    return {
      model: task.model,
      prompt: task.prompt,
      size: task.size,
      responseFormat: task.responseFormat,
      extraParams: task.extraParams,
      inputImages,
      maskImage,
      inputImagesLost,
    };
  }, [getPendingInputs]);

  const handleReuseTask = useCallback(
    (task: ImageTask) => {
      void buildReusePayloadFromTask(task).then(handleReuseParams);
    },
    [buildReusePayloadFromTask, handleReuseParams],
  );

  const handleGenerate = useCallback(() => {
    setFormError("");

    try {
      const normalizedForm = normalizeForm(form);
      validateRequest(settings, normalizedForm, {
        apiKeyRequired: t("errors.apiKeyRequired"),
        apiBaseUrlRequired: t("errors.apiBaseUrlRequired"),
        modelRequired: t("errors.modelRequired"),
        promptRequired: t("errors.promptRequired"),
      });
      const extraParams = parseAdvancedJson(normalizedForm.advancedJson, {
        invalidJson: t("errors.advancedJsonInvalid"),
        mustBeObject: t("errors.advancedJsonObject"),
      });
      addTasks(normalizedForm, extraParams);
      setActivePanel("tasks");
      // Keep inputImages/maskImage in the form — user may want to tweak the
      // prompt and re-submit. Revoking their object URLs here would break
      // the in-flight task's preview data too. They get cleared when the
      // user explicitly removes them.
      setForm((current) => ({ ...current, count: normalizedForm.count, size: normalizedForm.size }));

    } catch (error) {
      setFormError(
        toFriendlyError(error, {
          unknown: t("errors.unknown"),
          requestFailed: t("errors.requestFailed"),
        }),
      );
    }
  }, [addTasks, form, settings, t]);

  const handleAnalyzeImages = useCallback(() => {
    setVisionError("");

    try {
      const normalizedForm = {
        ...visionForm,
        prompt: visionForm.prompt.trim(),
      };
      validateVisionRequest(settings, normalizedForm, {
        apiKeyRequired: t("errors.apiKeyRequired"),
        apiBaseUrlRequired: t("errors.apiBaseUrlRequired"),
        visionModelRequired: t("errors.visionModelRequired"),
        promptRequired: t("errors.promptRequired"),
        imageRequired: t("errors.visionImageRequired"),
      });
      const extraParams = parseAdvancedJson(normalizedForm.advancedJson, {
        invalidJson: t("errors.advancedJsonInvalid"),
        mustBeObject: t("errors.advancedJsonObject"),
      });
      addVisionTask(normalizedForm, extraParams);
      setActivePanel("tasks");
      setVisionForm((current) => ({ ...current, prompt: normalizedForm.prompt }));
    } catch (error) {
      setVisionError(
        toFriendlyError(error, {
          unknown: t("errors.unknown"),
          requestFailed: t("errors.requestFailed"),
        }),
      );
    }
  }, [addVisionTask, settings, t, visionForm]);

  const handleBatchGenerate = useCallback(() => {
    setBatchError("");

    try {
      if (!settings.apiKey.trim()) throw new Error(t("errors.apiKeyRequired"));
      if (!settings.baseUrl.trim()) throw new Error(t("errors.apiBaseUrlRequired"));
      if (!settings.model.trim()) throw new Error(t("errors.modelRequired"));

      const parsed = parsePromptList(batchForm.promptsText);
      if (parsed.prompts.length === 0) {
        throw new Error(t("errors.batchPromptsRequired"));
      }

      const extraParams = parseAdvancedJson(batchForm.advancedJson, {
        invalidJson: t("errors.advancedJsonInvalid"),
        mustBeObject: t("errors.advancedJsonObject"),
      });

      const batchId = createBatchId();
      addBatchTasks({
        prompts: parsed.prompts,
        inputImages: batchForm.inputImages,
        size: batchForm.size.trim() || "1024x1024",
        countPerPrompt: Math.max(1, Math.floor(batchForm.countPerPrompt || 1)),
        extraParams,
        batchId,
      });
      setCurrentBatchId(batchId);
      setActivePanel("tasks");
    } catch (error) {
      setBatchError(
        toFriendlyError(error, {
          unknown: t("errors.unknown"),
          requestFailed: t("errors.requestFailed"),
        }),
      );
    }
  }, [addBatchTasks, batchForm, settings, t]);

  const handleRetryBatchErrors = useCallback(() => {
    if (!currentBatchId) return;
    const restoreFiles = batchForm.inputImages.map((item) => item.file);
    retryBatchErrors(currentBatchId, restoreFiles.length > 0 ? restoreFiles : undefined);
  }, [batchForm.inputImages, currentBatchId, retryBatchErrors]);

  const handleExportBatch = useCallback(async () => {
    if (!currentBatchId) return;
    setIsExportingBatch(true);
    try {
      const result = await downloadBatchZip(tasks, currentBatchId);
      setToast(t("batch.actions.exportDone", { exported: result.exported, missing: result.missing }));
    } catch (error) {
      setBatchError(
        toFriendlyError(error, {
          unknown: t("errors.unknown"),
          requestFailed: t("errors.requestFailed"),
        }),
      );
    } finally {
      setIsExportingBatch(false);
    }
  }, [currentBatchId, t, tasks]);

  const handleExportBatchClick = useCallback(() => {
    void handleExportBatch();
  }, [handleExportBatch]);

  return (

    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e0f2fe,_transparent_34rem),linear-gradient(135deg,_#f8fafc,_#eef2ff)] px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <Header taskCount={tasks.length} onClearTasks={clearTasks} />

        <StorageHealthBanner />

        <main className="grid gap-6 grid-cols-1 lg:grid-cols-[380px_1fr] items-start">
          {/* LEFT COLUMN: SUPER CONTROL CENTER (STICKY ON DESKTOP) */}
          <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2 space-y-6">
            <SettingsPanel settings={settings} onChange={setSettings} onReset={resetSettings} />

            {/* Workspace Mode Selection (Tabs) */}
            <div className="rounded-2xl border border-white/70 bg-white/75 p-1 shadow-sm backdrop-blur">
              <div className="grid grid-cols-4 gap-1">
                {(["generate", "vision", "batch", "rename"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`rounded-xl px-2 py-2 text-xs font-semibold transition truncate ${
                      activeMode === mode
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-500 hover:bg-white hover:text-slate-900"
                    }`}
                    onClick={() => setActiveMode(mode)}
                  >
                    {t(`workspace.modes.${mode}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Input Panel */}
            {activeMode === "generate" ? (
              <GenerationPanel form={form} error={formError} model={settings.model} onChange={updateForm} onSubmit={handleGenerate} />
            ) : activeMode === "vision" ? (
              <VisionPanel form={visionForm} error={visionError} visionModel={settings.visionModel} onChange={updateVisionForm} onSubmit={handleAnalyzeImages} />
            ) : activeMode === "batch" ? (
              <BatchGenerationPanel
                form={batchForm}
                error={batchError}
                model={settings.model}
                tasks={tasks}
                currentBatchId={currentBatchId}
                isExporting={isExportingBatch}
                onChange={updateBatchForm}
                onSubmit={handleBatchGenerate}
                onRetryBatchErrors={handleRetryBatchErrors}
                onExportBatch={handleExportBatchClick}
              />
            ) : (
              <BatchRenamePanel settings={settings} />
            )}

            <Notice>{t("notice.cors")}</Notice>
          </aside>

          {/* RIGHT COLUMN: PURE GALLERY / OUTPUT PANEL */}
          <div className="space-y-6">
            {/* Viewport Select Tab (Tasks vs Library) */}
            <div className="rounded-2xl border border-white/70 bg-white/75 p-1 shadow-sm backdrop-blur">
              <div className="grid grid-cols-2 gap-1">
                {(["tasks", "library"] as const).map((panel) => (
                  <button
                    key={panel}
                    type="button"
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      activePanel === panel
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-500 hover:bg-white hover:text-slate-900"
                    }`}
                    onClick={() => setActivePanel(panel)}
                  >
                    {t(`workspace.tabs.${panel}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Output Area (Tasks or Library Grid) */}
            {activePanel === "tasks" ? (
              <TaskQueue
                tasks={tasks}
                onPreview={setPreviewUrl}
                onRetry={retryTask}
                onCancel={cancelTask}
                onRemove={removeTask}
                onClearTaskImage={clearTaskImage}
                onReuseParams={handleReuseTask}
              />
            ) : (
              <ImageLibrary
                stats={cacheStats}
                onPreview={setPreviewUrl}
                onDeleteImage={clearTaskImage}
                onReuseParams={handleReuseParams}
                onClearImageCache={clearCachedImages}
              />
            )}
          </div>
        </main>
      </div>

      <ImagePreviewModal imageUrl={previewUrl} onClose={closePreview} />

      {/* Toast notification */}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700 shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
