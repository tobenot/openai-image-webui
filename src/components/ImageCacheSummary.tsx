import { useTranslation } from "react-i18next";
import type { ImageCacheStats } from "../types";

interface ImageCacheSummaryProps {
  stats: ImageCacheStats;
  onClear: () => void;
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

export function ImageCacheSummary({ stats, onClear }: ImageCacheSummaryProps) {
  const { t } = useTranslation();

  function handleClear() {
    if (stats.count <= 0) {
      return;
    }

    if (window.confirm(t("tasks.cache.clearConfirm"))) {
      onClear();
    }
  }

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        stats.overWarning ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-medium text-slate-800">{t("tasks.cache.title")}</div>
          <div className="mt-1 text-xs">
            {t("tasks.cache.summary", {
              count: stats.count,
              size: formatBytes(stats.size),
            })}
          </div>
          {stats.overWarning ? <div className="mt-1 text-xs">{t("tasks.cache.warning")}</div> : null}
        </div>
        <button
          type="button"
          className="self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          disabled={stats.count <= 0}
          onClick={handleClear}
        >
          {t("tasks.cache.clear")}
        </button>
      </div>
    </div>
  );
}
