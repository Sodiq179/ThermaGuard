// Types mirror docs/api.md (ThermaGuard API contract v1).

export type Intensity = "light" | "moderate" | "heavy";
export type WorkerStatus = "working" | "break" | "off";
export type BandKey = "low" | "moderate" | "high" | "very_high" | "extreme";
export type AttentionLevel = "normal" | "watch" | "attention" | "act_now";
export type PcmState = "ok" | "melting" | "spent" | "unknown";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertKind =
  | "zone_heat"
  | "worker_attention"
  | "sensor_stale"
  | "battery_low"
  | "pcm_spent"
  | "midday_ban";

export interface HeatBand {
  level: 0 | 1 | 2 | 3 | 4;
  key: BandKey;
  label: string;
  color: string;
  guidance: string;
}

export interface WorkRest {
  intensity: Intensity;
  work_minutes: number;
  rest_minutes: number;
  label: string;
  stop_work: boolean;
  limit_c: number | null;
}

export interface EnvReading {
  ts: string;
  air_temp_c: number;
  rh_pct: number;
  globe_temp_c: number | null;
  wind_ms: number | null;
  wbgt_c: number;
  wbgt_estimated: boolean;
  heat_index_c: number;
}

export interface ZoneSummary {
  id: string;
  name: string;
  description: string;
  station_id: string;
  default_intensity: Intensity;
  env: EnvReading | null;
  station_stale: boolean;
  band: HeatBand | null;
  recommendations: WorkRest[];
  on_break: boolean;
  workers_total: number;
  workers_working: number;
  workers_on_break: number;
  workers_flagged: number;
}

export interface AttentionFactor {
  key: "skin_temp" | "skin_trend" | "exposure" | "heat_load";
  label: string;
  detail: string;
  score: number;
}

export interface Attention {
  score: number;
  level: AttentionLevel;
  label: string;
  factors: AttentionFactor[];
  summary: string;
}

export interface VestStatus {
  vest_id: string;
  battery_pct: number | null;
  last_seen: string | null;
  stale: boolean;
  pcm_temp_c: number | null;
  pcm_state: PcmState;
}

export interface WorkerSummary {
  id: string;
  name: string;
  trade: string;
  zone_id: string | null;
  zone_name: string | null;
  intensity: Intensity;
  status: WorkerStatus;
  skin_temp_c: number | null;
  skin_trend_c_per_10min: number | null;
  continuous_exposure_min: number;
  total_exposure_min: number;
  break_elapsed_min: number | null;
  attention: Attention;
  vest: VestStatus | null;
}

export interface Alert {
  id: number;
  kind: AlertKind;
  severity: AlertSeverity;
  zone_id: string | null;
  worker_id: string | null;
  title: string;
  message: string;
  created_at: string;
  updated_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  active: boolean;
}

export interface Health {
  status: "ok";
  version: string;
  mqtt_connected: boolean;
}

export interface MiddayBan {
  active: boolean;
  in_season: boolean;
  window: string;
  rule: string;
}

export type SiteWbgtPoint = { ts: string } & { [zoneId: string]: number | string };

export interface Overview {
  site: {
    name: string;
    now: string;
    midday_ban: MiddayBan;
    max_wbgt_c: number | null;
    worst_band: HeatBand | null;
  };
  kpis: {
    zones: number;
    workers_active: number;
    workers_on_break: number;
    workers_flagged: number;
    open_alerts: number;
  };
  zones: ZoneSummary[];
  site_wbgt_history: SiteWbgtPoint[];
}

export interface ZoneDetail extends ZoneSummary {
  workers: WorkerSummary[];
  history: EnvReading[];
}

export interface WorkerHistoryPoint {
  ts: string;
  skin_temp_c: number | null;
  wbgt_c: number | null;
  pcm_temp_c: number | null;
}

export interface TimelineSegment {
  start: string;
  end: string | null;
  kind: "work" | "break";
  zone_id: string;
}

export interface WorkerDetail extends WorkerSummary {
  history: WorkerHistoryPoint[];
  timeline: TimelineSegment[];
  alerts: Alert[];
}

export interface MethodologyBand {
  key: BandKey;
  label: string;
  min_c: number | null;
  max_c: number | null;
  color: string;
  guidance: string;
}

export interface WorkRestRow {
  work_minutes: number;
  rest_minutes: number;
  light: number | null;
  moderate: number | null;
  heavy: number | null;
}

export interface Methodology {
  wbgt_formula: string;
  bands: MethodologyBand[];
  work_rest_table: WorkRestRow[];
  attention_inputs: { key: string; label: string; watch: string; act: string }[];
  midday_ban: { window: string; season: string; rule: string };
  disclaimer: string;
}

export interface SimScenario {
  key: string;
  label: string;
  description: string;
}

export interface SimState {
  enabled: boolean;
  scenario: string;
  speed: number;
  scenarios: SimScenario[];
}

export interface SimUpdate {
  scenario?: string;
  speed?: number;
  enabled?: boolean;
}

export interface WorkerCreate {
  id: string;
  name: string;
  trade: string;
  intensity: Intensity;
  vest_id?: string;
}

export type WorkerPatch = Partial<Omit<WorkerCreate, "id">>;

export interface ZoneCreate {
  id: string;
  name: string;
  description: string;
  station_id: string;
  default_intensity: Intensity;
}

export type ZonePatch = Partial<Omit<ZoneCreate, "id">>;

export type WsMessage = { type: "state"; ts: string } | { type: "alert"; alert: Alert };
