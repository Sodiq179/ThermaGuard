import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { BatteryLow, BatteryMedium, BatteryFull, WifiOff } from "lucide-react";
import type { VestStatus, WorkerSummary } from "../api/types";
import { ATTENTION_ORDER, fmtMinutes, fmtTemp } from "../lib/format";
import { AttentionBadge, IntensityChip, StatusChip } from "./Badges";

export function sortFlaggedFirst(workers: WorkerSummary[]): WorkerSummary[] {
  return [...workers].sort(
    (a, b) =>
      ATTENTION_ORDER[b.attention.level] - ATTENTION_ORDER[a.attention.level] ||
      b.attention.score - a.attention.score ||
      a.id.localeCompare(b.id),
  );
}

export function Battery({ vest }: { vest: VestStatus | null }) {
  if (!vest) return <span className="text-slate-400">No vest</span>;
  const pct = vest.battery_pct;
  const Icon = pct === null ? BatteryMedium : pct < 20 ? BatteryLow : pct < 60 ? BatteryMedium : BatteryFull;
  return (
    <span
      className={clsx(
        "tnum inline-flex items-center gap-1.5",
        pct !== null && pct < 20 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {pct === null ? "—" : `${Math.round(pct)}%`}
      {vest.stale && <WifiOff className="h-3.5 w-3.5 text-amber-500" aria-label="Vest not reporting" />}
    </span>
  );
}

interface WorkerTableProps {
  workers: WorkerSummary[];
  showZone?: boolean;
}

export function WorkerTable({ workers, showZone = false }: WorkerTableProps) {
  const navigate = useNavigate();
  return (
    <div className="relative overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th scope="col">Worker</th>
            {showZone && <th scope="col">Zone</th>}
            <th scope="col">Trade</th>
            <th scope="col">Intensity</th>
            <th scope="col">Status</th>
            <th scope="col" className="text-right">Skin temp</th>
            <th scope="col" className="text-right">Continuous</th>
            <th scope="col" className="text-right">Total today</th>
            <th scope="col">Attention</th>
            <th scope="col">Battery</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((w) => (
            <tr
              key={w.id}
              onClick={() => navigate(`/workers/${w.id}`)}
              className={clsx(
                "cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50",
                w.attention.level === "act_now" && "bg-red-50/60 dark:bg-red-950/20",
              )}
            >
              <td>
                <a
                  href={`/workers/${w.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/workers/${w.id}`);
                  }}
                  className="rounded font-medium text-slate-900 hover:underline dark:text-white"
                >
                  {w.name}
                </a>
                <div className="text-xs text-slate-400">{w.id}</div>
              </td>
              {showZone && <td className="text-slate-600 dark:text-slate-300">{w.zone_name ?? "—"}</td>}
              <td className="text-slate-600 dark:text-slate-300">{w.trade}</td>
              <td>
                <IntensityChip intensity={w.intensity} />
              </td>
              <td>
                <StatusChip status={w.status} />
              </td>
              <td className="tnum text-right font-medium">{fmtTemp(w.skin_temp_c)}</td>
              <td className="tnum text-right">{w.status === "off" ? "—" : fmtMinutes(w.continuous_exposure_min)}</td>
              <td className="tnum text-right text-slate-600 dark:text-slate-300">{fmtMinutes(w.total_exposure_min)}</td>
              <td>
                <AttentionBadge level={w.attention.level} label={w.attention.label} score={w.attention.score} />
              </td>
              <td>
                <Battery vest={w.vest} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
