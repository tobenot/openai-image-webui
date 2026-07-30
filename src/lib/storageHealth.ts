/**
 * Storage health signals.
 *
 * The persistence layer (localStorage + IndexedDB) can fail silently: quota
 * exhaustion, privacy mode, or the browser dropping the IndexedDB connection.
 * Swallowing those errors makes the app *look* fine while it quietly stops
 * saving anything, which is the worst possible failure mode to debug.
 *
 * This module is a tiny pub/sub channel: the storage layer reports problems,
 * the UI subscribes and surfaces them. Recoverable-and-irrelevant failures
 * (thumbnails, "recent sizes") intentionally do NOT report here — only issues
 * that mean the user is losing data.
 */

export type StorageIssueKind =
  | "taskQuotaExceeded"
  | "settingsWriteFailed"
  | "imageCacheWriteFailed"
  | "imageCacheEvictionFailed";

export interface StorageIssue {
  kind: StorageIssueKind;
  /** Non-localized technical detail, for the debug view only. */
  detail?: string;
  at: number;
}

type Listener = (issues: StorageIssue[]) => void;

const listeners = new Set<Listener>();
let issues: StorageIssue[] = [];

export function reportStorageIssue(kind: StorageIssueKind, detail?: unknown) {
  const message = detail instanceof Error ? detail.message : detail ? String(detail) : undefined;

  // Keep one entry per kind — repeated failures of the same kind are the norm
  // (every task update retries the same doomed write) and would flood the list.
  const next = issues.filter((issue) => issue.kind !== kind);
  next.push({ kind, detail: message, at: Date.now() });
  issues = next;
  listeners.forEach((listener) => listener(issues));
}

export function clearStorageIssues() {
  if (issues.length === 0) {
    return;
  }

  issues = [];
  listeners.forEach((listener) => listener(issues));
}

export function getStorageIssues() {
  return issues;
}

export function subscribeStorageIssues(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
