import JSZip from "jszip";

export type NamingMode = "compact" | "descriptive";

export interface RenameItem {
  id: string;
  originalName: string;
  newName: string;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  thumbnailUrl?: string;
  file: File;
}

const COMPRESS_MAX_DIMENSION = 1024;
const COMPRESS_QUALITY = 0.8;

export function compressImageForAI(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > COMPRESS_MAX_DIMENSION || height > COMPRESS_MAX_DIMENSION) {
        const scale = Math.min(COMPRESS_MAX_DIMENSION / width, COMPRESS_MAX_DIMENSION / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to compress image"));
        },
        "image/webp",
        COMPRESS_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = url;
  });
}

export function generateThumbnailUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 80;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.5));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for thumbnail"));
    };

    img.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

const COMPACT_PROMPT = `You are a game art asset manager. Based on the image content, give a filename.
Format: \`category_trait_trait\` (e.g. \`rock_mossy_dark\`, \`grass_yellow_dry\`).
Rules: English lowercase and underscores only. No numbering, no extension, no extra text.`;

const DESCRIPTIVE_PROMPT = `You are an accessibility expert writing alt-text as a filename.
Structure: category_subcategory_description.
The FIRST word MUST be the primary category (e.g. rock, grass, tree, tower, wall, water, sky).
The SECOND word MUST be a subcategory or variant (e.g. boulder, moss, pine, brick, river, cloud).
After that, describe key visual details: shape, direction, quantity, material, spatial relationships.
Examples: \`rock_boulder_large_scattered_on_hillside\`, \`tree_pine_on_rock_leaning_left\`, \`tower_brick_two_story_with_flag\`, \`grass_dry_yellow_patches_near_river\`.
Rules: English lowercase and underscores only. Keep it under 60 characters. No numbering, no extension, no extra text.`;

const MAX_DESCRIPTIVE_NAME_LENGTH = 60;

export async function callAIForName(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  imageBlob: Blob;
  namingMode?: NamingMode;
  signal?: AbortSignal;
}): Promise<string> {
  const { apiKey, baseUrl, model, imageBlob, namingMode = "compact", signal } = params;
  const dataUrl = await blobToDataUrl(imageBlob);

  const isDescriptive = namingMode === "descriptive";
  const prompt = isDescriptive ? DESCRIPTIVE_PROMPT : COMPACT_PROMPT;
  const detail = isDescriptive ? "auto" : "low";

  const endpoint = `${baseUrl.trim().replace(/\/$/, "")}/responses`;
  const body = {
    model: model.trim(),
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: dataUrl, detail },
        ],
      },
    ],
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = `API error ${res.status}`;
    try {
      const json = JSON.parse(text);
      msg = json.error?.message || json.message || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const json = await res.json();
  const outputText = extractOutputText(json);
  return sanitizeAIName(outputText, namingMode);
}

function extractOutputText(parsed: unknown): string {
  if (!parsed || typeof parsed !== "object") return "";
  if ("output_text" in parsed && typeof (parsed as Record<string, unknown>).output_text === "string") {
    return ((parsed as Record<string, unknown>).output_text as string).trim();
  }
  if ("output" in parsed && Array.isArray((parsed as Record<string, unknown>).output)) {
    const parts: string[] = [];
    for (const item of (parsed as Record<string, unknown>).output as unknown[]) {
      if (!item || typeof item !== "object" || !("content" in item)) continue;
      for (const content of (item as Record<string, unknown>).content as unknown[]) {
        if (!content || typeof content !== "object") continue;
        if ("text" in content && typeof (content as Record<string, unknown>).text === "string") {
          parts.push((content as Record<string, unknown>).text as string);
        }
      }
    }
    return parts.join("\n").trim();
  }
  return "";
}

function sanitizeAIName(raw: string, mode: NamingMode = "compact"): string {
  let name = raw.replace(/```/g, "").replace(/`/g, "").trim();
  name = name.split("\n")[0].trim();
  name = name.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  name = name.replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (!name) return "unnamed";
  if (mode === "descriptive" && name.length > MAX_DESCRIPTIVE_NAME_LENGTH) {
    name = name.slice(0, MAX_DESCRIPTIVE_NAME_LENGTH).replace(/_$/, "");
  }
  return name;
}

/**
 * `sequence` is a 1-based counter within the current batch. It replaces the
 * random hash this used to use: 4 hex chars collide roughly 7% of the time at
 * 100 files, and the generated .bat had no way to notice the collision.
 */
export function buildFinalName(aiName: string, originalName: string, sequence = 1): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${yy}${mm}${dd}`;
  const seq = String(Math.max(1, Math.floor(sequence))).padStart(3, "0");
  const ext = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".")) : ".png";
  return `${aiName}_${dateStr}_${seq}${ext}`;
}

/**
 * Makes sure a filename is safe to embed in a double-quoted batch-file
 * argument. `%` and `!` trigger variable expansion; `"` terminates the
 * argument. These are rare but do occur in artist-supplied filenames, and a
 * broken .bat is much worse than one skipped file.
 */
