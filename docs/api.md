# ThermaGuard API contract (v1)

Base URL: `/api/v1`. All timestamps are ISO-8601 UTC strings. Temperatures are °C.
Live updates: WebSocket at `/ws` (see bottom).

## Shared types (TypeScript notation)

```ts
type Intensity = "light" | "moderate" | "heavy";
type WorkerStatus = "working" | "break" | "off";          // off = not checked in
type BandKey = "low" | "moderate" | "high" | "very_high" | "extreme";
type AttentionLevel = "normal" | "watch" | "attention" | "act_now";
type PcmState = "ok" | "melting" | "spent" | "unknown";
type AlertSeverity = "info" | "warning" | "critical";
type AlertKind =
  | "zone_heat" | "worker_attention" | "sensor_stale"
  | "battery_low" | "pcm_spent" | "midday_ban";

interface HeatBand {
  level: 0 | 1 | 2 | 3 | 4;   // 0 = low ... 4 = extreme
  key: BandKey;
  label: string;              // "Low", "Moderate", "High", "Very high", "Extreme"
  color: string;              // hex, suggested UI colour
  guidance: string;           // one-sentence supervisor guidance
}

interface WorkRest {
  intensity: Intensity;
  work_minutes: number;       // per hour, 0..60
  rest_minutes: number;       // per hour
  label: string;              // "45 min work / 15 min rest" or "Stop work"
  stop_work: boolean;
  limit_c: number | null;     // WBGT limit that applies to the current row
}

interface EnvReading {
  ts: string;
  air_temp_c: number;
  rh_pct: number;
  globe_temp_c: number | null;
  wind_ms: number | null;
  wbgt_c: number;
  wbgt_estimated: boolean;    // true when no globe sensor -> estimated WBGT
  heat_index_c: number;
}

interface ZoneSummary {
  id: string;                 // "Z1"
  name: string;               // "Tower Crane Deck"
  description: string;
  station_id: string;         // "ST-Z1"
  default_intensity: Intensity;
  env: EnvReading | null;     // latest reading
  station_stale: boolean;     // no env data for > 60 s
  band: HeatBand | null;      // null when no env yet
  recommendations: WorkRest[];// one per intensity: light, moderate, heavy
  on_break: boolean;          // zone-wide break active
  workers_total: number;      // checked in to this zone
  workers_working: number;
  workers_on_break: number;
  workers_flagged: number;    // attention level attention or act_now
}

interface AttentionFactor {
  key: "skin_temp" | "skin_trend" | "exposure" | "heat_load";
  label: string;              // "Skin temperature"
  detail: string;             // "36.4 °C, above 36.0 °C watch level"
  score: number;              // 0..100 membership of the "risky" set for this input
}

interface Attention {
  score: number;              // 0..100
  level: AttentionLevel;
  label: string;              // "Normal", "Watch", "Attention", "Act now"
  factors: AttentionFactor[]; // sorted, highest score first
  summary: string;            // short human sentence: why
}

interface VestStatus {
  vest_id: string;
  battery_pct: number | null;
  last_seen: string | null;
  stale: boolean;             // no data for > 60 s
  pcm_temp_c: number | null;
  pcm_state: PcmState;
}

interface WorkerSummary {
  id: string;                 // "W001"
  name: string;
  trade: string;              // "Steel fixer"
  zone_id: string | null;
  zone_name: string | null;
  intensity: Intensity;
  status: WorkerStatus;
  skin_temp_c: number | null;
  skin_trend_c_per_10min: number | null;
  continuous_exposure_min: number;  // since check-in or last break end
  total_exposure_min: number;       // today, working time only
  break_elapsed_min: number | null; // when on break
  attention: Attention;
  vest: VestStatus | null;
}

interface Alert {
  id: number;
  kind: AlertKind;
  severity: AlertSeverity;
  zone_id: string | null;
  worker_id: string | null;
  title: string;              // "Worker W003 needs attention"
  message: string;
  created_at: string;
  updated_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  active: boolean;
}
```

