"""Exposure accounting from the work/break timeline, plus small time helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from typing import Iterable, Optional, Sequence, Tuple
from zoneinfo import ZoneInfo

from .thresholds import MiddayBanConfig, Thresholds


@dataclass(frozen=True)
class Segment:
    kind: str  # "work" | "break"
    start: datetime
    end: Optional[datetime]


@dataclass(frozen=True)
class ExposureSummary:
    continuous_min: float
    total_min: float
    break_elapsed_min: Optional[float]


def _minutes(start: datetime, end: datetime) -> float:
    return max(0.0, (end - start).total_seconds() / 60.0)


def summarize(segments: Sequence[Segment], now: datetime) -> ExposureSummary:
    """Continuous exposure = length of the open work segment; total = all work today."""
    total = sum(_minutes(s.start, s.end or now) for s in segments if s.kind == "work")
    open_seg = next((s for s in reversed(segments) if s.end is None), None)
    continuous = _minutes(open_seg.start, now) if open_seg and open_seg.kind == "work" else 0.0
    on_break = _minutes(open_seg.start, now) if open_seg and open_seg.kind == "break" else None
    return ExposureSummary(round(continuous, 1), round(total, 1), None if on_break is None else round(on_break, 1))


def skin_trend_per_10min(samples: Iterable[Tuple[datetime, float]]) -> Optional[float]:
    """Least-squares slope of skin temperature, expressed in °C per 10 minutes."""
    points = list(samples)
    if len(points) < 3:
        return None
    t0 = points[0][0]
    xs = [(ts - t0).total_seconds() / 600.0 for ts, _ in points]
    ys = [v for _, v in points]
    span = xs[-1] - xs[0]
    if span < 0.2:  # need at least ~2 minutes of data
        return None
    mean_x, mean_y = sum(xs) / len(xs), sum(ys) / len(ys)
    denom = sum((x - mean_x) ** 2 for x in xs)
    if denom == 0:
        return None
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / denom
    return round(slope, 2)


def pcm_state(pcm_temp_c: Optional[float], t: Thresholds) -> str:
    if pcm_temp_c is None:
        return "unknown"
    if pcm_temp_c < t.pcm_melt_point_c - 1.0:
        return "ok"
    if pcm_temp_c < t.pcm_melt_point_c + t.pcm_spent_margin_c:
        return "melting"
    return "spent"


def _parse_hhmm(value: str) -> time:
    hours, minutes = value.split(":")
    return time(int(hours), int(minutes))


def _parse_mmdd(value: str, year: int) -> date:
    month, day = value.split("-")
    return date(year, int(month), int(day))


def midday_ban_status(now: datetime, cfg: MiddayBanConfig) -> Tuple[bool, bool]:
    """Return ``(active, in_season)`` for the Saudi midday outdoor work ban."""
    local = now.astimezone(ZoneInfo(cfg.timezone))
    in_season = _parse_mmdd(cfg.season_start, local.year) <= local.date() <= _parse_mmdd(cfg.season_end, local.year)
    in_window = _parse_hhmm(cfg.start) <= local.time() < _parse_hhmm(cfg.end)
    return in_season and in_window, in_season


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
