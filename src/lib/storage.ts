import type { AppSettings, GenerateFormState, ImageTask, ImageTaskStatus } from "../types";

export const STORAGE_KEYS = {
  settings: "openai-image-webui:settings",
  tasks: "openai-image-webui:tasks",
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  baseUrl: "",
  model: import.meta.env.VITE_DEFAULT_MODEL || "gpt-image-1",
  responseFormat: "url",
  concurrency: 3,
};

export const DEFAULT_FORM: GenerateFormState = {
  prompt: "",
  count: 1,
  size: "1024x1024",
  advancedJson: "",
  inputImages: [],
  maskImage: null,
};

const TASK_STATUSES = new Set<ImageTaskStatus>([
  "pending",
  "running",
  "success",
  "error",
  "cancelled",
]);

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage quota or privacy-mode failures.
  }
}

export function sanitizeSettings(value: Partial<AppSettings> | null): AppSettings {
  return {
    apiKey: typeof value?.apiKey === "string" ? value.apiKey : DEFAULT_SETTINGS.apiKey,
    baseUrl: typeof value?.baseUrl === "string" ? value.baseUrl : DEFAULT_SETTINGS.baseUrl,
    model: typeof value?.model === "string" ? value.model : DEFAULT_SETTINGS.model,
    responseFormat:
      value?.responseFormat === "b64_json" || value?.responseFormat === "url"
        ? value.responseFormat
        : DEFAULT_SETTINGS.responseFormat,
    concurrency:
      typeof value?.concurrency === "number" && Number.isFinite(value.concurrency)
        ? Math.max(1, Math.floor(value.concurrency))
        : DEFAULT_SETTINGS.concurrency,
  };
}

export function loadSettings(): AppSettings {
  return sanitizeSettings(readJson<Partial<AppSettings>>(STORAGE_KEYS.settings));
}

export function saveSettings(settings: AppSettings) {
  writeJson(STORAGE_KEYS.settings, sanitizeSettings(settings));
}

function restoreTask(value: Partial<ImageTask>): ImageTask | null {
  if (
    typeof value.id !== "string" ||
    typeof value.prompt !== "string" ||
    typeof value.model !== "string" ||
    typeof value.size !== "string" ||
    (value.responseFormat !== "url" && value.responseFormat !== "b64_json") ||
    !value.status ||
    !TASK_STATUSES.has(value.status) ||
    typeof value.createdAt !== "number"
  ) {
    return null;
  }

  // Legacy tasks persisted before the edit-mode feature have no `mode`.
  // Default them to "generate" so they keep rendering correctly.
  const migrated = {
    ...value,
    mode: value.mode === "edit" ? "edit" : "generate",
  } as ImageTask;

  if (migrated.status === "pending" || migrated.status === "running") {
    return {
      ...migrated,
      status: "cancelled",
      error: "tasks.messages.taskInterrupted",
      finishedAt: Date.now(),
    };
  }

  return migrated;
}

export function loadTasks(): ImageTask[] {
  const rawTasks = readJson<Partial<ImageTask>[]>(STORAGE_KEYS.tasks);

  if (!Array.isArray(rawTasks)) {
    return [];
  }

  return rawTasks.map(restoreTask).filter((task): task is ImageTask => task !== null);
}

function toPersistedTask(task: ImageTask): ImageTask {
  const { raw: _raw, ...persisted } = task;

  if (
    persisted.imageCached ||
    persisted.imageUrl?.startsWith("blob:") ||
    persisted.imageUrl?.startsWith("data:")
  ) {
    return {
      ...persisted,
      imageUrl: undefined,
      b64Json: undefined,
      raw: undefined,
    };
  }

  // When the image was NOT cached (e.g. IndexedDB write failed while tab was
  // in the background), keep b64Json so the next session can still recover it.
  // b64Json is large but losing the image entirely is worse.
  return {
    ...persisted,
    raw: undefined,
  };
}

export function saveTasks(tasks: ImageTask[]) {
  writeJson(STORAGE_KEYS.tasks, tasks.slice(-100).map(toPersistedTask));
}

