"""Simplified harness model: torso skin temperature, PCM pack state and battery.

This is a demo-grade first-order model, tuned to produce plausible trends. It is not a
validated thermophysiological model.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

INTENSITY_HEAT = {"light": 0.0, "moderate": 0.35, "heavy": 0.7}
TAU_MIN = 6.0  # skin temperature time constant, scenario minutes
PCM_MELT_C = 28.0


@dataclass
class HarnessState:
    skin_temp_c: float
    pcm_melt_fraction: float
    pcm_temp_c: float
    battery_pct: float
    overheat_c: float = 0.0  # extra load for the overheating scenario

    @classmethod
    def initial(cls, worker_id: str, rng: random.Random) -> "HarnessState":
        melt = rng.uniform(0.1, 0.55)
        battery = rng.uniform(55.0, 100.0)
        if worker_id == "W001":
            melt = 0.97  # packs nearly spent early in the shift, demonstrates the replace reminder
        if worker_id == "W006":
            battery = 19.5  # demonstrates the low-battery reminder
        return cls(skin_temp_c=rng.uniform(33.2, 34.2), pcm_melt_fraction=melt,
                   pcm_temp_c=22.0 + 6.0 * melt, battery_pct=battery)


def step(state: HarnessState, *, dt_min: float, wbgt_c: float, intensity: str, on_break: bool,
         continuous_min: float, overheating: bool, rng: random.Random) -> HarnessState:
    """Advance the harness by ``dt_min`` scenario minutes."""
    heavy_factor = 1.3 if intensity == "heavy" else 1.0
    if not on_break:
        load = max(0.0, wbgt_c - 20.0) * heavy_factor
        state.pcm_melt_fraction = min(1.0, state.pcm_melt_fraction + dt_min * load / 1500.0)

    if state.pcm_melt_fraction < 1.0:
        state.pcm_temp_c = 22.0 + 6.0 * state.pcm_melt_fraction
    else:  # latent capacity exhausted: the pack warms toward skin temperature
        state.pcm_temp_c = min(state.skin_temp_c, state.pcm_temp_c + 0.4 * dt_min)

    pcm_cooling = 0.9 * (1.0 - state.pcm_melt_fraction)
    target = 33.2 + 0.17 * (wbgt_c - 24.0) + INTENSITY_HEAT.get(intensity, 0.35)
    target += min(0.8, 0.012 * continuous_min) - pcm_cooling
    if on_break:
        target -= 1.3
    if overheating:
        state.overheat_c = min(3.8, state.overheat_c + 0.22 * dt_min)
    else:
        state.overheat_c = max(0.0, state.overheat_c - 0.3 * dt_min)
    target += state.overheat_c

    alpha = min(1.0, dt_min / TAU_MIN)
    state.skin_temp_c += alpha * (target - state.skin_temp_c) + rng.gauss(0.0, 0.04)
    state.skin_temp_c = max(31.0, min(39.5, state.skin_temp_c))
    state.battery_pct = max(0.0, state.battery_pct - 0.02 * dt_min)
    return state
