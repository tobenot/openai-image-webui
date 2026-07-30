import type { ImageCacheStats, ImageResponseFormat } from "../types";
import { reportStorageIssue } from "./storageHealth";

const DB_NAME = "openai-image-webui-cache";
const DB_VERSION = 2;
const STORE_NAME = "images";

export const IMAGE_CACHE_WARNING_BYTES = 200 * 1024 * 1024;

/**
 * Hard ceiling for the image cache. Beyond this we evict oldest-first instead
 * of waiting for the browser to reject writes — a rejected write means the
 * generated image is gone for good, which is far worse than dropping an old one.
 */
export const IMAGE_CACHE_LIMIT_BYTES = 400 * 1024 * 1024;

export interface CachedImageMetadata {
  prompt?: string;
  model?: string;
  generationSize?: string;
  responseFormat?: ImageResponseFormat;
  taskCreatedAt?: number;
}

export interface CachedImageRecord extends CachedImageMetadata {
  id: string;
  blob: Blob;
  mimeType: string;
  size: number;
  cachedAt: number;
}

export interface CachedImagePage {
  images: CachedImageRecord[];
  hasMore: boolean;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      let store: IDBObjectStore;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
      } else {
        store = request.transaction?.objectStore(STORE_NAME) as IDBObjectStore;
      }

      if (!store.indexNames.contains("cachedAt")) {
        store.createIndex("cachedAt", "cachedAt");
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      // If the browser closes the connection behind our back (e.g. when the
      // tab is in the background for a long time), clear the cached promise so
      // the next call will re-open the database automatically.
      db.onclose = () => {
        dbPromise = null;
      };

      resolve(db);
    };
    request.onerror = () => {
      // Clear the cached promise so the next attempt can retry.
      dbPromise = null;
      reject(request.error ?? new Error("Failed to open IndexedDB."));
    };
  });

  return dbPromise;
}

function runTransactionOnce<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let transaction: IDBTransaction;

    try {
      transaction = db.transaction(STORE_NAME, mode);
    } catch (error) {
      // The connection may have been silently closed (InvalidStateError).
      // Clear the cached promise so the next openDb() call will reconnect.
      dbPromise = null;
      reject(error);
      return;
    }

    const store = transaction.objectStore(STORE_NAME);

    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    run(store, resolve, reject);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  return openDb()
    .then((db) => runTransactionOnce<T>(db, mode, run))
    .catch((firstError) => {
      // If the first attempt failed because the connection was stale, retry
      // once with a fresh connection.
      if (dbPromise === null) {
        return openDb().then((db) => runTransactionOnce<T>(db, mode, run));
      }

      throw firstError;
    });
}

function getMimeTypeFromDataUrl(dataUrl: string) {
  return dataUrl.match(/^data:([^;,]+)/)?.[1] || "image/png";
}

function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(",");

  if (commaIndex < 0) {
    throw new Error("Invalid data URL.");
  }

  const header = dataUrl.slice(0, commaIndex);
  const body = dataUrl.slice(commaIndex + 1);
  const mimeType = getMimeTypeFromDataUrl(header);
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function imageUrlToBlob(imageUrl: string, signal?: AbortSignal) {
  if (imageUrl.startsWith("data:")) {
    return dataUrlToBlob(imageUrl);
  }

  const response = await fetch(imageUrl, { signal });

  if (!response.ok) {
    throw new Error(`Image fetch failed with status ${response.status}.`);
  }

  return response.blob();
}

export async function cacheImageFromUrl(
  id: string,
  imageUrl: string,
  metadata: CachedImageMetadata = {},
  signal?: AbortSignal,
): Promise<CachedImageRecord> {
  const blob = await imageUrlToBlob(imageUrl, signal);
  const existing = await getCachedImage(id).catch(() => null);
  const record: CachedImageRecord = {
    ...existing,
    ...metadata,
    id,
    blob,
    mimeType: blob.type || existing?.mimeType || "image/png",
    size: blob.size,
    cachedAt: Date.now(),
  };

  await saveCachedImage(record);
  return record;
}

