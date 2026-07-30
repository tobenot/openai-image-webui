import type { AppSettings, BatchFormState, GenerateFormState, ImageTask, ImageTaskStatus, VisionFormState } from "../types";
import { reportStorageIssue } from "./storageHealth";


export const STORAGE_KEYS = {
  settings: "openai-image-webui:settings",
  tasks: "openai-image-webui:tasks",
  batchPrompts: "openai-image-webui:batch-prompts",
} as const;

const PERSISTED_TASKS_LIMIT = 500;

/**
 * Upper bound on concurrent requests. The settings input has `max={10}`, but
 * HTML number inputs do not actually reject out-of-range values, and nothing
 * stops a hand-edited localStorage entry. Clamping here keeps the app from
 * firing hundreds of parallel requests and exhausting the connection pool.
 */
export const MAX_CONCURRENCY = 10;

/**
 * Total budget for base64 image payloads kept in localStorage as a recovery
 * fallback. A single 1024x1024 PNG is ~1.5-2 MB as base64, and the whole
 * localStorage origin quota is typically only ~5 MB — a handful of uncached
 * images would otherwise wipe out the entire task history.
 */
const B64_FALLBACK_BUDGET_BYTES = 1_500_000;

/** Vision prompt i18n key — resolved by the caller so it follows the UI language. */
export const DEFAULT_VISION_PROMPT_KEY = "vision.defaultPrompt";

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  baseUrl: "",
  model: import.meta.env.VITE_DEFAULT_MODEL || "gpt-image-1",
  visionModel: import.meta.env.VITE_DEFAULT_VISION_MODEL || "gpt-4.1-mini",
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

export const DEFAULT_VISION_FORM: VisionFormState = {
  // Left empty on purpose: the real default is localized and injected by
  // VisionPanel, so switching UI language switches the placeholder prompt too.
  prompt: "",
  advancedJson: "",
  inputImages: [],
  detail: "high",
};

export const DEFAULT_BATCH_FORM: BatchFormState = {
  promptsText: "",
  size: "1024x1024",
  advancedJson: "",
  inputImages: [],
  countPerPrompt: 1,
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

export function writeJson<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Caller decides whether this is worth surfacing to the user.
    return false;
  }
}

export function sanitizeSettings(value: Partial<AppSettings> | null): AppSettings {
  return {
    apiKey: typeof value?.apiKey === "string" ? value.apiKey : DEFAULT_SETTINGS.apiKey,
    baseUrl: typeof value?.baseUrl === "string" ? value.baseUrl : DEFAULT_SETTINGS.baseUrl,
    model: typeof value?.model === "string" ? value.model : DEFAULT_SETTINGS.model,
    visionModel: typeof value?.visionModel === "string" ? value.visionModel : DEFAULT_SETTINGS.visionModel,
    responseFormat:

      value?.responseFormat === "b64_json" || value?.responseFormat === "url"
        ? value.responseFormat
        : DEFAULT_SETTINGS.responseFormat,
    concurrency:
      typeof value?.concurrency === "number" && Number.isFinite(value.concurrency)
        ? Math.min(MAX_CONCURRENCY, Math.max(1, Math.floor(value.concurrency)))
        : DEFAULT_SETTINGS.concurrency,
  };
}

export function loadSettings(): AppSettings {
  return sanitizeSettings(readJson<Partial<AppSettings>>(STORAGE_KEYS.settings));
}

export function saveSettings(settings: AppSettings) {
  if (!writeJson(STORAGE_KEYS.settings, sanitizeSettings(settings))) {
    reportStorageIssue("settingsWriteFailed");
  }
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
    mode: value.mode === "edit" || value.mode === "vision" ? value.mode : "generate",
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

function stripPayload(task: ImageTask): ImageTask {
  return {
    ...task,
    imageUrl: undefined,
    b64Json: undefined,
    raw: undefined,
  };
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

/**
 * Keeps b64 recovery payloads within a fixed byte budget, newest first.
 * Without this, a few failed cache writes can consume the whole localStorage
 * quota and silently kill task-history persistence altogether.
 */
function applyB64Budget(tasks: ImageTask[]): ImageTask[] {
  let remaining = B64_FALLBACK_BUDGET_BYTES;

  // Walk newest -> oldest so the most recently generated images keep their
  // fallback payload when the budget runs out.
  const result = new Array<ImageTask>(tasks.length);

  for (let index = tasks.length - 1; index >= 0; index -= 1) {
    const task = tasks[index];

    if (!task.b64Json) {
      result[index] = task;
      continue;
    }

    if (task.b64Json.length <= remaining) {
      remaining -= task.b64Json.length;
      result[index] = task;
    } else {
      result[index] = { ...task, b64Json: undefined };
    }
  }

  return result;
}

export function saveTasks(tasks: ImageTask[]) {
  const trimmed = tasks.slice(-PERSISTED_TASKS_LIMIT).map(toPersistedTask);

  if (writeJson(STORAGE_KEYS.tasks, applyB64Budget(trimmed))) {
    return;
  }

  // Quota exceeded. Retry without any image payloads at all — keeping the task
  // history (prompts, params, costs) matters more than the recovery fallback.
  if (writeJson(STORAGE_KEYS.tasks, trimmed.map(stripPayload))) {
    reportStorageIssue("taskQuotaExceeded");
    return;
  }

  // Still failing: drop to the most recent tasks only.
  const recent = trimmed.slice(-50).map(stripPayload);
  writeJson(STORAGE_KEYS.tasks, recent);
  reportStorageIssue("taskQuotaExceeded");
}

export function loadBatchPrompts(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.batchPrompts) ?? "";
  } catch {
    return "";
  }
}

export function saveBatchPrompts(value: string) {
  try {
    localStorage.setItem(STORAGE_KEYS.batchPrompts, value);
  } catch {
    // Ignore localStorage quota or privacy-mode failures.
  }
}

