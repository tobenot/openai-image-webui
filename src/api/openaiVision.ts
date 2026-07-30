import type { ImageTaskDebug, VisionAnalysisParams, VisionAnalysisResult } from "../types";
import { stripInternalParams } from "./requestShaping";

const DEBUG_LOG_PREFIX_VISION = "[openai-image-webui] responses/vision";
const MAX_DEBUG_STRING_LENGTH = 1_000;

export class VisionAnalysisError extends Error {
  debug: ImageTaskDebug;

  constructor(message: string, debug: ImageTaskDebug) {
    super(message);
    this.name = "VisionAnalysisError";
    this.debug = debug;
  }
}

export function getVisionAnalysisDebug(error: unknown): ImageTaskDebug | undefined {
  return error instanceof VisionAnalysisError ? error.debug : undefined;
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
        (key === "image_url" || key === "url") && typeof nested === "string"
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

function fillResponseDebug(debug: ImageTaskDebug, res: Response, bodyText: string, parsed: unknown) {
  debug.responseStatus = res.status;
  debug.responseStatusText = res.statusText;
  debug.responseContentType = res.headers.get("content-type");
  debug.responseBodyText = truncateDebugString(bodyText);
  debug.parsedResponse = sanitizeDebugValue(parsed);
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

function joinBaseUrl(baseUrl: string, path: string) {
  return `${baseUrl.trim().replace(/\/$/, "")}${path}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read image as data URL."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });
}

function extractOutputText(parsed: unknown): string {
  if (!parsed || typeof parsed !== "object") {
    return "";
  }

  if ("output_text" in parsed && typeof parsed.output_text === "string") {
    return parsed.output_text.trim();
  }

  if (!("output" in parsed) || !Array.isArray(parsed.output)) {
    return "";
  }

  const parts: string[] = [];
  for (const item of parsed.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (!content || typeof content !== "object") {
        continue;
      }
      if ("text" in content && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}

export async function analyzeImages(params: VisionAnalysisParams): Promise<VisionAnalysisResult> {
  const {
    apiKey,
    baseUrl,
    model,
    prompt,
    images,
    detail = "high",
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
    throw new Error("Vision model is required.");
  }
  if (!prompt.trim()) {
    throw new Error("OCR prompt is required.");
  }
  if (!images.length) {
    throw new Error("At least one image is required for OCR.");
  }

  const endpoint = joinBaseUrl(baseUrl, "/responses");
  const imageParts = await Promise.all(
    images.map(async (file) => ({
      type: "input_image",
      image_url: await fileToDataUrl(file),
      detail,
    })),
  );
  const body = {
    model: model.trim(),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt.trim(),
          },
          ...imageParts,
        ],
      },
    ],
    ...stripInternalParams(extraParams),
  };
  const debug = createDebug(endpoint, body);

  console.debug(`${DEBUG_LOG_PREFIX_VISION} request`, debug);

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

  console.debug(`${DEBUG_LOG_PREFIX_VISION} response`, debug);

  if (!res.ok) {
    throw new VisionAnalysisError(readApiError(res, responseBodyText), debug);
  }

  if (!parsedResponse) {
    throw new VisionAnalysisError("Invalid or empty JSON response.", debug);
  }

  const outputText = extractOutputText(parsedResponse);
  if (!outputText) {
    throw new VisionAnalysisError("No text output returned.", debug);
  }

  return {
    outputText,
    raw: parsedResponse,
    debug,
  };
}