function putRecord(record: CachedImageRecord) {
  return runTransaction<void>("readwrite", (store, resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Deletes oldest-first until at least `bytesNeeded` has been freed.
 * `protectedId` is never evicted — it is the record we are trying to store.
 */
function evictOldest(bytesNeeded: number, protectedId?: string): Promise<number> {
  return runTransaction<number>("readwrite", (store, resolve, reject) => {
    const request = store.index("cachedAt").openCursor(null, "next");
    let freed = 0;

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor || freed >= bytesNeeded) {
        resolve(freed);
        return;
      }

      const record = cursor.value as CachedImageRecord;

      if (record.id === protectedId) {
        cursor.continue();
        return;
      }

      freed += typeof record.size === "number" ? record.size : record.blob?.size ?? 0;
      cursor.delete();
      cursor.continue();
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Cached total byte size, so the common write path does not have to scan the
 * whole store. `null` means "unknown, needs a full measure" — which is also
 * what every mutation outside this module resets it to.
 */
let cachedTotalBytes: number | null = null;

function invalidateSizeCache() {
  cachedTotalBytes = null;
}

async function getTotalBytes(): Promise<number> {
  if (cachedTotalBytes !== null) {
    return cachedTotalBytes;
  }

  const stats = await getImageCacheStats();
  cachedTotalBytes = stats.size;
  return cachedTotalBytes;
}

export async function saveCachedImage(record: CachedImageRecord) {
  // Proactively make room so we stay under the ceiling, rather than waiting for
  // the browser to reject the write (by which point the image is already lost).
  try {
    const total = await getTotalBytes();

    if (total + record.size > IMAGE_CACHE_LIMIT_BYTES) {
      const freed = await evictOldest(total + record.size - IMAGE_CACHE_LIMIT_BYTES, record.id);
      cachedTotalBytes = Math.max(0, total - freed);
    }
  } catch (error) {
    invalidateSizeCache();
    reportStorageIssue("imageCacheEvictionFailed", error);
  }

  try {
    await putRecord(record);
    cachedTotalBytes = cachedTotalBytes === null ? null : cachedTotalBytes + record.size;
    return;
  } catch (error) {
    // Quota rejection despite our own accounting (other origins consuming the
    // shared budget, or a much smaller browser-imposed quota than we assumed).
    // Free several times the record size and retry once.
    invalidateSizeCache();

    try {
      await evictOldest(Math.max(record.size * 4, 32 * 1024 * 1024), record.id);
      await putRecord(record);
      return;
    } catch (retryError) {
      reportStorageIssue("imageCacheWriteFailed", retryError ?? error);
      throw retryError ?? error;
    }
  }
}

export function getCachedImage(id: string) {
  return runTransaction<CachedImageRecord | null>("readonly", (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve((request.result as CachedImageRecord | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export function listCachedImages(offset = 0, limit = 50): Promise<CachedImagePage> {
  return runTransaction<CachedImagePage>("readonly", (store, resolve, reject) => {
    const index = store.index("cachedAt");
    const request = index.openCursor(null, "prev");
    const images: CachedImageRecord[] = [];
    let skipped = 0;

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        resolve({ images, hasMore: false });
        return;
      }

      if (skipped < offset) {
        skipped += 1;
        cursor.continue();
        return;
      }

      if (images.length >= limit) {
        resolve({ images, hasMore: true });
        return;
      }

      images.push(cursor.value as CachedImageRecord);
      cursor.continue();
    };

    request.onerror = () => reject(request.error);
  });
}

export async function deleteCachedImage(id: string) {
  // Any external mutation makes the running byte total unreliable.
  invalidateSizeCache();

  return runTransaction<void>("readwrite", (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearImageCache() {
  invalidateSizeCache();

  await runTransaction<void>("readwrite", (store, resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  cachedTotalBytes = 0;
}

export function getImageCacheStats(): Promise<ImageCacheStats> {
  return runTransaction<ImageCacheStats>("readonly", (store, resolve, reject) => {
    let count = 0;
    let size = 0;
    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        resolve({
          count,
          size,
          warningBytes: IMAGE_CACHE_WARNING_BYTES,
          overWarning: size >= IMAGE_CACHE_WARNING_BYTES,
        });
        return;
      }

      const record = cursor.value as CachedImageRecord;
      count += 1;
      size += typeof record.size === "number" ? record.size : record.blob?.size ?? 0;
      cursor.continue();
    };

    request.onerror = () => reject(request.error);
  });
}
