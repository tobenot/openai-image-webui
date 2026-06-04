import JSZip from "jszip";
import { slugifyPrompt } from "./promptList";
import type { CachedImageRecord } from "./imageCache";

function extensionFromMime(mime?: string): string {
  if (!mime) return "png";
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "png";
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

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * Pack the given cached images into a ZIP and trigger download.
 * Layout:
 *   001_<slug>.<ext>
 *   002_<slug>.<ext>
 *   prompts.txt
 */
export async function downloadLibraryZip(
  items: Pick<CachedImageRecord, "id" | "blob" | "mimeType" | "prompt">[],
  zipName?: string,
): Promise<{ exported: number }> {
  if (items.length === 0) {
    return { exported: 0 };
  }

  const zip = new JSZip();
  const used = new Set<string>();
  const lines: string[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const seq = String(i + 1).padStart(3, "0");
    const slug = slugifyPrompt(item.prompt || "image") || "image";
    const ext = extensionFromMime(item.mimeType);
    let filename = `${seq}_${slug}.${ext}`;
    let dedup = 1;
    while (used.has(filename)) {
      filename = `${seq}_${slug}_${dedup}.${ext}`;
      dedup += 1;
    }
    used.add(filename);
    zip.file(filename, item.blob);
    lines.push(`${filename}\t${item.prompt || ""}`);
  }

  zip.file("prompts.txt", lines.join("\n") + "\n");

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, zipName || `image-library_${timestampSlug()}.zip`);
  return { exported: items.length };
}
