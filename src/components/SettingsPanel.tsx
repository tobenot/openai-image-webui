import { useEffect, useId, useRef, useState } from "react";
import { fetchModels, type ModelCapability, type ModelInfo } from "../api/openaiModels";
import { toFriendlyError } from "../lib/errors";
import type { AppSettings, ImageResponseFormat } from "../types";
import { Notice } from "./Notice";

const PROVIDER_PRESETS: Array<{
  name: string;
  description: string;
  settings: Pick<AppSettings, "baseUrl" | "model" | "responseFormat">;
}> = [
  {
    name: "OpenAI",
    description: "Official Images API",
    settings: {
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-image-1",
      responseFormat: "url",
    },
  },
  {
    name: "LaoZhang API",
    description: "OpenAI-compatible relay (global)",
    settings: {
      baseUrl: "https://api.laozhang.ai/v1",
      model: "gpt-image-1",
      responseFormat: "url",
    },
  },
  {
    name: "LaoZhang VIP",
    description: "Backup endpoint for overseas servers",
    settings: {
      baseUrl: "https://api-vip.laozhang.ai/v1",
      model: "gpt-image-1",
      responseFormat: "url",
    },
  },
];

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (next: Partial<AppSettings>) => void;
  onReset: () => void;
}

interface ModelsState {
  status: "idle" | "loading" | "success" | "error";
  list: ModelInfo[];
  error: string;
}

const INITIAL_MODELS_STATE: ModelsState = {
  status: "idle",
  list: [],
  error: "",
};

type ModelFilter = "all" | "image" | ModelCapability;

const MODEL_FILTER_OPTIONS: Array<{ value: ModelFilter; label: string }> = [
  { value: "image", label: "Image models" },
  { value: "image-generation", label: "Image generation" },
  { value: "image-editing", label: "Image editing" },
  { value: "image-related", label: "Image-related" },
  { value: "video", label: "Video" },
  { value: "other", label: "Other" },
  { value: "all", label: "All models" },
];

export function SettingsPanel({ settings, onChange, onReset }: SettingsPanelProps) {
  const datalistId = useId();
  const [modelsState, setModelsState] = useState<ModelsState>(INITIAL_MODELS_STATE);
  const [modelFilter, setModelFilter] = useState<ModelFilter>("image");
  const abortRef = useRef<AbortController | null>(null);
  const lastFetchedKeyRef = useRef<string>("");

  // Reset the model suggestions whenever the credential pair changes,
  // so the user does not see stale results from a different provider.
  useEffect(() => {
    const currentKey = `${settings.baseUrl.trim()}::${settings.apiKey.trim()}`;
    if (lastFetchedKeyRef.current && lastFetchedKeyRef.current !== currentKey) {
      setModelsState(INITIAL_MODELS_STATE);
      lastFetchedKeyRef.current = "";
    }
  }, [settings.apiKey, settings.baseUrl]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function handleFetchModels() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setModelsState({ status: "loading", list: [], error: "" });

    try {
      const list = await fetchModels({
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        signal: controller.signal,
      });
      lastFetchedKeyRef.current = `${settings.baseUrl.trim()}::${settings.apiKey.trim()}`;
      setModelsState({ status: "success", list, error: "" });
    } catch (error) {
      if (controller.signal.aborted) return;
      setModelsState({
        status: "error",
        list: [],
        error: toFriendlyError(error),
      });
    }
  }

  const imageModels = modelsState.list.filter((item) => item.isImageModel);
  const filteredModels = modelsState.list.filter((item) => {
    if (modelFilter === "all") return true;
    if (modelFilter === "image") return item.isImageModel;
    return item.category === modelFilter;
  });
  const categoryCounts = MODEL_FILTER_OPTIONS.reduce<Record<ModelFilter, number>>(
    (counts, option) => {
      counts[option.value] = modelsState.list.filter((item) => {
        if (option.value === "all") return true;
        if (option.value === "image") return item.isImageModel;
        return item.category === option.value;
      }).length;
      return counts;
    },
    {
      all: 0,
      image: 0,
      "image-generation": 0,
      "image-editing": 0,
      "image-related": 0,
      other: 0,
      video: 0,
    },
  );

  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">API Settings</h2>
          <p className="mt-1 text-sm text-slate-500">Bring your own endpoint and key.</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          onClick={onReset}
        >
          Reset
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <span className="mb-2 block text-sm font-medium text-slate-700">Provider Presets</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROVIDER_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-sky-300 hover:bg-sky-50"
                onClick={() => onChange(preset.settings)}
              >
                <span className="block text-sm font-semibold text-slate-800">{preset.name}</span>
                <span className="mt-1 block text-xs text-slate-500">{preset.description}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Presets only fill the base URL, model, and response format. You still need to use your own API key.
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">API Base URL</span>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="https://api.openai.com/v1"
            value={settings.baseUrl}
            onChange={(event) => onChange({ baseUrl: event.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">API Key</span>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            type="password"
            placeholder="sk-..."
            autoComplete="off"
            value={settings.apiKey}
            onChange={(event) => onChange({ apiKey: event.target.value })}
          />
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">Model</span>
            <div className="flex items-center gap-2">
              <select
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                value={modelFilter}
                onChange={(event) => setModelFilter(event.target.value as ModelFilter)}
              >
                {MODEL_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {modelsState.status === "success"
                      ? `${option.label} (${categoryCounts[option.value]})`
                      : option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleFetchModels}
                disabled={modelsState.status === "loading"}
              >
                {modelsState.status === "loading" ? "Fetching…" : "Fetch models"}
              </button>
            </div>
          </div>
          <input
            list={datalistId}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="gpt-image-1 or gpt-4o-image"
            value={settings.model}
            onChange={(event) => onChange({ model: event.target.value })}
          />
          <datalist id={datalistId}>
            {filteredModels.map((item) => (
              <option key={`${item.category}-${item.id}`} value={item.id}>
                {item.ownedBy ? `${item.categoryLabel} · ${item.ownedBy}` : item.categoryLabel}
              </option>
            ))}
          </datalist>
          {modelsState.status === "success" && (
            <p className="mt-1.5 text-xs text-slate-500">
              Loaded {modelsState.list.length} models ({imageModels.length} image-related, {filteredModels.length} shown). Classification is heuristic; you can still type any name manually.
            </p>
          )}
          {modelsState.status === "error" && (
            <p className="mt-1.5 text-xs text-rose-600">{modelsState.error}</p>
          )}
          {modelsState.status === "idle" && (
            <p className="mt-1.5 text-xs text-slate-500">
              For relay providers, click Fetch models to load the live list, or just type any model name.
            </p>
          )}
        </div>


        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Response Format</span>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            value={settings.responseFormat}
            onChange={(event) =>
              onChange({ responseFormat: event.target.value as ImageResponseFormat })
            }
          >
            <option value="url">url</option>
            <option value="b64_json">b64_json</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Concurrency</span>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            type="number"
            min={1}
            max={10}
            value={settings.concurrency}
            onChange={(event) => onChange({ concurrency: Number(event.target.value) })}
          />
        </label>

        <Notice variant="warning">Your API key is stored only in this browser.</Notice>
      </div>
    </section>
  );
}
