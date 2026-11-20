"""Environmental scenarios for an Eastern Province (Dammam) construction site.

Scenario keys must match ``backend/app/sim_catalog.py``.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, FrozenSet, Optional


@dataclass(frozen=True)
class Climate:
    t_min: float
    t_max: float
    rh_at_min: float
    rh_at_max: float


@dataclass(frozen=True)
class ZoneProfile:
    """How a zone's microclimate differs from the site weather."""

    temp_offset: float = 0.0
    solar_exposure: float = 1.0  # 0 = fully shaded/indoor, 1 = full sun
    has_globe: bool = True
    indoor_damping: Optional[float] = None  # if set, indoor temp = 27 + damping * (outdoor - 27)
    morning_shade_until: Optional[float] = None


ZONE_PROFILES: Dict[str, ZoneProfile] = {
    "Z1": ZoneProfile(temp_offset=1.5, solar_exposure=1.0, has_globe=True),
    "Z2": ZoneProfile(temp_offset=0.5, solar_exposure=0.85, has_globe=True),
    "Z3": ZoneProfile(temp_offset=-0.5, solar_exposure=0.8, has_globe=False, morning_shade_until=11.0),
    "Z4": ZoneProfile(solar_exposure=0.0, has_globe=False, indoor_damping=0.35),
}
DEFAULT_PROFILE = ZoneProfile(solar_exposure=0.7, has_globe=False)


@dataclass(frozen=True)
class Scenario:
    key: str
    climate: Climate
    start_hour: float
    end_hour: float  # the scenario clock loops back to start_hour after this
    hot_zone: Optional[str] = None  # zone that escalates over time
    hot_zone_rate_c_per_min: float = 0.0
    hot_zone_max_c: float = 0.0
    overheating_worker: Optional[str] = None
    silent_after_min: Optional[float] = None
    silent_stations: FrozenSet[str] = field(default_factory=frozenset)
    silent_vests: FrozenSet[str] = field(default_factory=frozenset)


SHOULDER = Climate(t_min=24.0, t_max=37.0, rh_at_min=60.0, rh_at_max=25.0)
SUMMER = Climate(t_min=33.0, t_max=43.0, rh_at_min=45.0, rh_at_max=20.0)

SCENARIOS: Dict[str, Scenario] = {
    "normal_day": Scenario("normal_day", SHOULDER, start_hour=10.0, end_hour=17.0),
    "midday_peak": Scenario("midday_peak", SUMMER, start_hour=11.5, end_hour=14.5),
    "hot_zone_escalation": Scenario(
        "hot_zone_escalation", SHOULDER, start_hour=10.0, end_hour=16.0,
        hot_zone="Z1", hot_zone_rate_c_per_min=0.4, hot_zone_max_c=9.0,
    ),
    "worker_overheating": Scenario(
        "worker_overheating", SHOULDER, start_hour=9.0, end_hour=15.0, overheating_worker="W003",
    ),
    "sensor_dropout": Scenario(
        "sensor_dropout", SHOULDER, start_hour=9.0, end_hour=15.0, silent_after_min=2.0,
        silent_stations=frozenset({"ST-Z3"}), silent_vests=frozenset({"V-W005"}),
    ),
}


def diurnal_fraction(hour: float) -> float:
    """0 at the 05:00 minimum, 1 at the 14:30 maximum, cosine-shaped in between."""
    peak, low = 14.5, 5.0
    if low <= hour <= peak:
        return 0.5 - 0.5 * math.cos(math.pi * (hour - low) / (peak - low))
    span = 24 - (peak - low)
    since_peak = (hour - peak) % 24
    return 0.5 + 0.5 * math.cos(math.pi * since_peak / span)


def solar_intensity(hour: float) -> float:
    """Relative solar load, 0 at night, 1 at solar noon (~12:00)."""
    if hour <= 5.5 or hour >= 18.5:
        return 0.0
    return math.sin(math.pi * (hour - 5.5) / 13.0)


@dataclass(frozen=True)
class EnvSample:
    air_temp_c: float
    rh_pct: float
    globe_temp_c: Optional[float]
    wind_ms: float


def zone_environment(scenario: Scenario, zone_id: str, hour: float, elapsed_min: float) -> EnvSample:
    climate = scenario.climate
    frac = diurnal_fraction(hour)
    air = climate.t_min + (climate.t_max - climate.t_min) * frac
    rh = climate.rh_at_min + (climate.rh_at_max - climate.rh_at_min) * frac

    profile = ZONE_PROFILES.get(zone_id, DEFAULT_PROFILE)
    air += profile.temp_offset
    if scenario.hot_zone == zone_id:
        air += min(scenario.hot_zone_max_c, scenario.hot_zone_rate_c_per_min * elapsed_min)
        rh -= min(10.0, 0.5 * elapsed_min)
    if profile.indoor_damping is not None:
        air = 27.0 + profile.indoor_damping * (air - 27.0)
        rh = 40.0

    solar = solar_intensity(hour) * profile.solar_exposure
    if profile.morning_shade_until is not None and hour < profile.morning_shade_until:
        solar *= 0.3
    globe = air + 16.0 * solar if profile.has_globe else None
    wind = 1.5 + 1.0 * solar
    return EnvSample(round(air, 2), round(max(8.0, min(95.0, rh)), 1), None if globe is None else round(globe, 2),
                     round(wind, 2))
