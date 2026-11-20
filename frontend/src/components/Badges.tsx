import type { ReactNode } from "react";
import clsx from "clsx";
import type { AttentionLevel, HeatBand, Intensity, WorkerStatus } from "../api/types";
import { ATTENTION_COLOR, BAND_COLOR, INTENSITY_LABEL, STATUS_LABEL } from "../lib/format";

export function bandColor(band: HeatBand | null | undefined): string {
  if (!band) return "#94a3b8";
  return band.color || BAND_COLOR[band.key];
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, backgroundColor: color }} aria-hidden />;
}

/** Status text preceded by a small coloured dot. */
export function DotLabel({ color, children, className }: { color: string; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-slate-700 dark:text-slate-300", className)}>
      <Dot color={color} />
      {children}
    </span>
  );
}

/** Neutral tag: the only "badge" style in the system. */
export function Chip({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-1.5 py-0.5 text-[12px] font-medium text-slate-600 dark:border-white/[0.1] dark:text-slate-300",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function HeatBadge({ band }: { band: HeatBand | null }) {
  if (!band) return <span className="text-[13px] text-slate-400">No data</span>;
  return <DotLabel color={bandColor(band)}>{band.label}</DotLabel>;
}

export function AttentionBadge({ level, label, score }: { level: AttentionLevel; label: string; score?: number }) {
  return (
    <DotLabel color={ATTENTION_COLOR[level]} className={level === "act_now" ? "font-medium text-red-700 dark:text-red-400" : undefined}>
      {label}
      {score !== undefined && <span className="tnum text-slate-400">{Math.round(score)}</span>}
    </DotLabel>
  );
}

/** Attention level with a thin score bar, for tables. */
export function AttentionMeter({ level, label, score }: { level: AttentionLevel; label: string; score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <span className="inline-flex items-center gap-3">
      <span className="w-[84px]">
        <AttentionBadge level={level} label={label} />
      </span>
      <span className="h-1 w-12 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 50 ? ATTENTION_COLOR[level] : "#94a3b8" }} />
      </span>
      <span className="tnum w-6 text-right text-[13px] text-slate-600 dark:text-slate-300">{Math.round(pct)}</span>
    </span>
  );
}

export function IntensityChip({ intensity }: { intensity: Intensity }) {
  return <span className="text-[13px] text-slate-700 dark:text-slate-300">{INTENSITY_LABEL[intensity]}</span>;
}

const STATUS_COLOR: Record<WorkerStatus, string> = { working: "#10b981", break: "#0ea5e9", off: "#94a3b8" };

export function StatusChip({ status }: { status: WorkerStatus }) {
  return <DotLabel color={STATUS_COLOR[status] ?? "#94a3b8"}>{STATUS_LABEL[status] ?? status}</DotLabel>;
}
