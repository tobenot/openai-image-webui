// Fetches the OpenAI-compatible model list from `{baseUrl}/models`.
// Used by SettingsPanel to populate the Model dropdown on demand.

export type ModelCapability = "image" | "non-image";

const IMAGE_MODEL_LABEL = "Image";
const NON_IMAGE_MODEL_LABEL = "Non-image";

const IMAGE_MODEL_HINTS = [
  "image",
  "gpt-image",
  "flash-image-preview",
  "dall-e",
  "dalle",
  "stable-diffusion",
  "sd3",
  "sdxl",
  "flux",
  "midjourney",
  "imagen",
  "ideogram",
  "recraft",
  "seedream",
  "nano-banana",
  "nanobanana",
];


export interface ModelInfo {
  id: string;
  category: ModelCapability;
  categoryLabel: string;
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

function classifyModel(id: string): Pick<ModelInfo, "category" | "categoryLabel" | "isImageModel"> {
  const lower = id.toLowerCase();
  const isImageModel = IMAGE_MODEL_HINTS.some((keyword) => lower.includes(keyword));

  if (isImageModel) {
    return {
      category: "image",
      categoryLabel: IMAGE_MODEL_LABEL,
      isImageModel: true,
    };
  }

  return {
    category: "non-image",
    categoryLabel: NON_IMAGE_MODEL_LABEL,
    isImageModel: false,
  };
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

  const models = data.reduce<ModelInfo[]>((result, item) => {
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!id) return result;

    result.push({
      id,
      ...(typeof item.owned_by === "string" ? { ownedBy: item.owned_by } : {}),
      ...classifyModel(id),
    });
    return result;
  }, []);

  // Image models first, then alphabetical within each group.
  models.sort((a, b) => {
    if (a.isImageModel !== b.isImageModel) {
      return a.isImageModel ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });


  return models;
}
