import { useState } from "react";
import { useParams } from "react-router-dom";
import clsx from "clsx";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Coffee,
  Gauge,
  LogIn,
  LogOut,
  Play,
  Snowflake,
  Sun,
  Thermometer,
  Timer,
  WifiOff,
} from "lucide-react";
import type { AttentionFactor, Intensity, PcmState, WorkerDetail } from "../api/types";
import { useCheckIn, useCheckOut, useWorker, useWorkerBreak, useWorkerIntensity, useZones } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { Card, CardHeader } from "../components/Card";
import { StatTile } from "../components/StatTile";
import { AttentionBadge, Chip, IntensityChip, StatusChip } from "../components/Badges";
import { ScoreRing } from "../components/ScoreRing";
import { Timeline } from "../components/Timeline";
import { SegmentedControl } from "../components/SegmentedControl";
import { AlertItem } from "../components/AlertItem";
import { Battery } from "../components/WorkerTable";
import { EmptyState, ErrorState, PageSkeleton } from "../components/States";
import { ChartTooltip, axisProps, tickTime, useChartTheme } from "../components/chart";
import {
  ATTENTION_COLOR,
  INTENSITIES,
  INTENSITY_LABEL,
  fmtAgo,
  fmtMinutes,
  fmtNum,
  fmtTemp,
  fmtTrend,
} from "../lib/format";

const INTENSITY_OPTIONS = INTENSITIES.map((v) => ({ value: v, label: INTENSITY_LABEL[v] }));

const FACTOR_ICON: Record<AttentionFactor["key"], typeof Thermometer> = {
  skin_temp: Thermometer,
  skin_trend: Activity,
  exposure: Timer,
  heat_load: Sun,
};

export function WorkerPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error, refetch } = useWorker(id);
  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load worker" />;
  return <WorkerContent worker={data} />;
}

