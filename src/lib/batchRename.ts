import JSZip from "jszip";

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

const RENAME_PROMPT = `你是一个游戏美术资源管理助手。请根据图片内容，给出一个适合作为美术资源的文件名。
格式要求：\`大类_特征_特征\`（例如：\`rock_mossy_dark\`、\`grass_yellow_dry\`）。
注意：只需返回英文小写和下划线，不要包含任何序号、后缀或多余文字。`;

export async function callAIForName(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  imageBlob: Blob;
  signal?: AbortSignal;
}): Promise<string> {
  const { apiKey, baseUrl, model, imageBlob, signal } = params;
  const dataUrl = await blobToDataUrl(imageBlob);

  const endpoint = `${baseUrl.trim().replace(/\/$/, "")}/responses`;
  const body = {
    model: model.trim(),
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: RENAME_PROMPT },
          { type: "input_image", image_url: dataUrl, detail: "low" },
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
  return sanitizeAIName(outputText);
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

function sanitizeAIName(raw: string): string {
  let name = raw.replace(/```/g, "").replace(/`/g, "").trim();
  name = name.split("\n")[0].trim();
  name = name.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  name = name.replace(/_+/g, "_").replace(/^_|_$/g, "");
  return name || "unnamed";
}

export function buildFinalName(aiName: string, originalName: string): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${yy}${mm}${dd}`;
  const hash = Math.random().toString(16).slice(2, 6);
  const ext = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".")) : ".png";
  return `${aiName}_${dateStr}_${hash}${ext}`;
}

export function generateRenameScript(items: RenameItem[]): string {
  const doneItems = items.filter((i) => i.status === "done" && i.newName);
  if (doneItems.length === 0) return "";

  const backupLines = doneItems.map((i) => `echo ${i.newName}=${i.originalName}`).join("\n");
  const renameLines = doneItems.map((i) => `ren "${i.originalName}" "${i.newName}"`).join("\n");

  return `@echo off
chcp 65001 >nul
echo 正在准备重命名美术资源...

:: 1. 写入备份日志（用于一键还原）
(
${backupLines}
) > _rename_backup.log

:: 2. 执行重命名
${renameLines}

echo.
echo ==========================================
echo  重命名完成！
echo  提示：如果不满意，双击运行 [restore_names.bat] 即可一键还原。
echo ==========================================
pause
`;
}

export function generateRestoreScript(): string {
  return `@echo off
chcp 65001 >nul
echo 正在读取备份，准备还原原始文件名...

if not exist _rename_backup.log (
    echo [错误] 未找到备份日志 _rename_backup.log，无法还原！
    pause
    exit /b
)

for /f "usebackq tokens=1,2 delims==" %%A in ("_rename_backup.log") do (
    ren "%%A" "%%B"
)

del _rename_backup.log
echo.
echo ==========================================
echo  原始文件名已成功恢复！
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

  for (const item of doneItems) {
    const arrayBuffer = await item.file.arrayBuffer();
    zip.file(item.newName, arrayBuffer);
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
