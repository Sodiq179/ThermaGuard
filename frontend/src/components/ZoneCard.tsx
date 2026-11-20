import { Link } from "react-router-dom";
import { ChevronRight, WifiOff } from "lucide-react";
import type { HeatBand, WorkerSummary, ZoneSummary } from "../api/types";
import { BAND_COLOR, fmtNum, fmtPct, fmtTemp } from "../lib/format";
import { HeatBadge, bandColor } from "./Badges";
import { AvatarStack } from "./Avatar";

const SCALE: HeatBand["key"][] = ["low", "moderate", "high", "very_high", "extreme"];
const SCALE_MIN = 22;
const SCALE_MAX = 34;

/** Neutral sparkline; only the latest point carries colour. */
export function Sparkline({ values, color, className = "h-8 w-24" }: { values: number[]; color: string; className?: string }) {
  if (values.length < 2) return <div className={className} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 96 + 2, 26 - ((v - min) / span) * 22]);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 100 30" className={className} aria-hidden>
      <polyline
        points={pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}
        fill="none"
        className="stroke-slate-300 dark:stroke-slate-600"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lx} cy={ly} r="2.6" fill={color} />
    </svg>
  );
}

export function BandScale({ wbgt, band }: { wbgt: number | null; band: HeatBand | null }) {
  const pct = wbgt === null ? null : Math.max(0, Math.min(100, ((wbgt - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100));
  return (
    <div className="relative" role="img" aria-label={band ? `Heat band ${band.label}` : "No heat band"}>
      <div className="flex h-1 gap-px overflow-hidden rounded-full">
        {SCALE.map((k) => (
          <span key={k} className="flex-1 opacity-70" style={{ backgroundColor: BAND_COLOR[k] }} />
        ))}
      </div>
      {pct !== null && (
        <span
          className="absolute -top-[3px] h-2.5 w-[3px] -translate-x-1/2 rounded-full bg-slate-900 ring-2 ring-white dark:bg-white dark:ring-slate-900"
          style={{ left: `${pct}%` }}
        />
      )}
    </div>
  );
}

interface ZoneCardProps {
  zone: ZoneSummary;
  trend: number[];
  workers: WorkerSummary[];
}

export function ZoneCard({ zone, trend, workers }: ZoneCardProps) {
  const color = bandColor(zone.band);
  const env = zone.env;
  return (
    <Link to={`/zones/${zone.id}`} className="card card-hover group flex flex-col p-4" aria-label={`${zone.name}, WBGT ${fmtTemp(env?.wbgt_c)}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="h-title truncate">{zone.name}</h3>
        <span className="flex items-center gap-1 text-[12px] text-slate-400">
          {zone.id}
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} aria-hidden />
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="tnum text-[24px] font-semibold leading-7" style={{ color }}>
            {fmtNum(env?.wbgt_c)}
            <span className="ml-0.5 text-[14px] font-normal text-slate-400">°C</span>
          </p>
          <div className="mt-1 flex items-center gap-2">
            <HeatBadge band={zone.band} />
            <span className="text-[12px] text-slate-400">WBGT{env?.wbgt_estimated ? " (est.)" : ""}</span>
          </div>
        </div>
        <Sparkline values={trend} color={color} />
      </div>

      <div className="mt-3">
        <BandScale wbgt={env?.wbgt_c ?? null} band={zone.band} />
      </div>

      <p className="tnum mt-3 text-[12px] text-slate-500 dark:text-slate-400">
        Air {fmtTemp(env?.air_temp_c)} · RH {fmtPct(env?.rh_pct)}
        {zone.on_break && " · Zone break"}
      </p>
      {zone.station_stale && (
        <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-amber-700 dark:text-amber-400">
          <WifiOff className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> Station {zone.station_id} not reporting
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
        {workers.length > 0 ? <AvatarStack workers={workers} /> : <span className="text-[12px] text-slate-400">No crew checked in</span>}
        <span className="tnum text-[12px] text-slate-500 dark:text-slate-400">
          {zone.workers_flagged > 0 ? (
            <span className="font-medium text-red-600 dark:text-red-400">{zone.workers_flagged} flagged</span>
          ) : (
            `${zone.workers_total} on crew`
          )}
        </span>
      </div>
    </Link>
  );
}
