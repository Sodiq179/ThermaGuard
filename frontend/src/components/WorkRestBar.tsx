import clsx from "clsx";
import { OctagonX } from "lucide-react";
import type { WorkRest } from "../api/types";
import { INTENSITY_LABEL } from "../lib/format";

interface WorkRestBarProps {
  rec: WorkRest;
  highlighted?: boolean;
}

/** Card showing the hourly work vs rest split for one intensity. */
export function WorkRestCard({ rec, highlighted }: WorkRestBarProps) {
  const workPct = Math.max(0, Math.min(100, (rec.work_minutes / 60) * 100));
  return (
    <div
      className={clsx(
        "relative rounded-2xl border p-4 transition",
        rec.stop_work
          ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
        highlighted && "ring-2 ring-sky-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{INTENSITY_LABEL[rec.intensity]} work</p>
        {highlighted && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            Zone default
          </span>
        )}
      </div>
      {rec.stop_work ? (
        <div className="mt-3 flex items-center gap-2 text-red-700 dark:text-red-400">
          <OctagonX className="h-7 w-7" aria-hidden />
          <span className="text-2xl font-bold tracking-tight">Stop work</span>
        </div>
      ) : (
        <p className="tnum mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {rec.work_minutes}
          <span className="text-sm font-medium text-slate-500"> min work</span>
          <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>
          {rec.rest_minutes}
          <span className="text-sm font-medium text-slate-500"> min rest</span>
        </p>
      )}
      <div
        className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="img"
        aria-label={rec.stop_work ? "No work permitted this hour" : `${rec.work_minutes} minutes work, ${rec.rest_minutes} minutes rest per hour`}
      >
        {rec.stop_work ? (
          <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#dc2626_0_6px,#f87171_6px_12px)]" />
        ) : (
          <>
            <div className="h-full bg-slate-800 transition-all dark:bg-slate-200" style={{ width: `${workPct}%` }} />
            <div className="h-full flex-1 bg-teal-400/70 dark:bg-teal-500/60" />
          </>
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{rec.stop_work ? "Rest / relocate" : "Work"}</span>
        <span>{rec.limit_c !== null ? `Limit ${rec.limit_c.toFixed(1)} °C WBGT` : "Per hour"}</span>
      </div>
    </div>
  );
}
