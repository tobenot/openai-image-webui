import { useState } from "react";
import { copyText, downloadImage } from "../lib/download";
import type { ImageTask } from "../types";

interface TaskCardProps {
  task: ImageTask;
  onPreview: (imageUrl: string) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
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

export function TaskCard({ task, onPreview, onRetry, onCancel, onRemove }: TaskCardProps) {
  const [message, setMessage] = useState("");
  const hasImage = Boolean(task.imageUrl);
  const canCancel = task.status === "pending" || task.status === "running";

  async function handleCopyImage() {
    if (!task.imageUrl) {
      return;
    }

    await copyText(task.imageUrl);
    setMessage("Image URL copied.");
  }

  async function handleCopyPrompt() {
    await copyText(task.prompt);
    setMessage("Prompt copied.");
  }

  async function handleDownload() {
    if (!task.imageUrl) {
      return;
    }

    await downloadImage(task.imageUrl, `openai-image-${task.id.slice(0, 8)}`);
    setMessage("Download started.");
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 md:grid-cols-[220px_1fr]">
        <div className="flex min-h-52 items-center justify-center bg-slate-100">
          {task.imageUrl ? (
            <button
              type="button"
              className="h-full w-full"
              onClick={() => onPreview(task.imageUrl as string)}
              aria-label="Preview generated image"
            >
              <img
                className="h-full max-h-64 w-full object-cover"
                src={task.imageUrl}
                alt={task.prompt}
                loading="lazy"
              />
            </button>
          ) : (
            <div className="px-6 text-center text-sm text-slate-400">
              {task.status === "running" ? "Generating..." : "No image yet"}
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[task.status]}`}
            >
              {task.status}
            </span>
            <span className="text-xs text-slate-400">Elapsed: {formatElapsed(task)}</span>
            <span className="text-xs text-slate-400">
              {new Date(task.createdAt).toLocaleString()}
            </span>
          </div>

          <p className="mb-3 line-clamp-3 text-sm leading-6 text-slate-700">{task.prompt}</p>

          <dl className="mb-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-2">
              <dt className="font-medium text-slate-700">Model</dt>
              <dd className="mt-1 break-all">{task.model}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <dt className="font-medium text-slate-700">Size</dt>
              <dd className="mt-1">{task.size}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <dt className="font-medium text-slate-700">Format</dt>
              <dd className="mt-1">{task.responseFormat}</dd>
            </div>
          </dl>

          {task.error ? (
            <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {task.error}
            </div>
          ) : null}

          {message ? <div className="mb-4 text-xs text-emerald-600">{message}</div> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={actionButtonClass(!hasImage)}
              disabled={!hasImage}
              onClick={() => task.imageUrl && onPreview(task.imageUrl)}
            >
              Preview
            </button>
            <button
              type="button"
              className={actionButtonClass(!hasImage)}
              disabled={!hasImage}
              onClick={() => void handleDownload()}
            >
              Download
            </button>
            <button
              type="button"
              className={actionButtonClass(!hasImage)}
              disabled={!hasImage}
              onClick={() => void handleCopyImage()}
            >
              Copy image URL
            </button>
            <button type="button" className={actionButtonClass()} onClick={() => void handleCopyPrompt()}>
              Copy prompt
            </button>
            <button type="button" className={actionButtonClass()} onClick={() => onRetry(task.id)}>
              Retry
            </button>
            {canCancel ? (
              <button type="button" className={actionButtonClass()} onClick={() => onCancel(task.id)}>
                Cancel
              </button>
            ) : null}
            <button type="button" className={actionButtonClass()} onClick={() => onRemove(task.id)}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
