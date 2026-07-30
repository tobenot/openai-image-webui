/**
 * Per-request cost estimation.
 *
 * Numbers below reflect OpenAI's official list pricing as of 2026-05 and are
 * baked in — there is no override UI. Anything routed through a relay (or any
 * model not listed here) will not match, so treat every figure as a rough
 * reference, not a bill.
 *
 * Models with no entry report "unknown" rather than silently showing nothing,
 * so the UI can tell "we don't know" apart from "it's free".
 */

// ---------- Types ----------

export interface ImagePricing {
  /** Cost per image in USD. Keyed by "{size}" or "{size}:{quality}". Fallback key: "default". */
  perImage: Record<string, number>;
}

export interface TokenPricing {
  /** USD per 1M input tokens */
  inputPerMillion: number;
  /** USD per 1M output tokens */
  outputPerMillion: number;
  /** USD per 1M cached input tokens (if applicable) */
  cachedInputPerMillion?: number;
}

export interface UsageInfo {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  /** For image models that report image count directly */
  imageCount?: number;
}

// ---------- Default Pricing Table ----------

const IMAGE_MODEL_PRICING: Record<string, ImagePricing> = {
  "gpt-image-1": {
    perImage: {
      "1024x1024:low": 0.011,
      "1024x1024:medium": 0.042,
      "1024x1024:high": 0.167,
      "1536x1024:low": 0.016,
      "1536x1024:medium": 0.063,
      "1536x1024:high": 0.25,
      "1024x1536:low": 0.016,
      "1024x1536:medium": 0.063,
      "1024x1536:high": 0.25,
      "auto:low": 0.011,
      "auto:medium": 0.042,
      "auto:high": 0.167,
      default: 0.042,
    },
  },
  "dall-e-3": {
    perImage: {
      "1024x1024:standard": 0.04,
      "1024x1024:hd": 0.08,
      "1792x1024:standard": 0.08,
      "1792x1024:hd": 0.12,
      "1024x1792:standard": 0.08,
      "1024x1792:hd": 0.12,
      default: 0.04,
    },
  },
  "dall-e-2": {
    perImage: {
      "1024x1024": 0.02,
      "512x512": 0.018,
      "256x256": 0.016,
      default: 0.02,
    },
  },
};

const TOKEN_MODEL_PRICING: Record<string, TokenPricing> = {
  "gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6, cachedInputPerMillion: 0.1 },
  "gpt-4.1-nano": { inputPerMillion: 0.1, outputPerMillion: 0.4, cachedInputPerMillion: 0.025 },
  "gpt-4.1": { inputPerMillion: 2.0, outputPerMillion: 8.0, cachedInputPerMillion: 0.5 },
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10.0, cachedInputPerMillion: 1.25 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6, cachedInputPerMillion: 0.075 },
};

// ---------- Helpers ----------

function normalizeModelKey(model: string): string {
  return model.trim().toLowerCase();
}

function findImagePricing(model: string): ImagePricing | undefined {
  const key = normalizeModelKey(model);
  for (const [pattern, pricing] of Object.entries(IMAGE_MODEL_PRICING)) {
    if (key === pattern || key.startsWith(pattern)) {
      return pricing;
    }
  }
  return undefined;
}

function findTokenPricing(model: string): TokenPricing | undefined {
  const key = normalizeModelKey(model);
  for (const [pattern, pricing] of Object.entries(TOKEN_MODEL_PRICING)) {
    if (key === pattern || key.startsWith(pattern)) {
      return pricing;
    }
  }
  return undefined;
}

/** True when we have no pricing data for this image model at all. */
export function isImagePricingUnknown(model: string): boolean {
  return findImagePricing(model) === undefined;
}

/** True when we have no pricing data for this token-billed model at all. */
export function isTokenPricingUnknown(model: string): boolean {
  return findTokenPricing(model) === undefined;
}

// ---------- Extract usage from raw API response ----------

export function extractUsageFromRaw(raw: unknown): UsageInfo | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const obj = raw as Record<string, unknown>;

  // OpenAI Responses API shape: { usage: { input_tokens, output_tokens, ... } }
  if (obj.usage && typeof obj.usage === "object") {
    const usage = obj.usage as Record<string, unknown>;
    const info: UsageInfo = {};

    if (typeof usage.input_tokens === "number") info.inputTokens = usage.input_tokens;
    if (typeof usage.output_tokens === "number") info.outputTokens = usage.output_tokens;

    // Nested details
    if (usage.input_tokens_details && typeof usage.input_tokens_details === "object") {
      const details = usage.input_tokens_details as Record<string, unknown>;
      if (typeof details.cached_tokens === "number") info.cachedInputTokens = details.cached_tokens;
    }

    if (info.inputTokens !== undefined || info.outputTokens !== undefined) {
      return info;
    }
  }

  // Some relays put usage at top level
  if (typeof obj.input_tokens === "number" || typeof obj.output_tokens === "number") {
    return {
      inputTokens: typeof obj.input_tokens === "number" ? obj.input_tokens : undefined,
      outputTokens: typeof obj.output_tokens === "number" ? obj.output_tokens : undefined,
    };
  }

  return undefined;
}

// ---------- Cost estimation ----------

export interface CostEstimate {
  /** Estimated cost in USD */
  usd: number;
  /** How it was calculated */
  method: "per-image" | "per-token" | "unknown";
}

/**
 * Estimate cost for an image generation/edit task.
 */
export function estimateImageCost(
  model: string,
  size: string,
  quality?: string,
  imageCount = 1,
): CostEstimate | undefined {
  const pricing = findImagePricing(model);
  if (!pricing) return undefined;

  const sizeNorm = size.trim().toLowerCase();
  const qualityNorm = (quality ?? "medium").trim().toLowerCase();

  // Try exact match with quality, then without, then default
  const lookupKeys = [
    `${sizeNorm}:${qualityNorm}`,
    sizeNorm,
    "default",
  ];

  for (const key of lookupKeys) {
    if (key in pricing.perImage) {
      return {
        usd: pricing.perImage[key] * imageCount,
        method: "per-image",
      };
    }
  }

  // Fallback: use default if exists
  if ("default" in pricing.perImage) {
    return {
      usd: pricing.perImage["default"] * imageCount,
      method: "per-image",
    };
  }

  return undefined;
}

/**
 * Estimate cost for a vision/text task based on token usage.
 */
export function estimateTokenCost(
  model: string,
  usage: UsageInfo,
): CostEstimate | undefined {
  const pricing = findTokenPricing(model);
  if (!pricing) return undefined;

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const cachedTokens = usage.cachedInputTokens ?? 0;
  const nonCachedInput = Math.max(0, inputTokens - cachedTokens);

  const inputCost = (nonCachedInput / 1_000_000) * pricing.inputPerMillion;
  const cachedCost = (cachedTokens / 1_000_000) * (pricing.cachedInputPerMillion ?? pricing.inputPerMillion);
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return {
    usd: inputCost + cachedCost + outputCost,
    method: "per-token",
  };
}

/**
 * Format cost for display. Shows in cents if < $0.01.
 */
export function formatCostUsd(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.001) return `<$0.001`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
