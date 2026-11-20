import type { TooltipProps } from "recharts";
import { useTheme } from "../lib/theme";
import { fmtTime } from "../lib/format";

export function useChartTheme() {
  const { dark } = useTheme();
  return {
    grid: dark ? "#1e293b" : "#eef2f6",
    axis: dark ? "#64748b" : "#94a3b8",
    cursor: dark ? "#334155" : "#cbd5e1",
  };
}

export const axisProps = {
  tickLine: false,
  axisLine: false,
  fontSize: 12,
  allowDecimals: false,
} as const;

export const tickTime = (v: string) => fmtTime(v);

type ValueFormatter = (value: number, name: string) => string;

export function ChartTooltip({
  active,
  payload,
  label,
  format,
}: TooltipProps<number, string> & { format?: ValueFormatter }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="card min-w-[160px] px-3 py-2.5 text-sm shadow-lift">
      <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">{fmtTime(String(label))}</p>
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
              {p.name}
            </span>
            <span className="tnum font-semibold text-slate-900 dark:text-white">
              {typeof p.value === "number"
                ? format
                  ? format(p.value, String(p.name))
                  : p.value.toFixed(1)
                : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
