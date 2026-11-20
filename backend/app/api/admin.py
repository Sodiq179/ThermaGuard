"""Registry management: workers, harness pairing and zones."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from .. import models, schemas
from ..container import Container
from ..domain.exposure import utcnow
from ..services import commands
from .deps import get_container, get_session

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/workers", response_model=schemas.WorkerSummary, status_code=201)
def create_worker(body: schemas.WorkerCreate, session: Session = Depends(get_session),
                  container: Container = Depends(get_container)):
    if session.get(models.Worker, body.id) is not None:
        raise HTTPException(409, f"Worker {body.id} already exists")
    commands.ensure_unique_vest(session, body.vest_id)
    worker = models.Worker(id=body.id, name=body.name, trade=body.trade, intensity=body.intensity,
                           vest_id=body.vest_id or None, status="off")
    session.add(worker)
    session.flush()
    container.hub.mark_dirty()
    return container.state(session).worker_summary(worker)


@router.patch("/workers/{worker_id}", response_model=schemas.WorkerSummary)
def update_worker(worker_id: str, body: schemas.WorkerUpdate, session: Session = Depends(get_session),
                  container: Container = Depends(get_container)):
    worker = commands.get_worker(session, worker_id)
    changes = body.model_dump(exclude_unset=True)
    if "vest_id" in changes:
        changes["vest_id"] = changes["vest_id"] or None
        commands.ensure_unique_vest(session, changes["vest_id"], worker_id)
    for field, value in changes.items():
        setattr(worker, field, value)
    session.flush()
    container.hub.mark_dirty()
    return container.state(session).worker_summary(worker)


@router.delete("/workers/{worker_id}", status_code=204)
def delete_worker(worker_id: str, session: Session = Depends(get_session), container: Container = Depends(get_container)):
    worker = commands.get_worker(session, worker_id)
    commands.check_out(session, worker_id, utcnow())
    session.query(models.Segment).filter(models.Segment.worker_id == worker_id).delete()
    session.delete(worker)
    container.hub.mark_dirty()
    return Response(status_code=204)


@router.post("/zones", response_model=schemas.ZoneSummary, status_code=201)
def create_zone(body: schemas.ZoneCreate, session: Session = Depends(get_session),
                container: Container = Depends(get_container)):
    if session.get(models.Zone, body.id) is not None:
        raise HTTPException(409, f"Zone {body.id} already exists")
    commands.ensure_unique_station(session, body.station_id)
    zone = models.Zone(**body.model_dump())
    session.add(zone)
    session.flush()
    container.hub.mark_dirty()
    return container.state(session).zone_summary(zone)


@router.patch("/zones/{zone_id}", response_model=schemas.ZoneSummary)
def update_zone(zone_id: str, body: schemas.ZoneUpdate, session: Session = Depends(get_session),
                container: Container = Depends(get_container)):
    zone = commands.get_zone(session, zone_id)
    changes = body.model_dump(exclude_unset=True)
    if "station_id" in changes:
        commands.ensure_unique_station(session, changes["station_id"], zone_id)
    for field, value in changes.items():
        setattr(zone, field, value)
    session.flush()
    container.hub.mark_dirty()
    return container.state(session).zone_summary(zone)
