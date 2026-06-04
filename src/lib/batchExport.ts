import JSZip from "jszip";
import { getCachedImage } from "./imageCache";
import { slugifyPrompt } from "./promptList";
import type { ImageTask } from "../types";

export const BATCH_ID_KEY = "_batchId";
export const BATCH_INDEX_KEY = "_batchIndex";

export function getTaskBatchId(task: ImageTask): string | undefined {
  const value = task.extraParams?.[BATCH_ID_KEY];
  return typeof value === "string" ? value : undefined;
}

export function getTaskBatchIndex(task: ImageTask): number | undefined {
  const value = task.extraParams?.[BATCH_INDEX_KEY];
  return typeof value === "number" ? value : undefined;
}

export function tasksOfBatch(tasks: ImageTask[], batchId: string): ImageTask[] {
  return tasks
    .filter((t) => getTaskBatchId(t) === batchId)
    .sort((a, b) => (getTaskBatchIndex(a) ?? 0) - (getTaskBatchIndex(b) ?? 0));
}

export interface BatchProgress {
  total: number;
  pending: number;
  running: number;
  success: number;
  error: number;
  cancelled: number;
}

export function batchProgress(tasks: ImageTask[], batchId: string): BatchProgress {
  const items = tasksOfBatch(tasks, batchId);
  const progress: BatchProgress = {
    total: items.length,
    pending: 0,
    running: 0,
    success: 0,
    error: 0,
    cancelled: 0,
  };
  for (const item of items) {
    progress[item.status] += 1;
  }
  return progress;
}

function extensionFromMime(mime?: string): string {
  if (!mime) return "png";
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "png";
}

interface ManifestEntry {
  index: number;
  taskId: string;
  prompt: string;
  model: string;
  size: string;
  status: ImageTask["status"];
  filename?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  estimatedCostUsd?: number;
}

/**
 * Build a ZIP from all success tasks in a batch and trigger download.
 * Layout:
 *   <batchId>/
 *     001_<slug>.png
 *     002_<slug>.png
 *     ...
 *     prompts.txt
 *     manifest.json
 */
export async function downloadBatchZip(
  tasks: ImageTask[],
  batchId: string,
): Promise<{ exported: number; missing: number }> {
  const items = tasksOfBatch(tasks, batchId);
  if (items.length === 0) {
    return { exported: 0, missing: 0 };
  }

  const zip = new JSZip();
  const folder = zip.folder(batchId) ?? zip;
  const promptLines: string[] = [];
  const manifest: ManifestEntry[] = [];
  let exported = 0;
  let missing = 0;

  for (let i = 0; i < items.length; i += 1) {
    const task = items[i];
    const seq = String(i + 1).padStart(3, "0");
    const slug = slugifyPrompt(task.prompt);
    const entry: ManifestEntry = {
      index: i + 1,
      taskId: task.id,
      prompt: task.prompt,
      model: task.model,
      size: task.size,
      status: task.status,
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
      estimatedCostUsd: task.estimatedCostUsd,
    };

    promptLines.push(`${seq}\t${task.prompt}`);

    if (task.status === "success") {
      try {
        const cached = await getCachedImage(task.id);
        if (cached) {
          const ext = extensionFromMime(cached.mimeType);
          const filename = `${seq}_${slug}.${ext}`;
          folder.file(filename, cached.blob);
          entry.filename = filename;
          exported += 1;
        } else {
          entry.error = "image not found in cache";
          missing += 1;
        }
      } catch (err) {
        entry.error = err instanceof Error ? err.message : String(err);
        missing += 1;
      }
    } else if (task.error) {
      entry.error = task.error;
    }

    manifest.push(entry);
  }

  folder.file("prompts.txt", promptLines.join("\n") + "\n");
  folder.file(
    "manifest.json",
    JSON.stringify(
      {
        batchId,
        exportedAt: new Date().toISOString(),
        total: items.length,
        exported,
        missing,
        items: manifest,
      },
      null,
      2,
    ),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${batchId}.zip`);
  return { exported, missing };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
