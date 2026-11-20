import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MiddayBan, Overview, WorkerSummary, ZoneSummary } from "../api/types";
import { useAlerts, useOverview, useWorkers } from "../api/hooks";
import { Card, CardHeader } from "../components/Card";
import { ZoneCard } from "../components/ZoneCard";
import { AlertItem } from "../components/AlertItem";
import { Avatar } from "../components/Avatar";
import { Dot } from "../components/Badges";
import { sortFlaggedFirst } from "../components/WorkerTable";
import { EmptyState, ErrorState, Skeleton } from "../components/States";
import { ChartTooltip, axisProps, tickTime, useChartTheme } from "../components/chart";
import { ATTENTION_COLOR, TZ, fmtTemp } from "../lib/format";

const SERIES_COLORS = ["#2563eb", "#0d9488", "#a855f7", "#64748b", "#0891b2", "#4f46e5", "#be185d", "#65a30d"];

export function OverviewPage() {
  const { data, isLoading, error, refetch } = useOverview();
  if (isLoading) return <OverviewSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  return <OverviewContent data={data} />;
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-[76px] rounded-lg" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  );
}

const clockFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

function OverviewContent({ data }: { data: Overview }) {
  const workers = useWorkers();
  const now = useNow(15000);
  const byZone = useMemo(() => {
    const map = new Map<string, WorkerSummary[]>();
    for (const w of sortFlaggedFirst(workers.data ?? [])) {
      if (!w.zone_id || w.status === "off") continue;
      map.set(w.zone_id, [...(map.get(w.zone_id) ?? []), w]);
    }
    return map;
  }, [workers.data]);
  const trends = useMemo(() => {
    const out: Record<string, number[]> = {};
    for (const z of data.zones) {
      out[z.id] = data.site_wbgt_history.map((p) => p[z.id]).filter((v): v is number => typeof v === "number");
    }
    return out;
  }, [data]);
  const zones = [...data.zones].sort((a, b) => (b.env?.wbgt_c ?? -1) - (a.env?.wbgt_c ?? -1));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-display">Overview</h1>
          <p className="tnum mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {data.site.name} · {clockFmt.format(now)} AST
          </p>
        </div>
        <MiddayBanText ban={data.site.midday_ban} />
      </header>

      <ActionBar zones={data.zones} />
      <KpiStrip data={data} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="zones-heading">
            <div className="mb-2.5 flex items-baseline justify-between">
              <h2 id="zones-heading" className="h-title">
                Zones
              </h2>
              <span className="text-[12px] text-slate-500 dark:text-slate-400">Highest WBGT first</span>
            </div>
            {zones.length === 0 ? (
              <Card>
                <EmptyState
                  title="No zones yet"
                  message="Add work zones in Admin to start monitoring."
                  action={
                    <Link to="/admin" className="btn-primary">
                      Open admin
                    </Link>
                  }
                />
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {zones.map((z) => (
                  <ZoneCard key={z.id} zone={z} trend={trends[z.id] ?? []} workers={byZone.get(z.id) ?? []} />
                ))}
              </div>
            )}
          </section>
          <SiteTrend history={data.site_wbgt_history} zones={data.zones} />
        </div>
        <aside className="min-w-0 space-y-5">
          <NeedsAttention workers={workers.data} loading={workers.isLoading} />
          <AlertFeed />
        </aside>
      </div>
    </div>
  );
}

function MiddayBanText({ ban }: { ban: MiddayBan }) {
  if (ban.active) {
    return (
      <p className="flex items-center gap-2 text-[13px] font-medium text-red-700 dark:text-red-400" title={ban.rule}>
        <Dot color="#dc2626" /> Midday work ban in effect ({ban.window})
      </p>
    );
  }
  return (
    <p className="text-[13px] text-slate-500 dark:text-slate-400" title={ban.rule}>
      {ban.in_season ? `Midday ban: outside ${ban.window}` : "Midday ban: out of season (15 Jun–15 Sep, 12:00–15:00)"}
    </p>
  );
}

function ActionBar({ zones }: { zones: ZoneSummary[] }) {
  const action = zones.filter((z) => (z.band?.level ?? 0) >= 3 || z.workers_flagged > 0);
  if (action.length === 0) return null;
  const worst = action.reduce((a, z) => ((z.band?.level ?? 0) > (a.band?.level ?? 0) ? z : a), action[0]);
  return (
    <div
      role="status"
      className="rounded-md border border-l-[3px] border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-700 dark:border-white/[0.08] dark:bg-slate-900 dark:text-slate-300"
      style={{ borderLeftColor: worst.band?.color ?? "#dc2626" }}
    >
      <span className="font-medium text-slate-900 dark:text-white">
        {action.length} {action.length === 1 ? "zone requires" : "zones require"} action:
      </span>{" "}
      {action.map((z, i) => (
        <span key={z.id}>
          {i > 0 && ", "}
          <Link to={`/zones/${z.id}`} className="link">
            {z.name}
          </Link>
        </span>
      ))}
      {worst.band && <span className="text-slate-500 dark:text-slate-400"> · {worst.band.guidance}</span>}
    </div>
  );
}

