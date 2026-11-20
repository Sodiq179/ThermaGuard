import { Link } from "react-router-dom";
import { ChevronRight, Coffee, Droplets, Thermometer, TriangleAlert, Users, WifiOff } from "lucide-react";
import type { ZoneSummary } from "../api/types";
import { fmtNum, fmtPct, fmtTemp } from "../lib/format";
import { Chip, HeatBadge, bandColor } from "./Badges";

export function ZoneCard({ zone }: { zone: ZoneSummary }) {
  const color = bandColor(zone.band);
  const env = zone.env;
  return (
    <Link
      to={`/zones/${zone.id}`}
      className="card card-hover group relative flex flex-col overflow-hidden p-5"
      aria-label={`${zone.name}, WBGT ${fmtTemp(env?.wbgt_c)}, ${zone.band?.label ?? "no data"}`}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400">{zone.id}</p>
          <h3 className="truncate font-semibold text-slate-900 dark:text-white">{zone.name}</h3>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {zone.on_break && (
            <Chip className="bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
              <Coffee className="h-3.5 w-3.5" aria-hidden /> Zone break
            </Chip>
          )}
          {zone.workers_flagged > 0 && (
            <Chip className="bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-300">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> {zone.workers_flagged} flagged
            </Chip>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">WBGT</p>
          <p className="tnum mt-1 text-5xl font-semibold tracking-tight" style={{ color }}>
            {fmtNum(env?.wbgt_c)}
            <span className="ml-1 text-xl font-medium text-slate-400">°C</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 pb-1">
          <HeatBadge band={zone.band} />
          {env?.wbgt_estimated && (
            <span className="text-[11px] font-medium text-slate-400" title="No globe sensor: WBGT estimated from air temperature and humidity">
              estimated
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-4 text-sm text-slate-600 dark:text-slate-300">
        <span className="tnum inline-flex items-center gap-1">
          <Thermometer className="h-4 w-4 text-slate-400" aria-hidden />
          <span className="sr-only">Air temperature</span>
          {fmtTemp(env?.air_temp_c)}
        </span>
        <span className="tnum inline-flex items-center gap-1">
          <Droplets className="h-4 w-4 text-slate-400" aria-hidden />
          <span className="sr-only">Humidity</span>
          {fmtPct(env?.rh_pct)} RH
        </span>
      </div>

      {zone.band && <p className="mt-3 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{zone.band.guidance}</p>}

      {zone.station_stale && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <WifiOff className="h-3.5 w-3.5" aria-hidden /> Station {zone.station_id} not reporting
        </p>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
        <span className="tnum inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <Users className="h-4 w-4 text-slate-400" aria-hidden />
          {zone.workers_working} working · {zone.workers_on_break} on break
        </span>
        <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" aria-hidden />
      </div>
    </Link>
  );
}
