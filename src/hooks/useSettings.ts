import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  sanitizeSettings,
  saveSettings,
} from "../lib/storage";
import type { AppSettings } from "../types";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  function updateSettings(next: Partial<AppSettings>) {
    setSettings((current) => sanitizeSettings({ ...current, ...next }));
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS);
  }

  return {
    settings,
    setSettings: updateSettings,
    resetSettings,
  };
}