function KpiStrip({ data }: { data: Overview }) {
  const { kpis, site } = data;
  const cells: { label: string; value: string; context: string; tone?: string }[] = [
    {
      label: "Max WBGT",
      value: fmtTemp(site.max_wbgt_c),
      context: site.worst_band ? `${site.worst_band.label} heat load` : "No readings",
      tone: site.worst_band?.color,
    },
    { label: "Active workers", value: String(kpis.workers_active), context: `${kpis.zones} zones` },
    { label: "On break", value: String(kpis.workers_on_break), context: "Resting" },
    {
      label: "Flagged workers",
      value: String(kpis.workers_flagged),
      context: "Attention or act now",
      tone: kpis.workers_flagged > 0 ? "#dc2626" : undefined,
    },
    { label: "Open alerts", value: String(kpis.open_alerts), context: kpis.open_alerts > 0 ? "Needs review" : "All clear" },
  ];
  return (
    <div className="card grid grid-cols-2 divide-slate-100 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x dark:divide-white/[0.06]">
      {cells.map((c) => (
        <div key={c.label} className="px-4 py-3">
          <p className="eyebrow">{c.label}</p>
          <p className="tnum mt-0.5 text-[24px] font-semibold leading-8 text-slate-900 dark:text-white" style={c.tone ? { color: c.tone } : undefined}>
            {c.value}
          </p>
          <p className="text-[12px] text-slate-400">{c.context}</p>
        </div>
      ))}
    </div>
  );
}

function NeedsAttention({ workers, loading }: { workers: WorkerSummary[] | undefined; loading: boolean }) {
  const flagged = sortFlaggedFirst(workers ?? []).filter((w) => w.attention.level !== "normal" && w.status !== "off");
  return (
    <Card>
      <CardHeader
        title="Needs attention"
        action={
          <Link to="/workers" className="link text-[13px]">
            View all
          </Link>
        }
      />
      <div className="px-2 pb-2 pt-1">
        {loading ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : flagged.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-slate-500">No worker is above the normal level.</p>
        ) : (
          <ul>
            {flagged.slice(0, 8).map((w) => (
              <li key={w.id}>
                <Link to={`/workers/${w.id}`} className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]">
                  <Avatar id={w.id} name={w.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-900 dark:text-white">{w.name}</p>
                    <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">{w.zone_name ?? "—"}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
                    <Dot color={ATTENTION_COLOR[w.attention.level]} />
                    {w.attention.label}
                  </span>
                  <span className="tnum w-7 text-right text-[13px] font-semibold text-slate-900 dark:text-white">{Math.round(w.attention.score)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function SiteTrend({ history, zones }: { history: Overview["site_wbgt_history"]; zones: ZoneSummary[] }) {
  const theme = useChartTheme();
  return (
    <Card>
      <CardHeader title="WBGT trend" subtitle="Last 30 minutes, by zone" />
      <div className="h-64 px-2 pb-3 pt-2">
        {history.length === 0 ? (
          <EmptyState title="No readings yet" message="The trend appears once stations report." className="py-8" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={theme.grid} vertical={false} />
              <XAxis dataKey="ts" tickFormatter={tickTime} stroke={theme.axis} minTickGap={40} {...axisProps} />
              <YAxis stroke={theme.axis} domain={["auto", "auto"]} unit="°" width={44} {...axisProps} />
              <Tooltip content={<ChartTooltip format={(v) => fmtTemp(v)} />} cursor={{ stroke: theme.cursor }} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
              {zones.map((z, i) => (
                <Line
                  key={z.id}
                  type="monotone"
                  dataKey={z.id}
                  name={z.name}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function AlertFeed() {
  const { data, isLoading, error, refetch } = useAlerts(true, 20);
  return (
    <Card>
      <CardHeader
        title="Alerts"
        subtitle={data ? `${data.length} open` : undefined}
        action={
          <Link to="/alerts" className="link text-[13px]">
            View all
          </Link>
        }
      />
      <div className="max-h-[28rem] overflow-y-auto px-4 pb-1">
        {isLoading ? (
          <div className="space-y-3 py-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} className="my-3 border-0" />
        ) : !data || data.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-500">No open alerts.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {data.map((a) => (
              <AlertItem key={a.id} alert={a} compact />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
