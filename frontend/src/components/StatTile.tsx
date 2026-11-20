import type { ReactNode } from "react";
import clsx from "clsx";

interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: ReactNode;
  hint?: ReactNode;
  accent?: string;
  className?: string;
}

export function StatTile({ label, value, unit, icon, hint, accent, className }: StatTileProps) {
  return (
    <div className={clsx("card relative overflow-hidden p-4 sm:p-5", className)}>
      {accent && <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} aria-hidden />}
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow truncate">{label}</p>
        {icon && <span className="text-slate-400 dark:text-slate-500">{icon}</span>}
      </div>
      <p className="tnum mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
        {value}
        {unit && <span className="ml-1 text-base font-medium text-slate-400 dark:text-slate-500">{unit}</span>}
      </p>
      {hint && <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}
