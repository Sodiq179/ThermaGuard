import { Link, useParams } from "react-router-dom";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Coffee, Play, WifiOff } from "lucide-react";
import type { Intensity, ZoneDetail } from "../api/types";
import { useZone, useZoneBreak, useZoneIntensity } from "../api/hooks";
import { Card, CardHeader } from "../components/Card";
import { StatStrip, StatTile } from "../components/StatTile";
import { HeatBadge, bandColor } from "../components/Badges";
import { WorkRestCard } from "../components/WorkRestBar";
import { SegmentedControl } from "../components/SegmentedControl";
import { WorkerTable, sortFlaggedFirst } from "../components/WorkerTable";
import { EmptyState, ErrorState, PageSkeleton } from "../components/States";
import { ChartTooltip, axisProps, tickTime, useChartTheme } from "../components/chart";
import { INTENSITIES, INTENSITY_LABEL, fmtNum, fmtPct, fmtTemp, fmtTime } from "../lib/format";

const INTENSITY_OPTIONS = INTENSITIES.map((v) => ({ value: v, label: INTENSITY_LABEL[v] }));

export function ZonePage() {
  const { id = "" } = useParams();
  const { data, isLoading, error, refetch } = useZone(id);
  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load zone" />;
  return <ZoneContent zone={data} />;
}

function ZoneContent({ zone }: { zone: ZoneDetail }) {
  const color = bandColor(zone.band);
  const env = zone.env;
  return (
    <div className="space-y-5">
      <header>
        <nav aria-label="Breadcrumb" className="text-[13px] text-slate-500 dark:text-slate-400">
          <Link to="/" className="hover:text-slate-900 dark:hover:text-white">
            Overview
          </Link>
          <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>
          <span aria-current="page">{zone.name}</span>
        </nav>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="h-display">{zone.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500 dark:text-slate-400">
              {zone.description && <span>{zone.description}</span>}
              <HeatBadge band={zone.band} />
              <span>Station {zone.station_id}</span>
              {zone.on_break && <span>Zone break active</span>}
              {zone.station_stale && (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <WifiOff className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> Station not reporting
                </span>
              )}
            </p>
          </div>
          {zone.band && <p className="max-w-md text-[13px] text-slate-600 dark:text-slate-300">{zone.band.guidance}</p>}
        </div>
      </header>

      <StatStrip>
        <StatTile
          label={env?.wbgt_estimated ? "WBGT (estimated)" : "WBGT"}
          value={fmtNum(env?.wbgt_c)}
          unit="°C"
          tone={zone.band ? color : undefined}
          hint={env ? `Updated ${fmtTime(env.ts)}` : "No reading yet"}
        />
        <StatTile label="Air temperature" value={fmtNum(env?.air_temp_c)} unit="°C" />
        <StatTile label="Relative humidity" value={fmtPct(env?.rh_pct)} />
        <StatTile label="Heat index" value={fmtNum(env?.heat_index_c)} unit="°C" />
      </StatStrip>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <EnvChart zone={zone} />
        <GroupActions zone={zone} />
      </div>

      <Card>
        <CardHeader
          title="Work–rest recommendation"
          subtitle="Per hour, ACGIH TLV for acclimatized workers at the current WBGT"
        />
        <div className="grid gap-3 px-4 pb-4 pt-1 lg:grid-cols-3">
          {zone.recommendations.length === 0 ? (
            <p className="text-sm text-slate-500 lg:col-span-3">Recommendations appear once the station reports.</p>
          ) : (
            zone.recommendations.map((r) => (
              <WorkRestCard key={r.intensity} rec={r} highlighted={r.intensity === zone.default_intensity} />
            ))
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Workers in zone"
          subtitle={`${zone.workers_total} checked in · ${zone.workers_flagged} flagged`}
                  />
        <div className="mt-1 border-t border-slate-200 dark:border-white/[0.08]">
          {zone.workers.length === 0 ? (
            <EmptyState title="No workers checked in" message="Check workers in from their page to monitor them here." />
          ) : (
            <WorkerTable workers={sortFlaggedFirst(zone.workers)} />
          )}
        </div>
      </Card>
    </div>
  );
}

function EnvChart({ zone }: { zone: ZoneDetail }) {
  const theme = useChartTheme();
  const color = bandColor(zone.band);
  return (
    <Card className="xl:col-span-3">
      <CardHeader title="Environment trend" subtitle="WBGT, air temperature and humidity · last 30 minutes" />
      <div className="h-64 px-2 pb-3 pt-2">
        {zone.history.length === 0 ? (
          <EmptyState title="No readings yet" className="py-8" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={zone.history} margin={{ top: 8, right: 0, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={theme.grid} vertical={false} />
              <XAxis dataKey="ts" tickFormatter={tickTime} stroke={theme.axis} minTickGap={40} {...axisProps} />
              <YAxis yAxisId="t" stroke={theme.axis} domain={["auto", "auto"]} unit="°" width={44} {...axisProps} />
              <YAxis yAxisId="rh" orientation="right" stroke={theme.axis} domain={[0, 100]} unit="%" width={44} {...axisProps} />
              <Tooltip
                content={<ChartTooltip format={(v, name) => (name === "Humidity" ? fmtPct(v) : fmtTemp(v))} />}
                cursor={{ stroke: theme.cursor }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line yAxisId="t" type="monotone" dataKey="wbgt_c" name="WBGT" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="t" type="monotone" dataKey="air_temp_c" name="Air temp" stroke="#64748b" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line yAxisId="rh" type="monotone" dataKey="rh_pct" name="Humidity" stroke="#0ea5e9" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function GroupActions({ zone }: { zone: ZoneDetail }) {
  const zoneBreak = useZoneBreak();
  const zoneIntensity = useZoneIntensity();
  return (
    <Card className="xl:col-span-2">
      <CardHeader title="Group actions" subtitle="Apply to every worker checked in to this zone" />
      <div className="space-y-5 px-4 pb-4 pt-1">
        <div>
          <p className="label">Zone break</p>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            {zone.on_break
              ? "A zone-wide break is active. End it to resume work."
              : `${zone.workers_working} working, ${zone.workers_on_break} on break.`}
          </p>
          {zone.on_break ? (
            <button
              type="button"
              className="btn-primary"
              disabled={zoneBreak.isPending}
              onClick={() => zoneBreak.mutate({ zoneId: zone.id, start: false })}
            >
              <Play className="h-4 w-4" aria-hidden /> End zone break
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              disabled={zoneBreak.isPending || zone.workers_working === 0}
              onClick={() => zoneBreak.mutate({ zoneId: zone.id, start: true })}
            >
              <Coffee className="h-4 w-4" aria-hidden /> Start zone break
            </button>
          )}
        </div>
        <div>
          <p className="label" id="zone-intensity-label">Zone work intensity</p>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Sets the intensity for all checked-in workers.</p>
          <SegmentedControl<Intensity>
            label="Zone work intensity"
            options={INTENSITY_OPTIONS}
            value={zone.default_intensity}
            disabled={zoneIntensity.isPending}
            onChange={(intensity) => zoneIntensity.mutate({ zoneId: zone.id, intensity })}
          />
        </div>
      </div>
    </Card>
  );
}
