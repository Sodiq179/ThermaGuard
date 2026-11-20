import type { ReactNode } from "react";
import { AlertCircle, Inbox, RotateCw } from "lucide-react";
import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton rounded-md bg-slate-200/60 dark:bg-white/[0.06]", className)} aria-hidden />;
}

export function SkeletonCards({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={clsx("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-3 p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  message?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, message, icon, action, className }: EmptyStateProps) {
  return (
    <div className={clsx("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <span className="mb-2 text-slate-300 dark:text-slate-600 [&>svg]:h-5 [&>svg]:w-5">{icon ?? <Inbox strokeWidth={1.75} aria-hidden />}</span>
      <p className="text-[13px] font-medium text-slate-900 dark:text-white">{title}</p>
      {message && <p className="mt-0.5 max-w-sm text-[13px] text-slate-500 dark:text-slate-400">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}

export function ErrorState({ error, onRetry, title = "Couldn't load data", className }: ErrorStateProps) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div
      role="alert"
      className={clsx(
        "card flex flex-col items-center gap-2 px-6 py-10 text-center",
        className,
      )}
    >
      <AlertCircle className="h-5 w-5 text-red-500" strokeWidth={1.75} aria-hidden />
      <div>
        <p className="text-[14px] font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="btn-secondary mt-1" onClick={onRetry}>
          <RotateCw className="h-4 w-4" aria-hidden /> Retry
        </button>
      )}
    </div>
  );
}
