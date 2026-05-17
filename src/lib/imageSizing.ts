export interface ImageSize {
  width: number;
  height: number;
}

export interface SizePresetGroup {
  ratio: string;
  sizes: readonly string[];
}

export type ModelSizeMode = "free" | "openaiFixed" | "gptImage2" | "geminiAspect";

export interface ModelSizingProfile {
  mode: ModelSizeMode;
  label: string;
}

interface CompatibleRequestParams {
  model: string;
  prompt: string;
  size: string;
  extraParams?: Record<string, unknown>;
}

interface CompatibleRequestResult {
  prompt: string;
  size: string;
  extraParams: Record<string, unknown>;
}

const MIN_SIZE = 256;
const MAX_SIZE = 4096;
const GPT_IMAGE_2_MAX_SIZE = 3840;
const GPT_IMAGE_2_STEP = 16;

export const GENERAL_SIZE_GROUPS: readonly SizePresetGroup[] = [
  { ratio: "1:1", sizes: ["512x512", "768x768", "1024x1024", "1536x1536", "2048x2048"] },
  { ratio: "4:3", sizes: ["768x576", "1024x768", "1536x1152", "2048x1536"] },
  { ratio: "3:4", sizes: ["576x768", "768x1024", "1152x1536", "1536x2048"] },
  { ratio: "3:2", sizes: ["768x512", "1248x832", "1536x1024", "2048x1360"] },
  { ratio: "2:3", sizes: ["512x768", "832x1248", "1024x1536", "1360x2048"] },
  { ratio: "5:4", sizes: ["1152x928", "1280x1024", "1600x1280", "2048x1638"] },
  { ratio: "4:5", sizes: ["928x1152", "1024x1280", "1280x1600", "1638x2048"] },
  { ratio: "16:9", sizes: ["1024x576", "1280x720", "1344x768", "1920x1080", "2560x1440"] },
  { ratio: "9:16", sizes: ["576x1024", "720x1280", "768x1344", "1080x1920", "1440x2560"] },
  { ratio: "21:9", sizes: ["1536x672", "1792x768", "2560x1080", "3440x1440"] },
  { ratio: "9:21", sizes: ["576x1344", "768x1792", "1080x2560"] },
] as const;

const DALLE_2_SIZE_GROUPS: readonly SizePresetGroup[] = [
  { ratio: "1:1", sizes: ["256x256", "512x512", "1024x1024"] },
] as const;

const DALLE_3_SIZE_GROUPS: readonly SizePresetGroup[] = [
  { ratio: "1:1", sizes: ["1024x1024"] },
  { ratio: "16:9", sizes: ["1792x1024"] },
  { ratio: "9:16", sizes: ["1024x1792"] },
] as const;

const GPT_IMAGE_1_SIZE_GROUPS: readonly SizePresetGroup[] = [
  { ratio: "auto", sizes: ["auto"] },
  { ratio: "1:1", sizes: ["1024x1024"] },
  { ratio: "3:2", sizes: ["1536x1024"] },
  { ratio: "2:3", sizes: ["1024x1536"] },
] as const;

const GEMINI_25_SIZE_GROUPS: readonly SizePresetGroup[] = [
  { ratio: "1:1", sizes: ["1024x1024"] },
  { ratio: "5:4", sizes: ["1152x928"] },
  { ratio: "4:5", sizes: ["928x1152"] },
  { ratio: "4:3", sizes: ["1184x864"] },
  { ratio: "3:4", sizes: ["864x1184"] },
  { ratio: "3:2", sizes: ["1248x832"] },
  { ratio: "2:3", sizes: ["832x1248"] },
  { ratio: "16:9", sizes: ["1344x768"] },
  { ratio: "9:16", sizes: ["768x1344"] },
  { ratio: "21:9", sizes: ["1536x672"] },
] as const;

