"""Simulator service entry point.

Reads the desired scenario and speed from the backend (``GET /api/v1/sim``), reads the
registry (zones and checked-in workers) so simulated devices follow supervisor actions,
then publishes station and harness readings every ``INTERVAL_S`` seconds.
"""

from __future__ import annotations

import logging
import os
import signal
import time
from typing import List, Optional, Tuple

import httpx

from .engine import Engine, WorkerInfo, ZoneInfo
from .transport import HttpTransport, MqttTransport, Transport

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s simulator: %(message)s")
log = logging.getLogger("simulator")

API_URL = os.environ.get("API_URL", "http://localhost:8000")
TRANSPORT = os.environ.get("TRANSPORT", "mqtt").lower()
MQTT_HOST = os.environ.get("MQTT_HOST", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
INTERVAL_S = float(os.environ.get("INTERVAL_S", "2"))

_running = True


def _stop(*_args) -> None:
    global _running
    _running = False


def fetch_state(api: httpx.Client) -> Optional[Tuple[dict, List[ZoneInfo], List[WorkerInfo]]]:
    try:
        sim = api.get("/api/v1/sim").json()
        zones = [ZoneInfo(z["id"], z["station_id"]) for z in api.get("/api/v1/zones").json()]
        workers = [
            WorkerInfo(
                id=w["id"],
                vest_id=w["vest"]["vest_id"] if w.get("vest") else None,
                zone_id=w["zone_id"],
                status=w["status"],
                intensity=w["intensity"],
                continuous_exposure_min=w["continuous_exposure_min"],
            )
            for w in api.get("/api/v1/workers").json()
        ]
        return sim, zones, workers
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        log.warning("Backend not reachable yet (%s), retrying", exc)
        return None


def build_transport() -> Transport:
    if TRANSPORT == "http":
        return HttpTransport(API_URL)
    return MqttTransport(MQTT_HOST, MQTT_PORT)


def run() -> None:
    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)
    api = httpx.Client(base_url=API_URL, timeout=5.0)
    transport = build_transport()
    engine: Optional[Engine] = None
    current_scenario = ""
    log.info("Simulator started (transport=%s, interval=%ss)", TRANSPORT, INTERVAL_S)

    while _running:
        started = time.monotonic()
        state = fetch_state(api)
        if state is not None:
            sim, zones, workers = state
            if engine is None:
                engine = Engine(sim["scenario"])
                current_scenario = sim["scenario"]
            elif sim["scenario"] != current_scenario:
                log.info("Switching scenario to %s", sim["scenario"])
                engine.set_scenario(sim["scenario"])
                current_scenario = sim["scenario"]
            if sim["enabled"]:
                dt_min = INTERVAL_S * float(sim["speed"]) / 60.0
                env, vests = engine.tick(dt_min, zones, workers)
                try:
                    for station_id, payload in env.items():
                        transport.send_env(station_id, payload)
                    for vest_id, payload in vests.items():
                        transport.send_vest(vest_id, payload)
                except Exception as exc:  # broker/backend hiccup: keep running
                    log.warning("Publish failed: %s", exc)
        time.sleep(max(0.0, INTERVAL_S - (time.monotonic() - started)))

    transport.close()
    api.close()
    log.info("Simulator stopped")


if __name__ == "__main__":
    run()
