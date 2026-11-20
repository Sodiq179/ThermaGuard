"""Supervisor actions that change the work timeline or the registry."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models


class NotFound(Exception):
    pass


class Conflict(Exception):
    pass


def get_worker(session: Session, worker_id: str) -> models.Worker:
    worker = session.get(models.Worker, worker_id)
    if worker is None:
        raise NotFound(f"Worker {worker_id} not found")
    return worker


def get_zone(session: Session, zone_id: str) -> models.Zone:
    zone = session.get(models.Zone, zone_id)
    if zone is None:
        raise NotFound(f"Zone {zone_id} not found")
    return zone


def _open_segment(session: Session, worker_id: str) -> Optional[models.Segment]:
    stmt = select(models.Segment).where(models.Segment.worker_id == worker_id, models.Segment.end.is_(None))
    return session.scalars(stmt).first()


def _close_open_segment(session: Session, worker_id: str, now: datetime) -> None:
    seg = _open_segment(session, worker_id)
    if seg is not None:
        seg.end = now


def _start_segment(session: Session, worker: models.Worker, kind: str, now: datetime) -> None:
    session.add(models.Segment(worker_id=worker.id, zone_id=worker.zone_id, kind=kind, start=now))


def check_in(session: Session, worker_id: str, zone_id: str, now: datetime) -> models.Worker:
    worker = get_worker(session, worker_id)
    get_zone(session, zone_id)
    _close_open_segment(session, worker.id, now)
    worker.zone_id = zone_id
    worker.status = "working"
    _start_segment(session, worker, "work", now)
    return worker


def check_out(session: Session, worker_id: str, now: datetime) -> models.Worker:
    worker = get_worker(session, worker_id)
    _close_open_segment(session, worker.id, now)
    worker.status = "off"
    worker.zone_id = None
    return worker


def start_break(session: Session, worker_id: str, now: datetime) -> models.Worker:
    worker = get_worker(session, worker_id)
    if worker.status == "off":
        raise Conflict(f"Worker {worker_id} is not checked in")
    if worker.status == "break":
        return worker
    _close_open_segment(session, worker.id, now)
    worker.status = "break"
    _start_segment(session, worker, "break", now)
    return worker


def end_break(session: Session, worker_id: str, now: datetime) -> models.Worker:
    worker = get_worker(session, worker_id)
    if worker.status == "off":
        raise Conflict(f"Worker {worker_id} is not checked in")
    if worker.status == "working":
        return worker
    _close_open_segment(session, worker.id, now)
    worker.status = "working"
    _start_segment(session, worker, "work", now)
    return worker


def set_worker_intensity(session: Session, worker_id: str, intensity: str) -> models.Worker:
    worker = get_worker(session, worker_id)
    worker.intensity = intensity
    return worker


def _zone_workers(session: Session, zone_id: str):
    return list(session.scalars(select(models.Worker).where(models.Worker.zone_id == zone_id)))


def zone_break(session: Session, zone_id: str, start: bool, now: datetime) -> models.Zone:
    zone = get_zone(session, zone_id)
    zone.on_break = start
    for worker in _zone_workers(session, zone_id):
        if start and worker.status == "working":
            start_break(session, worker.id, now)
        elif not start and worker.status == "break":
            end_break(session, worker.id, now)
    return zone


def set_zone_intensity(session: Session, zone_id: str, intensity: str) -> models.Zone:
    zone = get_zone(session, zone_id)
    zone.default_intensity = intensity
    for worker in _zone_workers(session, zone_id):
        worker.intensity = intensity
    return zone


def ensure_unique_vest(session: Session, vest_id: Optional[str], worker_id: Optional[str] = None) -> None:
    if not vest_id:
        return
    owner = session.scalars(select(models.Worker).where(models.Worker.vest_id == vest_id)).first()
    if owner is not None and owner.id != worker_id:
        raise Conflict(f"Harness {vest_id} is already paired with {owner.id}")


def ensure_unique_station(session: Session, station_id: str, zone_id: Optional[str] = None) -> None:
    owner = session.scalars(select(models.Zone).where(models.Zone.station_id == station_id)).first()
    if owner is not None and owner.id != zone_id:
        raise Conflict(f"Station {station_id} is already assigned to zone {owner.id}")
