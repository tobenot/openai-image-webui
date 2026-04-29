// Fetches the OpenAI-compatible model list from `{baseUrl}/models`.
// Used by SettingsPanel to populate the Model dropdown on demand.

const IMAGE_MODEL_KEYWORDS = [
  "image",
  "dall-e",
  "dalle",
  "flux",
  "stable-diffusion",
  "sd3",
  "midjourney",
  "imagen",
  "kontext",
];

export interface ModelInfo {
  id: string;
  isImageModel: boolean;
  ownedBy?: string;
}

export interface FetchModelsParams {
  apiKey: string;
  baseUrl: string;
  signal?: AbortSignal;
}

interface ModelListResponse {
  data?: Array<{ id?: string; owned_by?: string }>;
}

function classifyImageModel(id: string): boolean {
  const lower = id.toLowerCase();
  return IMAGE_MODEL_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export async function fetchModels(params: FetchModelsParams): Promise<ModelInfo[]> {
  const { apiKey, baseUrl, signal } = params;

  if (!apiKey.trim()) {
    throw new Error("API Key is required to fetch models.");
  }

  if (!baseUrl.trim()) {
    throw new Error("API Base URL is required to fetch models.");
  }

  const endpoint = `${baseUrl.trim().replace(/\/$/, "")}/models`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to fetch models (status ${res.status}).`);
  }

  const json = (await res.json()) as ModelListResponse;
  const data = Array.isArray(json.data) ? json.data : [];

  const models: ModelInfo[] = data
    .map((item) => {
      const id = typeof item.id === "string" ? item.id.trim() : "";
      if (!id) return null;
      return {
        id,
        ownedBy: typeof item.owned_by === "string" ? item.owned_by : undefined,
        isImageModel: classifyImageModel(id),
      } satisfies ModelInfo;
    })
    .filter((item): item is ModelInfo => item !== null);

  // Image models first, then alphabetical within each group.
  models.sort((a, b) => {
    if (a.isImageModel !== b.isImageModel) {
      return a.isImageModel ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });

  return models;
}
