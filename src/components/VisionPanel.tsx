import { useRef, useState, memo, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { InputImageError, prepareInputImage } from "../lib/imageInput";
import type { InputImageFile, VisionDetail, VisionFormState } from "../types";
import { Notice } from "./Notice";

interface VisionPanelProps {
  form: VisionFormState;
  error: string;
  visionModel: string;
  onChange: (next: Partial<VisionFormState>) => void;
  onSubmit: () => void;
}

export function VisionPanel({ form, error, visionModel, onChange, onSubmit }: VisionPanelProps) {
  const { t } = useTranslation();
  const [inputImageError, setInputImageError] = useState("");
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  async function handleAddInputImages(files: FileList | File[]) {
    setInputImageError("");
    const list = Array.from(files);
    const prepared: InputImageFile[] = [];

    for (const file of list) {
      try {
        prepared.push(await prepareInputImage(file));
      } catch (err) {
        const reason = err instanceof InputImageError ? err.message : String(err);
        setInputImageError(t("vision.inputImages.title") + ": " + reason);
        prepared.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return;
      }
    }

    if (prepared.length === 0) {
      return;
    }

    onChange({ inputImages: [...form.inputImages, ...prepared] });
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
  }

  function onImageInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      void handleAddInputImages(event.target.files);
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950">{t("vision.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("vision.subtitle")}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div
          className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 transition"
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-600">{t("vision.inputImages.title")}</p>
            {form.inputImages.length > 0 ? (
              <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                {t("vision.inputImages.badge", { count: form.inputImages.length })}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">{t("vision.inputImages.hint")}</p>

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
                  {t("vision.inputImages.remove")}
                </button>
                <span className="absolute bottom-0 left-0 right-0 bg-slate-900/70 px-1 py-0.5 text-center text-[10px] text-white">
                  {t("vision.inputImages.size", { width: item.width, height: item.height })}
                </span>
              </div>
            ))}

            <button
              type="button"
              className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-500 transition hover:border-violet-400 hover:text-violet-600"
              onClick={() => imageFileInputRef.current?.click()}
            >
              + {t("vision.inputImages.addButton")}
            </button>
            <input
              ref={imageFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={onImageInputChange}
            />
          </div>

          {inputImageError ? <p className="mt-2 text-xs text-rose-600">{inputImageError}</p> : null}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">{t("vision.prompt")}</span>
          <textarea
            className="min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            placeholder={t("vision.promptPlaceholder")}
            value={form.prompt}
            onChange={(event) => onChange({ prompt: event.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">{t("vision.detail")}</span>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            value={form.detail}
            onChange={(event) => onChange({ detail: event.target.value as VisionDetail })}
          >
            <option value="auto">auto</option>
            <option value="high">high</option>
            <option value="low">low</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">{t("vision.detailHint")}</p>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {t("vision.advancedJsonParams")}
          </span>
          <textarea
            className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            placeholder={'{\n  "max_output_tokens": 3000\n}'}
            value={form.advancedJson}
            onChange={(event) => onChange({ advancedJson: event.target.value })}
          />
        </label>

        <p className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-700">
          {t("vision.modelHint", { model: visionModel || "-" })}
        </p>

        {error ? <Notice variant="error">{error}</Notice> : null}

        <button
          className="inline-flex w-full items-center justify-center rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          type="submit"
          disabled={form.inputImages.length === 0}
        >
          {t("vision.analyze")}
        </button>
      </form>
    </section>
  );
});
