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
    description: "OpenAI-compatible relay",
    settings: {
      baseUrl: "https://api.laozhang.ai/v1",
      model: "gpt-4o-image",
      responseFormat: "url",
    },
  },
];

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (next: Partial<AppSettings>) => void;
  onReset: () => void;
}

export function SettingsPanel({ settings, onChange, onReset }: SettingsPanelProps) {

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

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Model</span>
          <input
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="gpt-image-1 or gpt-4o-image"
            value={settings.model}
            onChange={(event) => onChange({ model: event.target.value })}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            For relay providers, use the latest model name shown in that provider's dashboard.
          </p>
        </label>


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
