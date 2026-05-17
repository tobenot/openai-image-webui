import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GenerationPanel } from "./components/GenerationPanel";
import { Header } from "./components/Header";
import { ImageLibrary } from "./components/ImageLibrary";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { Notice } from "./components/Notice";
import { SettingsPanel } from "./components/SettingsPanel";
import { TaskQueue } from "./components/TaskQueue";

import { useImageTasks } from "./hooks/useImageTasks";
import { useSettings } from "./hooks/useSettings";
import { toFriendlyError } from "./lib/errors";
import { parseAdvancedJson } from "./lib/parseAdvancedJson";
import { DEFAULT_FORM } from "./lib/storage";
import type { AppSettings, GenerateFormState, ImageTask, InputImageFile, ReuseParamsPayload } from "./types";

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

type WorkspacePanel = "tasks" | "library";

export default function App() {
  const { i18n, t } = useTranslation();
  const { settings, setSettings, resetSettings } = useSettings();
  const [form, setForm] = useState<GenerateFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<WorkspacePanel>("tasks");

  const {
    tasks,
    cacheStats,
    addTasks,
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

  function updateForm(next: Partial<GenerateFormState>) {
    setForm((current) => ({ ...current, ...next }));
  }

  function handleReuseParams(payload: ReuseParamsPayload) {
    // Update settings (model + responseFormat)
    setSettings({
      model: payload.model,
      responseFormat: payload.responseFormat,
    });

    // Update form (prompt + size + advancedJson + inputImages + maskImage)
    setForm({
      prompt: payload.prompt,
      count: 1,
      size: payload.size,
      advancedJson: payload.extraParams && Object.keys(payload.extraParams).length > 0
        ? JSON.stringify(payload.extraParams, null, 2)
        : "",
      inputImages: payload.inputImages ?? [],
      maskImage: payload.maskImage ?? null,
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
  }

  /** Build a ReuseParamsPayload from an ImageTask, checking in-memory inputs. */
  function buildReusePayloadFromTask(task: ImageTask): ReuseParamsPayload {
    const pending = getPendingInputs(task.id);
    const isEdit = task.mode === "edit";
    const hasInputs = isEdit && pending && pending.images.length > 0;

    // If the task was an edit but inputs are gone, mark them as lost
    const inputImagesLost = isEdit && !hasInputs;

    // Convert File blobs back to InputImageFile format for the form
    let inputImages: InputImageFile[] | undefined;
    let maskImage: InputImageFile | null | undefined;

    if (hasInputs && pending) {
      inputImages = pending.images.map((file) => ({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        width: 0,
        height: 0,
      }));
      maskImage = pending.mask
        ? {
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file: pending.mask,
            previewUrl: URL.createObjectURL(pending.mask),
            width: 0,
            height: 0,
          }
        : null;
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e0f2fe,_transparent_34rem),linear-gradient(135deg,_#f8fafc,_#eef2ff)] px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <Header taskCount={tasks.length} onClearTasks={clearTasks} />

        <main className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-6">
            <SettingsPanel settings={settings} onChange={setSettings} onReset={resetSettings} />
            <Notice>{t("notice.cors")}</Notice>
          </aside>

          <div className="space-y-6">
            <GenerationPanel form={form} error={formError} model={settings.model} onChange={updateForm} onSubmit={handleGenerate} />
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
