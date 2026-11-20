import { useEffect, useState } from "react";
import clsx from "clsx";
import { CheckCircle2, Cpu, Radio } from "lucide-react";
import type { SimState } from "../api/types";
import { useSim, useUpdateSim } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { Card, CardHeader } from "../components/Card";
import { ErrorState, PageSkeleton } from "../components/States";

const ENV_PAYLOAD = `{
  "station_id": "ST-Z1",
  "air_temp_c": 44.2,
  "rh_pct": 38,
  "globe_temp_c": 55.1,
  "wind_ms": 1.4
}`;

const VEST_PAYLOAD = `{
  "vest_id": "V-001",
  "skin_temp_c": 36.1,
  "battery_pct": 82,
  "pcm_temp_c": 24.5
}`;

const CURL = `curl -X POST http://localhost:8000/api/v1/ingest/vest \\
  -H "Content-Type: application/json" \\
  -d '{"vest_id":"V-001","skin_temp_c":36.1,"battery_pct":82,"pcm_temp_c":24.5}'`;

const MQTT = `mosquitto_pub -h localhost -p 1883 \\
  -t thermaguard/v1/vests/V-001/telemetry \\
  -m '{"skin_temp_c":36.1,"battery_pct":82,"pcm_temp_c":24.5}'`;

export function SimulatorPage() {
  const { data, isLoading, error, refetch } = useSim();
  return (
    <div className="space-y-6">
      <PageHeader title="Simulator" subtitle="Drive the demo with synthetic stations and vests" />
      {isLoading ? <PageSkeleton /> : error || !data ? <ErrorState error={error} onRetry={() => void refetch()} /> : <SimControls sim={data} />}
      <IntegrationDocs />
    </div>
  );
}

function SimControls({ sim }: { sim: SimState }) {
  const update = useUpdateSim();
  const [speed, setSpeed] = useState(sim.speed);
  useEffect(() => setSpeed(sim.speed), [sim.speed]);

  return (
    <>
      <Card>
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex flex-1 items-center gap-4">
            <span
              className={clsx(
                "flex h-12 w-12 items-center justify-center rounded-lg",
                sim.enabled ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-slate-100 text-slate-400 dark:bg-slate-800",
              )}
            >
              <Cpu className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white">Simulator {sim.enabled ? "running" : "paused"}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Publishes over the same MQTT topics a real deployment uses.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enabled</span>
            <button
              type="button"
              role="switch"
              aria-checked={sim.enabled}
              aria-label="Enable simulator"
              disabled={update.isPending}
              onClick={() => update.mutate({ enabled: !sim.enabled })}
              className={clsx(
                "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition",
                sim.enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700",
              )}
            >
              <span className={clsx("inline-block h-5 w-5 rounded-full bg-white shadow transition", sim.enabled ? "translate-x-6" : "translate-x-1")} />
            </button>
          </div>
        </div>
        <div className="border-t border-slate-100 p-5 sm:p-6 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="sim-speed" className="label mb-0">
              Clock speed
            </label>
            <span className="tnum text-lg font-semibold text-slate-900 dark:text-white">{speed}×</span>
          </div>
          <input
            id="sim-speed"
            type="range"
            min={1}
            max={20}
            step={1}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            onPointerUp={() => speed !== sim.speed && update.mutate({ speed })}
            onKeyUp={() => speed !== sim.speed && update.mutate({ speed })}
            className="mt-3 w-full accent-slate-900 dark:accent-white"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>1× real time</span>
            <span>20×</span>
          </div>
        </div>
      </Card>

      <section aria-labelledby="scenarios-heading">
        <h2 id="scenarios-heading" className="mb-3 text-base font-semibold text-slate-900 dark:text-white">
          Scenarios
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sim.scenarios.map((s) => {
            const active = s.key === sim.scenario;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={active}
                disabled={update.isPending}
                onClick={() => !active && update.mutate({ scenario: s.key })}
                className={clsx(
                  "card card-hover p-5 text-left",
                  active && "!border-slate-900 ring-1 ring-slate-900 dark:!border-white dark:ring-white",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-900 dark:text-white">{s.label}</p>
                  {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-slate-900 dark:text-white" aria-label="Selected" />}
                </div>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{s.description}</p>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
      <pre className="code-block">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function IntegrationDocs() {
  return (
    <Card>
      <CardHeader
        title="Real sensors use the same interface"
        subtitle="Swap the simulator for field hardware without changing the backend"
        icon={<Radio className="h-4 w-4" />}
      />
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        <div className="space-y-3 lg:col-span-2">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Stations and harnesses publish JSON over MQTT (broker port 1883) or HTTP. IDs are taken from the topic.
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-slate-500">Station</span>
              <code className="break-all rounded-lg bg-slate-100 px-2 py-1 text-[13px] dark:bg-slate-800">thermaguard/v1/stations/{"{station_id}"}/env</code>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-slate-500">Vest</span>
              <code className="break-all rounded-lg bg-slate-100 px-2 py-1 text-[13px] dark:bg-slate-800">thermaguard/v1/vests/{"{vest_id}"}/telemetry</code>
            </li>
          </ul>
        </div>
        <CodeBlock title="Environmental station payload" code={ENV_PAYLOAD} />
        <CodeBlock title="Harness telemetry payload" code={VEST_PAYLOAD} />
        <CodeBlock title="HTTP ingest (curl)" code={CURL} />
        <CodeBlock title="MQTT publish" code={MQTT} />
      </div>
    </Card>
  );
}
