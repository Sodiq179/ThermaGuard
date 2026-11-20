"""Read model: turns stored readings and the work timeline into supervisor-facing state.

State is computed on read. A construction site has tens of workers and a handful of
zones, so this stays fast while keeping one source of truth (the stored readings).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..domain import attention as attention_logic
from ..domain import exposure as exposure_logic
from ..domain.thresholds import Thresholds
from ..domain.work_rest import classify_band, recommend_all

HISTORY_WINDOW = timedelta(minutes=30)
TREND_WINDOW = timedelta(minutes=10)


def start_of_day(now: datetime) -> datetime:
    return now - timedelta(hours=24)


class SiteState:
    """Snapshot of the site at ``now``. Build once per request, then query it."""

    def __init__(self, session: Session, thresholds: Thresholds, now: datetime) -> None:
        self.session = session
        self.t = thresholds
        self.now = now
        self.zones: List[models.Zone] = list(session.scalars(select(models.Zone).order_by(models.Zone.id)))
        self.workers: List[models.Worker] = list(session.scalars(select(models.Worker).order_by(models.Worker.id)))
        self._zone_by_id = {z.id: z for z in self.zones}
        self._latest_env: Dict[str, Optional[models.EnvReading]] = {z.id: self._latest_env_for(z) for z in self.zones}
        self._worker_cache: Dict[str, schemas.WorkerSummary] = {}

    # ------------------------------------------------------------------ helpers
    def _latest_env_for(self, zone: models.Zone) -> Optional[models.EnvReading]:
        stmt = (
            select(models.EnvReading)
            .where(models.EnvReading.station_id == zone.station_id)
            .order_by(models.EnvReading.ts.desc())
            .limit(1)
        )
        return self.session.scalars(stmt).first()

    def _is_stale(self, ts: Optional[datetime]) -> bool:
        return ts is None or (self.now - ts).total_seconds() > self.t.stale_after_s

    def zone(self, zone_id: str) -> Optional[models.Zone]:
        return self._zone_by_id.get(zone_id)

    def zone_wbgt(self, zone_id: Optional[str]) -> Optional[float]:
        if zone_id is None:
            return None
        env = self._latest_env.get(zone_id)
        return env.wbgt_c if env is not None else None

    def band(self, wbgt: Optional[float]) -> Optional[schemas.HeatBand]:
        if wbgt is None:
            return None
        b = classify_band(wbgt, self.t)
        return schemas.HeatBand(level=b.level, key=b.key, label=b.label, color=b.color, guidance=b.guidance)

    # ------------------------------------------------------------------ workers
    def worker_summary(self, worker: models.Worker) -> schemas.WorkerSummary:
        cached = self._worker_cache.get(worker.id)
        if cached is not None:
            return cached

        segments = self._segments(worker.id)
        exp = exposure_logic.summarize(
            [exposure_logic.Segment(s.kind, s.start, s.end) for s in segments], self.now
        )

        vest_status: Optional[schemas.VestStatus] = None
        skin: Optional[float] = None
        trend: Optional[float] = None
        if worker.vest_id:
            recent = list(
                self.session.scalars(
                    select(models.VestReading)
                    .where(models.VestReading.vest_id == worker.vest_id, models.VestReading.ts >= self.now - TREND_WINDOW)
                    .order_by(models.VestReading.ts)
                )
            )
            latest = recent[-1] if recent else self.session.scalars(
                select(models.VestReading)
                .where(models.VestReading.vest_id == worker.vest_id)
                .order_by(models.VestReading.ts.desc())
                .limit(1)
            ).first()
            stale = self._is_stale(latest.ts if latest else None)
            if latest is not None and not stale:
                skin = latest.skin_temp_c
                trend = exposure_logic.skin_trend_per_10min((r.ts, r.skin_temp_c) for r in recent)
            vest_status = schemas.VestStatus(
                vest_id=worker.vest_id,
                battery_pct=latest.battery_pct if latest else None,
                last_seen=latest.ts if latest else None,
                stale=stale,
                pcm_temp_c=latest.pcm_temp_c if latest else None,
                pcm_state=exposure_logic.pcm_state(latest.pcm_temp_c if latest else None, self.t),
            )

        wbgt = self.zone_wbgt(worker.zone_id)
        allowed: Optional[int] = None
        if wbgt is not None:
            rec = next(r for r in recommend_all(wbgt, self.t) if r.intensity == worker.intensity)
            allowed = rec.work_minutes

        result = attention_logic.evaluate(
            attention_logic.AttentionInputs(
                on_shift=worker.status != "off",
                on_break=worker.status == "break",
                skin_temp_c=skin,
                skin_trend_c_per_10min=trend,
                continuous_exposure_min=exp.continuous_min,
                allowed_work_min=allowed,
                wbgt_c=wbgt,
                intensity=worker.intensity,
            ),
            self.t,
        )
        zone = self.zone(worker.zone_id) if worker.zone_id else None
        summary = schemas.WorkerSummary(
            id=worker.id,
            name=worker.name,
            trade=worker.trade,
            zone_id=worker.zone_id,
            zone_name=zone.name if zone else None,
            intensity=worker.intensity,
            status=worker.status,
            skin_temp_c=skin,
            skin_trend_c_per_10min=trend,
            continuous_exposure_min=exp.continuous_min,
            total_exposure_min=exp.total_min,
            break_elapsed_min=exp.break_elapsed_min,
            attention=schemas.Attention(
                score=result.score,
                level=result.level,
                label=result.label,
                summary=result.summary,
                factors=[schemas.AttentionFactor(**f.__dict__) for f in result.factors],
            ),
            vest=vest_status,
        )
        self._worker_cache[worker.id] = summary
        return summary

    def _segments(self, worker_id: str) -> List[models.Segment]:
        stmt = (
            select(models.Segment)
            .where(models.Segment.worker_id == worker_id)
            .where((models.Segment.end.is_(None)) | (models.Segment.end >= start_of_day(self.now)))
            .order_by(models.Segment.start)
        )
        return list(self.session.scalars(stmt))

    def worker_summaries(self, zone_id: Optional[str] = None) -> List[schemas.WorkerSummary]:
        workers = [w for w in self.workers if zone_id is None or w.zone_id == zone_id]
        return [self.worker_summary(w) for w in workers]

    def worker_detail(self, worker: models.Worker) -> schemas.WorkerDetail:
        summary = self.worker_summary(worker)
        since = self.now - HISTORY_WINDOW
        history: List[schemas.WorkerHistoryPoint] = []
        if worker.vest_id:
            zone = self.zone(worker.zone_id) if worker.zone_id else None
            env_points = []
            if zone is not None:
                env_points = list(
                    self.session.scalars(
                        select(models.EnvReading)
                        .where(models.EnvReading.station_id == zone.station_id, models.EnvReading.ts >= since)
                        .order_by(models.EnvReading.ts)
                    )
                )
            idx = 0
            current_wbgt: Optional[float] = None
            for r in self.session.scalars(
                select(models.VestReading)
                .where(models.VestReading.vest_id == worker.vest_id, models.VestReading.ts >= since)
                .order_by(models.VestReading.ts)
            ):
                while idx < len(env_points) and env_points[idx].ts <= r.ts:
                    current_wbgt = env_points[idx].wbgt_c
                    idx += 1
                history.append(
                    schemas.WorkerHistoryPoint(ts=r.ts, skin_temp_c=r.skin_temp_c, wbgt_c=current_wbgt, pcm_temp_c=r.pcm_temp_c)
                )
        timeline = [
            schemas.TimelineSegment(start=s.start, end=s.end, kind=s.kind, zone_id=s.zone_id)
            for s in self._segments(worker.id)
        ]
        alerts = list(
            self.session.scalars(
                select(models.Alert)
                .where(models.Alert.worker_id == worker.id)
                .order_by(models.Alert.created_at.desc())
                .limit(20)
            )
        )
        return schemas.WorkerDetail(
            **summary.model_dump(),
            history=history,
            timeline=timeline,
            alerts=[schemas.AlertOut.model_validate(a) for a in alerts],
        )

    # ------------------------------------------------------------------ zones
    def zone_summary(self, zone: models.Zone) -> schemas.ZoneSummary:
        env = self._latest_env.get(zone.id)
        stale = self._is_stale(env.ts if env else None)
        wbgt = env.wbgt_c if env else None
        recs = recommend_all(wbgt, self.t) if wbgt is not None else []
        members = self.worker_summaries(zone.id)
        return schemas.ZoneSummary(
            id=zone.id,
            name=zone.name,
            description=zone.description,
            station_id=zone.station_id,
            default_intensity=zone.default_intensity,
            env=schemas.EnvReading.model_validate(env) if env else None,
            station_stale=stale,
            band=self.band(wbgt),
            recommendations=[schemas.WorkRest(**r.__dict__) for r in recs],
            on_break=zone.on_break,
            workers_total=sum(1 for w in members if w.status != "off"),
            workers_working=sum(1 for w in members if w.status == "working"),
            workers_on_break=sum(1 for w in members if w.status == "break"),
            workers_flagged=sum(1 for w in members if w.attention.level in ("attention", "act_now")),
        )

    def zone_detail(self, zone: models.Zone) -> schemas.ZoneDetail:
        summary = self.zone_summary(zone)
        history = list(
            self.session.scalars(
                select(models.EnvReading)
                .where(models.EnvReading.station_id == zone.station_id, models.EnvReading.ts >= self.now - HISTORY_WINDOW)
                .order_by(models.EnvReading.ts)
            )
        )
        workers = sorted(self.worker_summaries(zone.id), key=lambda w: (w.status == "off", -w.attention.score))
        return schemas.ZoneDetail(
            **summary.model_dump(),
            workers=workers,
            history=[schemas.EnvReading.model_validate(h) for h in history],
        )

    # ------------------------------------------------------------------ site
    def site_wbgt_history(self) -> List[Dict[str, object]]:
        """WBGT per zone in one-minute buckets over the history window."""
        station_to_zone = {z.station_id: z.id for z in self.zones}
        rows = self.session.scalars(
            select(models.EnvReading)
            .where(models.EnvReading.ts >= self.now - HISTORY_WINDOW)
            .order_by(models.EnvReading.ts)
        )
        buckets: Dict[datetime, Dict[str, List[float]]] = defaultdict(lambda: defaultdict(list))
        for r in rows:
            zone_id = station_to_zone.get(r.station_id)
            if zone_id is None:
                continue
            bucket = r.ts.replace(second=0, microsecond=0)
            buckets[bucket][zone_id].append(r.wbgt_c)
        series: List[Dict[str, object]] = []
        for bucket in sorted(buckets):
            point: Dict[str, object] = {"ts": bucket.isoformat()}
            for zone_id, values in buckets[bucket].items():
                point[zone_id] = round(sum(values) / len(values), 2)
            series.append(point)
        return series

    def overview(self, open_alerts: int, site_name: str) -> schemas.Overview:
        zones = [self.zone_summary(z) for z in self.zones]
        workers = self.worker_summaries()
        wbgts = [z.env.wbgt_c for z in zones if z.env is not None and not z.station_stale]
        max_wbgt = max(wbgts) if wbgts else None
        active, in_season = exposure_logic.midday_ban_status(self.now, self.t.midday_ban)
        ban = self.t.midday_ban
        return schemas.Overview(
            site=schemas.Site(
                name=site_name,
                now=self.now,
                midday_ban=schemas.MiddayBan(
                    active=active, in_season=in_season, window=f"{ban.start}-{ban.end}", rule=ban.rule
                ),
                max_wbgt_c=max_wbgt,
                worst_band=self.band(max_wbgt),
            ),
            kpis=schemas.Kpis(
                zones=len(zones),
                workers_active=sum(1 for w in workers if w.status != "off"),
                workers_on_break=sum(1 for w in workers if w.status == "break"),
                workers_flagged=sum(1 for w in workers if w.attention.level in ("attention", "act_now")),
                open_alerts=open_alerts,
            ),
            zones=zones,
            site_wbgt_history=self.site_wbgt_history(),
        )
