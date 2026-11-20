import { useState, type FormEvent, type ReactNode } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { Intensity, WorkerSummary, ZoneSummary } from "../api/types";
import {
  useCreateWorker,
  useCreateZone,
  useDeleteWorker,
  useUpdateWorker,
  useUpdateZone,
  useWorkers,
  useZones,
} from "../api/hooks";
import { PageHeader } from "../components/PageHeader";
import { Card, CardHeader } from "../components/Card";
import { IntensityChip } from "../components/Badges";
import { EmptyState, ErrorState, Skeleton } from "../components/States";
import { INTENSITIES, INTENSITY_LABEL } from "../lib/format";

type Errors<T> = Partial<Record<keyof T, string>>;

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function IntensitySelect({ id, value, onChange }: { id: string; value: Intensity; onChange: (v: Intensity) => void }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value as Intensity)}>
      {INTENSITIES.map((i) => (
        <option key={i} value={i}>
          {INTENSITY_LABEL[i]}
        </option>
      ))}
    </select>
  );
}

export function AdminPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Registry" subtitle="Manage workers, vests and work zones" />
      <WorkersAdmin />
      <ZonesAdmin />
    </div>
  );
}

// ---------- Workers ----------

interface WorkerForm {
  id: string;
  name: string;
  trade: string;
  intensity: Intensity;
  vest_id: string;
}

const EMPTY_WORKER: WorkerForm = { id: "", name: "", trade: "", intensity: "moderate", vest_id: "" };

function validateWorker(f: WorkerForm, isNew: boolean): Errors<WorkerForm> {
  const e: Errors<WorkerForm> = {};
  if (isNew && !ID_RE.test(f.id.trim())) e.id = "Use 1–32 letters, digits, - or _ (e.g. W010).";
  if (!f.name.trim()) e.name = "Name is required.";
  if (!f.trade.trim()) e.trade = "Trade is required.";
  if (f.vest_id && !ID_RE.test(f.vest_id.trim())) e.vest_id = "Vest ID may contain letters, digits, - or _.";
  return e;
}

