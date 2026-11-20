import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import clsx from "clsx";

export type ToastTone = "success" | "error" | "info" | "warning" | "critical";

interface ToastInput {
  tone: ToastTone;
  title: string;
  message?: string;
  href?: string;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastApi {
  push: (t: ToastInput) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE = {
  success: { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  error: { icon: XCircle, cls: "text-red-600 dark:text-red-400", bar: "bg-red-500" },
  info: { icon: Info, cls: "text-sky-600 dark:text-sky-400", bar: "bg-sky-500" },
  warning: { icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  critical: { icon: AlertOctagon, cls: "text-red-600 dark:text-red-400", bar: "bg-red-600" },
} as const;

const MAX_TOASTS = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      setItems((xs) => [...xs, { ...t, id }].slice(-MAX_TOASTS));
      const ttl = t.tone === "critical" ? 9000 : t.tone === "error" || t.tone === "warning" ? 7000 : 4000;
      window.setTimeout(() => dismiss(id), ttl);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6"
        aria-live="polite"
        role="region"
        aria-label="Notifications"
      >
        {items.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const tone = TONE[toast.tone];
  const Icon = tone.icon;
  const body = (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{toast.title}</p>
      {toast.message && <p className="mt-0.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{toast.message}</p>}
    </div>
  );
  return (
    <div
      role={toast.tone === "critical" || toast.tone === "error" ? "alert" : "status"}
      className="card pointer-events-auto relative flex w-full max-w-sm animate-toast-in items-start gap-3 overflow-hidden p-4 pl-5 shadow-lift"
    >
      <span className={clsx("absolute inset-y-0 left-0 w-1", tone.bar)} aria-hidden />
      <Icon className={clsx("mt-0.5 h-5 w-5 shrink-0", tone.cls)} aria-hidden />
      {toast.href ? (
        <Link to={toast.href} onClick={onDismiss} className="min-w-0 flex-1 rounded hover:opacity-80">
          {body}
        </Link>
      ) : (
        body
      )}
      <button type="button" onClick={onDismiss} className="icon-btn -mr-2 -mt-2 h-8 w-8" aria-label="Dismiss notification">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
