import type { ImageCacheStats } from "../types";

const DB_NAME = "openai-image-webui-cache";
const DB_VERSION = 1;
const STORE_NAME = "images";

export const IMAGE_CACHE_WARNING_BYTES = 200 * 1024 * 1024;

export interface CachedImageRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  size: number;
  cachedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("cachedAt", "cachedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });

  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);

        transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
        run(store, resolve, reject);
      }),
  );
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
  signal?: AbortSignal,
): Promise<CachedImageRecord> {
  const blob = await imageUrlToBlob(imageUrl, signal);
  const record: CachedImageRecord = {
    id,
    blob,
    mimeType: blob.type || "image/png",
    size: blob.size,
    cachedAt: Date.now(),
  };

  await saveCachedImage(record);
  return record;
}

export function saveCachedImage(record: CachedImageRecord) {
  return runTransaction<void>("readwrite", (store, resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function getCachedImage(id: string) {
  return runTransaction<CachedImageRecord | null>("readonly", (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve((request.result as CachedImageRecord | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export function deleteCachedImage(id: string) {
  return runTransaction<void>("readwrite", (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function clearImageCache() {
  return runTransaction<void>("readwrite", (store, resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
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
