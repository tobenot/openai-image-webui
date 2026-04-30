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
import type { AppSettings, GenerateFormState } from "./types";

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
  } = useImageTasks(settings);


  const closePreview = useCallback(() => setPreviewUrl(null), []);

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
            <GenerationPanel form={form} error={formError} onChange={updateForm} onSubmit={handleGenerate} />
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
              />
            ) : (
              <ImageLibrary
                stats={cacheStats}
                onPreview={setPreviewUrl}
                onDeleteImage={clearTaskImage}
                onClearImageCache={clearCachedImages}
              />
            )}


          </div>
        </main>
      </div>

      <ImagePreviewModal imageUrl={previewUrl} onClose={closePreview} />
    </div>
  );
}
