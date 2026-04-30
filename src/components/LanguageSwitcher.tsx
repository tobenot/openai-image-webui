import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../i18n/resources";

function normalizeLanguage(language: string): SupportedLanguage {
  return language.startsWith("zh") ? "zh-CN" : "en";
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage || i18n.language);

  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
      <span className="text-xs text-slate-500">{t("language.label")}</span>
      <select
        aria-label={t("language.label")}
        className="bg-transparent text-sm font-medium outline-none"
        value={currentLanguage}
        onChange={(event) => void i18n.changeLanguage(event.target.value as SupportedLanguage)}
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {t(`language.options.${language}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
