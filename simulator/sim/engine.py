"""Simulation engine: advances a scenario clock and produces device payloads.

The engine is pure (no I/O) so it can be unit-tested; ``main.py`` handles the network.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from . import physiology
from .scenarios import SCENARIOS, Scenario, zone_environment


@dataclass(frozen=True)
class ZoneInfo:
    id: str
    station_id: str


@dataclass(frozen=True)
class WorkerInfo:
    id: str
    vest_id: Optional[str]
    zone_id: Optional[str]
    status: str
    intensity: str
    continuous_exposure_min: float


class Engine:
    def __init__(self, scenario_key: str = "normal_day", seed: int = 7) -> None:
        self.rng = random.Random(seed)
        self.harnesses: Dict[str, physiology.HarnessState] = {}
        self.scenario: Scenario = SCENARIOS["normal_day"]
        self.hour = 0.0
        self.elapsed_min = 0.0
        self.set_scenario(scenario_key)

    def set_scenario(self, key: str) -> None:
        self.scenario = SCENARIOS.get(key, SCENARIOS["normal_day"])
        self.hour = self.scenario.start_hour
        self.elapsed_min = 0.0
        for state in self.harnesses.values():
            state.overheat_c = 0.0

    def advance(self, dt_min: float) -> None:
        self.elapsed_min += dt_min
        self.hour += dt_min / 60.0
        if self.hour >= self.scenario.end_hour:
            self.hour = self.scenario.start_hour

    def _silent(self) -> bool:
        s = self.scenario
        return s.silent_after_min is not None and self.elapsed_min >= s.silent_after_min

    def tick(self, dt_min: float, zones: List[ZoneInfo], workers: List[WorkerInfo]
             ) -> Tuple[Dict[str, dict], Dict[str, dict]]:
        """Advance ``dt_min`` scenario minutes; return (env payloads by station, vest payloads by vest)."""
        self.advance(dt_min)
        silent = self._silent()
        env_out: Dict[str, dict] = {}
        zone_wbgt: Dict[str, float] = {}

        for zone in zones:
            sample = zone_environment(self.scenario, zone.id, self.hour, self.elapsed_min)
            noise = self.rng.gauss(0.0, 0.08)
            payload = {
                "air_temp_c": round(sample.air_temp_c + noise, 2),
                "rh_pct": sample.rh_pct,
                "wind_ms": sample.wind_ms,
            }
            if sample.globe_temp_c is not None:
                payload["globe_temp_c"] = round(sample.globe_temp_c + noise, 2)
            zone_wbgt[zone.id] = approximate_wbgt(sample.air_temp_c, sample.rh_pct, sample.globe_temp_c)
            if not (silent and zone.station_id in self.scenario.silent_stations):
                env_out[zone.station_id] = payload

        vest_out: Dict[str, dict] = {}
        for worker in workers:
            if not worker.vest_id or worker.status == "off" or worker.zone_id is None:
                continue
            state = self.harnesses.get(worker.id)
            if state is None:
                state = physiology.HarnessState.initial(worker.id, self.rng)
                self.harnesses[worker.id] = state
            physiology.step(
                state,
                dt_min=dt_min,
                wbgt_c=zone_wbgt.get(worker.zone_id, 26.0),
                intensity=worker.intensity,
                on_break=worker.status == "break",
                continuous_min=worker.continuous_exposure_min,
                overheating=self.scenario.overheating_worker == worker.id,
                rng=self.rng,
            )
            if silent and worker.vest_id in self.scenario.silent_vests:
                continue
            vest_out[worker.vest_id] = {
                "skin_temp_c": round(state.skin_temp_c, 2),
                "battery_pct": round(state.battery_pct, 1),
                "pcm_temp_c": round(state.pcm_temp_c, 2),
            }
        return env_out, vest_out


def approximate_wbgt(air: float, rh: float, globe: Optional[float]) -> float:
    """Lightweight WBGT estimate used only to drive the harness model."""
    e = rh / 100.0 * 6.105 * math.exp(17.27 * air / (237.7 + air))
    estimate = 0.567 * air + 0.393 * e + 3.94
    if globe is not None:
        estimate += 0.1 * max(0.0, globe - air) - 1.0
    return estimate
