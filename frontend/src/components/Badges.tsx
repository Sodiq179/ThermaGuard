import type { ReactNode } from "react";
import clsx from "clsx";
import { AlertOctagon, AlertTriangle, CheckCircle2, Coffee, Eye, Footprints, HardHat, LogOut } from "lucide-react";
import type { AttentionLevel, HeatBand, Intensity, WorkerStatus } from "../api/types";
import { BAND_COLOR, INTENSITY_LABEL, STATUS_LABEL } from "../lib/format";

export function bandColor(band: HeatBand | null | undefined): string {
  if (!band) return "#94a3b8";
  return band.color || BAND_COLOR[band.key];
}

interface ChipProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Chip({ children, className, title }: ChipProps) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        className ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      )}
    >
      {children}
    </span>
  );
}

export function HeatBadge({ band, size = "sm" }: { band: HeatBand | null; size?: "sm" | "md" }) {
  if (!band) return <Chip>No data</Chip>;
  const color = bandColor(band);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold",
        size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs",
      )}
      style={{ color, backgroundColor: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {band.label}
      <span className="sr-only"> heat band</span>
    </span>
  );
}

const ATTENTION_STYLE: Record<AttentionLevel, { cls: string; icon: typeof CheckCircle2 }> = {
  normal: {
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30",
    icon: CheckCircle2,
  },
  watch: {
    cls: "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30",
    icon: Eye,
  },
  attention: {
    cls: "bg-orange-50 text-orange-800 ring-orange-600/25 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/30",
    icon: AlertTriangle,
  },
  act_now: {
    cls: "bg-red-600 text-white ring-red-700 animate-pulse-ring dark:bg-red-600 dark:text-white",
    icon: AlertOctagon,
  },
};

export function AttentionBadge({ level, label, score }: { level: AttentionLevel; label: string; score?: number }) {
  const s = ATTENTION_STYLE[level];
  const Icon = s.icon;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        s.cls,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
      {score !== undefined && <span className="tnum opacity-80">· {Math.round(score)}</span>}
    </span>
  );
}

const INTENSITY_ICON_BARS: Record<Intensity, number> = { light: 1, moderate: 2, heavy: 3 };

export function IntensityChip({ intensity }: { intensity: Intensity }) {
  const bars = INTENSITY_ICON_BARS[intensity];
  return (
    <Chip>
      <span className="flex items-end gap-px" aria-hidden>
        {[1, 2, 3].map((b) => (
          <span
            key={b}
            className={clsx("w-[3px] rounded-sm", b <= bars ? "bg-current" : "bg-current opacity-25")}
            style={{ height: 4 + b * 2 }}
          />
        ))}
      </span>
      {INTENSITY_LABEL[intensity]}
    </Chip>
  );
}

const STATUS_STYLE: Record<WorkerStatus, { cls: string; icon: typeof HardHat }> = {
  working: { cls: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300", icon: HardHat },
  break: { cls: "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300", icon: Coffee },
  off: { cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", icon: LogOut },
};

export function StatusChip({ status }: { status: WorkerStatus }) {
  const s = STATUS_STYLE[status] ?? { cls: undefined, icon: Footprints };
  const Icon = s.icon;
  return (
    <Chip className={s.cls}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {STATUS_LABEL[status] ?? status}
    </Chip>
  );
}
