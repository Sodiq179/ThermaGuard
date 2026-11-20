import { Link } from "react-router-dom";
import clsx from "clsx";
import { AlertOctagon, AlertTriangle, Check, CheckCheck, Info } from "lucide-react";
import type { Alert, AlertSeverity } from "../api/types";
import { useAckAlert, useResolveAlert } from "../api/hooks";
import { fmtAgo, fmtDateTime } from "../lib/format";

const SEVERITY: Record<AlertSeverity, { icon: typeof Info; cls: string; label: string }> = {
  info: { icon: Info, cls: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400", label: "Info" },
  warning: { icon: AlertTriangle, cls: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400", label: "Warning" },
  critical: { icon: AlertOctagon, cls: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400", label: "Critical" },
};

interface AlertItemProps {
  alert: Alert;
  actions?: boolean;
  compact?: boolean;
}

export function AlertItem({ alert, actions = false, compact = false }: AlertItemProps) {
  const sev = SEVERITY[alert.severity] ?? SEVERITY.info;
  const Icon = sev.icon;
  const ack = useAckAlert();
  const resolve = useResolveAlert();
  return (
    <li className={clsx("flex gap-3", compact ? "py-3" : "py-4")}>
      <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", sev.cls)}>
        <Icon className="h-[18px] w-[18px]" aria-hidden />
        <span className="sr-only">{sev.label}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="font-medium text-slate-900 dark:text-white">{alert.title}</p>
          <time className="tnum shrink-0 text-xs text-slate-400" dateTime={alert.created_at} title={fmtDateTime(alert.created_at)}>
            {fmtAgo(alert.created_at)}
          </time>
        </div>
        <p className={clsx("mt-0.5 text-sm text-slate-600 dark:text-slate-400", compact && "line-clamp-2")}>{alert.message}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          {alert.zone_id && (
            <Link to={`/zones/${alert.zone_id}`} className="font-medium text-sky-700 hover:underline dark:text-sky-400">
              Zone {alert.zone_id}
            </Link>
          )}
          {alert.worker_id && (
            <Link to={`/workers/${alert.worker_id}`} className="font-medium text-sky-700 hover:underline dark:text-sky-400">
              Worker {alert.worker_id}
            </Link>
          )}
          {alert.acknowledged_at && (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Check className="h-3.5 w-3.5" aria-hidden /> Acknowledged {fmtAgo(alert.acknowledged_at)}
            </span>
          )}
          {alert.resolved_at && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Resolved {fmtAgo(alert.resolved_at)}
            </span>
          )}
          {actions && alert.active && (
            <span className="ml-auto flex gap-2">
              {!alert.acknowledged_at && (
                <button
                  type="button"
                  className="btn-secondary h-8 px-3 text-xs"
                  disabled={ack.isPending}
                  onClick={() => ack.mutate(alert.id)}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden /> Acknowledge
                </button>
              )}
              <button
                type="button"
                className="btn-primary h-8 px-3 text-xs"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate(alert.id)}
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Resolve
              </button>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
