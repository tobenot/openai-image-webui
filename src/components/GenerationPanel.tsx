import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { GenerateFormState, InputImageFile } from "../types";
import {
  assertMaskMatchesImage,
  InputImageError,
  modelLikelySupportsMultipleImages,
  modelRequiresStrictPng,
  prepareInputImage,
} from "../lib/imageInput";
import { Notice } from "./Notice";

const SIZE_STEP = 64;
const MIN_SIZE = 256;
const MAX_SIZE = 4096;
const DEFAULT_SIZE = 1024;
const RECENT_SIZE_LIMIT = 6;
const RECENT_SIZE_STORAGE_KEY = "openai-image-webui:recent-sizes";

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
  /** Used to decide strict PNG enforcement and multi-image warnings. */
  model?: string;
  onChange: (next: Partial<GenerateFormState>) => void;
  onSubmit: () => void;
}

function roundToSizeStep(value: number) {
  return Math.max(SIZE_STEP, Math.round(value / SIZE_STEP) * SIZE_STEP);
}

function clampDimension(value: number) {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, roundToSizeStep(value)));
}

function normalizeSize(value: string) {
  const cleaned = value.trim().replace(/×/g, "x").replace(/\s+/g, "");

  if (!/^\d+x\d+$/i.test(cleaned)) {
    return "";
  }

  return cleaned.toLowerCase();
}

function parseSize(value: string) {
  const normalized = normalizeSize(value);
  if (!normalized) {
    return null;
  }

  const [widthPart, heightPart] = normalized.split("x");
  const width = Number(widthPart);
  const height = Number(heightPart);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    width: clampDimension(width),
    height: clampDimension(height),
  };
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
  const parsed = parseSize(size);

  if (!parsed) {
    return "";
  }

  const divisor = greatestCommonDivisor(parsed.width, parsed.height);
  return `${Math.round(parsed.width / divisor)}:${Math.round(parsed.height / divisor)}`;
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

