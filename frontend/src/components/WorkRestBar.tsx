import clsx from "clsx";
import { OctagonX } from "lucide-react";
import type { WorkRest } from "../api/types";
import { INTENSITY_LABEL } from "../lib/format";

/** A one-hour clock face: the work share of the hour as an arc, rest as the remainder. */
function HourClock({ work, stop, color }: { work: number; stop: boolean; color: string }) {
  const size = 72;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const workLen = stop ? 0 : (Math.max(0, Math.min(60, work)) / 60) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-slate-200 dark:stroke-white/[0.1]"
      />
      {!stop && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={`${workLen} ${c}`}
          stroke={color}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

interface WorkRestCardProps {
  rec: WorkRest;
  highlighted?: boolean;
}

export function WorkRestCard({ rec, highlighted }: WorkRestCardProps) {
  return (
    <div
      className={clsx(
        "flex items-center gap-4 rounded-md border p-3",
        highlighted ? "border-accent-500/60 dark:border-accent-500/50" : "border-slate-200 dark:border-white/[0.08]",
      )}
      role="group"
      aria-label={`${INTENSITY_LABEL[rec.intensity]} work: ${rec.label}`}
    >
      <div className="relative">
        <HourClock work={rec.work_minutes} stop={rec.stop_work} color="#2563EB" />
        <div className="absolute inset-0 flex items-center justify-center">
          {rec.stop_work ? (
            <OctagonX className="h-5 w-5 text-red-600 dark:text-red-400" strokeWidth={1.75} aria-hidden />
          ) : (
            <span className="tnum text-[15px] font-semibold text-slate-900 dark:text-white">{rec.work_minutes}′</span>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-slate-500 dark:text-slate-400">
          {INTENSITY_LABEL[rec.intensity]} work{highlighted && <span className="text-accent-600 dark:text-accent-500"> · zone default</span>}
        </p>
        {rec.stop_work ? (
          <p className="mt-0.5 text-[15px] font-semibold text-red-700 dark:text-red-400">Stop work</p>
        ) : (
          <p className="tnum mt-0.5 text-[15px] font-semibold text-slate-900 dark:text-white">
            {rec.work_minutes} min work / {rec.rest_minutes} min rest
          </p>
        )}
        <p className="tnum mt-0.5 text-[12px] text-slate-400">
          {rec.stop_work ? "Rest in shade or relocate" : rec.limit_c !== null ? `Per hour · limit ${rec.limit_c.toFixed(1)} °C WBGT` : "Per hour"}
        </p>
      </div>
    </div>
  );
}
