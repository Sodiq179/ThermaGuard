"""MQTT transport: subscribes to device topics and feeds the shared ingestion pipeline.

Topics (payloads are JSON objects matching the HTTP ingest bodies; ids come from the topic):
    thermaguard/v1/stations/{station_id}/env
    thermaguard/v1/vests/{vest_id}/telemetry
"""

from __future__ import annotations

import json
import logging
from typing import Callable, Optional

import paho.mqtt.client as mqtt
from pydantic import ValidationError

from .. import schemas
from ..db import Database
from ..domain.exposure import utcnow
from . import service

log = logging.getLogger(__name__)

ENV_TOPIC = "thermaguard/v1/stations/+/env"
VEST_TOPIC = "thermaguard/v1/vests/+/telemetry"


def parse_message(topic: str, raw: bytes):
    """Map a topic + payload to a validated ingest schema. Raises ValueError on bad input."""
    parts = topic.split("/")
    if len(parts) != 5 or parts[0] != "thermaguard" or parts[1] != "v1":
        raise ValueError(f"Unexpected topic {topic}")
    try:
        body = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Payload is not valid JSON: {exc}") from exc
    if not isinstance(body, dict):
        raise ValueError("Payload must be a JSON object")
    kind, device_id, leaf = parts[2], parts[3], parts[4]
    try:
        if kind == "stations" and leaf == "env":
            return schemas.EnvIngest(**{**body, "station_id": device_id})
        if kind == "vests" and leaf == "telemetry":
            return schemas.VestIngest(**{**body, "vest_id": device_id})
    except ValidationError as exc:
        raise ValueError(str(exc)) from exc
    raise ValueError(f"Unexpected topic {topic}")


class MqttConsumer:
    def __init__(self, host: str, port: int, db: Database, on_ingest: Callable[[], None]) -> None:
        self.host, self.port, self.db, self.on_ingest = host, port, db, on_ingest
        self.connected = False
        self._client: Optional[mqtt.Client] = None

    def start(self) -> None:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="thermaguard-backend")
        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message
        client.reconnect_delay_set(min_delay=1, max_delay=10)
        client.connect_async(self.host, self.port, keepalive=30)
        client.loop_start()
        self._client = client
        log.info("MQTT consumer connecting to %s:%s", self.host, self.port)

    def stop(self) -> None:
        if self._client is not None:
            self._client.loop_stop()
            self._client.disconnect()

    def _on_connect(self, client, _userdata, _flags, reason_code, _props=None):
        if reason_code == 0:
            self.connected = True
            client.subscribe([(ENV_TOPIC, 1), (VEST_TOPIC, 1)])
            log.info("MQTT connected, subscribed to device topics")
        else:
            log.warning("MQTT connect failed: %s", reason_code)

    def _on_disconnect(self, _client, _userdata, _flags, reason_code, _props=None):
        self.connected = False
        log.warning("MQTT disconnected: %s", reason_code)

    def _on_message(self, _client, _userdata, msg):
        try:
            payload = parse_message(msg.topic, msg.payload)
        except ValueError as exc:
            log.warning("Rejected MQTT message on %s: %s", msg.topic, exc)
            return
        try:
            with self.db.session() as session:
                if isinstance(payload, schemas.EnvIngest):
                    service.ingest_env(session, payload, utcnow())
                else:
                    service.ingest_vest(session, payload, utcnow())
            self.on_ingest()
        except Exception:  # keep the consumer alive whatever happens
            log.exception("Failed to store MQTT message from %s", msg.topic)
