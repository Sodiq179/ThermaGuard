import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { useToast } from "../components/Toast";
import type {
  Alert,
  Health,
  Intensity,
  Methodology,
  Overview,
  SimState,
  SimUpdate,
  WorkerCreate,
  WorkerDetail,
  WorkerPatch,
  WorkerSummary,
  ZoneCreate,
  ZoneDetail,
  ZonePatch,
  ZoneSummary,
} from "./types";

const LIVE = { refetchInterval: 5000 } as const;
const enc = encodeURIComponent;

export const keys = {
  health: ["health"] as const,
  overview: ["overview"] as const,
  zones: ["zones"] as const,
  zone: (id: string) => ["zone", id] as const,
  workers: (zoneId?: string) => ["workers", zoneId ?? "all"] as const,
  worker: (id: string) => ["worker", id] as const,
  alerts: (active: boolean, limit: number) => ["alerts", active, limit] as const,
  methodology: ["methodology"] as const,
  sim: ["sim"] as const,
};

// ---------- Reads ----------

export const useHealth = () =>
  useQuery({ queryKey: keys.health, queryFn: () => api.get<Health>("/health"), refetchInterval: 15000 });

export const useOverview = () =>
  useQuery({ queryKey: keys.overview, queryFn: () => api.get<Overview>("/overview"), ...LIVE });

export const useZones = () =>
  useQuery({ queryKey: keys.zones, queryFn: () => api.get<ZoneSummary[]>("/zones"), ...LIVE });

export const useZone = (id: string) =>
  useQuery({ queryKey: keys.zone(id), queryFn: () => api.get<ZoneDetail>(`/zones/${enc(id)}`), ...LIVE });

export const useWorkers = (zoneId?: string) =>
  useQuery({
    queryKey: keys.workers(zoneId),
    queryFn: () => api.get<WorkerSummary[]>(zoneId ? `/workers?zone_id=${enc(zoneId)}` : "/workers"),
    ...LIVE,
  });

export const useWorker = (id: string) =>
  useQuery({ queryKey: keys.worker(id), queryFn: () => api.get<WorkerDetail>(`/workers/${enc(id)}`), ...LIVE });

export const useAlerts = (active = true, limit = 100) =>
  useQuery({
    queryKey: keys.alerts(active, limit),
    queryFn: () => api.get<Alert[]>(`/alerts?active=${active}&limit=${limit}`),
    ...LIVE,
  });

export const useMethodology = () =>
  useQuery({ queryKey: keys.methodology, queryFn: () => api.get<Methodology>("/methodology"), staleTime: 300_000 });

export const useSim = () => useQuery({ queryKey: keys.sim, queryFn: () => api.get<SimState>("/sim"), ...LIVE });

// ---------- Actions ----------

/** Wraps a mutation: refreshes every query and reports the outcome as a toast. */
function useAction<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, success: (vars: TVars) => string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_data, vars) => {
      toast.push({ tone: "success", title: success(vars) });
      return qc.invalidateQueries();
    },
    onError: (err) => {
      toast.push({ tone: "error", title: "Action failed", message: err instanceof Error ? err.message : String(err) });
    },
  });
}

export const useCheckIn = () =>
  useAction(
    ({ workerId, zoneId }: { workerId: string; zoneId: string }) =>
      api.post<WorkerSummary>(`/workers/${enc(workerId)}/check-in`, { zone_id: zoneId }),
    ({ workerId, zoneId }) => `${workerId} checked in to ${zoneId}`,
  );

export const useCheckOut = () =>
  useAction(
    (workerId: string) => api.post<WorkerSummary>(`/workers/${enc(workerId)}/check-out`),
    (workerId) => `${workerId} checked out`,
  );

export const useWorkerBreak = () =>
  useAction(
    ({ workerId, start }: { workerId: string; start: boolean }) =>
      api.post<WorkerSummary>(`/workers/${enc(workerId)}/break/${start ? "start" : "end"}`),
    ({ workerId, start }) => (start ? `Break started for ${workerId}` : `Break ended for ${workerId}`),
  );

export const useWorkerIntensity = () =>
  useAction(
    ({ workerId, intensity }: { workerId: string; intensity: Intensity }) =>
      api.put<WorkerSummary>(`/workers/${enc(workerId)}/intensity`, { intensity }),
    ({ workerId, intensity }) => `${workerId} set to ${intensity} work`,
  );

export const useZoneBreak = () =>
  useAction(
    ({ zoneId, start }: { zoneId: string; start: boolean }) =>
      api.post<ZoneSummary>(`/zones/${enc(zoneId)}/break/${start ? "start" : "end"}`),
    ({ zoneId, start }) => (start ? `Zone break started in ${zoneId}` : `Zone break ended in ${zoneId}`),
  );

export const useZoneIntensity = () =>
  useAction(
    ({ zoneId, intensity }: { zoneId: string; intensity: Intensity }) =>
      api.put<ZoneSummary>(`/zones/${enc(zoneId)}/intensity`, { intensity }),
    ({ zoneId, intensity }) => `${zoneId} set to ${intensity} work`,
  );

export const useAckAlert = () => useAction((id: number) => api.post<Alert>(`/alerts/${id}/ack`), () => "Alert acknowledged");

export const useResolveAlert = () =>
  useAction((id: number) => api.post<Alert>(`/alerts/${id}/resolve`), () => "Alert resolved");

export const useUpdateSim = () => useAction((body: SimUpdate) => api.put<SimState>("/sim", body), () => "Simulator updated");

export const useCreateWorker = () =>
  useAction((body: WorkerCreate) => api.post<WorkerSummary>("/admin/workers", body), (b) => `Worker ${b.id} added`);

export const useUpdateWorker = () =>
  useAction(
    ({ id, patch }: { id: string; patch: WorkerPatch }) => api.patch<WorkerSummary>(`/admin/workers/${enc(id)}`, patch),
    ({ id }) => `Worker ${id} updated`,
  );

export const useDeleteWorker = () =>
  useAction((id: string) => api.del(`/admin/workers/${enc(id)}`), (id) => `Worker ${id} removed`);

export const useCreateZone = () =>
  useAction((body: ZoneCreate) => api.post<ZoneSummary>("/admin/zones", body), (b) => `Zone ${b.id} added`);

export const useUpdateZone = () =>
  useAction(
    ({ id, patch }: { id: string; patch: ZonePatch }) => api.patch<ZoneSummary>(`/admin/zones/${enc(id)}`, patch),
    ({ id }) => `Zone ${id} updated`,
  );
