import clsx from "clsx";
import type { TimelineSegment } from "../api/types";
import { fmtMinutes, fmtTime } from "../lib/format";

interface TimelineProps {
  segments: TimelineSegment[];
  now?: number;
}

/** Horizontal band of today's work and break segments. */
export function Timeline({ segments, now = Date.now() }: TimelineProps) {
  const parsed = segments
    .map((s) => ({ ...s, s: Date.parse(s.start), e: s.end ? Date.parse(s.end) : now }))
    .filter((s) => !Number.isNaN(s.s) && !Number.isNaN(s.e));
  if (parsed.length === 0) return null;
  const min = Math.min(...parsed.map((p) => p.s));
  const max = Math.max(now, ...parsed.map((p) => p.e));
  const span = Math.max(1, max - min);
  const ticks = [min, min + span / 4, min + span / 2, min + (3 * span) / 4, max];

  return (
    <div>
      <div className="relative h-10 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800/70">
        {parsed.map((p, i) => {
          const left = ((p.s - min) / span) * 100;
          const width = Math.max(0.6, ((p.e - p.s) / span) * 100);
          const mins = (p.e - p.s) / 60000;
          return (
            <div
              key={`${p.start}-${i}`}
              className={clsx(
                "absolute inset-y-1 rounded-md border-l-2 border-white/60 transition-opacity hover:opacity-80 dark:border-slate-900/60",
                p.kind === "work" ? "bg-slate-700 dark:bg-slate-300" : "bg-teal-400 dark:bg-teal-500",
                !p.end && "bg-[length:12px_12px]",
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${p.kind === "work" ? "Work" : "Break"} · ${fmtTime(p.start)}–${p.end ? fmtTime(p.end) : "now"} · ${fmtMinutes(mins)} · ${p.zone_id}`}
            />
          );
        })}
      </div>
      <div className="tnum mt-1.5 flex justify-between text-xs text-slate-400">
        {ticks.map((t, i) => (
          <span key={i}>{fmtTime(new Date(t))}</span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-slate-700 dark:bg-slate-300" aria-hidden /> Work
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-teal-400 dark:bg-teal-500" aria-hidden /> Break
        </span>
      </div>
      <ul className="sr-only">
        {parsed.map((p, i) => (
          <li key={i}>
            {p.kind} from {fmtTime(p.start)} to {p.end ? fmtTime(p.end) : "now"}
          </li>
        ))}
      </ul>
    </div>
  );
}
