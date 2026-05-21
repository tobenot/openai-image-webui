import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AppSettings } from "../types";
import type { RenameItem } from "../lib/batchRename";
import {
  buildFinalName,
  callAIForName,
  compressImageForAI,
  downloadRenamedZip,
  downloadScriptZip,
  generateThumbnailUrl,
} from "../lib/batchRename";

interface BatchRenamePanelProps {
  settings: AppSettings;
}

const ACCEPTED_FORMATS = ".jpg,.jpeg,.png,.webp,.tga,.bmp";

export function BatchRenamePanel({ settings }: BatchRenamePanelProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<RenameItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) =>
      /\.(jpe?g|png|webp|tga|bmp)$/i.test(f.name),
    );
    if (fileArray.length === 0) return;

    const newItems: RenameItem[] = await Promise.all(
      fileArray.map(async (file) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let thumbnailUrl = "";
        try {
          thumbnailUrl = await generateThumbnailUrl(file);
        } catch { /* ignore */ }
        return {
          id,
          originalName: file.name,
          newName: "",
          status: "pending" as const,
          thumbnailUrl,
          file,
        };
      }),
    );

    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = "";
      }
    },
    [handleFiles],
  );

  const startRename = useCallback(async () => {
    if (!settings.apiKey.trim() || !settings.baseUrl.trim() || !settings.visionModel.trim()) return;

    const pendingItems = items.filter((i) => i.status === "pending" || i.status === "error");
    if (pendingItems.length === 0) return;

    setIsProcessing(true);
    const controller = new AbortController();
    abortRef.current = controller;

    for (const item of pendingItems) {
      if (controller.signal.aborted) break;

      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "processing" } : i)),
      );

      try {
        const compressed = await compressImageForAI(item.file);
        const aiName = await callAIForName({
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.visionModel,
          imageBlob: compressed,
          signal: controller.signal,
        });
        const finalName = buildFinalName(aiName, item.originalName);

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "done", newName: finalName } : i,
          ),
        );
      } catch (err) {
        if (controller.signal.aborted) break;
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error", error: err instanceof Error ? err.message : "Unknown error" }
              : i,
          ),
        );
      }
    }

    setIsProcessing(false);
    abortRef.current = null;
  }, [items, settings]);

  const stopProcessing = useCallback(() => {
    abortRef.current?.abort();
    setIsProcessing(false);
  }, []);

  const clearAll = useCallback(() => {
    abortRef.current?.abort();
    setItems([]);
    setIsProcessing(false);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const doneCount = items.filter((i) => i.status === "done").length;
  const canDownload = doneCount > 0;

  const settingsOk = settings.apiKey.trim() && settings.baseUrl.trim() && settings.visionModel.trim();

  return (
    <section className="space-y-4 rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{t("batchRename.title")}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{t("batchRename.subtitle")}</p>
      </div>

      {/* Drop zone */}
      <div
        className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-slate-300 bg-slate-50 hover:border-slate-400"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <p className="text-sm text-slate-500">{t("batchRename.dropHint")}</p>
        <p className="mt-1 text-xs text-slate-400">{t("batchRename.formatHint")}</p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={ACCEPTED_FORMATS}
          onChange={handleFileInput}
        />
      </div>

      {/* Item list */}
      {items.length > 0 && (
        <div className="max-h-[400px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
            >
              {/* Thumbnail */}
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  className="h-10 w-10 flex-shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-slate-200 text-xs text-slate-400">
                  IMG
                </div>
              )}

              {/* Names */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-slate-600">{item.originalName}</div>
                {item.newName && (
                  <div className="flex items-center gap-1 truncate">
                    <span className="text-slate-400">→</span>
                    <span className="font-medium text-emerald-700">{item.newName}</span>
                  </div>
                )}
                {item.error && (
                  <div className="truncate text-xs text-red-500">{item.error}</div>
                )}
              </div>

              {/* Status badge */}
              <div className="flex-shrink-0">
                {item.status === "pending" && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {t("batchRename.statusPending")}
                  </span>
                )}
                {item.status === "processing" && (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-600">
                    {t("batchRename.statusProcessing")}
                  </span>
                )}
                {item.status === "done" && (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-600">✓</span>
                )}
                {item.status === "error" && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-500">✗</span>
                )}
              </div>

              {/* Remove button */}
              {!isProcessing && (
                <button
                  type="button"
                  className="flex-shrink-0 text-slate-400 hover:text-red-500"
                  onClick={() => removeItem(item.id)}
                  title={t("batchRename.remove")}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {items.length > 0 && (
        <div className="text-xs text-slate-500">
          {t("batchRename.stats", { total: items.length, done: doneCount })}
        </div>
      )}

      {/* Validation hint */}
      {!settingsOk && items.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {t("batchRename.settingsRequired")}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!isProcessing ? (
          <button
            type="button"
            disabled={items.length === 0 || !settingsOk}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={startRename}
          >
            {t("batchRename.start")}
          </button>
        ) : (
          <button
            type="button"
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500"
            onClick={stopProcessing}
          >
            {t("batchRename.stop")}
          </button>
        )}

        <button
          type="button"
          disabled={!canDownload}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => downloadScriptZip(items)}
        >
          {t("batchRename.downloadScript")}
        </button>

        <button
          type="button"
          disabled={!canDownload}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => downloadRenamedZip(items)}
        >
          {t("batchRename.downloadZip")}
        </button>

        {items.length > 0 && !isProcessing && (
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-500 shadow-sm transition hover:bg-red-50 hover:text-red-600"
            onClick={clearAll}
          >
            {t("batchRename.clear")}
          </button>
        )}
      </div>
    </section>
  );
}
