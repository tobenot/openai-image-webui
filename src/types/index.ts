export type ImageTaskStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "cancelled";

export type ImageResponseFormat = "url" | "b64_json";

export interface AppSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  responseFormat: ImageResponseFormat;
  concurrency: number;
}

export interface GenerateFormState {
  prompt: string;
  count: number;
  size: string;
  advancedJson: string;
}

export interface ImageTask {
  id: string;
  prompt: string;
  model: string;
  size: string;
  responseFormat: ImageResponseFormat;
  status: ImageTaskStatus;
  imageUrl?: string;
  b64Json?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  raw?: unknown;
  extraParams?: Record<string, unknown>;
}

export interface GenerateImageParams {
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
  size?: string;
  responseFormat?: ImageResponseFormat;
  extraParams?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface GenerateImageResult {
  imageUrl: string;
  b64Json?: string;
  raw: unknown;
}
