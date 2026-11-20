"""Zone-level heat assessment (OHS): heat bands and work-rest recommendations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from .thresholds import INTENSITIES, Band, Thresholds


@dataclass(frozen=True)
class WorkRest:
    intensity: str
    work_minutes: int
    rest_minutes: int
    label: str
    stop_work: bool
    limit_c: Optional[float]


def classify_band(wbgt_c: float, thresholds: Thresholds) -> Band:
    for band in thresholds.bands:
        if band.max_c is None or wbgt_c < band.max_c:
            return band
    return thresholds.bands[-1]


def recommend(wbgt_c: float, intensity: str, thresholds: Thresholds) -> WorkRest:
    """Return the longest permitted work share per hour for this WBGT and intensity.

    Rows are ordered from most work to least; the first row whose limit is not exceeded wins.
    If every limit is exceeded, work must stop.
    """
    for row in thresholds.work_rest:
        limit = row.limits.get(intensity)
        if limit is not None and wbgt_c <= limit:
            if row.rest_minutes == 0:
                label = "Continuous work"
            else:
                label = f"{row.work_minutes} min work / {row.rest_minutes} min rest"
            return WorkRest(intensity, row.work_minutes, row.rest_minutes, label, False, limit)
    return WorkRest(intensity, 0, 60, "Stop work", True, None)


def recommend_all(wbgt_c: float, thresholds: Thresholds) -> List[WorkRest]:
    return [recommend(wbgt_c, intensity, thresholds) for intensity in INTENSITIES]
