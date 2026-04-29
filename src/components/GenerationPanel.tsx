import type { FormEvent } from "react";
import type { GenerateFormState } from "../types";
import { Notice } from "./Notice";

const SIZE_OPTIONS = ["1024x1024", "1024x1792", "1792x1024", "512x512"];

interface GenerationPanelProps {
  form: GenerateFormState;
  error: string;
  onChange: (next: Partial<GenerateFormState>) => void;
  onSubmit: () => void;
}

export function GenerationPanel({ form, error, onChange, onSubmit }: GenerationPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950">Generate Images</h2>
        <p className="mt-1 text-sm text-slate-500">Create queued image tasks from one prompt.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Prompt</span>
          <textarea
            className="min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder="A cute cat wearing sunglasses, cinematic lighting"
            value={form.prompt}
            onChange={(event) => onChange({ prompt: event.target.value })}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Image Count</span>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              type="number"
              min={1}
              max={20}
              value={form.count}
              onChange={(event) => onChange({ count: Number(event.target.value) })}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Size</span>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              value={form.size}
              onChange={(event) => onChange({ size: event.target.value })}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                form.size === size
                  ? "border-sky-400 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => onChange({ size })}
            >
              {size}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Advanced JSON Params
          </span>
          <textarea
            className="min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder={'{\n  "quality": "high",\n  "style": "vivid"\n}'}
            value={form.advancedJson}
            onChange={(event) => onChange({ advancedJson: event.target.value })}
          />
        </label>

        {error ? <Notice variant="error">{error}</Notice> : null}

        <button
          className="inline-flex w-full items-center justify-center rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          type="submit"
          disabled={!form.prompt.trim()}
        >
          Generate
        </button>
      </form>
    </section>
  );
}