function WorkerContent({ worker }: { worker: WorkerDetail }) {
  const crumbs = [
    { label: "Site", to: "/" },
    ...(worker.zone_id ? [{ label: worker.zone_name ?? worker.zone_id, to: `/zones/${worker.zone_id}` }] : []),
    { label: worker.name },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={crumbs}
        title={worker.name}
        subtitle={`${worker.id} · ${worker.trade}${worker.zone_name ? ` · ${worker.zone_name}` : " · Not checked in"}`}
        meta={
          <>
            <StatusChip status={worker.status} />
            <IntensityChip intensity={worker.intensity} />
            <AttentionBadge level={worker.attention.level} label={worker.attention.label} />
          </>
        }
      />

      <AttentionCard worker={worker} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Skin temperature"
          value={fmtNum(worker.skin_temp_c)}
          unit="°C"
          icon={<Thermometer className="h-4 w-4" />}
          hint={<TrendHint trend={worker.skin_trend_c_per_10min} />}
        />
        <StatTile
          label="Continuous exposure"
          value={worker.status === "off" ? "—" : fmtMinutes(worker.continuous_exposure_min)}
          icon={<Timer className="h-4 w-4" />}
          hint={
            worker.status === "break" && worker.break_elapsed_min !== null
              ? `On break for ${fmtMinutes(worker.break_elapsed_min)}`
              : "Since check-in or last break"
          }
        />
        <StatTile label="Total today" value={fmtMinutes(worker.total_exposure_min)} icon={<Clock className="h-4 w-4" />} hint="Working time only" />
        <StatTile label="Work intensity" value={INTENSITY_LABEL[worker.intensity]} icon={<Gauge className="h-4 w-4" />} hint="Metabolic load class" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <SkinChart worker={worker} />
        <HarnessCard worker={worker} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Exposure timeline" subtitle="Today's work and break periods" />
          <div className="p-5 sm:p-6">
            {worker.timeline.length === 0 ? (
              <EmptyState title="No activity today" className="py-6" />
            ) : (
              <Timeline segments={worker.timeline} />
            )}
          </div>
        </Card>
        <ActionsCard worker={worker} />
      </div>

      <Card>
        <CardHeader title="Recent alerts" subtitle="For this worker, newest first" />
        <div className="px-5 pb-2 sm:px-6">
          {worker.alerts.length === 0 ? (
            <EmptyState title="No alerts" message="Nothing raised for this worker recently." className="py-8" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {worker.alerts.map((a) => (
                <AlertItem key={a.id} alert={a} actions />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function TrendHint({ trend }: { trend: number | null }) {
  if (trend === null) return <span>Trend not available</span>;
  const Icon = trend > 0.05 ? ArrowUpRight : trend < -0.05 ? ArrowDownRight : ArrowRight;
  return (
    <span
      className={clsx(
        "tnum inline-flex items-center gap-1",
        trend > 0.3 ? "text-orange-600 dark:text-orange-400" : trend < -0.05 ? "text-emerald-600 dark:text-emerald-400" : "",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {fmtTrend(trend)}
    </span>
  );
}

function AttentionCard({ worker }: { worker: WorkerDetail }) {
  const { attention } = worker;
  const color = ATTENTION_COLOR[attention.level];
  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(260px,1fr)_2fr]">
        <div
          className="flex flex-col items-center justify-center gap-4 border-b border-slate-100 p-6 text-center lg:border-b-0 lg:border-r dark:border-slate-800"
          style={{ backgroundImage: `radial-gradient(circle at 50% 40%, ${color}1c, transparent 70%)` }}
        >
          <p className="eyebrow">Attention score</p>
          <ScoreRing score={attention.score} color={color} label={attention.label} />
          <p className="max-w-xs text-sm font-medium text-slate-700 dark:text-slate-200">{attention.summary}</p>
        </div>
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Why this score</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Each input scored 0–100 · highest first</p>
          </div>
          {attention.factors.length === 0 ? (
            <p className="text-sm text-slate-500">No sensor inputs yet.</p>
          ) : (
            <ul className="space-y-5">
              {attention.factors.map((f) => (
                <FactorRow key={f.key} factor={f} />
              ))}
            </ul>
          )}
          <p className="mt-6 text-xs text-slate-400">
            Decision support only: combines sensor readings into a prompt for supervisor attention. It is not a medical assessment.
          </p>
        </div>
      </div>
    </Card>
  );
}

function factorColor(score: number): string {
  if (score >= 75) return ATTENTION_COLOR.act_now;
  if (score >= 50) return ATTENTION_COLOR.attention;
  if (score >= 25) return ATTENTION_COLOR.watch;
  return ATTENTION_COLOR.normal;
}

function FactorRow({ factor }: { factor: AttentionFactor }) {
  const Icon = FACTOR_ICON[factor.key] ?? Activity;
  const score = Math.max(0, Math.min(100, factor.score));
  const color = factorColor(score);
  return (
    <li className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1f`, color }}>
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium text-slate-900 dark:text-white">{factor.label}</p>
          <p className="tnum text-sm font-semibold" style={{ color }}>
            {Math.round(score)}
          </p>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{factor.detail}</p>
        <div
          className="relative mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(score)}
          aria-label={`${factor.label} contribution`}
        >
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${score}%`, backgroundColor: color }} />
          {[25, 50, 75].map((t) => (
            <span key={t} className="absolute inset-y-0 w-px bg-white/70 dark:bg-slate-900/70" style={{ left: `${t}%` }} aria-hidden />
          ))}
        </div>
      </div>
    </li>
  );
}

function SkinChart({ worker }: { worker: WorkerDetail }) {
  const theme = useChartTheme();
  return (
    <Card className="xl:col-span-3">
      <CardHeader title="Skin temperature vs zone WBGT" subtitle="Last 30 minutes" />
      <div className="h-72 px-2 pb-4 pt-4 sm:px-4">
        {worker.history.length === 0 ? (
          <EmptyState title="No readings yet" className="py-8" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={worker.history} margin={{ top: 8, right: 0, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={theme.grid} vertical={false} />
              <XAxis dataKey="ts" tickFormatter={tickTime} stroke={theme.axis} minTickGap={40} {...axisProps} />
              <YAxis yAxisId="skin" stroke={theme.axis} domain={["auto", "auto"]} unit="°" width={44} {...axisProps} />
              <YAxis yAxisId="wbgt" orientation="right" stroke={theme.axis} domain={["auto", "auto"]} unit="°" width={44} {...axisProps} />
              <Tooltip content={<ChartTooltip format={(v) => fmtTemp(v)} />} cursor={{ stroke: theme.cursor }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line yAxisId="skin" type="monotone" dataKey="skin_temp_c" name="Skin temp" stroke="#e11d48" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
              <Line yAxisId="wbgt" type="monotone" dataKey="wbgt_c" name="Zone WBGT" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />
              <Line yAxisId="skin" type="monotone" dataKey="pcm_temp_c" name="PCM pack" stroke="#0ea5e9" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

const PCM_STATE: Record<PcmState, { label: string; cls: string }> = {
  ok: { label: "Cooling", cls: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" },
  melting: { label: "Melting", cls: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" },
  spent: { label: "Spent", cls: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" },
  unknown: { label: "Unknown", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

function HarnessCard({ worker }: { worker: WorkerDetail }) {
  const vest = worker.vest;
  return (
    <Card className="xl:col-span-2">
      <CardHeader title="Cooling harness" subtitle={vest ? `Vest ${vest.vest_id}` : "No vest assigned"} icon={<Snowflake className="h-4 w-4" />} />
      {vest ? (
        <div className="space-y-4 p-5 sm:p-6">
          {vest.stale && (
            <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <WifiOff className="h-4 w-4" aria-hidden /> Vest not reporting · last seen {fmtAgo(vest.last_seen)}
            </p>
          )}
          {vest.pcm_state === "spent" && (
            <p className="flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white">
              <Snowflake className="h-4 w-4" aria-hidden /> Replace PCM pack
            </p>
          )}
          <dl className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <dt className="eyebrow">PCM pack</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <span className="tnum text-xl font-semibold text-slate-900 dark:text-white">{fmtTemp(vest.pcm_temp_c)}</span>
                <Chip className={(PCM_STATE[vest.pcm_state] ?? PCM_STATE.unknown).cls}>{(PCM_STATE[vest.pcm_state] ?? PCM_STATE.unknown).label}</Chip>
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <dt className="eyebrow">Battery</dt>
              <dd className="mt-1 text-xl font-semibold">
                <Battery vest={vest} />
              </dd>
            </div>
            <div className="col-span-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <dt className="eyebrow">Last seen</dt>
              <dd className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{fmtAgo(vest.last_seen)}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <EmptyState title="No vest assigned" message="Assign a vest in Admin to stream skin temperature." className="py-8" />
      )}
    </Card>
  );
}

function ActionsCard({ worker }: { worker: WorkerDetail }) {
  const zones = useZones();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const brk = useWorkerBreak();
  const intensity = useWorkerIntensity();
  const [zoneId, setZoneId] = useState(worker.zone_id ?? "");
  const selected = zoneId || zones.data?.[0]?.id || "";

  return (
    <Card className="xl:col-span-2">
      <CardHeader title="Supervisor actions" />
      <div className="space-y-6 p-5 sm:p-6">
        {worker.status === "off" ? (
          <div>
            <label htmlFor="checkin-zone" className="label">
              Check in to zone
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                id="checkin-zone"
                className="input max-w-[16rem] flex-1"
                value={selected}
                onChange={(e) => setZoneId(e.target.value)}
              >
                {(zones.data ?? []).map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} ({z.id})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary"
                disabled={!selected || checkIn.isPending}
                onClick={() => checkIn.mutate({ workerId: worker.id, zoneId: selected })}
              >
                <LogIn className="h-4 w-4" aria-hidden /> Check in
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {worker.status === "break" ? (
              <button
                type="button"
                className="btn-primary"
                disabled={brk.isPending}
                onClick={() => brk.mutate({ workerId: worker.id, start: false })}
              >
                <Play className="h-4 w-4" aria-hidden /> End break
              </button>
            ) : (
              <button
                type="button"
                className="btn bg-teal-600 text-white hover:bg-teal-700"
                disabled={brk.isPending}
                onClick={() => brk.mutate({ workerId: worker.id, start: true })}
              >
                <Coffee className="h-4 w-4" aria-hidden /> Start break
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              disabled={checkOut.isPending}
              onClick={() => checkOut.mutate(worker.id)}
            >
              <LogOut className="h-4 w-4" aria-hidden /> Check out
            </button>
          </div>
        )}
        <div>
          <p className="label">Work intensity</p>
          <SegmentedControl<Intensity>
            label="Worker intensity"
            options={INTENSITY_OPTIONS}
            value={worker.intensity}
            disabled={intensity.isPending}
            onChange={(v) => intensity.mutate({ workerId: worker.id, intensity: v })}
          />
        </div>
      </div>
    </Card>
  );
}