const GEMINI_3_SIZE_GROUPS: readonly SizePresetGroup[] = [
  { ratio: "1:1", sizes: ["1024x1024", "2048x2048", "4096x4096"] },
  { ratio: "5:4", sizes: ["1152x928", "2304x1856"] },
  { ratio: "4:5", sizes: ["928x1152", "1856x2304"] },
  { ratio: "4:3", sizes: ["1200x896", "2400x1792"] },
  { ratio: "3:4", sizes: ["896x1200", "1792x2400"] },
  { ratio: "3:2", sizes: ["1264x848", "2528x1696"] },
  { ratio: "2:3", sizes: ["848x1264", "1696x2528"] },
  { ratio: "16:9", sizes: ["1376x768", "2752x1536"] },
  { ratio: "9:16", sizes: ["768x1376", "1536x2752"] },
  { ratio: "21:9", sizes: ["1584x672", "3168x1344"] },
] as const;

const GEMINI_31_EXTRA_SIZE_GROUPS: readonly SizePresetGroup[] = [
  { ratio: "4:1", sizes: ["2048x512", "4096x1024"] },
  { ratio: "1:4", sizes: ["512x2048", "1024x4096"] },
  { ratio: "8:1", sizes: ["3072x384"] },
  { ratio: "1:8", sizes: ["384x3072"] },
] as const;

const DALLE_2_ALLOWED = ["256x256", "512x512", "1024x1024"];
const DALLE_3_ALLOWED = ["1024x1024", "1792x1024", "1024x1792"];
const GPT_IMAGE_1_ALLOWED = ["1024x1024", "1536x1024", "1024x1536"];

const GEMINI_25_1K_SIZES: Record<string, string> = {
  "1:1": "1024x1024",
  "5:4": "1152x928",
  "4:5": "928x1152",
  "4:3": "1184x864",
  "3:4": "864x1184",
  "3:2": "1248x832",
  "2:3": "832x1248",
  "16:9": "1344x768",
  "9:16": "768x1344",
  "21:9": "1536x672",
};

const GEMINI_3_1K_SIZES: Record<string, string> = {
  "1:1": "1024x1024",
  "5:4": "1152x928",
  "4:5": "928x1152",
  "4:3": "1200x896",
  "3:4": "896x1200",
  "3:2": "1264x848",
  "2:3": "848x1264",
  "16:9": "1376x768",
  "9:16": "768x1376",
  "21:9": "1584x672",
  "4:1": "2048x512",
  "1:4": "512x2048",
  "8:1": "3072x384",
  "1:8": "384x3072",
};

function isDalle2(model: string) {
  const needle = model.trim().toLowerCase();
  return needle === "dall-e-2" || needle.startsWith("dall-e-2-");
}

function isDalle3(model: string) {
  const needle = model.trim().toLowerCase();
  return needle === "dall-e-3" || needle.startsWith("dall-e-3-");
}

function isGptImage1(model: string) {
  const needle = model.trim().toLowerCase();
  return needle === "gpt-image-1" || needle.startsWith("gpt-image-1-");
}

function isGptImage2(model: string) {
  const needle = model.trim().toLowerCase();
  return needle === "gpt-image-2" || needle.startsWith("gpt-image-2-");
}

function isGeminiImage(model: string) {
  const needle = model.trim().toLowerCase();
  return (
    needle.includes("nano-banana") ||
    needle.includes("gemini-flash-image") ||
    needle.includes("gemini-2.5-flash-image") ||
    needle.includes("gemini-3.1-flash-image") ||
    needle.includes("gemini-3-pro-image") ||
    needle.includes("gemini-3.0-pro-image")
  );
}

function isGemini31Image(model: string) {
  const needle = model.trim().toLowerCase();
  return needle.includes("3.1") || needle.includes("banana-2") || needle.includes("nano-banana-2");
}

function isGeminiProImage(model: string) {
  const needle = model.trim().toLowerCase();
  return needle.includes("pro-image") || needle.includes("banana-pro") || needle.includes("nano-banana-pro");
}

