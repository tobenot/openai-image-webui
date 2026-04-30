import { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface ImagePreviewModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function ImagePreviewModal({ imageUrl, onClose }: ImagePreviewModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!imageUrl) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imageUrl, onClose]);

  if (!imageUrl) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur">
      <button
        className="absolute inset-0 h-full w-full"
        type="button"
        onClick={onClose}
        aria-label={t("preview.closePreview")}
      />
      <div className="relative max-h-full max-w-6xl overflow-hidden rounded-3xl bg-white p-3 shadow-2xl">
        <button
          className="absolute right-4 top-4 rounded-full bg-slate-950/80 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
          type="button"
          onClick={onClose}
        >
          {t("preview.close")}
        </button>
        <img
          className="max-h-[85vh] max-w-full rounded-2xl object-contain"
          src={imageUrl}
          alt={t("preview.alt")}
        />
      </div>
    </div>
  );
}