## Read endpoints

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{status: "ok", version: string, mqtt_enabled: boolean, mqtt_connected: boolean}` |
| GET | `/overview` | `Overview` |
| GET | `/zones` | `ZoneSummary[]` |
| GET | `/zones/{id}` | `ZoneDetail` |
| GET | `/workers` | `WorkerSummary[]` (optional `?zone_id=Z1`) |
| GET | `/workers/{id}` | `WorkerDetail` |
| GET | `/alerts` | `Alert[]` (`?active=true` default true; `?limit=100`) |
| GET | `/methodology` | `Methodology` (thresholds, for an explainer page) |
| GET | `/sim` | `SimState` |

```ts
interface Overview {
  site: {
    name: string;                       // "ThermaGuard Demo Site, Dammam"
    now: string;
    midday_ban: { active: boolean; in_season: boolean; window: string; rule: string };
    max_wbgt_c: number | null;
    worst_band: HeatBand | null;
  };
  kpis: { zones: number; workers_active: number; workers_on_break: number;
          workers_flagged: number; open_alerts: number };
  zones: ZoneSummary[];
  site_wbgt_history: { ts: string; [zoneId: string]: number | string }[]; // last 30 min, one key per zone id with wbgt
}

interface ZoneDetail extends ZoneSummary {
  workers: WorkerSummary[];
  history: EnvReading[];                // last 30 min, oldest first
}

interface WorkerDetail extends WorkerSummary {
  history: { ts: string; skin_temp_c: number | null; wbgt_c: number | null; pcm_temp_c: number | null }[]; // last 30 min
  timeline: { start: string; end: string | null; kind: "work" | "break"; zone_id: string }[];         // today
  alerts: Alert[];                      // recent for this worker, newest first
}

interface Methodology {
  wbgt_formula: string;
  bands: { key: BandKey; label: string; min_c: number | null; max_c: number | null; color: string; guidance: string }[];
  work_rest_table: { work_minutes: number; rest_minutes: number; light: number | null; moderate: number | null; heavy: number | null }[];
  attention_inputs: { key: string; label: string; watch: string; act: string }[];
  midday_ban: { window: string; season: string; rule: string };
  disclaimer: string;
}

interface SimState {
  enabled: boolean;
  scenario: string;
  speed: number;                        // 1..20, environmental clock multiplier
  scenarios: { key: string; label: string; description: string }[];
}
```

## Supervisor actions (all return the updated `WorkerSummary` / `ZoneSummary`)

| Method | Path | Body |
|---|---|---|
| POST | `/workers/{id}/check-in` | `{zone_id: string}` |
| POST | `/workers/{id}/check-out` | — |
| POST | `/workers/{id}/break/start` | — |
| POST | `/workers/{id}/break/end` | — |
| PUT | `/workers/{id}/intensity` | `{intensity: Intensity}` |
| POST | `/zones/{id}/break/start` | — (puts every working worker in the zone on break) |
| POST | `/zones/{id}/break/end` | — |
| PUT | `/zones/{id}/intensity` | `{intensity: Intensity}` (applies to all workers checked in) |
| POST | `/alerts/{id}/ack` | — returns `Alert` |
| POST | `/alerts/{id}/resolve` | — returns `Alert` |
| PUT | `/sim` | `{scenario?: string, speed?: number, enabled?: boolean}` returns `SimState` |

## Admin (registry)

| Method | Path | Body |
|---|---|---|
| POST | `/admin/workers` | `{id, name, trade, intensity, vest_id?}` → `WorkerSummary` |
| PATCH | `/admin/workers/{id}` | any of `{name, trade, intensity, vest_id}` → `WorkerSummary` |
| DELETE | `/admin/workers/{id}` | → 204 |
| POST | `/admin/zones` | `{id, name, description, station_id, default_intensity}` → `ZoneSummary` |
| PATCH | `/admin/zones/{id}` | any of `{name, description, station_id, default_intensity}` → `ZoneSummary` |

Errors: `{detail: string}` with 400/404/409/422.

## Ingestion (device-facing)

HTTP:
- `POST /ingest/env` body `{station_id, ts?, air_temp_c, rh_pct, globe_temp_c?, wind_ms?}` → 202
- `POST /ingest/vest` body `{vest_id, ts?, skin_temp_c, battery_pct?, pcm_temp_c?}` → 202

MQTT (broker `mosquitto:1883`, host port 1883), same JSON bodies (ids taken from topic):
- `thermaguard/v1/stations/{station_id}/env`
- `thermaguard/v1/vests/{vest_id}/telemetry`

## WebSocket `/ws`

Server → client JSON messages:
- `{"type": "state", "ts": "..."}` — state changed, refetch visible queries (throttled to ≤ 1/s).
- `{"type": "alert", "alert": Alert}` — a new alert was raised (show a toast).
