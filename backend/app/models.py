"""ORM tables."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from .db import Base


class UtcDateTime(TypeDecorator):
    """Stores timezone-aware UTC datetimes; SQLite returns naive values, so re-attach UTC."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


class Zone(Base):
    __tablename__ = "zones"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    station_id: Mapped[str] = mapped_column(String(64), unique=True)
    default_intensity: Mapped[str] = mapped_column(String(16), default="moderate")
    on_break: Mapped[bool] = mapped_column(default=False)


class Worker(Base):
    __tablename__ = "workers"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    trade: Mapped[str] = mapped_column(String(80), default="")
    intensity: Mapped[str] = mapped_column(String(16), default="moderate")
    vest_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True)
    zone_id: Mapped[Optional[str]] = mapped_column(ForeignKey("zones.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="off")


class Segment(Base):
    """A contiguous stretch of work or break for a worker in a zone."""

    __tablename__ = "segments"
    __table_args__ = (Index("ix_segments_worker_start", "worker_id", "start"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    worker_id: Mapped[str] = mapped_column(ForeignKey("workers.id", ondelete="CASCADE"))
    zone_id: Mapped[str] = mapped_column(String(32))
    kind: Mapped[str] = mapped_column(String(8))
    start: Mapped[datetime] = mapped_column(UtcDateTime)
    end: Mapped[Optional[datetime]] = mapped_column(UtcDateTime, nullable=True)


class EnvReading(Base):
    __tablename__ = "env_readings"
    __table_args__ = (Index("ix_env_station_ts", "station_id", "ts"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    station_id: Mapped[str] = mapped_column(String(64))
    ts: Mapped[datetime] = mapped_column(UtcDateTime)
    air_temp_c: Mapped[float] = mapped_column(Float)
    rh_pct: Mapped[float] = mapped_column(Float)
    globe_temp_c: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    wind_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    wbgt_c: Mapped[float] = mapped_column(Float)
    wbgt_estimated: Mapped[bool] = mapped_column(default=False)
    heat_index_c: Mapped[float] = mapped_column(Float)


class VestReading(Base):
    __tablename__ = "vest_readings"
    __table_args__ = (Index("ix_vest_ts", "vest_id", "ts"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vest_id: Mapped[str] = mapped_column(String(64))
    ts: Mapped[datetime] = mapped_column(UtcDateTime)
    skin_temp_c: Mapped[float] = mapped_column(Float)
    battery_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pcm_temp_c: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (Index("ix_alerts_key_active", "dedup_key", "active"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dedup_key: Mapped[str] = mapped_column(String(160))
    kind: Mapped[str] = mapped_column(String(32))
    severity: Mapped[str] = mapped_column(String(16))
    zone_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    worker_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime)
    updated_at: Mapped[datetime] = mapped_column(UtcDateTime)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(UtcDateTime, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(UtcDateTime, nullable=True)
    active: Mapped[bool] = mapped_column(default=True)


class SimConfig(Base):
    """Single-row table holding the desired simulator settings (read by the simulator)."""

    __tablename__ = "sim_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    enabled: Mapped[bool] = mapped_column(default=True)
    scenario: Mapped[str] = mapped_column(String(64))
    speed: Mapped[float] = mapped_column(Float)
