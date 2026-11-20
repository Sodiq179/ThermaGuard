"""Single ingestion pipeline shared by MQTT and HTTP transports.

Every reading goes through validation (pydantic schema), enrichment (WBGT, heat index)
and storage here, so both transports behave identically.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.orm import Session

from .. import models, schemas
from ..domain.wbgt import compute_wbgt, heat_index_c

log = logging.getLogger(__name__)

# Device clocks drift; readings stamped too far in the future are clamped to server time.
MAX_CLOCK_SKEW = timedelta(seconds=30)


def _timestamp(ts: datetime | None, now: datetime) -> datetime:
    if ts is None:
        return now
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return now if ts - now > MAX_CLOCK_SKEW else ts


def ingest_env(session: Session, payload: schemas.EnvIngest, now: datetime) -> models.EnvReading:
    wbgt = compute_wbgt(payload.air_temp_c, payload.rh_pct, payload.globe_temp_c)
    reading = models.EnvReading(
        station_id=payload.station_id,
        ts=_timestamp(payload.ts, now),
        air_temp_c=payload.air_temp_c,
        rh_pct=payload.rh_pct,
        globe_temp_c=payload.globe_temp_c,
        wind_ms=payload.wind_ms,
        wbgt_c=wbgt.wbgt_c,
        wbgt_estimated=wbgt.estimated,
        heat_index_c=heat_index_c(payload.air_temp_c, payload.rh_pct),
    )
    session.add(reading)
    return reading


def ingest_vest(session: Session, payload: schemas.VestIngest, now: datetime) -> models.VestReading:
    reading = models.VestReading(
        vest_id=payload.vest_id,
        ts=_timestamp(payload.ts, now),
        skin_temp_c=payload.skin_temp_c,
        battery_pct=payload.battery_pct,
        pcm_temp_c=payload.pcm_temp_c,
    )
    session.add(reading)
    return reading


def prune(session: Session, older_than: datetime) -> None:
    session.execute(delete(models.EnvReading).where(models.EnvReading.ts < older_than))
    session.execute(delete(models.VestReading).where(models.VestReading.ts < older_than))
