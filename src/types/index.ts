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

export interface ImageTaskDebug {
  endpoint: string;
  requestBody: Record<string, unknown>;
  responseStatus?: number;
  responseStatusText?: string;
  responseContentType?: string | null;
  responseBodyText?: string;
  parsedResponse?: unknown;
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
  imageCached?: boolean;
  imageMimeType?: string;
  imageSize?: number;
  error?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  raw?: unknown;
  debug?: ImageTaskDebug;
  extraParams?: Record<string, unknown>;
}

export interface ImageCacheStats {
  count: number;
  size: number;
  warningBytes: number;
  overWarning: boolean;
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
  debug: ImageTaskDebug;
}


