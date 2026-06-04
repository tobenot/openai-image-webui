import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { BatchFormState, ImageTask, InputImageFile } from "../types";
import {
  InputImageError,
  modelLikelySupportsMultipleImages,
  modelRequiresStrictPng,
  prepareInputImage,
} from "../lib/imageInput";
import { parsePromptList, readPromptListFile } from "../lib/promptList";
import { batchProgress, tasksOfBatch } from "../lib/batchExport";
import { Notice } from "./Notice";

interface BatchGenerationPanelProps {
  form: BatchFormState;
  error: string;
  model?: string;
  tasks: ImageTask[];
  currentBatchId: string | null;
  isExporting?: boolean;
  onChange: (next: Partial<BatchFormState>) => void;
  onSubmit: () => void;
  onRetryBatchErrors: () => void;
  onExportBatch: () => void;
}

const COMMON_SIZES = ["512x512", "1024x1024", "1024x1536", "1536x1024", "1024x1792", "1792x1024"];
const PROMPT_FILE_ACCEPT = ".txt,.md,.csv,text/plain,text/markdown,text/csv";

export function BatchGenerationPanel({
  form,
  error,
  model,
  tasks,
  currentBatchId,
  isExporting,
  onChange,
  onSubmit,
  onRetryBatchErrors,
  onExportBatch,
}: BatchGenerationPanelProps) {
  const { t } = useTranslation();
  const [inputImageError, setInputImageError] = useState("");
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const promptFileInputRef = useRef<HTMLInputElement>(null);

  const strictPng = modelRequiresStrictPng(model ?? "");
  const supportsMultiImage = modelLikelySupportsMultipleImages(model ?? "");
  const isEditMode = form.inputImages.length > 0;

  const parsed = useMemo(() => parsePromptList(form.promptsText), [form.promptsText]);
  const totalTasksToCreate = parsed.prompts.length * Math.max(1, Math.floor(form.countPerPrompt || 1));

  const progress = useMemo(
    () => (currentBatchId ? batchProgress(tasks, currentBatchId) : null),
    [tasks, currentBatchId],
  );
  const batchTasks = useMemo(
    () => (currentBatchId ? tasksOfBatch(tasks, currentBatchId) : []),
    [tasks, currentBatchId],
  );
  const successCount = progress?.success ?? 0;
  const errorCount = progress?.error ?? 0;
  const finishedCount = progress
    ? progress.success + progress.error + progress.cancelled
    : 0;
  const percent =
    progress && progress.total > 0
      ? Math.round((finishedCount / progress.total) * 100)
      : 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  async function handleAddInputImages(files: FileList | File[]) {
    setInputImageError("");
    const list = Array.from(files);
    const prepared: InputImageFile[] = [];
    for (const file of list) {
      try {
        const item = await prepareInputImage(file, { strictPngOnly: strictPng });
        prepared.push(item);
      } catch (err) {
        const reason = err instanceof InputImageError ? err.message : String(err);
        setInputImageError(t("batch.inputImages.title") + ": " + reason);
        prepared.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return;
      }
    }
    if (prepared.length === 0) return;
    onChange({ inputImages: [...form.inputImages, ...prepared] });
  }

  function removeInputImage(id: string) {
    const next = form.inputImages.filter((item) => {
      if (item.id === id) {
        URL.revokeObjectURL(item.previewUrl);
        return false;
      }
      return true;
    });
    onChange({ inputImages: next });
  }

  function onImageInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      void handleAddInputImages(event.target.files);
    }
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      void handleAddInputImages(files);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  async function handlePromptFileImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await readPromptListFile(file);
      onChange({ promptsText: text });
    } catch (err) {
      setInputImageError(
        t("batch.prompts.importFailed", { reason: err instanceof Error ? err.message : String(err) }),
      );
    }
  }

  const acceptMime = strictPng ? "image/png" : "image/png,image/jpeg,image/webp";
  const showMultiImageWarning =
    form.inputImages.length > 1 && !!model && !supportsMultiImage;

  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950">{t("batch.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("batch.subtitle")}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Prompt list */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">{t("batch.prompts.title")}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-400 hover:text-sky-600"
                onClick={() => promptFileInputRef.current?.click()}
              >
                {t("batch.prompts.importButton")}
              </button>
              <input
                ref={promptFileInputRef}
                type="file"
                accept={PROMPT_FILE_ACCEPT}
                hidden
                onChange={handlePromptFileImport}
              />
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-rose-400 hover:text-rose-600 disabled:cursor-not-allowed disabled:text-slate-300"
                onClick={() => onChange({ promptsText: "" })}
                disabled={!form.promptsText}
              >
                {t("batch.prompts.clearButton")}
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">{t("batch.prompts.hint")}</p>
          <textarea
            className="mt-2 min-h-40 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder={t("batch.prompts.placeholder")}
            value={form.promptsText}
            onChange={(event) => onChange({ promptsText: event.target.value })}
          />
          <p className="mt-2 text-xs text-slate-500">
            {t("batch.prompts.parsedSummary", {
              count: parsed.prompts.length,
              comments: parsed.commentLines,
              empty: parsed.emptyLines,
            })}
          </p>
        </div>

        {/* Shared reference images (optional) */}
        <div
          className={`rounded-xl border p-3 transition ${
            isEditMode ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 bg-slate-50/70"
          }`}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600">{t("batch.inputImages.title")}</p>
            {isEditMode ? (
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                {t("batch.inputImages.editModeBadge")}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">{t("batch.inputImages.hint")}</p>

          <div className="mt-2 flex flex-wrap gap-2">
            {form.inputImages.map((item) => (
              <div
                key={item.id}
                className="group relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-white"
                title={`${item.file.name} · ${item.width}×${item.height}`}
              >
                <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-0 top-0 rounded-bl-lg bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100"
                  onClick={() => removeInputImage(item.id)}
                >
                  {t("batch.inputImages.remove")}
                </button>
                <span className="absolute bottom-0 left-0 right-0 bg-slate-900/70 px-1 py-0.5 text-center text-[10px] text-white">
                  {item.width}×{item.height}
                </span>
              </div>
            ))}
            <button
              type="button"
              className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-500 transition hover:border-sky-400 hover:text-sky-600"
              onClick={() => imageFileInputRef.current?.click()}
            >
              + {t("batch.inputImages.addButton")}
            </button>
            <input
              ref={imageFileInputRef}
              type="file"
              accept={acceptMime}
              multiple
              hidden
              onChange={onImageInputChange}
            />
          </div>

          {showMultiImageWarning ? (
            <p className="mt-2 text-xs text-amber-700">{t("batch.inputImages.multipleImagesWarning")}</p>
          ) : null}
          {inputImageError ? <p className="mt-2 text-xs text-rose-600">{inputImageError}</p> : null}
        </div>

        {/* Size + count + advanced */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">{t("batch.size")}</span>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              value={form.size}
              placeholder="1024x1024"
              onChange={(event) => onChange({ size: event.target.value })}
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {COMMON_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                    form.size.trim() === s
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => onChange({ size: s })}
                >
                  {s}
                </button>
              ))}
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">{t("batch.countPerPrompt")}</span>
            <input
              type="number"
              min={1}
              max={20}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              value={form.countPerPrompt}
              onChange={(event) => onChange({ countPerPrompt: Number(event.target.value) })}
            />
            <p className="mt-1 text-xs text-slate-500">{t("batch.countPerPromptHint")}</p>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">{t("batch.advancedJsonParams")}</span>
          <textarea
            className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder={'{\n  "quality": "high"\n}'}
            value={form.advancedJson}
            onChange={(event) => onChange({ advancedJson: event.target.value })}
          />
        </label>

        {error ? <Notice variant="error">{error}</Notice> : null}

        {/* Submit */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-xs text-slate-600">
            {t("batch.submitSummary", {
              prompts: parsed.prompts.length,
              count: Math.max(1, Math.floor(form.countPerPrompt || 1)),
              total: totalTasksToCreate,
            })}
          </p>
          <button
            type="submit"
            className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={parsed.prompts.length === 0}
          >
            {isEditMode ? t("batch.startEdit") : t("batch.startGenerate")}
          </button>
        </div>
      </form>

      {/* Current batch progress */}
      {currentBatchId && progress ? (
        <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50/70 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">{t("batch.progress.title")}</p>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-mono text-slate-600">
              {currentBatchId}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {t("batch.progress.summary", {
              done: finishedCount,
              total: progress.total,
              running: progress.running,
              error: progress.error,
            })}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onRetryBatchErrors}
              disabled={errorCount === 0}
            >
              {t("batch.actions.retryErrors", { count: errorCount })}
            </button>
            <button
              type="button"
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onExportBatch}
              disabled={successCount === 0 || Boolean(isExporting)}
            >
              {isExporting
                ? t("batch.actions.exporting")
                : t("batch.actions.exportZip", { count: successCount })}
            </button>
          </div>
          {batchTasks.length > 0 ? (
            <p className="mt-2 text-[11px] text-slate-500">
              {t("batch.progress.tasksHint")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
