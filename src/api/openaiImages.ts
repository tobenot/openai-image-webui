import type { GenerateImageParams, GenerateImageResult } from "../types";

async function readApiError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");

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
    throw new Error(await readApiError(res));
  }

  const data = (await res.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
  };
  const item = data.data?.[0];

  if (!item) {
    throw new Error("No image data returned.");
  }

  if (item.url) {
    return {
      imageUrl: item.url,
      raw: data,
    };
  }

  if (item.b64_json) {
    return {
      imageUrl: `data:image/png;base64,${item.b64_json}`,
      b64Json: item.b64_json,
      raw: data,
    };
  }

  throw new Error("Unsupported image response format.");
}
