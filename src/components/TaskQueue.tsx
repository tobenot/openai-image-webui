import { useTranslation } from "react-i18next";
import type { ImageCacheStats, ImageTask } from "../types";
import { ImageCacheSummary } from "./ImageCacheSummary";
import { TaskCard } from "./TaskCard";

interface TaskQueueProps {
  tasks: ImageTask[];
  cacheStats: ImageCacheStats;
  onPreview: (imageUrl: string) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onClearTaskImage: (id: string) => void;
  onClearImageCache: () => void;
}

export function TaskQueue({
  tasks,
  cacheStats,
  onPreview,
  onRetry,
  onCancel,
  onRemove,
  onClearTaskImage,
  onClearImageCache,
}: TaskQueueProps) {
  const { t } = useTranslation();
  const stats = {
    pending: tasks.filter((task) => task.status === "pending").length,
    running: tasks.filter((task) => task.status === "running").length,
    success: tasks.filter((task) => task.status === "success").length,
    error: tasks.filter((task) => task.status === "error").length,
  };
  const orderedTasks = [...tasks].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{t("tasks.title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("tasks.stats", stats)}</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          {t("tasks.total", { count: tasks.length })}
        </div>
      </div>

      <div className="mb-5">
        <ImageCacheSummary stats={cacheStats} onClear={onClearImageCache} />
      </div>

      {orderedTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
          {t("tasks.empty")}
        </div>
      ) : (
        <div className="space-y-4">
          {orderedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onPreview={onPreview}
              onRetry={onRetry}
              onCancel={onCancel}
              onRemove={onRemove}
              onClearImage={onClearTaskImage}
            />
          ))}
        </div>
      )}
    </section>
  );
}
