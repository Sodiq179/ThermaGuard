"""Application container: wires settings, database, thresholds, transports and the hub."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import List, Optional

from sqlalchemy import select

from . import models, schemas
from .config import Settings
from .db import Database
from .domain.exposure import utcnow
from .domain.thresholds import Thresholds, get_thresholds
from .ingestion import service as ingestion
from .ingestion.mqtt_consumer import MqttConsumer
from .realtime.hub import Hub
from .seed import seed_demo
from .services import alerts as alert_engine
from .services.state import SiteState

log = logging.getLogger(__name__)

PRUNE_EVERY = timedelta(minutes=10)


class Container:
    def __init__(self, settings: Settings, thresholds: Optional[Thresholds] = None) -> None:
        self.settings = settings
        self.thresholds = thresholds or get_thresholds()
        self.db = Database(settings.database_url)
        self.hub = Hub()
        self.mqtt: Optional[MqttConsumer] = None
        self._last_prune = utcnow()

    def init_storage(self) -> None:
        self.db.create_all()
        with self.db.session() as session:
            if self.settings.seed_demo and seed_demo(session, utcnow()):
                log.info("Seeded demo site")
            if session.get(models.SimConfig, 1) is None:
                session.add(models.SimConfig(id=1, enabled=True, scenario=self.settings.sim_scenario,
                                             speed=self.settings.sim_speed))

    def start_mqtt(self) -> None:
        if not self.settings.mqtt_enabled:
            return
        self.mqtt = MqttConsumer(self.settings.mqtt_host, self.settings.mqtt_port, self.db, self.hub.mark_dirty)
        self.mqtt.start()

    def stop(self) -> None:
        if self.mqtt is not None:
            self.mqtt.stop()

    @property
    def mqtt_connected(self) -> bool:
        return bool(self.mqtt and self.mqtt.connected)

    def state(self, session) -> SiteState:
        return SiteState(session, self.thresholds, utcnow())

    def evaluate(self) -> List[dict]:
        """Reconcile alerts with current state; returns newly raised alerts as JSON-ready dicts."""
        now = utcnow()
        with self.db.session() as session:
            state = SiteState(session, self.thresholds, now)
            raised = alert_engine.reconcile(session, alert_engine.derive_conditions(state), now)
            payload = [schemas.AlertOut.model_validate(a).model_dump(mode="json") for a in raised]
            if now - self._last_prune > PRUNE_EVERY:
                ingestion.prune(session, now - timedelta(hours=self.settings.retention_hours))
                self._last_prune = now
        return payload

    def sim_config(self, session) -> models.SimConfig:
        config = session.scalars(select(models.SimConfig).where(models.SimConfig.id == 1)).first()
        if config is None:
            config = models.SimConfig(id=1, enabled=True, scenario=self.settings.sim_scenario,
                                      speed=self.settings.sim_speed)
            session.add(config)
            session.flush()
        return config
