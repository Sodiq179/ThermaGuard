"""Publishing transports. They use exactly the interface real devices will use."""

from __future__ import annotations

import json
import logging
from typing import Protocol

import httpx
import paho.mqtt.client as mqtt

log = logging.getLogger(__name__)


class Transport(Protocol):
    def send_env(self, station_id: str, payload: dict) -> None: ...

    def send_vest(self, vest_id: str, payload: dict) -> None: ...

    def close(self) -> None: ...


class MqttTransport:
    def __init__(self, host: str, port: int) -> None:
        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="thermaguard-simulator")
        self._client.reconnect_delay_set(min_delay=1, max_delay=10)
        self._client.connect_async(host, port, keepalive=30)
        self._client.loop_start()
        log.info("Simulator publishing over MQTT to %s:%s", host, port)

    def send_env(self, station_id: str, payload: dict) -> None:
        self._client.publish(f"thermaguard/v1/stations/{station_id}/env", json.dumps(payload), qos=0)

    def send_vest(self, vest_id: str, payload: dict) -> None:
        self._client.publish(f"thermaguard/v1/vests/{vest_id}/telemetry", json.dumps(payload), qos=0)

    def close(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()


class HttpTransport:
    def __init__(self, api_url: str) -> None:
        self._client = httpx.Client(base_url=api_url, timeout=5.0)
        log.info("Simulator publishing over HTTP to %s", api_url)

    def send_env(self, station_id: str, payload: dict) -> None:
        self._client.post("/api/v1/ingest/env", json={"station_id": station_id, **payload}).raise_for_status()

    def send_vest(self, vest_id: str, payload: dict) -> None:
        self._client.post("/api/v1/ingest/vest", json={"vest_id": vest_id, **payload}).raise_for_status()

    def close(self) -> None:
        self._client.close()