function roundToMultiple(value: number, multiple: number) {
  return Math.max(multiple, Math.round(value / multiple) * multiple);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hasParam(params: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(params, key);
}

function parseRatio(ratio: string) {
  const [w, h] = ratio.split(":").map(Number);
  return { width: w || 1, height: h || 1 };
}

function scaleSize(size: string, multiplier: number) {
  const parsed = parseSize(size);
  if (!parsed) return size;
  return `${Math.round(parsed.width * multiplier)}x${Math.round(parsed.height * multiplier)}`;
}

function hasPromptAspectRatio(prompt: string) {
  return /(?:^|\s)--(?:ar|aspect(?:-ratio)?)\s+\d+(?:\s*[:/]\s*\d+)?\b/i.test(prompt);
}

function closestSize(size: ImageSize | null, allowed: readonly string[]) {
  if (!size) return allowed[0];

  const targetRatio = size.width / size.height;
  const targetArea = size.width * size.height;
  let best = allowed[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of allowed) {
    const parsed = parseSize(candidate);
    if (!parsed) continue;
    const ratioScore = Math.abs(Math.log(targetRatio / (parsed.width / parsed.height)));
    const areaScore = Math.abs(Math.log(targetArea / (parsed.width * parsed.height)));
    const score = ratioScore * 2 + areaScore * 0.2;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function closestAspectRatio(size: ImageSize | null, ratios: readonly string[]) {
  if (!size) return ratios[0];

  const targetRatio = size.width / size.height;
  let best = ratios[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const ratio of ratios) {
    const parts = parseRatio(ratio);
    const score = Math.abs(Math.log(targetRatio / (parts.width / parts.height)));
    if (score < bestScore) {
      best = ratio;
      bestScore = score;
    }
  }

  return best;
}

function normalizeGptImage2Size(size: ImageSize | null) {
  const fallback = size ?? { width: 1024, height: 1024 };
  let width = roundToMultiple(clamp(fallback.width, MIN_SIZE, GPT_IMAGE_2_MAX_SIZE), GPT_IMAGE_2_STEP);
  let height = roundToMultiple(clamp(fallback.height, MIN_SIZE, GPT_IMAGE_2_MAX_SIZE), GPT_IMAGE_2_STEP);

  if (width / height > 3) {
    width = roundToMultiple(height * 3, GPT_IMAGE_2_STEP);
  } else if (height / width > 3) {
    height = roundToMultiple(width * 3, GPT_IMAGE_2_STEP);
  }

  width = clamp(width, MIN_SIZE, GPT_IMAGE_2_MAX_SIZE);
  height = clamp(height, MIN_SIZE, GPT_IMAGE_2_MAX_SIZE);
  return `${width}x${height}`;
}

function geminiAspectRatios(model: string) {
  const base = ["1:1", "5:4", "4:5", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16", "21:9"];
  return isGemini31Image(model) ? [...base, "4:1", "1:4", "8:1", "1:8"] : base;
}

function inferGeminiImageSize(model: string, size: ImageSize | null) {
  if (!isGemini31Image(model) && !isGeminiProImage(model)) {
    return undefined;
  }

  const maxSide = size ? Math.max(size.width, size.height) : 1024;
  if (isGemini31Image(model) && maxSide <= 768) return "512";
  if (maxSide <= 1600) return "1K";
  if (maxSide <= 3200) return "2K";
  return "4K";
}

function geminiCanonicalSize(model: string, aspectRatio: string, imageSize?: string) {
  const baseSize = isGeminiProImage(model) || isGemini31Image(model)
    ? GEMINI_3_1K_SIZES[aspectRatio]
    : GEMINI_25_1K_SIZES[aspectRatio];
  const fallback = baseSize ?? GEMINI_25_1K_SIZES[aspectRatio] ?? "1024x1024";

  if (imageSize === "512") return scaleSize(fallback, 0.5);
  if (imageSize === "2K") return scaleSize(fallback, 2);
  if (imageSize === "4K") return scaleSize(fallback, 4);
  return fallback;
}

export function normalizeSize(value: string) {
  const cleaned = value.trim().replace(/×/g, "x").replace(/\s+/g, "");
  if (!/^\d+x\d+$/i.test(cleaned)) return "";
  return cleaned.toLowerCase();
}

export function parseSize(value: string): ImageSize | null {
  const normalized = normalizeSize(value);
  if (!normalized) return null;

  const [widthPart, heightPart] = normalized.split("x");
  const width = Number(widthPart);
  const height = Number(heightPart);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

export function getModelSizingProfile(model: string): ModelSizingProfile {
  if (isDalle2(model) || isDalle3(model) || isGptImage1(model)) {
    return { mode: "openaiFixed", label: "OpenAI fixed sizes" };
  }
  if (isGptImage2(model)) {
    return { mode: "gptImage2", label: "GPT Image 2 flexible sizes" };
  }
  if (isGeminiImage(model)) {
    return { mode: "geminiAspect", label: "Gemini / Nano Banana aspect ratios" };
  }
  return { mode: "free", label: "Free size" };
}

export function getSizePresetGroupsForModel(model: string): readonly SizePresetGroup[] {
  if (isDalle2(model)) return DALLE_2_SIZE_GROUPS;
  if (isDalle3(model)) return DALLE_3_SIZE_GROUPS;
  if (isGptImage1(model)) return GPT_IMAGE_1_SIZE_GROUPS;
  if (isGeminiImage(model)) {
    if (isGemini31Image(model)) return [...GEMINI_3_SIZE_GROUPS, ...GEMINI_31_EXTRA_SIZE_GROUPS];
    if (isGeminiProImage(model)) return GEMINI_3_SIZE_GROUPS;
    return GEMINI_25_SIZE_GROUPS;
  }
  return GENERAL_SIZE_GROUPS;
}

export function buildCompatibleImageRequest({
  model,
  prompt,
  size,
  extraParams = {},
}: CompatibleRequestParams): CompatibleRequestResult {
  const parsedSize = parseSize(size);
  const normalizedPrompt = prompt.trim();
  const nextExtraParams = { ...extraParams };
  const profile = getModelSizingProfile(model);

  if (isDalle2(model)) {
    return {
      prompt: normalizedPrompt,
      size: closestSize(parsedSize, DALLE_2_ALLOWED),
      extraParams: nextExtraParams,
    };
  }

  if (isDalle3(model)) {
    return {
      prompt: normalizedPrompt,
      size: closestSize(parsedSize, DALLE_3_ALLOWED),
      extraParams: nextExtraParams,
    };
  }

  if (isGptImage1(model)) {
    const normalized = size.trim().toLowerCase();
    return {
      prompt: normalizedPrompt,
      size: normalized === "auto" ? "auto" : closestSize(parsedSize, GPT_IMAGE_1_ALLOWED),
      extraParams: nextExtraParams,
    };
  }

  if (profile.mode === "gptImage2") {
    return {
      prompt: normalizedPrompt,
      size: normalizeGptImage2Size(parsedSize),
      extraParams: nextExtraParams,
    };
  }

  if (profile.mode === "geminiAspect") {
    const aspectRatio = String(nextExtraParams.aspect_ratio ?? nextExtraParams.aspectRatio ?? closestAspectRatio(parsedSize, geminiAspectRatios(model)));
    const imageSize = String(nextExtraParams.image_size ?? nextExtraParams.imageSize ?? inferGeminiImageSize(model, parsedSize) ?? "");
    const shouldAppendPromptAr = nextExtraParams.append_prompt_ar !== false;
    delete nextExtraParams.append_prompt_ar;

    if (!hasParam(nextExtraParams, "aspect_ratio") && !hasParam(nextExtraParams, "aspectRatio")) {
      nextExtraParams.aspect_ratio = aspectRatio;
    }
    if (imageSize && !hasParam(nextExtraParams, "image_size") && !hasParam(nextExtraParams, "imageSize")) {
      nextExtraParams.image_size = imageSize;
    }

    return {
      prompt:
        shouldAppendPromptAr && !hasPromptAspectRatio(normalizedPrompt)
          ? `${normalizedPrompt} --ar ${aspectRatio}`
          : normalizedPrompt,
      size: geminiCanonicalSize(model, aspectRatio, imageSize),
      extraParams: nextExtraParams,
    };
  }

  return {
    prompt: normalizedPrompt,
    size: normalizeSize(size) || size.trim(),
    extraParams: nextExtraParams,
  };
}
