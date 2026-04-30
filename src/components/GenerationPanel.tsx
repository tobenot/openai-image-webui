import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { GenerateFormState } from "../types";
import { Notice } from "./Notice";

const SIZE_STEP = 64;
const RECENT_SIZE_LIMIT = 6;
const RECENT_SIZE_STORAGE_KEY = "openai-image-webui:recent-sizes";
const QUALITY_OPTIONS = [
  { key: "1k", longEdge: 1024 },
  { key: "2k", longEdge: 2048 },
  { key: "4k", longEdge: 4096 },
] as const;

const RATIO_OPTIONS = [
  { key: "1:1", width: 1, height: 1 },
  { key: "2:3", width: 2, height: 3 },
  { key: "3:4", width: 3, height: 4 },
  { key: "4:5", width: 4, height: 5 },
  { key: "5:4", width: 5, height: 4 },
  { key: "4:3", width: 4, height: 3 },
  { key: "3:2", width: 3, height: 2 },
  { key: "9:16", width: 9, height: 16 },
  { key: "16:9", width: 16, height: 9 },
] as const;

const RATIO_SLIDER_MIN = 1;
const RATIO_SLIDER_MAX = 16;

const COMMON_SIZE_OPTIONS = [
  "512x768",
  "768x1024",
  "1024x1536",
  "1536x2048",
  "512x512",
  "768x768",
  "1024x1024",
  "1536x1536",
  "2048x2048",
  "768x512",
  "1024x768",
  "1536x1024",
  "2048x1536",
] as const;


interface GenerationPanelProps {
  form: GenerateFormState;
  error: string;
  onChange: (next: Partial<GenerateFormState>) => void;
  onSubmit: () => void;
}

function roundToSizeStep(value: number) {
  return Math.max(SIZE_STEP, Math.round(value / SIZE_STEP) * SIZE_STEP);
}

function buildSize(widthRatio: number, heightRatio: number, longEdge: number) {
  if (widthRatio >= heightRatio) {
    const width = longEdge;
    const height = roundToSizeStep((longEdge * heightRatio) / widthRatio);
    return `${width}x${height}`;
  }

  const width = roundToSizeStep((longEdge * widthRatio) / heightRatio);
  const height = longEdge;
  return `${width}x${height}`;
}

function normalizeSize(value: string) {
  const cleaned = value.trim().replace(/×/g, "x").replace(/\s+/g, "");

  if (!/^\d+x\d+$/i.test(cleaned)) {
    return "";
  }

  return cleaned.toLowerCase();
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }

  return x || 1;
}

