import { useState } from "react";
import { useTranslation } from "react-i18next";
import { copyText, downloadImage, downloadText } from "../lib/download";

import type { ImageTask } from "../types";

interface TaskCardProps {
  task: ImageTask;
  onPreview: (imageUrl: string) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onClearImage: (id: string) => void;
  onReuseParams: (task: ImageTask) => void;
}

const statusStyles: Record<ImageTask["status"], string> = {
  pending: "bg-slate-100 text-slate-700 ring-slate-200",
  running: "bg-sky-100 text-sky-700 ring-sky-200",
  success: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  error: "bg-rose-100 text-rose-700 ring-rose-200",
  cancelled: "bg-amber-100 text-amber-700 ring-amber-200",
};

function formatElapsed(task: ImageTask) {
  if (!task.startedAt) {
    return "-";
  }

  const end = task.finishedAt ?? Date.now();
  return `${Math.max(0, (end - task.startedAt) / 1000).toFixed(1)}s`;
}

function actionButtonClass(disabled = false) {
  return `rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
    disabled
      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
  }`;
}

// Some persisted error strings are stored as i18n keys (e.g. "tasks.messages.taskCancelled")
// so they can be re-translated when the user switches language. Anything else (such as
// raw API error responses) is rendered as-is.
function isI18nKey(value: string) {
  return value.startsWith("tasks.messages.") || value.startsWith("errors.");
}

function formatTaskDebug(task: ImageTask, errorText: string) {
  return JSON.stringify(
    {
      id: task.id,
      status: task.status,
      error: errorText || undefined,
      model: task.model,
      size: task.size,
      responseFormat: task.responseFormat,
      imageCached: task.imageCached,
      imageSize: task.imageSize,
      outputText: task.outputText,
      debug: task.debug,
    },

    null,
    2,
  );
}

