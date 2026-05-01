import type { InputImageFile } from "../types";

// Runtime guards for the edits endpoint. Servers will reject oversized images
// with 400/413; we pre-shrink them to avoid round trips.
export const ACCEPTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const STRICT_PNG_ONLY_MIME_TYPES = ["image/png"] as const;

export const INPUT_IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB — safe for gpt-image-1; dall-e-2 enforces 4 MB separately.
export const INPUT_IMAGE_MAX_DIMENSION = 2048;
export const DALLE2_MAX_BYTES = 4 * 1024 * 1024;

type AcceptedMime = (typeof ACCEPTED_IMAGE_MIME_TYPES)[number];

export interface PreprocessOptions {
  /** Models where the API only accepts PNG / <4MB / square (dall-e-2 legacy). */
  strictPngOnly?: boolean;
}

export class InputImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputImageError";
  }
}

function createInputImageId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isAcceptedMime(mime: string, strict: boolean): mime is AcceptedMime {
  const allow = strict ? STRICT_PNG_ONLY_MIME_TYPES : ACCEPTED_IMAGE_MIME_TYPES;
  return (allow as readonly string[]).includes(mime);
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new InputImageError("Failed to decode image."));
    };
    img.src = url;
    // Caller owns revocation after use.
    (img as HTMLImageElement & { __objectUrl: string }).__objectUrl = url;
  });
}

function revokeImageElement(img: HTMLImageElement) {
  const url = (img as HTMLImageElement & { __objectUrl?: string }).__objectUrl;
  if (url) {
    URL.revokeObjectURL(url);
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, mime: AcceptedMime, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new InputImageError("Failed to encode resized image."));
        }
      },
      mime,
      quality,
    );
  });
}

/**
 * Downscale `file` so the longest side is <= maxDimension. Re-encodes into the
 * same mime where possible. PNG stays PNG (to preserve alpha), JPEG/WebP keep
 * their format at quality 0.92.
 */
async function downscaleImageFile(
  file: File,
  maxDimension: number,
): Promise<{ file: File; width: number; height: number }> {
  const mime = (ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)
    ? (file.type as AcceptedMime)
    : "image/png";

  const img = await loadImageElement(file);
  try {
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longest > maxDimension ? maxDimension / longest : 1;
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new InputImageError("Canvas 2D context is not available.");
    }
    ctx.drawImage(img, 0, 0, width, height);

    const outMime: AcceptedMime = mime === "image/png" ? "image/png" : mime;
    const outQuality = outMime === "image/png" ? undefined : 0.92;
    const blob = await canvasToBlob(canvas, outMime, outQuality);

    const ext = outMime === "image/png" ? "png" : outMime === "image/jpeg" ? "jpg" : "webp";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const resized = new File([blob], `${baseName}.${ext}`, {
      type: outMime,
      lastModified: Date.now(),
    });
    return { file: resized, width, height };
  } finally {
    revokeImageElement(img);
  }
}

async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  const img = await loadImageElement(file);
  try {
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    revokeImageElement(img);
  }
}

/**
 * Validate + (optionally) downscale a user-picked file, then wrap it into an
 * InputImageFile ready to be rendered in the UI.
 *
 * Caller owns the previewUrl lifecycle — revoke it when the image is removed.
 */
export async function prepareInputImage(
  file: File,
  options: PreprocessOptions = {},
): Promise<InputImageFile> {
  const strict = Boolean(options.strictPngOnly);

  if (!isAcceptedMime(file.type, strict)) {
    throw new InputImageError(
      strict
        ? `Only PNG is accepted for this model. Got: ${file.type || "unknown"}.`
        : `Unsupported image type: ${file.type || "unknown"}. Use PNG, JPEG or WebP.`,
    );
  }

  const hardMax = strict ? DALLE2_MAX_BYTES : INPUT_IMAGE_MAX_BYTES * 4;
  if (file.size > hardMax) {
    throw new InputImageError(
      `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
        `Max is ${(hardMax / 1024 / 1024).toFixed(0)} MB.`,
    );
  }

  const needsShrink = file.size > INPUT_IMAGE_MAX_BYTES;
  const dims = await readImageDimensions(file);
  const tooBig =
    needsShrink ||
    dims.width > INPUT_IMAGE_MAX_DIMENSION ||
    dims.height > INPUT_IMAGE_MAX_DIMENSION;

  const finalFile = tooBig ? await downscaleImageFile(file, INPUT_IMAGE_MAX_DIMENSION) : null;
  const resolvedFile = finalFile?.file ?? file;
  const resolvedWidth = finalFile?.width ?? dims.width;
  const resolvedHeight = finalFile?.height ?? dims.height;

  if (strict && resolvedWidth !== resolvedHeight) {
    throw new InputImageError("This model requires a square image.");
  }

  return {
    id: createInputImageId(),
    file: resolvedFile,
    previewUrl: URL.createObjectURL(resolvedFile),
    width: resolvedWidth,
    height: resolvedHeight,
  };
}

/**
 * Ensure a mask file is same-size as the first source image. API will otherwise 400.
 */
export function assertMaskMatchesImage(
  mask: InputImageFile,
  reference: InputImageFile,
): void {
  if (mask.width !== reference.width || mask.height !== reference.height) {
    throw new InputImageError(
      `Mask size ${mask.width}x${mask.height} does not match image size ${reference.width}x${reference.height}.`,
    );
  }
}

/**
 * Some relay providers / legacy models only accept a single reference image.
 * This heuristic is advisory — it drives UI warnings, not hard limits.
 */
export function modelLikelySupportsMultipleImages(model: string): boolean {
  const needle = model.trim().toLowerCase();
  if (!needle) return false;
  return (
    needle.includes("gpt-image") ||
    needle.includes("flux-kontext") ||
    needle.includes("seededit") ||
    needle.includes("nano-banana") ||
    needle.includes("gemini-flash-image")
  );
}

export function modelRequiresStrictPng(model: string): boolean {
  const needle = model.trim().toLowerCase();
  return needle === "dall-e-2" || needle.startsWith("dall-e-2-");
}
