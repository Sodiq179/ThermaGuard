import type { ReactNode } from "react";
import { BookOpen, Gauge, Info, ListChecks, ShieldAlert, Sun, Timer } from "lucide-react";
import type { Methodology, MethodologyBand } from "../api/types";
import { useMethodology } from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { ErrorState, PageSkeleton } from "../components/States";
import { BAND_COLOR } from "../lib/format";

const SECTIONS = [
  { id: "wbgt", label: "WBGT" },
  { id: "bands", label: "Heat bands" },
  { id: "work-rest", label: "Work–rest" },
  { id: "attention", label: "Attention score" },
  { id: "midday", label: "Midday ban" },
  { id: "disclaimer", label: "Disclaimer" },
];

export function MethodologyPage() {
  const { data, isLoading, error, refetch } = useMethodology();
  return (
    <div>
      <PageHeader
        title="How it works"
        subtitle="The standards and logic behind every number on this dashboard"
      />
      {isLoading ? <PageSkeleton /> : error || !data ? <ErrorState error={error} onRetry={() => void refetch()} /> : <Doc m={data} />}
    </div>
  );
}

function Section({ id, icon, title, lead, children }: { id: string; icon: ReactNode; title: string; lead?: string; children: ReactNode }) {
  return (
    <Card as="article" className="scroll-mt-24 p-5">
      <div id={id} className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-slate-400 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <div>
          <h2 className="text-[16px] font-semibold text-slate-900 dark:text-white">{title}</h2>
          {lead && <p className="mt-1 max-w-2xl text-slate-600 dark:text-slate-400">{lead}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function range(b: MethodologyBand): string {
  if (b.min_c === null && b.max_c !== null) return `< ${b.max_c.toFixed(1)} °C`;
  if (b.min_c !== null && b.max_c === null) return `≥ ${b.min_c.toFixed(1)} °C`;
  if (b.min_c !== null && b.max_c !== null) return `${b.min_c.toFixed(1)} – ${b.max_c.toFixed(1)} °C`;
  return "—";
}

function limit(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(1)} °C`;
}

function Doc({ m }: { m: Methodology }) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_1fr]">
      <nav aria-label="On this page" className="hidden lg:block">
        <div className="sticky top-24">
          <p className="eyebrow mb-3">On this page</p>
          <ul className="space-y-1 border-l border-slate-200 dark:border-slate-800">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="-ml-px block border-l-2 border-transparent py-1 pl-4 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="min-w-0 space-y-6">
        <Section
          id="wbgt"
          icon={<Gauge className="h-5 w-5" />}
          title="Wet Bulb Globe Temperature (ISO 7243)"
          lead="WBGT combines air temperature, humidity, radiant heat and wind into one heat-load index. It is the basis for every band and work–rest recommendation."
        >
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center dark:border-white/[0.08] dark:bg-slate-950">
            <p className="font-mono text-lg font-semibold text-slate-900 sm:text-xl dark:text-white">{m.wbgt_formula}</p>
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-slate-900 dark:text-white">T<sub>nwb</sub> · natural wet bulb</dt>
              <dd className="mt-1 text-slate-600 dark:text-slate-400">Evaporative cooling potential; dominated by humidity and air movement.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900 dark:text-white">T<sub>g</sub> · black globe</dt>
              <dd className="mt-1 text-slate-600 dark:text-slate-400">Radiant heat from sun and hot surfaces such as steel decks.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900 dark:text-white">T<sub>a</sub> · air temperature</dt>
              <dd className="mt-1 text-slate-600 dark:text-slate-400">Dry-bulb temperature measured in shade.</dd>
            </div>
          </dl>
          <p className="mt-5 flex items-start gap-2 rounded-md bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Stations without a globe sensor report an <strong className="font-semibold">estimated</strong> WBGT from air
              temperature and humidity; these readings are tagged in the UI.
            </span>
          </p>
        </Section>

        <Section id="bands" icon={<Sun className="h-5 w-5" />} title="Heat bands" lead="Each zone is classified by its current WBGT. Colour is paired with a label everywhere in the app.">
          <div className="relative overflow-x-auto">
            <table className="table-base !min-w-[560px]">
              <thead>
                <tr>
                  <th scope="col">Band</th>
                  <th scope="col">WBGT</th>
                  <th scope="col">Supervisor guidance</th>
                </tr>
              </thead>
              <tbody>
                {m.bands.map((b) => {
                  const c = b.color || BAND_COLOR[b.key];
                  return (
                    <tr key={b.key}>
                      <td>
                        <span className="inline-flex items-center gap-2 font-semibold" style={{ color: c }}>
                          <span className="h-3 w-3 rounded" style={{ backgroundColor: c }} aria-hidden />
                          {b.label}
                        </span>
                      </td>
                      <td className="tnum font-medium">{range(b)}</td>
                      <td className="!whitespace-normal text-slate-600 dark:text-slate-400">{b.guidance}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full" aria-hidden>
            {m.bands.map((b) => (
              <div key={b.key} className="flex-1" style={{ backgroundColor: b.color || BAND_COLOR[b.key] }} />
            ))}
          </div>
        </Section>

        <Section
          id="work-rest"
          icon={<Timer className="h-5 w-5" />}
          title="Work–rest schedule (ACGIH TLV, acclimatized)"
          lead="Maximum WBGT at which each hourly work–rest split is acceptable, by work intensity. Above the highest limit for an intensity, the recommendation is to stop work."
        >
          <div className="relative overflow-x-auto">
            <table className="table-base !min-w-[520px]">
              <thead>
                <tr>
                  <th scope="col">Work / rest per hour</th>
                  <th scope="col" className="text-right">Light</th>
                  <th scope="col" className="text-right">Moderate</th>
                  <th scope="col" className="text-right">Heavy</th>
                </tr>
              </thead>
              <tbody>
                {m.work_rest_table.map((r) => (
                  <tr key={`${r.work_minutes}-${r.rest_minutes}`}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-2 w-20 overflow-hidden rounded-full bg-teal-400/70" aria-hidden>
                          <div className="bg-slate-800 dark:bg-slate-200" style={{ width: `${(r.work_minutes / 60) * 100}%` }} />
                        </div>
                        <span className="tnum font-medium">
                          {r.work_minutes} / {r.rest_minutes} min
                        </span>
                      </div>
                    </td>
                    <td className="tnum text-right">{limit(r.light)}</td>
                    <td className="tnum text-right">{limit(r.moderate)}</td>
                    <td className="tnum text-right">{limit(r.heavy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          id="attention"
          icon={<ListChecks className="h-5 w-5" />}
          title="Attention score"
          lead="Each input is mapped to a 0–100 membership of a “needs attention” set, then combined into one score with a level: Normal, Watch, Attention or Act now. The worker page shows every factor so supervisors can see why a worker is flagged."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {m.attention_inputs.map((a) => (
              <div key={a.key} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <p className="font-semibold text-slate-900 dark:text-white">{a.label}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 font-medium text-amber-700 dark:text-amber-400">Watch</dt>
                    <dd className="text-slate-600 dark:text-slate-400">{a.watch}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 font-medium text-red-700 dark:text-red-400">Act</dt>
                    <dd className="text-slate-600 dark:text-slate-400">{a.act}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </Section>

        <Section id="midday" icon={<BookOpen className="h-5 w-5" />} title="Saudi midday work ban" lead={m.midday_ban.rule}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
              <dt className="eyebrow">Season</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{m.midday_ban.season}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
              <dt className="eyebrow">Daily window</dt>
              <dd className="tnum mt-1 text-lg font-semibold text-slate-900 dark:text-white">{m.midday_ban.window}</dd>
            </div>
          </dl>
        </Section>

        <div id="disclaimer" className="scroll-mt-24 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Disclaimer</p>
            <p className="mt-1 text-sm leading-relaxed">{m.disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
