export type ImageTaskStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "cancelled";

export type ImageResponseFormat = "url" | "b64_json";

export type RequestMode = "generate" | "edit";

export interface AppSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  responseFormat: ImageResponseFormat;
  concurrency: number;
}

/**
 * An image the user supplied as input (reference image for edits).
 * Stored in-memory only — not persisted to localStorage.
 */
export interface InputImageFile {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

export interface GenerateFormState {
  prompt: string;
  count: number;
  size: string;
  advancedJson: string;
  inputImages: InputImageFile[];
  maskImage: InputImageFile | null;
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
  mode: RequestMode;
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
  /**
   * Number of input images used for an edit request. Purely metadata for debug /
   * display; the actual File blobs are never persisted.
   */
  inputImageCount?: number;
  hasMask?: boolean;
}

export interface ImageCacheStats {
  count: number;
  size: number;
  warningBytes: number;
  overWarning: boolean;
}


export interface ReuseParamsPayload {
  model: string;
  prompt: string;
  size: string;
  responseFormat: ImageResponseFormat;
  extraParams?: Record<string, unknown>;
  /** Only available when File blobs are still in memory. */
  inputImages?: InputImageFile[];
  maskImage?: InputImageFile | null;
  /** True when the task was an edit but the reference images have been lost. */
  inputImagesLost?: boolean;
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

export interface EditImageParams extends GenerateImageParams {
  /** At least one image is required for edits. */
  images: File[];
  /** Optional inpainting mask — must match the first image's dimensions. */
  mask?: File | null;
}

export interface GenerateImageResult {
  imageUrl: string;
  b64Json?: string;
  raw: unknown;
  debug: ImageTaskDebug;
}


