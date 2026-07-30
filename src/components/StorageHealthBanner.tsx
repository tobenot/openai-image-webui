import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  clearStorageIssues,
  getStorageIssues,
  subscribeStorageIssues,
  type StorageIssue,
} from "../lib/storageHealth";

/**
 * Surfaces persistence failures that would otherwise be invisible.
 * Without this the app keeps looking healthy while silently losing data.
 */
export const StorageHealthBanner = memo(function StorageHealthBanner() {
  const { t } = useTranslation();
  const [issues, setIssues] = useState<StorageIssue[]>(getStorageIssues);

  useEffect(() => subscribeStorageIssues(setIssues), []);

  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{t("storageHealth.title")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {issues.map((issue) => (
              <li key={issue.kind}>
                {t(`storageHealth.${issue.kind}`)}
                {issue.detail ? (
                  <span className="ml-1 text-xs text-amber-700">({issue.detail})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <button
          className="shrink-0 rounded-xl border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
          type="button"
          onClick={clearStorageIssues}
        >
          {t("storageHealth.dismiss")}
        </button>
      </div>
    </div>
  );
});
