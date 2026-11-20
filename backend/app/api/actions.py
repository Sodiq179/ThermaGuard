"""Supervisor actions and alert handling."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..container import Container
from ..domain.exposure import utcnow
from ..services import commands
from .deps import get_container, get_session

router = APIRouter(tags=["actions"])


def _worker_out(session: Session, container: Container, worker: models.Worker) -> schemas.WorkerSummary:
    session.flush()
    container.hub.mark_dirty()
    return container.state(session).worker_summary(worker)


def _zone_out(session: Session, container: Container, zone: models.Zone) -> schemas.ZoneSummary:
    session.flush()
    container.hub.mark_dirty()
    return container.state(session).zone_summary(zone)


@router.post("/workers/{worker_id}/check-in", response_model=schemas.WorkerSummary)
def check_in(worker_id: str, body: schemas.CheckIn, session: Session = Depends(get_session),
             container: Container = Depends(get_container)):
    return _worker_out(session, container, commands.check_in(session, worker_id, body.zone_id, utcnow()))


@router.post("/workers/{worker_id}/check-out", response_model=schemas.WorkerSummary)
def check_out(worker_id: str, session: Session = Depends(get_session), container: Container = Depends(get_container)):
    return _worker_out(session, container, commands.check_out(session, worker_id, utcnow()))


@router.post("/workers/{worker_id}/break/start", response_model=schemas.WorkerSummary)
def start_break(worker_id: str, session: Session = Depends(get_session), container: Container = Depends(get_container)):
    return _worker_out(session, container, commands.start_break(session, worker_id, utcnow()))


@router.post("/workers/{worker_id}/break/end", response_model=schemas.WorkerSummary)
def end_break(worker_id: str, session: Session = Depends(get_session), container: Container = Depends(get_container)):
    return _worker_out(session, container, commands.end_break(session, worker_id, utcnow()))


@router.put("/workers/{worker_id}/intensity", response_model=schemas.WorkerSummary)
def worker_intensity(worker_id: str, body: schemas.SetIntensity, session: Session = Depends(get_session),
                     container: Container = Depends(get_container)):
    return _worker_out(session, container, commands.set_worker_intensity(session, worker_id, body.intensity))


@router.post("/zones/{zone_id}/break/start", response_model=schemas.ZoneSummary)
def zone_break_start(zone_id: str, session: Session = Depends(get_session), container: Container = Depends(get_container)):
    return _zone_out(session, container, commands.zone_break(session, zone_id, True, utcnow()))


@router.post("/zones/{zone_id}/break/end", response_model=schemas.ZoneSummary)
def zone_break_end(zone_id: str, session: Session = Depends(get_session), container: Container = Depends(get_container)):
    return _zone_out(session, container, commands.zone_break(session, zone_id, False, utcnow()))


@router.put("/zones/{zone_id}/intensity", response_model=schemas.ZoneSummary)
def zone_intensity(zone_id: str, body: schemas.SetIntensity, session: Session = Depends(get_session),
                   container: Container = Depends(get_container)):
    return _zone_out(session, container, commands.set_zone_intensity(session, zone_id, body.intensity))


def _alert(session: Session, alert_id: int) -> models.Alert:
    alert = session.get(models.Alert, alert_id)
    if alert is None:
        raise HTTPException(404, f"Alert {alert_id} not found")
    return alert


@router.post("/alerts/{alert_id}/ack", response_model=schemas.AlertOut)
def ack_alert(alert_id: int, session: Session = Depends(get_session), container: Container = Depends(get_container)):
    alert = _alert(session, alert_id)
    if alert.acknowledged_at is None:
        alert.acknowledged_at = utcnow()
    container.hub.mark_dirty()
    return alert


@router.post("/alerts/{alert_id}/resolve", response_model=schemas.AlertOut)
def resolve_alert(alert_id: int, session: Session = Depends(get_session), container: Container = Depends(get_container)):
    alert = _alert(session, alert_id)
    now = utcnow()
    alert.active = False
    alert.resolved_at = alert.resolved_at or now
    alert.acknowledged_at = alert.acknowledged_at or now
    alert.updated_at = now
    container.hub.mark_dirty()
    return alert
