"""Alert engine: derives the set of conditions that need attention and reconciles them
with stored alerts (raise new ones, refresh existing ones, auto-resolve cleared ones)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..domain.exposure import midday_ban_status
from .state import SiteState


@dataclass(frozen=True)
class Condition:
    key: str
    kind: str
    severity: str
    title: str
    message: str
    zone_id: Optional[str] = None
    worker_id: Optional[str] = None


def derive_conditions(state: SiteState) -> List[Condition]:
    t = state.t
    out: List[Condition] = []

    for zone in state.zones:
        summary = state.zone_summary(zone)
        if summary.station_stale:
            out.append(
                Condition(
                    f"sensor_stale:station:{zone.id}", "sensor_stale", "warning",
                    f"{zone.name}: station offline",
                    f"No data from station {zone.station_id} for over {t.stale_after_s} s. Heat guidance for this zone is unavailable.",
                    zone_id=zone.id,
                )
            )
        elif summary.band is not None and summary.band.level >= 3 and summary.workers_total > 0:
            severity = "critical" if summary.band.level >= 4 else "warning"
            stop = [r.intensity for r in summary.recommendations if r.stop_work]
            extra = f" Stop work for {', '.join(stop)} intensity." if stop else ""
            out.append(
                Condition(
                    f"zone_heat:{zone.id}", "zone_heat", severity,
                    f"{zone.name}: {summary.band.label.lower()} heat",
                    f"WBGT {summary.env.wbgt_c:.1f} °C. {summary.band.guidance}{extra}",
                    zone_id=zone.id,
                )
            )

    for worker in state.workers:
        if worker.status == "off":
            continue
        w = state.worker_summary(worker)
        if w.attention.level in ("attention", "act_now"):
            severity = "critical" if w.attention.level == "act_now" else "warning"
            verb = "needs immediate attention" if w.attention.level == "act_now" else "needs attention"
            out.append(
                Condition(
                    f"worker_attention:{worker.id}", "worker_attention", severity,
                    f"{worker.name} ({worker.id}) {verb}",
                    f"Score {w.attention.score:.0f}/100. {w.attention.summary}",
                    zone_id=worker.zone_id, worker_id=worker.id,
                )
            )
        if w.vest is not None:
            if w.vest.stale:
                out.append(
                    Condition(
                        f"sensor_stale:vest:{worker.id}", "sensor_stale", "warning",
                        f"{worker.name}: harness offline",
                        f"No data from harness {w.vest.vest_id} for over {t.stale_after_s} s. Check the worker in person.",
                        zone_id=worker.zone_id, worker_id=worker.id,
                    )
                )
            if w.vest.battery_pct is not None and w.vest.battery_pct < t.battery_low_pct:
                out.append(
                    Condition(
                        f"battery_low:{worker.id}", "battery_low", "info",
                        f"{worker.name}: harness battery low",
                        f"Battery at {w.vest.battery_pct:.0f}%. Swap or charge the harness at the next break.",
                        zone_id=worker.zone_id, worker_id=worker.id,
                    )
                )
            if w.vest.pcm_state == "spent":
                out.append(
                    Condition(
                        f"pcm_spent:{worker.id}", "pcm_spent", "info",
                        f"{worker.name}: replace PCM packs",
                        f"PCM pack at {w.vest.pcm_temp_c:.1f} °C, cooling capacity used up. Swap in recharged packs.",
                        zone_id=worker.zone_id, worker_id=worker.id,
                    )
                )

    active, _ = midday_ban_status(state.now, t.midday_ban)
    working = sum(1 for w in state.workers if w.status == "working")
    if active and working:
        out.append(
            Condition(
                "midday_ban", "midday_ban", "critical",
                "Midday work ban in effect",
                f"{working} worker(s) are working during the {t.midday_ban.start}-{t.midday_ban.end} ban. {t.midday_ban.rule}",
            )
        )
    return out


def reconcile(session: Session, conditions: List[Condition], now: datetime) -> List[models.Alert]:
    """Apply conditions to the alert table. Returns alerts that were newly raised or escalated."""
    active: Dict[str, models.Alert] = {
        a.dedup_key: a for a in session.scalars(select(models.Alert).where(models.Alert.active.is_(True)))
    }
    raised: List[models.Alert] = []
    seen = set()
    severity_rank = {"info": 0, "warning": 1, "critical": 2}

    for c in conditions:
        seen.add(c.key)
        existing = active.get(c.key)
        if existing is None:
            alert = models.Alert(
                dedup_key=c.key, kind=c.kind, severity=c.severity, zone_id=c.zone_id, worker_id=c.worker_id,
                title=c.title, message=c.message, created_at=now, updated_at=now, active=True,
            )
            session.add(alert)
            raised.append(alert)
            continue
        escalated = severity_rank[c.severity] > severity_rank[existing.severity]
        existing.severity, existing.title, existing.message, existing.updated_at = c.severity, c.title, c.message, now
        if escalated:
            existing.acknowledged_at = None
            raised.append(existing)

    for key, alert in active.items():
        if key not in seen:
            alert.active = False
            alert.resolved_at = now
            alert.updated_at = now

    session.flush()
    return raised


def open_alert_count(session: Session) -> int:
    return len(list(session.scalars(select(models.Alert.id).where(models.Alert.active.is_(True)))))
