import type {
  EditImageParams,
  GenerateImageParams,
  GenerateImageResult,
  ImageTaskDebug,
} from "../types";

const DEBUG_LOG_PREFIX_GENERATE = "[openai-image-webui] images/generations";
const DEBUG_LOG_PREFIX_EDIT = "[openai-image-webui] images/edits";
const MAX_DEBUG_STRING_LENGTH = 1_000;

export class ImageGenerationError extends Error {
  debug: ImageTaskDebug;

  constructor(message: string, debug: ImageTaskDebug) {
    super(message);
    this.name = "ImageGenerationError";
    this.debug = debug;
  }
}

export function getImageGenerationDebug(error: unknown): ImageTaskDebug | undefined {
  return error instanceof ImageGenerationError ? error.debug : undefined;
}

function truncateDebugString(value: string) {
  if (value.length <= MAX_DEBUG_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_DEBUG_STRING_LENGTH)}… [truncated ${value.length - MAX_DEBUG_STRING_LENGTH} chars]`;
}

function sanitizeDebugValue(value: unknown): unknown {
  if (typeof value === "string") {
    return truncateDebugString(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeDebugValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        (key === "b64_json" || key === "data") && typeof nested === "string"
          ? truncateDebugString(nested)
          : sanitizeDebugValue(nested),
      ]),
    );
  }

  return value;
}


function createDebug(endpoint: string, requestBody: Record<string, unknown>): ImageTaskDebug {
  return {
    endpoint,
    requestBody: sanitizeDebugValue(requestBody) as Record<string, unknown>,
  };
}

function readApiError(res: Response, text: string): string {
  if (!text) {
    return `Request failed with status ${res.status}`;
  }

  try {
    const json = JSON.parse(text) as {
      error?: { message?: string };
      message?: string;
    };

    return json.error?.message || json.message || text;
  } catch {
    return text;
  }
}

function parseJsonResponse(text: string): unknown {
  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function getOpenAiImageItem(data: unknown): { url?: string; b64_json?: string } | undefined {
  if (!data || typeof data !== "object" || !("data" in data) || !Array.isArray(data.data)) {
    return undefined;
  }

  const [item] = data.data;

  if (!item || typeof item !== "object") {
    return undefined;
  }

  return item as { url?: string; b64_json?: string };
}

function fillResponseDebug(debug: ImageTaskDebug, res: Response, bodyText: string, parsed: unknown) {
  debug.responseStatus = res.status;
  debug.responseStatusText = res.statusText;
  debug.responseContentType = res.headers.get("content-type");
  debug.responseBodyText = truncateDebugString(bodyText);
  debug.parsedResponse = sanitizeDebugValue(parsed);
}

function imageItemToResult(
  parsed: unknown,
  debug: ImageTaskDebug,
): GenerateImageResult {
  const item = getOpenAiImageItem(parsed);

  if (!item) {
    throw new ImageGenerationError("No image data returned.", debug);
  }

  if (item.url) {
    return {
      imageUrl: item.url,
      raw: parsed,
      debug,
    };
  }

  if (item.b64_json) {
    return {
      imageUrl: `data:image/png;base64,${item.b64_json}`,
      b64Json: item.b64_json,
      raw: parsed,
      debug,
    };
  }

  throw new ImageGenerationError("Unsupported image response format.", debug);
}

function assertBasicParams(params: GenerateImageParams) {
  if (!params.apiKey.trim()) {
    throw new Error("API Key is required.");
  }
  if (!params.baseUrl.trim()) {
    throw new Error("API Base URL is required.");
  }
  if (!params.model.trim()) {
    throw new Error("Model is required.");
  }
  if (!params.prompt.trim()) {
    throw new Error("Prompt is required.");
  }
}

function joinBaseUrl(baseUrl: string, path: string) {
  return `${baseUrl.trim().replace(/\/$/, "")}${path}`;
}

export async function generateImage(
  params: GenerateImageParams,
): Promise<GenerateImageResult> {
  const {
    apiKey,
    baseUrl,
    model,
    prompt,
    size,
    responseFormat = "url",
    extraParams = {},
    signal,
  } = params;

  assertBasicParams(params);

  const endpoint = joinBaseUrl(baseUrl, "/images/generations");
  const body = {
    model: model.trim(),
    prompt: prompt.trim(),
    n: 1,
    ...(size?.trim() ? { size: size.trim() } : {}),
    ...(responseFormat ? { response_format: responseFormat } : {}),
    ...extraParams,
  };
  const debug = createDebug(endpoint, body);

  console.debug(`${DEBUG_LOG_PREFIX_GENERATE} request`, debug);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  const responseBodyText = await res.text().catch(() => "");
  const parsedResponse = parseJsonResponse(responseBodyText);
  fillResponseDebug(debug, res, responseBodyText, parsedResponse);

  console.debug(`${DEBUG_LOG_PREFIX_GENERATE} response`, debug);

  if (!res.ok) {
    throw new ImageGenerationError(readApiError(res, responseBodyText), debug);
  }

  if (!parsedResponse) {
    throw new ImageGenerationError("Invalid or empty JSON response.", debug);
  }

  return imageItemToResult(parsedResponse, debug);
}

/**
 * Call POST {baseUrl}/images/edits with multipart/form-data.
 *
 * IMPORTANT: Do NOT set Content-Type manually when sending FormData. The browser
 * must populate the boundary itself; servers reject requests where the boundary
 * is missing or mismatched.
 */
export async function editImage(params: EditImageParams): Promise<GenerateImageResult> {
  const {
    apiKey,
    baseUrl,
    model,
    prompt,
    size,
    responseFormat = "url",
    extraParams = {},
    images,
    mask,
    signal,
  } = params;

  assertBasicParams(params);

  if (!images.length) {
    throw new Error("At least one input image is required for edits.");
  }

  const endpoint = joinBaseUrl(baseUrl, "/images/edits");
  const form = new FormData();
  form.append("model", model.trim());
  form.append("prompt", prompt.trim());
  form.append("n", "1");
  if (size?.trim()) {
    form.append("size", size.trim());
  }
  if (responseFormat) {
    form.append("response_format", responseFormat);
  }

  // Multi-image reference: append the same field name multiple times. The
  // server sees it as an array. Both "image" and "image[]" are used in the
  // wild; "image" is the form accepted by OpenAI's own docs.
  images.forEach((file) => {
    form.append("image", file, file.name);
  });

  if (mask) {
    form.append("mask", mask, mask.name);
  }

  // Passthrough of quality / background / output_format / seed / etc.
  for (const [key, value] of Object.entries(extraParams)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      form.append(key, String(value));
    } else {
      // Arrays / objects are JSON-stringified; behaviour varies by upstream,
      // but this matches what OpenAI-compatible relays commonly accept.
      form.append(key, JSON.stringify(value));
    }
  }

  const debugBody: Record<string, unknown> = {
    model: model.trim(),
    prompt: prompt.trim(),
    n: 1,
    size: size?.trim(),
    response_format: responseFormat,
    imageCount: images.length,
    imageNames: images.map((f) => `${f.name} (${f.type}, ${f.size}B)`),
    hasMask: Boolean(mask),
    maskName: mask ? `${mask.name} (${mask.type}, ${mask.size}B)` : undefined,
    extraParams,
  };
  const debug = createDebug(endpoint, debugBody);

  console.debug(`${DEBUG_LOG_PREFIX_EDIT} request`, debug);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      // No Content-Type — browser will attach multipart boundary automatically.
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
    signal,
  });

  const responseBodyText = await res.text().catch(() => "");
  const parsedResponse = parseJsonResponse(responseBodyText);
  fillResponseDebug(debug, res, responseBodyText, parsedResponse);

  console.debug(`${DEBUG_LOG_PREFIX_EDIT} response`, debug);

  if (!res.ok) {
    throw new ImageGenerationError(readApiError(res, responseBodyText), debug);
  }

  if (!parsedResponse) {
    throw new ImageGenerationError("Invalid or empty JSON response.", debug);
  }

  return imageItemToResult(parsedResponse, debug);
}