export function GenerationPanel({ form, error, model, onChange, onSubmit }: GenerationPanelProps) {
  const { t } = useTranslation();
  const initialParsedSize = parseSize(form.size);
  const [sliderWidth, setSliderWidth] = useState(initialParsedSize?.width ?? DEFAULT_SIZE);
  const [sliderHeight, setSliderHeight] = useState(initialParsedSize?.height ?? DEFAULT_SIZE);
  const [recentSizes, setRecentSizes] = useState<string[]>(() => loadRecentSizes());
  const [inputImageError, setInputImageError] = useState("");
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const maskFileInputRef = useRef<HTMLInputElement>(null);

  const strictPng = modelRequiresStrictPng(model ?? "");
  const supportsMultiImage = modelLikelySupportsMultipleImages(model ?? "");
  const isEditMode = form.inputImages.length > 0;

  useEffect(() => {
    const parsed = parseSize(form.size);
    if (!parsed) {
      return;
    }

    setSliderWidth((current) => (current === parsed.width ? current : parsed.width));
    setSliderHeight((current) => (current === parsed.height ? current : parsed.height));
  }, [form.size]);

  const currentSize = useMemo(() => `${sliderWidth}x${sliderHeight}`, [sliderHeight, sliderWidth]);
  const currentRatioLabel = useMemo(() => getRatioLabel(currentSize), [currentSize]);

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
    const parsed = parseSize(value);
    if (!parsed) {
      onChange({ size: value });
      return;
    }

    const normalizedSize = `${parsed.width}x${parsed.height}`;
    setSliderWidth(parsed.width);
    setSliderHeight(parsed.height);
    onChange({ size: normalizedSize });
    rememberSize(normalizedSize);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    rememberSize(form.size);
    onSubmit();
  }

  async function handleAddInputImages(files: FileList | File[]) {
    setInputImageError("");
    const list = Array.from(files);
    const prepared: InputImageFile[] = [];
    for (const file of list) {
      try {
        const item = await prepareInputImage(file, { strictPngOnly: strictPng });
        prepared.push(item);
      } catch (err) {
        const reason = err instanceof InputImageError ? err.message : String(err);
        setInputImageError(t("generation.inputImages.title") + ": " + reason);
        prepared.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return;
      }
    }
    if (prepared.length === 0) return;
    onChange({ inputImages: [...form.inputImages, ...prepared] });
  }

  async function handleAddMask(file: File) {
    setInputImageError("");
    if (form.inputImages.length === 0) {
      setInputImageError(t("generation.inputImages.mask") + ": requires at least one input image first.");
      return;
    }
    try {
      const mask = await prepareInputImage(file, { strictPngOnly: true });
      assertMaskMatchesImage(mask, form.inputImages[0]);
      if (form.maskImage) URL.revokeObjectURL(form.maskImage.previewUrl);
      onChange({ maskImage: mask });
    } catch (err) {
      const reason = err instanceof InputImageError ? err.message : String(err);
      setInputImageError(t("generation.inputImages.mask") + ": " + reason);
    }
  }

  function removeInputImage(id: string) {
    const next = form.inputImages.filter((item) => {
      if (item.id === id) {
        URL.revokeObjectURL(item.previewUrl);
        return false;
      }
      return true;
    });
    onChange({ inputImages: next });
    // Mask must be dropped if its reference (first image) is gone.
    if (next.length === 0 && form.maskImage) {
      URL.revokeObjectURL(form.maskImage.previewUrl);
      onChange({ maskImage: null });
    }
  }

  function removeMask() {
    if (form.maskImage) URL.revokeObjectURL(form.maskImage.previewUrl);
    onChange({ maskImage: null });
  }

  function onImageInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      void handleAddInputImages(event.target.files);
    }
    event.target.value = "";
  }

  function onMaskInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void handleAddMask(file);
    }
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      void handleAddInputImages(files);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  const acceptMime = strictPng ? "image/png" : "image/png,image/jpeg,image/webp";
  const showMultiImageWarning =
    form.inputImages.length > 1 && !!model && !supportsMultiImage;

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

        <div
          className={`rounded-xl border p-3 transition ${
            isEditMode
              ? "border-emerald-300 bg-emerald-50/60"
              : "border-slate-200 bg-slate-50/70"
          }`}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600">
              {t("generation.inputImages.title")}
            </p>
            {isEditMode ? (
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                {t("generation.inputImages.editModeBadge")}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">{t("generation.inputImages.hint")}</p>

          <div className="mt-2 flex flex-wrap gap-2">
            {form.inputImages.map((item) => (
              <div
                key={item.id}
                className="group relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-white"
                title={`${item.file.name} · ${item.width}×${item.height}`}
              >
                <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-0 top-0 rounded-bl-lg bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100"
                  onClick={() => removeInputImage(item.id)}
                >
                  {t("generation.inputImages.remove")}
                </button>
                <span className="absolute bottom-0 left-0 right-0 bg-slate-900/70 px-1 py-0.5 text-center text-[10px] text-white">
                  {t("generation.inputImages.size", { width: item.width, height: item.height })}
                </span>
              </div>
            ))}

            <button
              type="button"
              className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-500 transition hover:border-sky-400 hover:text-sky-600"
              onClick={() => imageFileInputRef.current?.click()}
            >
              + {t("generation.inputImages.addButton")}
            </button>
            <input
              ref={imageFileInputRef}
              type="file"
              accept={acceptMime}
              multiple
              hidden
              onChange={onImageInputChange}
            />
          </div>

          {isEditMode ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-600">{t("generation.inputImages.mask")}</p>
              <p className="mt-1 text-xs text-slate-500">{t("generation.inputImages.maskHint")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {form.maskImage ? (
                  <div
                    className="group relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-white"
                    title={`${form.maskImage.file.name} · ${form.maskImage.width}×${form.maskImage.height}`}
                  >
                    <img
                      src={form.maskImage.previewUrl}
                      alt={form.maskImage.file.name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-0 top-0 rounded-bl-lg bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100"
                      onClick={removeMask}
                    >
                      {t("generation.inputImages.remove")}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-500 transition hover:border-sky-400 hover:text-sky-600"
                      onClick={() => maskFileInputRef.current?.click()}
                    >
                      + {t("generation.inputImages.addMaskButton")}
                    </button>
                    <input
                      ref={maskFileInputRef}
                      type="file"
                      accept="image/png"
                      hidden
                      onChange={onMaskInputChange}
                    />
                  </>
                )}
              </div>
            </div>
          ) : null}

          {showMultiImageWarning ? (
            <p className="mt-2 text-xs text-amber-700">
              {t("generation.inputImages.multipleImagesWarning")}
            </p>
          ) : null}

          {inputImageError ? (
            <p className="mt-2 text-xs text-rose-600">{inputImageError}</p>
          ) : null}
        </div>

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
              onBlur={() => applySize(form.size)}
            />
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-xs font-medium text-slate-600">{t("generation.resolutionSlider")}</p>
          <p className="mt-1 text-xs text-slate-500">{t("generation.currentSize", { size: currentSize })}</p>
          <p className="mt-1 text-xs text-slate-500">
            {t("generation.currentRatioAuto", { ratio: currentRatioLabel || "-" })}
          </p>
          <p className="mt-1 text-xs text-slate-500">{t("generation.sizeStepHint", { step: SIZE_STEP })}</p>

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-600">
              <span className="mb-1 block">{t("generation.widthPixels")}: {sliderWidth}</span>
              <input
                type="range"
                min={MIN_SIZE}
                max={MAX_SIZE}
                step={SIZE_STEP}
                value={sliderWidth}
                className="w-full"
                onChange={(event) => {
                  const nextWidth = clampDimension(Number(event.target.value));
                  setSliderWidth(nextWidth);
                  applySize(`${nextWidth}x${sliderHeight}`);
                }}
              />
            </label>

            <label className="block text-xs text-slate-600">
              <span className="mb-1 block">{t("generation.heightPixels")}: {sliderHeight}</span>
              <input
                type="range"
                min={MIN_SIZE}
                max={MAX_SIZE}
                step={SIZE_STEP}
                value={sliderHeight}
                className="w-full"
                onChange={(event) => {
                  const nextHeight = clampDimension(Number(event.target.value));
                  setSliderHeight(nextHeight);
                  applySize(`${sliderWidth}x${nextHeight}`);
                }}
              />
            </label>
          </div>
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
          {isEditMode ? t("generation.edit") : t("generation.generate")}
        </button>
      </form>
    </section>
  );
}
