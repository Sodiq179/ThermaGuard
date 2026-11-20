"""Read endpoints: the Site -> Zone -> Worker drill-down, alerts and methodology."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import __version__, models, schemas
from ..container import Container
from ..services.alerts import open_alert_count
from .deps import get_container, get_session

router = APIRouter(tags=["dashboard"])


@router.get("/health", response_model=schemas.Health)
def health(container: Container = Depends(get_container)) -> schemas.Health:
    return schemas.Health(status="ok", version=__version__, mqtt_connected=container.mqtt_connected)


@router.get("/overview", response_model=schemas.Overview)
def overview(session: Session = Depends(get_session), container: Container = Depends(get_container)):
    return container.state(session).overview(open_alert_count(session), container.settings.site_name)


@router.get("/zones", response_model=List[schemas.ZoneSummary])
def list_zones(session: Session = Depends(get_session), container: Container = Depends(get_container)):
    state = container.state(session)
    return [state.zone_summary(z) for z in state.zones]


@router.get("/zones/{zone_id}", response_model=schemas.ZoneDetail)
def zone_detail(zone_id: str, session: Session = Depends(get_session), container: Container = Depends(get_container)):
    state = container.state(session)
    zone = state.zone(zone_id)
    if zone is None:
        raise HTTPException(404, f"Zone {zone_id} not found")
    return state.zone_detail(zone)


@router.get("/workers", response_model=List[schemas.WorkerSummary])
def list_workers(
    zone_id: Optional[str] = None,
    session: Session = Depends(get_session),
    container: Container = Depends(get_container),
):
    return container.state(session).worker_summaries(zone_id)


@router.get("/workers/{worker_id}", response_model=schemas.WorkerDetail)
def worker_detail(worker_id: str, session: Session = Depends(get_session), container: Container = Depends(get_container)):
    worker = session.get(models.Worker, worker_id)
    if worker is None:
        raise HTTPException(404, f"Worker {worker_id} not found")
    return container.state(session).worker_detail(worker)


@router.get("/alerts", response_model=List[schemas.AlertOut])
def list_alerts(
    active: bool = True,
    limit: int = Query(100, ge=1, le=500),
    session: Session = Depends(get_session),
):
    stmt = select(models.Alert).where(models.Alert.active.is_(active))
    order = models.Alert.updated_at.desc() if active else models.Alert.resolved_at.desc()
    return list(session.scalars(stmt.order_by(order).limit(limit)))


@router.get("/methodology", response_model=schemas.Methodology)
def methodology(container: Container = Depends(get_container)) -> schemas.Methodology:
    t = container.thresholds
    a = t.attention
    ban = t.midday_ban
    return schemas.Methodology(
        wbgt_formula="WBGT = 0.7·Tnw + 0.2·Tg + 0.1·Ta (ISO 7243, outdoor). Without a globe sensor: "
        "WBGT ≈ 0.567·Ta + 0.393·e + 3.94 (estimate).",
        bands=[
            schemas.MethodologyBand(key=b.key, label=b.label, min_c=b.min_c, max_c=b.max_c, color=b.color,
                                    guidance=b.guidance)
            for b in t.bands
        ],
        work_rest_table=[
            schemas.MethodologyRow(work_minutes=r.work_minutes, rest_minutes=r.rest_minutes, **r.limits)
            for r in t.work_rest
        ],
        attention_inputs=[
            schemas.AttentionInput(key="skin_temp", label="Skin temperature (harness)",
                                   watch=f"≥ {a.skin_watch_c:.1f} °C", act=f"≥ {a.skin_act_c:.1f} °C"),
            schemas.AttentionInput(key="skin_trend", label="Skin temperature trend",
                                   watch=f"> {a.skin_trend.low:+.1f} °C / 10 min",
                                   act=f"≥ {a.skin_trend.high:+.1f} °C / 10 min"),
            schemas.AttentionInput(key="exposure", label="Continuous exposure vs. recommended work time",
                                   watch=f"> {a.exposure_ratio.low:.0%} of allowed",
                                   act=f"≥ {a.exposure_ratio.high:.0%} of allowed"),
            schemas.AttentionInput(key="heat_load", label="Zone WBGT vs. intensity reference",
                                   watch=f"> {a.heat_load.low:+.0f} °C", act=f"≥ {a.heat_load.high:+.0f} °C"),
        ],
        midday_ban=schemas.MethodologyBan(
            window=f"{ban.start}-{ban.end}", season=f"{ban.season_start} to {ban.season_end} (MM-DD)", rule=ban.rule
        ),
        disclaimer="ThermaGuard supports supervisor decisions about heat exposure. It is not a medical device "
        "and does not diagnose heat illness. Always follow site safety procedures and act on worker symptoms.",
    )
