// Fetches the OpenAI-compatible model list from `{baseUrl}/models`.
// Used by SettingsPanel to populate the Model dropdown on demand.

export type ModelCapability =
  | "image-generation"
  | "image-editing"
  | "image-related"
  | "video"
  | "other";

interface ModelCapabilityRule {
  category: ModelCapability;
  label: string;
  keywords: string[];
}

const MODEL_CAPABILITY_RULES: ModelCapabilityRule[] = [
  {
    category: "image-editing",
    label: "Image editing",
    keywords: ["edit", "editing", "inpaint", "outpaint", "variation", "controlnet", "seededit"],
  },
  {
    category: "image-generation",
    label: "Image generation",
    keywords: [
      "gpt-image",
      "dall-e",
      "dalle",
      "flux",
      "stable-diffusion",
      "sd3",
      "midjourney",
      "imagen",
      "kontext",
      "sora-image",
      "sora_image",
      "gemini-flash-image",
      "gemini_flash_image",
      "nano-banana",
      "nanobanana",
      "seedream",
      "ideogram",
      "recraft",
      "leonardo",
    ],
  },
  {
    category: "image-related",
    label: "Image-related",
    keywords: ["image", "img", "photo", "picture", "vision", "visual"],
  },
  {
    category: "video",
    label: "Video",
    keywords: ["sora", "video", "kling", "runway", "pika", "luma"],
  },
];

const OTHER_MODEL_LABEL = "Other";

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
  const rule = MODEL_CAPABILITY_RULES.find((item) =>
    item.keywords.some((keyword) => lower.includes(keyword)),
  );

  if (!rule) {
    return {
      category: "other",
      categoryLabel: OTHER_MODEL_LABEL,
      isImageModel: false,
    };
  }

  return {
    category: rule.category,
    categoryLabel: rule.label,
    isImageModel: rule.category.startsWith("image-"),
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

  // Image models first, then category, then alphabetical within each group.
  models.sort((a, b) => {
    if (a.isImageModel !== b.isImageModel) {
      return a.isImageModel ? -1 : 1;
    }
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.id.localeCompare(b.id);
  });

  return models;
}
