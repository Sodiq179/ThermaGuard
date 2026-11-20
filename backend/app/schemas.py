"""API contracts (see docs/api.md)."""

from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

Intensity = Literal["light", "moderate", "heavy"]
WorkerStatus = Literal["working", "break", "off"]
AttentionLevel = Literal["normal", "watch", "attention", "act_now"]
PcmState = Literal["ok", "melting", "spent", "unknown"]


class Model(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- ingestion
class EnvIngest(Model):
    station_id: str = Field(min_length=1, max_length=64)
    ts: Optional[datetime] = None
    air_temp_c: float = Field(ge=-30, le=70)
    rh_pct: float = Field(ge=0, le=100)
    globe_temp_c: Optional[float] = Field(default=None, ge=-30, le=100)
    wind_ms: Optional[float] = Field(default=None, ge=0, le=60)


class VestIngest(Model):
    vest_id: str = Field(min_length=1, max_length=64)
    ts: Optional[datetime] = None
    skin_temp_c: float = Field(ge=20, le=45)
    battery_pct: Optional[float] = Field(default=None, ge=0, le=100)
    pcm_temp_c: Optional[float] = Field(default=None, ge=-10, le=80)


# --------------------------------------------------------------------------- read models
class HeatBand(Model):
    level: int
    key: str
    label: str
    color: str
    guidance: str


class WorkRest(Model):
    intensity: Intensity
    work_minutes: int
    rest_minutes: int
    label: str
    stop_work: bool
    limit_c: Optional[float]


class EnvReading(Model):
    ts: datetime
    air_temp_c: float
    rh_pct: float
    globe_temp_c: Optional[float]
    wind_ms: Optional[float]
    wbgt_c: float
    wbgt_estimated: bool
    heat_index_c: float


class ZoneSummary(Model):
    id: str
    name: str
    description: str
    station_id: str
    default_intensity: Intensity
    env: Optional[EnvReading]
    station_stale: bool
    band: Optional[HeatBand]
    recommendations: List[WorkRest]
    on_break: bool
    workers_total: int
    workers_working: int
    workers_on_break: int
    workers_flagged: int


class AttentionFactor(Model):
    key: str
    label: str
    detail: str
    score: float


class Attention(Model):
    score: float
    level: AttentionLevel
    label: str
    factors: List[AttentionFactor]
    summary: str


class VestStatus(Model):
    vest_id: str
    battery_pct: Optional[float]
    last_seen: Optional[datetime]
    stale: bool
    pcm_temp_c: Optional[float]
    pcm_state: PcmState


class WorkerSummary(Model):
    id: str
    name: str
    trade: str
    zone_id: Optional[str]
    zone_name: Optional[str]
    intensity: Intensity
    status: WorkerStatus
    skin_temp_c: Optional[float]
    skin_trend_c_per_10min: Optional[float]
    continuous_exposure_min: float
    total_exposure_min: float
    break_elapsed_min: Optional[float]
    attention: Attention
    vest: Optional[VestStatus]


class AlertOut(Model):
    id: int
    kind: str
    severity: str
    zone_id: Optional[str]
    worker_id: Optional[str]
    title: str
    message: str
    created_at: datetime
    updated_at: datetime
    acknowledged_at: Optional[datetime]
    resolved_at: Optional[datetime]
    active: bool


class MiddayBan(Model):
    active: bool
    in_season: bool
    window: str
    rule: str


class Site(Model):
    name: str
    now: datetime
    midday_ban: MiddayBan
    max_wbgt_c: Optional[float]
    worst_band: Optional[HeatBand]


class Kpis(Model):
    zones: int
    workers_active: int
    workers_on_break: int
    workers_flagged: int
    open_alerts: int


class Overview(Model):
    site: Site
    kpis: Kpis
    zones: List[ZoneSummary]
    site_wbgt_history: List[Dict[str, Union[str, float]]]


class ZoneDetail(ZoneSummary):
    workers: List[WorkerSummary]
    history: List[EnvReading]


class WorkerHistoryPoint(Model):
    ts: datetime
    skin_temp_c: Optional[float]
    wbgt_c: Optional[float]
    pcm_temp_c: Optional[float]


class TimelineSegment(Model):
    start: datetime
    end: Optional[datetime]
    kind: Literal["work", "break"]
    zone_id: str


class WorkerDetail(WorkerSummary):
    history: List[WorkerHistoryPoint]
    timeline: List[TimelineSegment]
    alerts: List[AlertOut]


class MethodologyBand(Model):
    key: str
    label: str
    min_c: Optional[float]
    max_c: Optional[float]
    color: str
    guidance: str


class MethodologyRow(Model):
    work_minutes: int
    rest_minutes: int
    light: Optional[float]
    moderate: Optional[float]
    heavy: Optional[float]


class AttentionInput(Model):
    key: str
    label: str
    watch: str
    act: str


class MethodologyBan(Model):
    window: str
    season: str
    rule: str


class Methodology(Model):
    wbgt_formula: str
    bands: List[MethodologyBand]
    work_rest_table: List[MethodologyRow]
    attention_inputs: List[AttentionInput]
    midday_ban: MethodologyBan
    disclaimer: str


class ScenarioInfo(Model):
    key: str
    label: str
    description: str


class SimState(Model):
    enabled: bool
    scenario: str
    speed: float
    scenarios: List[ScenarioInfo]


class Health(Model):
    status: str
    version: str
    mqtt_enabled: bool
    mqtt_connected: bool


# --------------------------------------------------------------------------- commands
class CheckIn(Model):
    zone_id: str


class SetIntensity(Model):
    intensity: Intensity


class SimUpdate(Model):
    scenario: Optional[str] = None
    speed: Optional[float] = Field(default=None, ge=1, le=20)
    enabled: Optional[bool] = None


class WorkerCreate(Model):
    id: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=1, max_length=120)
    trade: str = Field(default="", max_length=80)
    intensity: Intensity = "moderate"
    vest_id: Optional[str] = Field(default=None, max_length=64)


class WorkerUpdate(Model):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    trade: Optional[str] = Field(default=None, max_length=80)
    intensity: Optional[Intensity] = None
    vest_id: Optional[str] = Field(default=None, max_length=64)


class ZoneCreate(Model):
    id: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    station_id: str = Field(min_length=1, max_length=64)
    default_intensity: Intensity = "moderate"


class ZoneUpdate(Model):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    station_id: Optional[str] = Field(default=None, min_length=1, max_length=64)
    default_intensity: Optional[Intensity] = None
