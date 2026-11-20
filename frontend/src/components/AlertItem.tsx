import { Link } from "react-router-dom";
import clsx from "clsx";
import type { Alert, AlertSeverity } from "../api/types";
import { useAckAlert, useResolveAlert, useWorkers } from "../api/hooks";
import { fmtAgo, fmtDateTime } from "../lib/format";
import { Avatar } from "./Avatar";
import { Dot } from "./Badges";

const SEVERITY: Record<AlertSeverity, { color: string; label: string }> = {
  info: { color: "#0ea5e9", label: "Info" },
  warning: { color: "#f59e0b", label: "Warning" },
  critical: { color: "#dc2626", label: "Critical" },
};

interface AlertItemProps {
  alert: Alert;
  actions?: boolean;
  compact?: boolean;
}

export function AlertItem({ alert, actions = false, compact = false }: AlertItemProps) {
  const sev = SEVERITY[alert.severity] ?? SEVERITY.info;
  const ack = useAckAlert();
  const resolve = useResolveAlert();
  const workers = useWorkers();
  const worker = alert.worker_id ? workers.data?.find((w) => w.id === alert.worker_id) : undefined;
  return (
    <li className={clsx("flex gap-3", compact ? "py-2.5" : "py-3")}>
      <span className="mt-0.5 flex w-6 shrink-0 justify-center">
        {worker ? <Avatar id={worker.id} name={worker.name} size={24} /> : <span className="mt-1.5"><Dot color={sev.color} /></span>}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-slate-900 dark:text-white">
            {worker && <Dot color={sev.color} size={6} />}
            <span className="truncate">{alert.title}</span>
            <span className="sr-only">({sev.label})</span>
          </p>
          <time className="tnum shrink-0 text-[12px] text-slate-400" dateTime={alert.created_at} title={fmtDateTime(alert.created_at)}>
            {fmtAgo(alert.created_at)}
          </time>
        </div>
        <p className={clsx("mt-0.5 text-[13px] text-slate-500 dark:text-slate-400", compact && "line-clamp-1")}>{alert.message}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-slate-500 dark:text-slate-400">
          {alert.zone_id && (
            <Link to={`/zones/${alert.zone_id}`} className="link">
              Zone {alert.zone_id}
            </Link>
          )}
          {alert.worker_id && (
            <Link to={`/workers/${alert.worker_id}`} className="link">
              {worker ? worker.name : `Worker ${alert.worker_id}`}
            </Link>
          )}
          {alert.acknowledged_at && <span>Acknowledged {fmtAgo(alert.acknowledged_at)}</span>}
          {alert.resolved_at && <span>Resolved {fmtAgo(alert.resolved_at)}</span>}
          {actions && alert.active && (
            <span className="ml-auto flex gap-2">
              {!alert.acknowledged_at && (
                <button type="button" className="btn-secondary h-7 px-2.5 text-[12px]" disabled={ack.isPending} onClick={() => ack.mutate(alert.id)}>
                  Acknowledge
                </button>
              )}
              <button type="button" className="btn-secondary h-7 px-2.5 text-[12px]" disabled={resolve.isPending} onClick={() => resolve.mutate(alert.id)}>
                Resolve
              </button>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
