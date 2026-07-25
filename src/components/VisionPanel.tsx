import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { InputImageError, prepareInputImage } from "../lib/imageInput";
import type { InputImageFile, VisionDetail, VisionFormState } from "../types";
import { Notice } from "./Notice";
import { ImageDropzone } from "./ImageDropzone";

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
        <ImageDropzone
          accent="violet"
          images={form.inputImages}
          onAdd={handleAddInputImages}
          onRemove={removeInputImage}
          title={t("vision.inputImages.title")}
          hint={t("vision.inputImages.hint")}
          addButtonLabel={t("vision.inputImages.addButton")}
          removeLabel={t("vision.inputImages.remove")}
          badge={
            form.inputImages.length > 0
              ? t("vision.inputImages.badge", { count: form.inputImages.length })
              : undefined
          }
          error={inputImageError || undefined}
          sizeLabel={(width, height) => t("vision.inputImages.size", { width, height })}
        />

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
}
