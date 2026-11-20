import type { ReactNode } from "react";
import clsx from "clsx";

interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone?: string;
  className?: string;
}

/** One cell of a metric strip: label, value, muted context. */
export function StatTile({ label, value, unit, hint, tone, className }: StatTileProps) {
  return (
    <div className={clsx("px-4 py-3", className)}>
      <p className="eyebrow">{label}</p>
      <p className="tnum mt-0.5 text-[24px] font-semibold leading-8 text-slate-900 dark:text-white" style={tone ? { color: tone } : undefined}>
        {value}
        {unit && <span className="ml-0.5 text-[14px] font-normal text-slate-400">{unit}</span>}
      </p>
      {hint && <div className="text-[12px] text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}

export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("card grid grid-cols-2 divide-slate-100 lg:grid-cols-4 lg:divide-x dark:divide-white/[0.06]", className)}>{children}</div>
  );
}
