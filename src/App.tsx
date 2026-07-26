import { useCallback, useEffect, useState, type ReactNode } from "react";
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


import { useImageTasks } from "./hooks/useImageTasks";
import { useSettings } from "./hooks/useSettings";
import { toFriendlyError } from "./lib/errors";
import { parseAdvancedJson } from "./lib/parseAdvancedJson";
import { stripGeminiSizeArtifacts } from "./lib/imageSizing";
import { DEFAULT_BATCH_FORM, DEFAULT_FORM, DEFAULT_VISION_FORM, loadBatchPrompts, saveBatchPrompts } from "./lib/storage";
import { createBatchId, parsePromptList } from "./lib/promptList";
import { downloadBatchZip, getTaskBatchId } from "./lib/batchExport";
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

const MODE_ICONS: Record<WorkspaceMode, ReactNode> = {
  generate: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7L19 15z" />
    </svg>
  ),
  vision: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  batch: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  rename: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
};

/** Build an {@link InputImageFile} from a File with a fresh object URL. */
function makeInputImageFile(file: File, width = 0, height = 0): InputImageFile {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    width,
    height,
  };
}

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

  const activeTaskCount = tasks.filter(
    (task) => task.status === "pending" || task.status === "running",
  ).length;

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

  function updateForm(next: Partial<GenerateFormState>) {
    setForm((current) => ({ ...current, ...next }));
  }

  function updateVisionForm(next: Partial<VisionFormState>) {
    setVisionForm((current) => ({ ...current, ...next }));
  }

  function updateBatchForm(next: Partial<BatchFormState>) {
    setBatchForm((current) => {
      const merged = { ...current, ...next };
      if (typeof next.promptsText === "string") {
        saveBatchPrompts(next.promptsText);
      }
      return merged;
    });
  }

  function handleReuseParams(payload: ReuseParamsPayload) {
    // Gemini models store auto-derived aspect_ratio / image_size in
    // extraParams and an auto-appended "--ar X:Y" in the prompt. Restoring
    // them verbatim locks the size — subsequent form.size changes get
    // ignored by buildCompatibleImageRequest (the "改尺寸都无效" bug). Strip
    // them here so form.size stays the single source of truth. No-op for
    // non-Gemini models.
    const { prompt: cleanPrompt, extraParams: cleanExtra } = stripGeminiSizeArtifacts(
      payload.model,
      payload.prompt,
      payload.size,
      payload.extraParams,
    );

    console.log("[reuseParams] handleReuseParams", {
      model: payload.model,
      inputImageCount: payload.inputImages?.length ?? 0,
      hasMask: !!payload.maskImage,
      inputImagesLost: payload.inputImagesLost,
      strippedGeminiArtifacts: cleanPrompt !== payload.prompt || cleanExtra !== payload.extraParams,
    });

    // Update settings (model + responseFormat)
    setSettings({
      model: payload.model,
      responseFormat: payload.responseFormat,
    });

    // Update form (prompt + size + advancedJson + inputImages + maskImage)
    setForm({
      prompt: cleanPrompt,
      count: 1,
      size: payload.size,
      advancedJson: cleanExtra && Object.keys(cleanExtra).length > 0
        ? JSON.stringify(cleanExtra, null, 2)
        : "",
      inputImages: payload.inputImages ?? [],
      maskImage: payload.maskImage ?? null,
    });

    // Switch back to the generate workspace so the applied params are
    // actually visible — the form lives behind the mode switch.
    setActiveMode("generate");
    setActivePanel("tasks");
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Show toast
    if (payload.inputImagesLost) {
      setToast(t("tasks.messages.paramsAppliedInputsLost"));
    } else {
      setToast(t("tasks.messages.paramsApplied"));
    }
  }

  /** Build a ReuseParamsPayload from an ImageTask, checking in-memory inputs. */
  function buildReusePayloadFromTask(task: ImageTask): ReuseParamsPayload {
    const pending = getPendingInputs(task.id);
    const isEdit = task.mode === "edit";
    const hasInputs = isEdit && pending && pending.images.length > 0;

    // The generate and batch forms both keep their inputImages after a
    // successful submit (so the user can tweak & re-submit). The in-memory
    // File blobs held in pendingInputs are released once the task succeeds,
    // so when reusing an edit task whose blobs are gone, fall back to the
    // form that originally supplied the images before declaring them "lost".
    // Batch tasks were created from the batch form; single edits from the
    // generate form. In the common "just uploaded, just generated, now
    // reuse" flow the images are still right there - no reason to tell the
    // user they're gone.
    const isBatchTask = !!getTaskBatchId(task);
    const fallbackSource = isBatchTask ? batchForm.inputImages : form.inputImages;
    const fallbackAvailable = isEdit && !hasInputs && fallbackSource.length > 0;

    // Only truly lost when there are neither in-memory inputs nor a form
    // fallback.
    const inputImagesLost = isEdit && !hasInputs && !fallbackAvailable;

    console.log("[reuseParams] buildReusePayloadFromTask", {
      taskId: task.id,
      taskMode: task.mode,
      taskStatus: task.status,
      hasPendingInputs: !!pending,
      pendingImageCount: pending?.images.length ?? 0,
      isBatchTask,
      fallbackImageCount: fallbackSource.length,
      hasFormMask: !!form.maskImage,
      hasInputs,
      fallbackAvailable,
      inputImagesLost,
    });

    // Convert File blobs back to InputImageFile format for the form
    let inputImages: InputImageFile[] | undefined;
    let maskImage: InputImageFile | null | undefined;

    if (hasInputs && pending) {
      inputImages = pending.images.map((file: File) => makeInputImageFile(file));
      maskImage = pending.mask ? makeInputImageFile(pending.mask) : null;
    } else if (fallbackAvailable) {
      if (isBatchTask) {
        // The batch form's images are about to move into the generate form.
        // Clone them with fresh object URLs so they don't share previewUrl
        // lifetime with the batch form - revoking one when removed from the
        // generate form must not break the batch form's copy.
        inputImages = fallbackSource.map((item) =>
          makeInputImageFile(item.file, item.width, item.height),
        );
        maskImage = null; // batch tasks never carry a mask
      } else {
        // Reuse the generate form's existing InputImageFile entries as-is -
        // their previewUrls are already valid, and they stay in the same
        // form, so no need to mint new object URLs (which would also leak
        // the old ones).
        inputImages = form.inputImages;
        maskImage = form.maskImage;
      }
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
  }

  function handleGenerate() {
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
  }

  function handleAnalyzeImages() {
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
  }

  function handleBatchGenerate() {
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
  }

  function handleRetryBatchErrors() {
    if (!currentBatchId) return;
    const restoreFiles = batchForm.inputImages.map((item) => item.file);
    retryBatchErrors(currentBatchId, restoreFiles.length > 0 ? restoreFiles : undefined);
  }

  async function handleExportBatch() {
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
  }

  return (

    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e0f2fe,_transparent_34rem),linear-gradient(135deg,_#f8fafc,_#eef2ff)] px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <Header taskCount={tasks.length} onClearTasks={clearTasks} />

        <main className="grid gap-6 grid-cols-1 lg:grid-cols-[380px_1fr] items-start">
          {/* LEFT COLUMN: SUPER CONTROL CENTER (STICKY ON DESKTOP) */}
          <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2 space-y-6">
            <SettingsPanel settings={settings} onChange={setSettings} onReset={resetSettings} />

            {/* Workspace Mode Selection */}
            <nav aria-label={t("workspace.modes.generate")} className="grid grid-cols-2 gap-2">
              {(["generate", "vision", "batch", "rename"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={activeMode === mode}
                  className={`rounded-2xl border p-3 text-left transition ${
                    activeMode === mode
                      ? "border-slate-950 bg-slate-950 text-white shadow-soft"
                      : "border-white/70 bg-white/75 text-slate-600 backdrop-blur hover:border-slate-300 hover:bg-white hover:text-slate-900"
                  }`}
                  onClick={() => setActiveMode(mode)}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {MODE_ICONS[mode]}
                    {t(`workspace.modes.${mode}`)}
                  </span>
                  <span
                    className={`mt-1 block text-[11px] leading-4 ${
                      activeMode === mode ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    {t(`workspace.modeDescriptions.${mode}`)}
                  </span>
                </button>
              ))}
            </nav>

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
                onExportBatch={() => void handleExportBatch()}
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
                {(["tasks", "library"] as const).map((panel) => {
                  const badge = panel === "tasks" ? activeTaskCount : cacheStats.count;
                  return (
                    <button
                      key={panel}
                      type="button"
                      aria-pressed={activePanel === panel}
                      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        activePanel === panel
                          ? "bg-slate-950 text-white shadow-sm"
                          : "text-slate-500 hover:bg-white hover:text-slate-900"
                      }`}
                      onClick={() => setActivePanel(panel)}
                    >
                      {t(`workspace.tabs.${panel}`)}
                      {badge > 0 ? (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                            activePanel === panel
                              ? "bg-white/20 text-white"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
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
                onReuseParams={(task) => handleReuseParams(buildReusePayloadFromTask(task))}
              />
            ) : (
              <ImageLibrary
                stats={cacheStats}
                onPreview={setPreviewUrl}
                onDeleteImage={clearTaskImage}
                onClearImageCache={clearCachedImages}
                onReuseParams={(payload) => handleReuseParams(payload)}
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
