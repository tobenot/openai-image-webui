import type { GenerateImageParams, GenerateImageResult, ImageTaskDebug } from "../types";

const DEBUG_LOG_PREFIX = "[openai-image-webui] images/generations";
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

  if (!apiKey.trim()) {
    throw new Error("API Key is required.");
  }

  if (!baseUrl.trim()) {
    throw new Error("API Base URL is required.");
  }

  if (!model.trim()) {
    throw new Error("Model is required.");
  }

  if (!prompt.trim()) {
    throw new Error("Prompt is required.");
  }

  const endpoint = `${baseUrl.trim().replace(/\/$/, "")}/images/generations`;
  const body = {
    model: model.trim(),
    prompt: prompt.trim(),
    n: 1,
    ...(size?.trim() ? { size: size.trim() } : {}),
    ...(responseFormat ? { response_format: responseFormat } : {}),
    ...extraParams,
  };
  const debug = createDebug(endpoint, body);

  console.debug(`${DEBUG_LOG_PREFIX} request`, debug);

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

  debug.responseStatus = res.status;
  debug.responseStatusText = res.statusText;
  debug.responseContentType = res.headers.get("content-type");
  debug.responseBodyText = truncateDebugString(responseBodyText);
  debug.parsedResponse = sanitizeDebugValue(parsedResponse);

  console.debug(`${DEBUG_LOG_PREFIX} response`, debug);

  if (!res.ok) {
    throw new ImageGenerationError(readApiError(res, responseBodyText), debug);
  }

  if (!parsedResponse) {
    throw new ImageGenerationError("Invalid or empty JSON response.", debug);
  }

  const item = getOpenAiImageItem(parsedResponse);

  if (!item) {
    throw new ImageGenerationError("No image data returned.", debug);
  }

  if (item.url) {
    return {
      imageUrl: item.url,
      raw: parsedResponse,
      debug,
    };
  }

  if (item.b64_json) {
    return {
      imageUrl: `data:image/png;base64,${item.b64_json}`,
      b64Json: item.b64_json,
      raw: parsedResponse,
      debug,
    };
  }

  throw new ImageGenerationError("Unsupported image response format.", debug);
}