function WorkersAdmin() {
  const workers = useWorkers();
  const create = useCreateWorker();
  const update = useUpdateWorker();
  const del = useDeleteWorker();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<WorkerForm>(EMPTY_WORKER);
  const [errors, setErrors] = useState<Errors<WorkerForm>>({});
  const isNew = editing === null;

  const startEdit = (w: WorkerSummary) => {
    setEditing(w.id);
    setForm({ id: w.id, name: w.name, trade: w.trade, intensity: w.intensity, vest_id: w.vest?.vest_id ?? "" });
    setErrors({});
  };
  const reset = () => {
    setEditing(null);
    setForm(EMPTY_WORKER);
    setErrors({});
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const e = validateWorker(form, isNew);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const vest = form.vest_id.trim() || undefined;
    const body = { name: form.name.trim(), trade: form.trade.trim(), intensity: form.intensity, vest_id: vest };
    if (isNew) create.mutate({ id: form.id.trim(), ...body }, { onSuccess: reset });
    else update.mutate({ id: editing, patch: body }, { onSuccess: reset });
  };

  const set = <K extends keyof WorkerForm>(k: K, v: WorkerForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const pending = create.isPending || update.isPending;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Workers" subtitle={`${workers.data?.length ?? 0} registered`} />
        <div className="mt-4 border-t border-slate-100 dark:border-slate-800">
          {workers.isLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : workers.error ? (
            <ErrorState error={workers.error} onRetry={() => void workers.refetch()} className="m-5" />
          ) : !workers.data || workers.data.length === 0 ? (
            <EmptyState title="No workers yet" message="Use the form to register the first worker." />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="table-base !min-w-[560px]">
                <thead>
                  <tr>
                    <th scope="col">Worker</th>
                    <th scope="col">Trade</th>
                    <th scope="col">Intensity</th>
                    <th scope="col">Vest</th>
                    <th scope="col" className="text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workers.data.map((w) => (
                    <tr key={w.id} className={editing === w.id ? "bg-sky-50/60 dark:bg-sky-500/5" : undefined}>
                      <td>
                        <div className="font-medium text-slate-900 dark:text-white">{w.name}</div>
                        <div className="text-xs text-slate-400">{w.id}</div>
                      </td>
                      <td className="text-slate-600 dark:text-slate-300">{w.trade}</td>
                      <td>
                        <IntensityChip intensity={w.intensity} />
                      </td>
                      <td className="font-mono text-xs text-slate-600 dark:text-slate-300">{w.vest?.vest_id ?? "—"}</td>
                      <td className="text-right">
                        <button type="button" className="icon-btn" aria-label={`Edit ${w.name}`} onClick={() => startEdit(w)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-500/10"
                          aria-label={`Delete ${w.name}`}
                          disabled={del.isPending}
                          onClick={() => {
                            if (window.confirm(`Remove ${w.name} (${w.id}) from the registry?`)) {
                              del.mutate(w.id, { onSuccess: () => editing === w.id && reset() });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card className="self-start">
        <CardHeader
          title={isNew ? "Add worker" : `Edit ${editing}`}
          icon={isNew ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          action={
            !isNew && (
              <button type="button" className="icon-btn" aria-label="Cancel editing" onClick={reset}>
                <X className="h-4 w-4" />
              </button>
            )
          }
        />
        <form className="space-y-4 p-5 sm:p-6" onSubmit={submit} noValidate>
          <Field id="w-id" label="Worker ID" error={errors.id}>
            <input
              id="w-id"
              className="input disabled:opacity-60"
              value={form.id}
              disabled={!isNew}
              placeholder="W010"
              aria-invalid={!!errors.id}
              aria-describedby={errors.id ? "w-id-error" : undefined}
              onChange={(e) => set("id", e.target.value)}
            />
          </Field>
          <Field id="w-name" label="Full name" error={errors.name}>
            <input id="w-name" className="input" value={form.name} aria-invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field id="w-trade" label="Trade" error={errors.trade}>
            <input id="w-trade" className="input" value={form.trade} placeholder="Steel fixer" aria-invalid={!!errors.trade} onChange={(e) => set("trade", e.target.value)} />
          </Field>
          <Field id="w-intensity" label="Default intensity">
            <IntensitySelect id="w-intensity" value={form.intensity} onChange={(v) => set("intensity", v)} />
          </Field>
          <Field id="w-vest" label="Vest ID (optional)" error={errors.vest_id}>
            <input id="w-vest" className="input font-mono" value={form.vest_id} placeholder="V-010" aria-invalid={!!errors.vest_id} onChange={(e) => set("vest_id", e.target.value)} />
          </Field>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary" disabled={pending}>
              {isNew ? "Add worker" : "Save changes"}
            </button>
            {!isNew && (
              <button type="button" className="btn-secondary" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

// ---------- Zones ----------

interface ZoneForm {
  id: string;
  name: string;
  description: string;
  station_id: string;
  default_intensity: Intensity;
}

const EMPTY_ZONE: ZoneForm = { id: "", name: "", description: "", station_id: "", default_intensity: "moderate" };

function validateZone(f: ZoneForm, isNew: boolean): Errors<ZoneForm> {
  const e: Errors<ZoneForm> = {};
  if (isNew && !ID_RE.test(f.id.trim())) e.id = "Use 1–32 letters, digits, - or _ (e.g. Z5).";
  if (!f.name.trim()) e.name = "Name is required.";
  if (!ID_RE.test(f.station_id.trim())) e.station_id = "Station ID is required (e.g. ST-Z5).";
  return e;
}

function ZonesAdmin() {
  const zones = useZones();
  const create = useCreateZone();
  const update = useUpdateZone();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ZoneForm>(EMPTY_ZONE);
  const [errors, setErrors] = useState<Errors<ZoneForm>>({});
  const isNew = editing === null;

  const startEdit = (z: ZoneSummary) => {
    setEditing(z.id);
    setForm({ id: z.id, name: z.name, description: z.description, station_id: z.station_id, default_intensity: z.default_intensity });
    setErrors({});
  };
  const reset = () => {
    setEditing(null);
    setForm(EMPTY_ZONE);
    setErrors({});
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const e = validateZone(form, isNew);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      station_id: form.station_id.trim(),
      default_intensity: form.default_intensity,
    };
    if (isNew) create.mutate({ id: form.id.trim(), ...body }, { onSuccess: reset });
    else update.mutate({ id: editing, patch: body }, { onSuccess: reset });
  };

  const set = <K extends keyof ZoneForm>(k: K, v: ZoneForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const pending = create.isPending || update.isPending;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Work zones" subtitle={`${zones.data?.length ?? 0} zones, each with one environmental station`} />
        <div className="mt-4 border-t border-slate-100 dark:border-slate-800">
          {zones.isLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : zones.error ? (
            <ErrorState error={zones.error} onRetry={() => void zones.refetch()} className="m-5" />
          ) : !zones.data || zones.data.length === 0 ? (
            <EmptyState title="No zones yet" message="Use the form to add the first work zone." />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="table-base !min-w-[560px]">
                <thead>
                  <tr>
                    <th scope="col">Zone</th>
                    <th scope="col">Station</th>
                    <th scope="col">Default intensity</th>
                    <th scope="col" className="text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {zones.data.map((z) => (
                    <tr key={z.id} className={editing === z.id ? "bg-sky-50/60 dark:bg-sky-500/5" : undefined}>
                      <td className="!whitespace-normal">
                        <div className="font-medium text-slate-900 dark:text-white">{z.name}</div>
                        <div className="text-xs text-slate-400">
                          {z.id}
                          {z.description && ` · ${z.description}`}
                        </div>
                      </td>
                      <td className="font-mono text-xs text-slate-600 dark:text-slate-300">{z.station_id}</td>
                      <td>
                        <IntensityChip intensity={z.default_intensity} />
                      </td>
                      <td className="text-right">
                        <button type="button" className="icon-btn" aria-label={`Edit ${z.name}`} onClick={() => startEdit(z)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card className="self-start">
        <CardHeader
          title={isNew ? "Add zone" : `Edit ${editing}`}
          icon={isNew ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          action={
            !isNew && (
              <button type="button" className="icon-btn" aria-label="Cancel editing" onClick={reset}>
                <X className="h-4 w-4" />
              </button>
            )
          }
        />
        <form className="space-y-4 p-5 sm:p-6" onSubmit={submit} noValidate>
          <Field id="z-id" label="Zone ID" error={errors.id}>
            <input id="z-id" className="input disabled:opacity-60" value={form.id} disabled={!isNew} placeholder="Z5" aria-invalid={!!errors.id} onChange={(e) => set("id", e.target.value)} />
          </Field>
          <Field id="z-name" label="Name" error={errors.name}>
            <input id="z-name" className="input" value={form.name} placeholder="Podium slab" aria-invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field id="z-desc" label="Description">
            <input id="z-desc" className="input" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field id="z-station" label="Station ID" error={errors.station_id}>
            <input id="z-station" className="input font-mono" value={form.station_id} placeholder="ST-Z5" aria-invalid={!!errors.station_id} onChange={(e) => set("station_id", e.target.value)} />
          </Field>
          <Field id="z-intensity" label="Default intensity">
            <IntensitySelect id="z-intensity" value={form.default_intensity} onChange={(v) => set("default_intensity", v)} />
          </Field>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary" disabled={pending}>
              {isNew ? "Add zone" : "Save changes"}
            </button>
            {!isNew && (
              <button type="button" className="btn-secondary" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
