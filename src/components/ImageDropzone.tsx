import { useRef, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import type { InputImageFile } from "../types";

type DropzoneAccent = "sky" | "violet";

// Full literal class strings so Tailwind's JIT picks them up.
const ADD_BUTTON_HOVER: Record<DropzoneAccent, string> = {
  sky: "hover:border-sky-400 hover:text-sky-600",
  violet: "hover:border-violet-400 hover:text-violet-600",
};

const BADGE_CLASS: Record<DropzoneAccent, string> = {
  sky: "rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white",
  violet: "rounded-full bg-violet-500 px-2 py-0.5 text-[11px] font-semibold text-white",
};

export interface ImageDropzoneProps {
  images: InputImageFile[];
  /** Called with files from drag & drop or the file picker. May be async. */
  onAdd: (files: FileList | File[]) => void | Promise<void>;
  onRemove: (id: string) => void;
  /** Accent color for the add button and badge. Defaults to "sky". */
  accent?: DropzoneAccent;
  title: string;
  hint: string;
  addButtonLabel: string;
  removeLabel: string;
  accept?: string;
  /** Optional badge shown in the header row (e.g. edit-mode / count badge). */
  badge?: string;
  /** Optional warning shown below the grid (e.g. multi-image model warning). */
  warning?: string;
  /** Optional error shown below the grid. */
  error?: string;
  /** Formats the dimension overlay on each thumbnail. Defaults to "WxH". */
  sizeLabel?: (width: number, height: number) => string;
  /** Extra content rendered between the thumbnail grid and the warning/error. */
  children?: ReactNode;
}

export function ImageDropzone({
  images,
  onAdd,
  onRemove,
  accent = "sky",
  title,
  hint,
  addButtonLabel,
  removeLabel,
  accept = "image/png,image/jpeg,image/webp",
  badge,
  warning,
  error,
  sizeLabel = (width, height) => `${width}×${height}`,
  children,
}: ImageDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasImages = images.length > 0;

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      void onAdd(event.target.files);
    }
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      void onAdd(files);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  return (
    <div
      className={
        accent === "violet"
          ? "rounded-xl border border-violet-200 bg-violet-50/50 p-3 transition"
          : `rounded-xl border p-3 transition ${
              hasImages
                ? "border-emerald-300 bg-emerald-50/60"
                : "border-slate-200 bg-slate-50/70"
            }`
      }
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">{title}</p>
        {badge ? <span className={BADGE_CLASS[accent]}>{badge}</span> : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {images.map((item) => (
          <div
            key={item.id}
            className="group relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-white"
            title={`${item.file.name} · ${item.width}×${item.height}`}
          >
            <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
            <button
              type="button"
              className="absolute right-0 top-0 rounded-bl-lg bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100"
              onClick={() => onRemove(item.id)}
            >
              {removeLabel}
            </button>
            <span className="absolute bottom-0 left-0 right-0 bg-slate-900/70 px-1 py-0.5 text-center text-[10px] text-white">
              {sizeLabel(item.width, item.height)}
            </span>
          </div>
        ))}

        <button
          type="button"
          className={`flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-500 transition ${ADD_BUTTON_HOVER[accent]}`}
          onClick={() => fileInputRef.current?.click()}
        >
          + {addButtonLabel}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          hidden
          onChange={onFileInputChange}
        />
      </div>

      {children}

      {warning ? <p className="mt-2 text-xs text-amber-700">{warning}</p> : null}
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
