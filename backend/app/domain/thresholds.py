"""Typed access to the heat-stress thresholds defined in ``config/thresholds.yaml``."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

import yaml

INTENSITIES = ("light", "moderate", "heavy")


@dataclass(frozen=True)
class Band:
    level: int
    key: str
    label: str
    max_c: Optional[float]
    min_c: Optional[float]
    color: str
    guidance: str


@dataclass(frozen=True)
class WorkRestRow:
    work_minutes: int
    rest_minutes: int
    limits: Dict[str, Optional[float]]


@dataclass(frozen=True)
class Ramp:
    low: float
    high: float

    def membership(self, value: float) -> float:
        """Linear ramp membership in the 'high' fuzzy set, clamped to [0, 1]."""
        if value <= self.low:
            return 0.0
        if value >= self.high:
            return 1.0
        return (value - self.low) / (self.high - self.low)


@dataclass(frozen=True)
class AttentionConfig:
    skin_temp: Ramp
    skin_watch_c: float
    skin_act_c: float
    skin_trend: Ramp
    exposure_ratio: Ramp
    heat_load: Ramp
    level_watch: float
    level_attention: float
    level_act_now: float


@dataclass(frozen=True)
class MiddayBanConfig:
    start: str
    end: str
    season_start: str
    season_end: str
    timezone: str
    rule: str


@dataclass(frozen=True)
class Thresholds:
    bands: List[Band]
    work_rest: List[WorkRestRow]
    continuous_reference_c: Dict[str, float]
    attention: AttentionConfig
    pcm_melt_point_c: float
    pcm_spent_margin_c: float
    stale_after_s: int
    battery_low_pct: float
    midday_ban: MiddayBanConfig


def parse_thresholds(raw: dict) -> Thresholds:
    bands: List[Band] = []
    previous_max: Optional[float] = None
    for level, item in enumerate(raw["bands"]):
        bands.append(
            Band(
                level=level,
                key=item["key"],
                label=item["label"],
                max_c=item.get("max_c"),
                min_c=previous_max,
                color=item["color"],
                guidance=item["guidance"],
            )
        )
        previous_max = item.get("max_c")

    rows = [
        WorkRestRow(
            work_minutes=int(r["work_minutes"]),
            rest_minutes=int(r["rest_minutes"]),
            limits={i: r.get(i) for i in INTENSITIES},
        )
        for r in raw["work_rest"]
    ]

    att = raw["attention"]
    attention = AttentionConfig(
        skin_temp=Ramp(att["skin_temp_c"]["low"], att["skin_temp_c"]["high"]),
        skin_watch_c=att["skin_temp_c"]["watch"],
        skin_act_c=att["skin_temp_c"]["act"],
        skin_trend=Ramp(**att["skin_trend_c_per_10min"]),
        exposure_ratio=Ramp(**att["exposure_ratio"]),
        heat_load=Ramp(**att["heat_load_c"]),
        level_watch=att["levels"]["watch"],
        level_attention=att["levels"]["attention"],
        level_act_now=att["levels"]["act_now"],
    )

    return Thresholds(
        bands=bands,
        work_rest=rows,
        continuous_reference_c={k: float(v) for k, v in raw["continuous_reference_c"].items()},
        attention=attention,
        pcm_melt_point_c=float(raw["pcm"]["melt_point_c"]),
        pcm_spent_margin_c=float(raw["pcm"]["spent_margin_c"]),
        stale_after_s=int(raw["sensors"]["stale_after_s"]),
        battery_low_pct=float(raw["sensors"]["battery_low_pct"]),
        midday_ban=MiddayBanConfig(**raw["midday_ban"]),
    )


def load_thresholds(path: Path) -> Thresholds:
    with path.open("r", encoding="utf-8") as fh:
        return parse_thresholds(yaml.safe_load(fh))


DEFAULT_PATH = Path(__file__).resolve().parents[2] / "config" / "thresholds.yaml"


@lru_cache(maxsize=1)
def get_thresholds() -> Thresholds:
    return load_thresholds(DEFAULT_PATH)
