import { useState } from "react";
import { useParams } from "react-router-dom";
import clsx from "clsx";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Coffee,
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
import { Avatar } from "../components/Avatar";
import { Link } from "react-router-dom";
import { Card, CardHeader } from "../components/Card";
import { StatStrip, StatTile } from "../components/StatTile";
import { AttentionBadge, DotLabel, StatusChip } from "../components/Badges";
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
  return (
    <div className="space-y-5">
      <ProfileHeader worker={worker} />

      <StatStrip>
        <StatTile label="Skin temperature" value={fmtNum(worker.skin_temp_c)} unit="°C" hint={<TrendHint trend={worker.skin_trend_c_per_10min} />} />
        <StatTile
          label="Continuous exposure"
          value={worker.status === "off" ? "—" : fmtMinutes(worker.continuous_exposure_min)}
          hint={
            worker.status === "break" && worker.break_elapsed_min !== null
              ? `On break for ${fmtMinutes(worker.break_elapsed_min)}`
              : "Since check-in or last break"
          }
        />
        <StatTile label="Total today" value={fmtMinutes(worker.total_exposure_min)} hint="Working time only" />
        <StatTile label="Work intensity" value={INTENSITY_LABEL[worker.intensity]} hint="Metabolic load class" />
      </StatStrip>

      <AttentionCard worker={worker} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <SkinChart worker={worker} />
        <HarnessCard worker={worker} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Exposure timeline" subtitle="Today" />
          <div className="px-4 pb-4 pt-1">
            {worker.timeline.length === 0 ? <EmptyState title="No activity today" className="py-6" /> : <Timeline segments={worker.timeline} />}
          </div>
        </Card>
        <ActionsCard worker={worker} />
      </div>

      <Card>
        <CardHeader title="Recent alerts" />
        <div className="px-4 pb-1">
          {worker.alerts.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-500">No alerts for this worker.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
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

function ProfileHeader({ worker }: { worker: WorkerDetail }) {
  return (
    <header>
      <nav aria-label="Breadcrumb" className="text-[13px] text-slate-500 dark:text-slate-400">
        <Link to="/" className="hover:text-slate-900 dark:hover:text-white">
          Overview
        </Link>
        {worker.zone_id && (
          <>
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>
            <Link to={`/zones/${worker.zone_id}`} className="hover:text-slate-900 dark:hover:text-white">
              {worker.zone_name ?? worker.zone_id}
            </Link>
          </>
        )}
        <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>
        <span aria-current="page">{worker.name}</span>
      </nav>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar id={worker.id} name={worker.name} size={72} square />
        <div className="min-w-0 flex-1">
          <h1 className="h-display">{worker.name}</h1>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            <span className="tnum">{worker.id}</span> · {worker.trade} · {worker.zone_name ?? "Not checked in"}
            {worker.vest && <> · Vest {worker.vest.vest_id}</>}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusChip status={worker.status} />
            <AttentionBadge level={worker.attention.level} label={worker.attention.label} />
          </div>
        </div>
        <QuickActions worker={worker} />
      </div>
    </header>
  );
}

function QuickActions({ worker }: { worker: WorkerDetail }) {
  const brk = useWorkerBreak();
  const checkOut = useCheckOut();
  if (worker.status === "off") return null;
  return (
    <div className="flex shrink-0 gap-2">
      <button type="button" className="btn-secondary" disabled={checkOut.isPending} onClick={() => checkOut.mutate(worker.id)}>
        Check out
      </button>
      {worker.status === "break" ? (
        <button type="button" className="btn-primary" disabled={brk.isPending} onClick={() => brk.mutate({ workerId: worker.id, start: false })}>
          End break
        </button>
      ) : (
        <button type="button" className="btn-primary" disabled={brk.isPending} onClick={() => brk.mutate({ workerId: worker.id, start: true })}>
          Start break
        </button>
      )}
    </div>
  );
}

function TrendHint({ trend }: { trend: number | null }) {
  if (trend === null) return <span>Trend not available</span>;
  const Icon = trend > 0.05 ? ArrowUpRight : trend < -0.05 ? ArrowDownRight : ArrowRight;
  return (
    <span className={clsx("tnum inline-flex items-center gap-1", trend > 0.3 && "text-orange-600 dark:text-orange-400")}>
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      {fmtTrend(trend)}
    </span>
  );
}

function AttentionCard({ worker }: { worker: WorkerDetail }) {
  const { attention } = worker;
  const color = ATTENTION_COLOR[attention.level];
  return (
    <Card>
      <div className="grid lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col items-center justify-center gap-3 border-b border-slate-100 p-5 text-center lg:border-b-0 lg:border-r dark:border-white/[0.06]">
          <p className="eyebrow">Attention score</p>
          <ScoreRing score={attention.score} color={color} label={attention.label} />
          <p className="max-w-[16rem] text-[13px] text-slate-600 dark:text-slate-300">{attention.summary}</p>
        </div>
        <div className="p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="h-title">Why this score</h2>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">Each input scored 0–100</p>
          </div>
          {attention.factors.length === 0 ? (
            <p className="text-[13px] text-slate-500">No sensor inputs yet.</p>
          ) : (
            <ul className="space-y-4">
              {attention.factors.map((f) => (
                <FactorRow key={f.key} factor={f} />
              ))}
            </ul>
          )}
          <p className="mt-5 text-[12px] text-slate-400">Decision support only. Not a medical assessment.</p>
        </div>
      </div>
    </Card>
  );
}

function factorColor(score: number): string {
  if (score >= 75) return ATTENTION_COLOR.act_now;
  if (score >= 50) return ATTENTION_COLOR.attention;
  return "#94a3b8";
}

function FactorRow({ factor }: { factor: AttentionFactor }) {
  const Icon = FACTOR_ICON[factor.key] ?? Activity;
  const score = Math.max(0, Math.min(100, factor.score));
  const color = factorColor(score);
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-medium text-slate-900 dark:text-white">{factor.label}</p>
          <p className="tnum text-[13px] font-semibold text-slate-900 dark:text-white">{Math.round(score)}</p>
        </div>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">{factor.detail}</p>
        <div
          className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(score)}
          aria-label={`${factor.label} contribution`}
        >
          <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
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
      <div className="h-64 px-2 pb-3 pt-2">
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
              <Line yAxisId="skin" type="monotone" dataKey="skin_temp_c" name="Skin temp" stroke="#e11d48" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
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
  ok: { label: "Cooling", cls: "#0ea5e9" },
  melting: { label: "Melting", cls: "#f59e0b" },
  spent: { label: "Spent", cls: "#dc2626" },
  unknown: { label: "Unknown", cls: "#94a3b8" },
};

function HarnessCard({ worker }: { worker: WorkerDetail }) {
  const vest = worker.vest;
  return (
    <Card className="xl:col-span-2">
      <CardHeader title="Cooling harness" subtitle={vest ? `Vest ${vest.vest_id}` : "No vest assigned"} />
      {vest ? (
        <div className="space-y-3 px-4 pb-4 pt-1">
          {vest.stale && (
            <p className="flex items-center gap-2 rounded-md border border-l-[3px] border-slate-200 border-l-amber-500 px-3 py-2 text-[13px] text-slate-700 dark:border-white/[0.08] dark:border-l-amber-500 dark:text-slate-300">
              <WifiOff className="h-4 w-4" aria-hidden /> Vest not reporting · last seen {fmtAgo(vest.last_seen)}
            </p>
          )}
          {vest.pcm_state === "spent" && (
            <p className="flex items-center gap-2 rounded-md border border-l-[3px] border-slate-200 border-l-red-600 px-3 py-2 text-[13px] font-medium text-red-700 dark:border-white/[0.08] dark:border-l-red-600 dark:text-red-400">
              <Snowflake className="h-4 w-4" aria-hidden /> Replace PCM pack
            </p>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div >
              <dt className="eyebrow">PCM pack</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <span className="tnum text-[20px] font-semibold text-slate-900 dark:text-white">{fmtTemp(vest.pcm_temp_c)}</span>
                <DotLabel color={(PCM_STATE[vest.pcm_state] ?? PCM_STATE.unknown).cls}>{(PCM_STATE[vest.pcm_state] ?? PCM_STATE.unknown).label}</DotLabel>
              </dd>
            </div>
            <div >
              <dt className="eyebrow">Battery</dt>
              <dd className="mt-1 text-[20px] font-semibold">
                <Battery vest={vest} />
              </dd>
            </div>
            <div className="col-span-2">
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
      <div className="space-y-5 px-4 pb-4 pt-1">
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
                className="btn-secondary"
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
