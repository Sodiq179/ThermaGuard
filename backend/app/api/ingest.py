"""HTTP ingestion for devices that cannot use MQTT, plus simulator control."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas
from ..container import Container
from ..domain.exposure import utcnow
from ..ingestion import service
from ..sim_catalog import SCENARIO_KEYS, SCENARIOS
from .deps import get_container, get_session

router = APIRouter()


@router.post("/ingest/env", status_code=202, tags=["ingestion"])
def ingest_env(body: schemas.EnvIngest, session: Session = Depends(get_session),
               container: Container = Depends(get_container)) -> dict:
    service.ingest_env(session, body, utcnow())
    container.hub.mark_dirty()
    return {"accepted": True}


@router.post("/ingest/vest", status_code=202, tags=["ingestion"])
def ingest_vest(body: schemas.VestIngest, session: Session = Depends(get_session),
                container: Container = Depends(get_container)) -> dict:
    service.ingest_vest(session, body, utcnow())
    container.hub.mark_dirty()
    return {"accepted": True}


def _sim_state(config) -> schemas.SimState:
    return schemas.SimState(enabled=config.enabled, scenario=config.scenario, speed=config.speed,
                            scenarios=[schemas.ScenarioInfo(**s) for s in SCENARIOS])


@router.get("/sim", response_model=schemas.SimState, tags=["simulator"])
def get_sim(session: Session = Depends(get_session), container: Container = Depends(get_container)):
    return _sim_state(container.sim_config(session))


@router.put("/sim", response_model=schemas.SimState, tags=["simulator"])
def update_sim(body: schemas.SimUpdate, session: Session = Depends(get_session),
               container: Container = Depends(get_container)):
    config = container.sim_config(session)
    if body.scenario is not None:
        if body.scenario not in SCENARIO_KEYS:
            raise HTTPException(400, f"Unknown scenario {body.scenario}")
        config.scenario = body.scenario
    if body.speed is not None:
        config.speed = body.speed
    if body.enabled is not None:
        config.enabled = body.enabled
    return _sim_state(config)