function getRatioLabel(size: string) {
  const normalized = normalizeSize(size);
  const [widthPart, heightPart] = normalized.split("x");
  const width = Number(widthPart);
  const height = Number(heightPart);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "";
  }

  const divisor = greatestCommonDivisor(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function loadRecentSizes() {

  try {
    const raw = localStorage.getItem(RECENT_SIZE_STORAGE_KEY);
    if (!raw) {
      return [] as string[];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [] as string[];
    }

    return parsed
      .map((item) => (typeof item === "string" ? normalizeSize(item) : ""))
      .filter(Boolean)
      .slice(0, RECENT_SIZE_LIMIT);
  } catch {
    return [] as string[];
  }
}

function saveRecentSizes(sizes: string[]) {
  try {
    localStorage.setItem(RECENT_SIZE_STORAGE_KEY, JSON.stringify(sizes.slice(0, RECENT_SIZE_LIMIT)));
  } catch {
    // Ignore localStorage quota or privacy-mode failures.
  }
}

export function GenerationPanel({ form, error, onChange, onSubmit }: GenerationPanelProps) {
  const { t } = useTranslation();
  const [selectedQuality, setSelectedQuality] = useState<(typeof QUALITY_OPTIONS)[number]["key"]>("1k");
  const [ratioWidth, setRatioWidth] = useState(1);
  const [ratioHeight, setRatioHeight] = useState(1);
  const [recentSizes, setRecentSizes] = useState<string[]>(() => loadRecentSizes());

  const selectedQualityConfig = useMemo(
    () => QUALITY_OPTIONS.find((option) => option.key === selectedQuality) ?? QUALITY_OPTIONS[0],
    [selectedQuality],
  );

  const currentRatioLabel = useMemo(() => `${ratioWidth}:${ratioHeight}`, [ratioHeight, ratioWidth]);

  const suggestedSize = useMemo(
    () => buildSize(ratioWidth, ratioHeight, selectedQualityConfig.longEdge),
    [ratioHeight, ratioWidth, selectedQualityConfig.longEdge],
  );


  function rememberSize(value: string) {
    const normalized = normalizeSize(value);

    if (!normalized) {
      return;
    }

    setRecentSizes((current) => {
      const next = [normalized, ...current.filter((item) => item !== normalized)].slice(
        0,
        RECENT_SIZE_LIMIT,
      );
      saveRecentSizes(next);
      return next;
    });
  }

  function applySize(value: string) {
    onChange({ size: value });
    rememberSize(value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    rememberSize(form.size);
    onSubmit();
  }

  function applyQuickSize(
    nextRatioWidth: number,
    nextRatioHeight: number,
    nextQualityKey: (typeof QUALITY_OPTIONS)[number]["key"],
  ) {
    const quality = QUALITY_OPTIONS.find((option) => option.key === nextQualityKey) ?? QUALITY_OPTIONS[0];
    applySize(buildSize(nextRatioWidth, nextRatioHeight, quality.longEdge));
  }


  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950">{t("generation.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("generation.subtitle")}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {t("generation.prompt")}
          </span>
          <textarea
            className="min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            placeholder={t("generation.promptPlaceholder")}
            value={form.prompt}
            onChange={(event) => onChange({ prompt: event.target.value })}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("generation.imageCount")}
            </span>
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
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("generation.size")}
            </span>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              placeholder={t("generation.sizePlaceholder")}
              value={form.size}
              onChange={(event) => onChange({ size: event.target.value })}
              onBlur={() => rememberSize(form.size)}
            />
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-xs font-medium text-slate-600">{t("generation.quickSizePreset")}</p>

          <div className="mt-2 flex flex-wrap gap-2">
            {RATIO_OPTIONS.map((ratio) => (
              <button
                key={ratio.key}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  ratioWidth === ratio.width && ratioHeight === ratio.height
                    ? "border-sky-400 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => {
                  setRatioWidth(ratio.width);
                  setRatioHeight(ratio.height);
                  applyQuickSize(ratio.width, ratio.height, selectedQuality);
                }}
              >
                {ratio.key}
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-medium text-slate-600">{t("generation.ratioSlider")}</p>
            <p className="mt-1 text-xs text-slate-500">{t("generation.currentRatio", { ratio: currentRatioLabel })}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-slate-600">
                <span className="mb-1 block">{t("generation.widthRatio")}: {ratioWidth}</span>
                <input
                  type="range"
                  min={RATIO_SLIDER_MIN}
                  max={RATIO_SLIDER_MAX}
                  step={1}
                  value={ratioWidth}
                  className="w-full"
                  onChange={(event) => {
                    const nextWidth = Number(event.target.value);
                    setRatioWidth(nextWidth);
                    applyQuickSize(nextWidth, ratioHeight, selectedQuality);
                  }}
                />
              </label>
              <label className="block text-xs text-slate-600">
                <span className="mb-1 block">{t("generation.heightRatio")}: {ratioHeight}</span>
                <input
                  type="range"
                  min={RATIO_SLIDER_MIN}
                  max={RATIO_SLIDER_MAX}
                  step={1}
                  value={ratioHeight}
                  className="w-full"
                  onChange={(event) => {
                    const nextHeight = Number(event.target.value);
                    setRatioHeight(nextHeight);
                    applyQuickSize(ratioWidth, nextHeight, selectedQuality);
                  }}
                />
              </label>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {QUALITY_OPTIONS.map((quality) => (
              <button
                key={quality.key}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  selectedQuality === quality.key
                    ? "border-violet-400 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => {
                  setSelectedQuality(quality.key);
                  applyQuickSize(ratioWidth, ratioHeight, quality.key);
                }}
              >
                {t(`generation.quality.${quality.key}`)}
              </button>
            ))}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {t("generation.recommendedSize", { size: suggestedSize })}
          </p>
        </div>


        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-xs font-medium text-slate-600">{t("generation.commonSizes")}</p>
          <p className="mt-1 text-xs text-slate-500">{t("generation.commonSizesHint")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {COMMON_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  normalizeSize(form.size) === normalizeSize(size)
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => applySize(size)}
              >
                {size} · {getRatioLabel(size)}
              </button>
            ))}
          </div>
        </div>


        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-xs font-medium text-slate-600">{t("generation.recentSizes")}</p>
          {recentSizes.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {recentSizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    normalizeSize(form.size) === normalizeSize(size)
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => applySize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">{t("generation.recentSizesEmpty")}</p>
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {t("generation.advancedJsonParams")}
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
          {t("generation.generate")}
        </button>
      </form>
    </section>
  );
}