export function TaskCard({ task, onPreview, onRetry, onCancel, onRemove, onClearImage, onReuseParams }: TaskCardProps) {
  const { t } = useTranslation();
  const [messageKey, setMessageKey] = useState<string>("");
  const isVisionTask = task.mode === "vision";
  const hasImage = Boolean(task.imageUrl);
  const hasStoredImage = hasImage || Boolean(task.imageCached);
  const hasOutputText = Boolean(task.outputText?.trim());
  const hasDebug = Boolean(task.debug);

  const canCancel = task.status === "pending" || task.status === "running";

  async function handleCopyImage() {
    if (!task.imageUrl) {
      return;
    }

    await copyText(task.imageUrl);
    setMessageKey("tasks.messages.imageUrlCopied");
  }

  async function handleCopyPrompt() {
    await copyText(task.prompt);
    setMessageKey("tasks.messages.promptCopied");
  }

  async function handleCopyOutputText() {
    if (!task.outputText) {
      return;
    }

    await copyText(task.outputText);
    setMessageKey("tasks.messages.outputCopied");
  }

  function handleDownloadOutputText() {
    if (!task.outputText) {
      return;
    }

    downloadText(task.outputText, `openai-ocr-${task.id.slice(0, 8)}`);
    setMessageKey("tasks.messages.outputDownloadStarted");
  }

  async function handleCopyDebug() {
    if (!hasDebug) {

      return;
    }

    await copyText(formatTaskDebug(task, errorText));
    setMessageKey("tasks.messages.debugCopied");
  }

  async function handleDownload() {
    if (!task.imageUrl) {
      return;
    }

    await downloadImage(task.imageUrl, `openai-image-${task.id.slice(0, 8)}`, task.imageMimeType);

    setMessageKey("tasks.messages.downloadStarted");
  }

  function handleClearImage() {
    if (!hasStoredImage) {
      return;
    }

    onClearImage(task.id);
    setMessageKey("tasks.messages.imageCacheDeleted");
  }

  const errorText = task.error
    ? isI18nKey(task.error)
      ? t(task.error)
      : task.error
    : "";
  const debugText = hasDebug ? formatTaskDebug(task, errorText) : "";
  const placeholderText = isVisionTask
    ? task.status === "running"
      ? t("tasks.analyzing")
      : t("tasks.noTextYet")
    : task.imageCached
      ? t("tasks.restoringCachedImage")
      : task.status === "running"
        ? t("tasks.generating")
        : t("tasks.noImageYet");


  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 md:grid-cols-[220px_1fr]">
        <div className="flex min-h-52 items-center justify-center bg-slate-100">
          {isVisionTask ? (
            <div className="px-6 text-center text-sm text-slate-400">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-lg font-bold text-violet-600">
                OCR
              </div>
              {placeholderText}
            </div>
          ) : task.imageUrl ? (
            <button
              type="button"
              className="h-full w-full"
              onClick={() => onPreview(task.imageUrl as string)}
              aria-label={t("tasks.previewGeneratedImage")}
            >
              <img
                className="h-full max-h-64 w-full object-cover"
                src={task.imageUrl}
                alt={task.prompt}
                loading="lazy"
              />
            </button>
          ) : (
            <div className="px-6 text-center text-sm text-slate-400">{placeholderText}</div>
          )}
        </div>

        <div className="p-4">

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[task.status]}`}
            >
              {t(`tasks.status.${task.status}`)}
            </span>
            <span className="text-xs text-slate-400">
              {t("tasks.elapsed", { value: formatElapsed(task) })}
            </span>
            <span className="text-xs text-slate-400">
              {new Date(task.createdAt).toLocaleString()}
            </span>
            {task.imageCached ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                {t("tasks.cache.cachedBadge")}
              </span>
            ) : null}
          </div>

          <p className="mb-3 line-clamp-3 text-sm leading-6 text-slate-700">{task.prompt}</p>

          <dl className="mb-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-2">
              <dt className="font-medium text-slate-700">{t("tasks.fields.model")}</dt>
              <dd className="mt-1 break-all">{task.model}</dd>
            </div>
            {isVisionTask ? (
              <>
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="font-medium text-slate-700">{t("tasks.fields.inputImages")}</dt>
                  <dd className="mt-1">{task.inputImageCount ?? 0}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="font-medium text-slate-700">{t("tasks.fields.detail")}</dt>
                  <dd className="mt-1">{task.visionDetail ?? "-"}</dd>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="font-medium text-slate-700">{t("tasks.fields.size")}</dt>
                  <dd className="mt-1">{task.size}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="font-medium text-slate-700">{t("tasks.fields.format")}</dt>
                  <dd className="mt-1">{task.responseFormat}</dd>
                </div>
              </>
            )}
          </dl>

          {hasOutputText ? (
            <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-sm leading-6 text-slate-800">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-600">
                {t("tasks.outputText")}
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-sans">{task.outputText}</pre>
            </div>
          ) : null}

          {errorText ? (
            <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">

              {errorText}
            </div>
          ) : null}

          {debugText ? (
            <details className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <summary className="cursor-pointer font-medium text-slate-700">
                {t("tasks.debugDetails")}
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono">
                {debugText}
              </pre>
            </details>
          ) : null}

          {messageKey ? <div className="mb-4 text-xs text-emerald-600">{t(messageKey)}</div> : null}

          <div className="flex flex-wrap gap-2">
            {isVisionTask ? (
              <>
                <button
                  type="button"
                  className={actionButtonClass(!hasOutputText)}
                  disabled={!hasOutputText}
                  onClick={() => void handleCopyOutputText()}
                >
                  {t("tasks.actions.copyOutput")}
                </button>
                <button
                  type="button"
                  className={actionButtonClass(!hasOutputText)}
                  disabled={!hasOutputText}
                  onClick={handleDownloadOutputText}
                >
                  {t("tasks.actions.downloadText")}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={actionButtonClass(!hasImage)}
                  disabled={!hasImage}
                  onClick={() => task.imageUrl && onPreview(task.imageUrl)}
                >
                  {t("tasks.actions.preview")}
                </button>
                <button
                  type="button"
                  className={actionButtonClass(!hasImage)}
                  disabled={!hasImage}
                  onClick={() => void handleDownload()}
                >
                  {t("tasks.actions.download")}
                </button>
                <button
                  type="button"
                  className={actionButtonClass(!hasImage)}
                  disabled={!hasImage}
                  onClick={() => void handleCopyImage()}
                >
                  {t("tasks.actions.copyImageUrl")}
                </button>
              </>
            )}
            <button type="button" className={actionButtonClass()} onClick={() => void handleCopyPrompt()}>
              {t("tasks.actions.copyPrompt")}
            </button>

            <button
              type="button"
              className={actionButtonClass(!hasDebug)}
              disabled={!hasDebug}
              onClick={() => void handleCopyDebug()}
            >
              {t("tasks.actions.copyDebug")}
            </button>
            {!isVisionTask ? (
              <>
                <button
                  type="button"
                  className={actionButtonClass(!hasStoredImage)}
                  disabled={!hasStoredImage}
                  onClick={handleClearImage}
                >
                  {t("tasks.actions.deleteImageCache")}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                  onClick={() => onReuseParams(task)}
                >
                  {t("tasks.actions.reuseParams")}
                </button>
              </>
            ) : null}

            <button type="button" className={actionButtonClass()} onClick={() => onRetry(task.id)}>
              {t("tasks.actions.retry")}
            </button>
            {canCancel ? (
              <button type="button" className={actionButtonClass()} onClick={() => onCancel(task.id)}>
                {t("tasks.actions.cancel")}
              </button>
            ) : null}
            <button type="button" className={actionButtonClass()} onClick={() => onRemove(task.id)}>
              {t("tasks.actions.delete")}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
