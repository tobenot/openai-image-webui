import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listCachedImages, type CachedImageRecord } from "../lib/imageCache";
import { copyText, downloadImage } from "../lib/download";
import type { ImageCacheStats } from "../types";
import { ImageCacheSummary } from "./ImageCacheSummary";

const PAGE_SIZE = 50;

type LibraryImage = CachedImageRecord & {
  objectUrl: string;
};

interface ImageLibraryProps {
  stats: ImageCacheStats;
  onPreview: (imageUrl: string) => void;
  onDeleteImage: (id: string) => void;
  onClearImageCache: () => void;
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function ImageLibrary({ stats, onPreview, onDeleteImage, onClearImageCache }: ImageLibraryProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<LibraryImage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messageKey, setMessageKey] = useState("");
  const objectUrlsRef = useRef(new Set<string>());

  const revokeObjectUrl = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  }, []);

  const clearObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  const toLibraryImage = useCallback((record: CachedImageRecord): LibraryImage => {
    const objectUrl = URL.createObjectURL(record.blob);
    objectUrlsRef.current.add(objectUrl);
    return { ...record, objectUrl };
  }, []);

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
    setMessageKey("");

    try {
      const page = await listCachedImages(0, PAGE_SIZE);
      clearObjectUrls();
      setItems(page.images.map(toLibraryImage));
      setHasMore(page.hasMore);
    } catch (error) {
      console.warn("[openai-image-webui] Failed to load image library", error);
      setMessageKey("library.messages.loadFailed");
    } finally {
      setIsLoading(false);
    }
  }, [clearObjectUrls, toLibraryImage]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage, stats.count, stats.size]);

  useEffect(() => {
    return () => clearObjectUrls();
  }, [clearObjectUrls]);

  async function handleLoadMore() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setMessageKey("");

    try {
      const page = await listCachedImages(items.length, PAGE_SIZE);
      setItems((current) => [...current, ...page.images.map(toLibraryImage)]);
      setHasMore(page.hasMore);
    } catch (error) {
      console.warn("[openai-image-webui] Failed to load more images", error);
      setMessageKey("library.messages.loadFailed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopyPrompt(item: LibraryImage) {
    await copyText(item.prompt || "");
    setMessageKey("library.messages.promptCopied");
  }

  async function handleDownload(item: LibraryImage) {
    await downloadImage(item.objectUrl, `openai-image-${item.id.slice(0, 8)}`, item.mimeType);
    setMessageKey("library.messages.downloadStarted");
  }

  function handleDelete(item: LibraryImage) {
    if (!window.confirm(t("library.deleteConfirm"))) {
      return;
    }

    revokeObjectUrl(item.objectUrl);
    onDeleteImage(item.id);
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    setMessageKey("library.messages.imageDeleted");
  }

  function handleClearAll() {
    clearObjectUrls();
    setItems([]);
    setHasMore(false);
    onClearImageCache();
    setMessageKey("library.messages.cacheCleared");
  }


  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{t("library.title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("library.subtitle")}</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          {t("tasks.cache.summary", { count: stats.count, size: formatBytes(stats.size) })}
        </div>
      </div>

      <div className="mb-5">
        <ImageCacheSummary stats={stats} onClear={handleClearAll} />
      </div>

      {messageKey ? <div className="mb-4 text-xs text-emerald-600">{t(messageKey)}</div> : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
          {isLoading ? t("library.loading") : t("library.empty")}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  className="block aspect-square w-full bg-slate-100"
                  onClick={() => onPreview(item.objectUrl)}
                  aria-label={t("library.previewImage")}
                >
                  <img
                    className="h-full w-full object-cover"
                    src={item.objectUrl}
                    alt={item.prompt || t("library.unknownPrompt")}
                    loading="lazy"
                  />
                </button>
                <div className="space-y-3 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>{new Date(item.taskCreatedAt || item.cachedAt).toLocaleString()}</span>
                    <span>{formatBytes(item.size)}</span>
                  </div>
                  <p className="line-clamp-2 min-h-10 text-sm leading-5 text-slate-700">
                    {item.prompt || t("library.unknownPrompt")}
                  </p>
                  <dl className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <dt className="font-medium text-slate-700">{t("tasks.fields.model")}</dt>
                      <dd className="mt-1 truncate">{item.model || t("library.unknownModel")}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <dt className="font-medium text-slate-700">{t("tasks.fields.size")}</dt>
                      <dd className="mt-1">{item.generationSize || "-"}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => onPreview(item.objectUrl)}
                    >
                      {t("tasks.actions.preview")}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => void handleDownload(item)}
                    >
                      {t("tasks.actions.download")}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                      disabled={!item.prompt}
                      onClick={() => void handleCopyPrompt(item)}
                    >
                      {t("tasks.actions.copyPrompt")}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-100 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:border-rose-200 hover:bg-rose-50"
                      onClick={() => handleDelete(item)}
                    >
                      {t("tasks.actions.delete")}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {hasMore ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                disabled={isLoading}
                onClick={() => void handleLoadMore()}
              >
                {isLoading ? t("library.loading") : t("library.loadMore")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