function isBatSafe(name: string): boolean {
  return !/["%!^&<>|\r\n]/.test(name);
}

/**
 * Resolves duplicate target names by appending `_2`, `_3`, ... so no rename
 * silently overwrites another file.
 */
function dedupeTargetNames(items: RenameItem[]): { item: RenameItem; target: string }[] {
  const used = new Set<string>();

  return items.map((item) => {
    const dotIndex = item.newName.lastIndexOf(".");
    const stem = dotIndex > 0 ? item.newName.slice(0, dotIndex) : item.newName;
    const ext = dotIndex > 0 ? item.newName.slice(dotIndex) : "";

    let target = item.newName;
    let suffix = 2;

    while (used.has(target.toLowerCase())) {
      target = `${stem}_${suffix}${ext}`;
      suffix += 1;
    }

    used.add(target.toLowerCase());
    return { item, target };
  });
}

export function generateRenameScript(items: RenameItem[]): string {
  const doneItems = items.filter((i) => i.status === "done" && i.newName);
  if (doneItems.length === 0) return "";

  const pairs = dedupeTargetNames(doneItems);
  const safePairs = pairs.filter(({ item, target }) => isBatSafe(item.originalName) && isBatSafe(target));
  const unsafeCount = pairs.length - safePairs.length;

  // Tab-separated instead of "=": filenames may legitimately contain "=",
  // which would make the restore script split at the wrong place.
  const backupLines = safePairs
    .map(({ item, target }) => `echo ${target}\t${item.originalName}`)
    .join("\n");

  // Every rename is guarded: skip when the target exists, and report failures
  // instead of silently moving on.
  const renameLines = safePairs
    .map(
      ({ item, target }) => `if exist "${target}" (
    echo [SKIP] "${target}" already exists, leaving "${item.originalName}" alone.
    set /a SKIPPED+=1
) else (
    ren "${item.originalName}" "${target}"
    if errorlevel 1 (
        echo [FAIL] Could not rename "${item.originalName}".
        set /a FAILED+=1
    ) else (
        set /a RENAMED+=1
    )
)`,
    )
    .join("\n");

  const unsafeNotice = unsafeCount
    ? `echo [WARN] ${unsafeCount} file(s) excluded - their names contain characters unsafe for batch scripts. Rename those manually.\n`
    : "";

  return `@echo off
setlocal enabledelayedexpansion
set RENAMED=0
set SKIPPED=0
set FAILED=0
echo Preparing to rename assets...

rem 1. Write backup log (for restore)
(
${backupLines}
) > _rename_backup.log

rem 2. Execute rename
${renameLines}

${unsafeNotice}echo.
echo ==========================================
echo  Renamed: !RENAMED!  Skipped: !SKIPPED!  Failed: !FAILED!
if not "!FAILED!"=="0" echo  Some files failed - see messages above.
echo  To undo, run [restore_names.bat]
echo ==========================================
pause
`;
}

export function generateRestoreScript(): string {
  return `@echo off
setlocal enabledelayedexpansion
set RESTORED=0
set FAILED=0
echo Reading backup, preparing to restore original names...

if not exist _rename_backup.log (
    echo [ERROR] Backup log _rename_backup.log not found, cannot restore!
    pause
    exit /b
)

for /f "usebackq tokens=1,2 delims=	" %%A in ("_rename_backup.log") do (
    if exist "%%A" (
        ren "%%A" "%%B"
        if errorlevel 1 (
            echo [FAIL] Could not restore "%%A".
            set /a FAILED+=1
        ) else (
            set /a RESTORED+=1
        )
    ) else (
        echo [SKIP] "%%A" not found, maybe already restored.
    )
)

echo.
echo ==========================================
echo  Restored: !RESTORED!  Failed: !FAILED!
if "!FAILED!"=="0" (
    del _rename_backup.log
    echo  Original filenames restored!
) else (
    echo  Backup log kept so you can retry.
)
echo ==========================================
pause
`;
}

export async function downloadScriptZip(items: RenameItem[]): Promise<void> {
  const zip = new JSZip();
  zip.file("run_rename.bat", generateRenameScript(items));
  zip.file("restore_names.bat", generateRestoreScript());
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, "rename_scripts.zip");
}

export async function downloadRenamedZip(items: RenameItem[]): Promise<void> {
  const zip = new JSZip();
  const doneItems = items.filter((i) => i.status === "done" && i.newName);

  for (const { item, target } of dedupeTargetNames(doneItems)) {
    const arrayBuffer = await item.file.arrayBuffer();
    zip.file(target, arrayBuffer);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, "renamed_images.zip");
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
