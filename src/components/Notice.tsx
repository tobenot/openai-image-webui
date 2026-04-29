type NoticeVariant = "info" | "warning" | "error" | "success";

interface NoticeProps {
  children: React.ReactNode;
  variant?: NoticeVariant;
}

const styles: Record<NoticeVariant, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function Notice({ children, variant = "info" }: NoticeProps) {
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles[variant]}`}>{children}</div>;
}
