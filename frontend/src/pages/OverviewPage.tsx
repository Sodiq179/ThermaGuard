import { Link } from "react-router-dom";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bell, Coffee, Flame, HardHat, LayoutGrid, Sun, SunDim, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import type { MiddayBan, Overview, ZoneSummary } from "../api/types";
import { useAlerts, useOverview } from "../api/hooks";
import { Card, CardHeader } from "../components/Card";
import { StatTile } from "../components/StatTile";
import { ZoneCard } from "../components/ZoneCard";
import { AlertItem } from "../components/AlertItem";
import { bandColor } from "../components/Badges";
import { EmptyState, ErrorState, PageSkeleton, Skeleton } from "../components/States";
import { ChartTooltip, axisProps, tickTime, useChartTheme } from "../components/chart";
import { fmtTemp } from "../lib/format";

const SERIES_COLORS = ["#2563eb", "#0d9488", "#d946ef", "#64748b", "#0891b2", "#4f46e5", "#be185d", "#65a30d"];

export function OverviewPage() {
  const { data, isLoading, error, refetch } = useOverview();
  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;
  return <OverviewContent data={data} />;
}

function OverviewContent({ data }: { data: Overview }) {
  const { site, kpis, zones } = data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">Site overview</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{site.name}</p>
        </div>
        <MiddayBanPill ban={site.midday_ban} />
      </div>

      {site.midday_ban.active && <MiddayBanBanner ban={site.midday_ban} />}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Zones" value={kpis.zones} icon={<LayoutGrid className="h-4 w-4" />} />
        <StatTile label="Active workers" value={kpis.workers_active} icon={<HardHat className="h-4 w-4" />} />
        <StatTile label="On break" value={kpis.workers_on_break} icon={<Coffee className="h-4 w-4" />} />
        <StatTile
          label="Flagged workers"
          value={kpis.workers_flagged}
          icon={<TriangleAlert className="h-4 w-4" />}
          accent={kpis.workers_flagged > 0 ? "#ea580c" : undefined}
          hint={kpis.workers_flagged > 0 ? "Attention or act now" : "None flagged"}
        />
        <StatTile
          label="Open alerts"
          value={kpis.open_alerts}
          icon={<Bell className="h-4 w-4" />}
          accent={kpis.open_alerts > 0 ? "#dc2626" : undefined}
          className="col-span-2 md:col-span-1"
        />
      </div>

      <WorstBanner overview={data} />

      <section aria-labelledby="zones-heading">
        <h2 id="zones-heading" className="mb-3 text-base font-semibold text-slate-900 dark:text-white">
          Work zones
        </h2>
        {zones.length === 0 ? (
          <Card>
            <EmptyState title="No zones yet" message="Add work zones in Admin to start monitoring." action={<Link to="/admin" className="btn-primary">Open admin</Link>} />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {zones.map((z) => (
              <ZoneCard key={z.id} zone={z} />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <SiteTrend history={data.site_wbgt_history} zones={zones} />
        <AlertFeed />
      </div>
    </div>
  );
}

function MiddayBanPill({ ban }: { ban: MiddayBan }) {
  if (ban.active) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
        <Sun className="h-4 w-4" aria-hidden /> Midday work ban in effect
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
      title={ban.rule}
    >
      <SunDim className="h-3.5 w-3.5" aria-hidden />
      {ban.in_season ? `Midday ban: outside ${ban.window}` : "Midday ban: out of season (15 Jun–15 Sep, 12:00–15:00)"}
    </span>
  );
}

function MiddayBanBanner({ ban }: { ban: MiddayBan }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
      <Sun className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
      <div>
        <p className="font-semibold">Midday outdoor work ban in effect ({ban.window})</p>
        <p className="mt-0.5 text-sm opacity-90">{ban.rule}</p>
      </div>
    </div>
  );
}

function WorstBanner({ overview }: { overview: Overview }) {
  const band = overview.site.worst_band;
  if (!band) return null;
  const color = bandColor(band);
  const worstZone = overview.zones.reduce<ZoneSummary | null>(
    (acc, z) => (z.env && (!acc?.env || z.env.wbgt_c > acc.env.wbgt_c) ? z : acc),
    null,
  );
  return (
    <div
      className="card flex flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:items-center"
      style={{ backgroundImage: `linear-gradient(90deg, ${color}1a, transparent 60%)` }}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: color }}>
        <Flame className="h-6 w-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">Worst condition on site</p>
        <p className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
          <span style={{ color }}>{band.label}</span> heat load
          {worstZone && (
            <>
              {" "}in{" "}
              <Link to={`/zones/${worstZone.id}`} className="underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500">
                {worstZone.name}
              </Link>
            </>
          )}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{band.guidance}</p>
      </div>
      <div className="text-left sm:text-right">
        <p className="eyebrow">Max WBGT</p>
        <p className="tnum text-3xl font-semibold" style={{ color }}>
          {fmtTemp(overview.site.max_wbgt_c)}
        </p>
      </div>
    </div>
  );
}

function SiteTrend({ history, zones }: { history: Overview["site_wbgt_history"]; zones: ZoneSummary[] }) {
  const theme = useChartTheme();
  return (
    <Card className="xl:col-span-3">
      <CardHeader title="Site WBGT trend" subtitle="Last 30 minutes, per zone" />
      <div className="h-72 px-2 pb-4 pt-4 sm:px-4">
        {history.length === 0 ? (
          <EmptyState title="No readings yet" message="Trend appears once stations start reporting." className="py-8" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={theme.grid} vertical={false} />
              <XAxis dataKey="ts" tickFormatter={tickTime} stroke={theme.axis} minTickGap={40} {...axisProps} />
              <YAxis stroke={theme.axis} domain={["auto", "auto"]} unit="°" width={44} {...axisProps} />
              <Tooltip content={<ChartTooltip format={(v) => fmtTemp(v)} />} cursor={{ stroke: theme.cursor }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {zones.map((z, i) => (
                <Line
                  key={z.id}
                  type="monotone"
                  dataKey={z.id}
                  name={z.name}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2}
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
    <Card className="flex flex-col xl:col-span-2">
      <CardHeader
        title="Live alerts"
        subtitle="Newest first"
        action={
          <Link to="/alerts" className="btn-ghost h-8 text-xs">
            View all
          </Link>
        }
      />
      <div className={clsx("flex-1 px-5 pb-3 sm:px-6", data && data.length > 0 && "max-h-[19rem] overflow-y-auto")}>
        {isLoading ? (
          <div className="space-y-4 py-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} className="my-4 border-0 shadow-none" />
        ) : !data || data.length === 0 ? (
          <EmptyState title="All clear" message="No open alerts on site right now." className="py-8" />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((a) => (
              <AlertItem key={a.id} alert={a} compact />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
