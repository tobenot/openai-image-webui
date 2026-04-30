import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface HeaderProps {
  taskCount: number;
  onClearTasks: () => void;
}

export function Header({ taskCount, onClearTasks }: HeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft backdrop-blur md:flex-row md:items-center md:justify-between">
      <div>
        <div className="mb-2 inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
          {t("header.badge")}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
          {t("header.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
          {t("header.subtitle")}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <a
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          href="https://github.com/search?q=openai-image-webui&type=repositories"
          target="_blank"
          rel="noreferrer"
        >
          {t("header.github")}
        </a>
        <LanguageSwitcher />
        <button
          className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          type="button"
          onClick={onClearTasks}
          disabled={taskCount === 0}
        >
          {t("header.clearTasks")}
        </button>
      </div>
    </header>
  );
}
