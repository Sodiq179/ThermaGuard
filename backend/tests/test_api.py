"""API tests covering ingestion, the drill-down, supervisor actions and alerts."""

from __future__ import annotations

import json

import pytest

from app import schemas
from app.ingestion.mqtt_consumer import parse_message

API = "/api/v1"


def _feed_env(client, station="ST-Z1", air=44.0, rh=25.0, globe=None):
    body = {"station_id": station, "air_temp_c": air, "rh_pct": rh}
    if globe is not None:
        body["globe_temp_c"] = globe
    assert client.post(f"{API}/ingest/env", json=body).status_code == 202


def _feed_vest(client, vest="V-W001", skin=35.0, battery=80.0, pcm=None):
    body = {"vest_id": vest, "skin_temp_c": skin, "battery_pct": battery}
    if pcm is not None:
        body["pcm_temp_c"] = pcm
    assert client.post(f"{API}/ingest/vest", json=body).status_code == 202


def test_health(client):
    body = client.get(f"{API}/health").json()
    assert body["status"] == "ok"
    assert body["mqtt_connected"] is False


def test_overview_after_ingest(client):
    _feed_env(client, "ST-Z1", air=42.0, rh=30.0, globe=55.0)
    data = client.get(f"{API}/overview").json()
    assert data["kpis"]["zones"] == 4
    assert data["kpis"]["workers_active"] == 11
    z1 = next(z for z in data["zones"] if z["id"] == "Z1")
    assert z1["env"]["wbgt_estimated"] is False
    assert z1["band"]["key"] in {"very_high", "extreme"}
    assert [r["intensity"] for r in z1["recommendations"]] == ["light", "moderate", "heavy"]
    assert len(data["site_wbgt_history"]) == 1
    z2 = next(z for z in data["zones"] if z["id"] == "Z2")
    assert z2["env"] is None and z2["station_stale"] is True


def test_zone_detail_lists_workers_and_history(client):
    _feed_env(client, "ST-Z2", air=36.0, rh=35.0)
    data = client.get(f"{API}/zones/Z2").json()
    assert {w["id"] for w in data["workers"]} == {"W004", "W005", "W006"}
    assert len(data["history"]) == 1
    assert client.get(f"{API}/zones/NOPE").status_code == 404


def test_worker_detail_includes_vest_and_attention(client):
    _feed_env(client, "ST-Z1", air=40.0, rh=30.0)
    _feed_vest(client, "V-W001", skin=37.4, pcm=31.0)
    data = client.get(f"{API}/workers/W001").json()
    assert data["skin_temp_c"] == pytest.approx(37.4)
    assert data["vest"]["pcm_state"] == "spent"
    assert data["attention"]["level"] in {"attention", "act_now"}
    assert data["timeline"][0]["kind"] == "work"
    assert len(data["history"]) == 1


def test_break_cycle_and_check_out(client):
    r = client.post(f"{API}/workers/W004/break/start")
    assert r.status_code == 200 and r.json()["status"] == "break"
    r = client.post(f"{API}/workers/W004/break/end")
    assert r.json()["status"] == "working"
    assert r.json()["continuous_exposure_min"] < 1
    r = client.post(f"{API}/workers/W004/check-out")
    assert r.json()["status"] == "off" and r.json()["zone_id"] is None
    assert client.post(f"{API}/workers/W004/break/start").status_code == 409
    r = client.post(f"{API}/workers/W004/check-in", json={"zone_id": "Z3"})
    assert r.json()["zone_id"] == "Z3"


def test_zone_break_and_intensity(client):
    r = client.post(f"{API}/zones/Z1/break/start")
    assert r.json()["on_break"] is True
    assert r.json()["workers_on_break"] == 3
    r = client.put(f"{API}/zones/Z1/intensity", json={"intensity": "light"})
    assert r.json()["default_intensity"] == "light"
    workers = client.get(f"{API}/workers", params={"zone_id": "Z1"}).json()
    assert {w["intensity"] for w in workers} == {"light"}
    r = client.post(f"{API}/zones/Z1/break/end")
    assert r.json()["workers_working"] == 3


def test_alert_lifecycle(client, container):
    _feed_env(client, "ST-Z1", air=46.0, rh=30.0, globe=62.0)
    for zone_station in ("ST-Z2", "ST-Z3", "ST-Z4"):
        _feed_env(client, zone_station, air=30.0, rh=30.0)
    raised = container.evaluate()
    kinds = {a["kind"] for a in raised}
    assert "zone_heat" in kinds
    assert "sensor_stale" in kinds  # harnesses have not reported yet

    alerts = client.get(f"{API}/alerts").json()
    zone_alert = next(a for a in alerts if a["kind"] == "zone_heat")
    assert zone_alert["severity"] == "critical"

    acked = client.post(f"{API}/alerts/{zone_alert['id']}/ack").json()
    assert acked["acknowledged_at"] is not None

    # Re-evaluating with unchanged conditions must not duplicate alerts.
    assert all(a["kind"] != "zone_heat" for a in container.evaluate())

    # Cooling down resolves the zone alert automatically.
    _feed_env(client, "ST-Z1", air=28.0, rh=30.0)
    container.evaluate()
    history = client.get(f"{API}/alerts", params={"active": False}).json()
    assert any(a["id"] == zone_alert["id"] for a in history)


def test_admin_worker_and_zone_crud(client):
    r = client.post(f"{API}/admin/workers", json={"id": "W100", "name": "Test Worker", "trade": "Painter",
                                                  "intensity": "light", "vest_id": "V-W100"})
    assert r.status_code == 201 and r.json()["status"] == "off"
    dup = client.post(f"{API}/admin/workers", json={"id": "W101", "name": "X", "vest_id": "V-W100"})
    assert dup.status_code == 409
    r = client.patch(f"{API}/admin/workers/W100", json={"trade": "Plasterer"})
    assert r.json()["trade"] == "Plasterer"
    assert client.delete(f"{API}/admin/workers/W100").status_code == 204
    assert client.get(f"{API}/workers/W100").status_code == 404

    r = client.post(f"{API}/admin/zones", json={"id": "Z9", "name": "Laydown", "station_id": "ST-Z9"})
    assert r.status_code == 201
    assert client.post(f"{API}/admin/zones", json={"id": "Z10", "name": "X", "station_id": "ST-Z9"}).status_code == 409
    r = client.patch(f"{API}/admin/zones/Z9", json={"name": "Laydown Yard"})
    assert r.json()["name"] == "Laydown Yard"


def test_ingest_validation(client):
    r = client.post(f"{API}/ingest/vest", json={"vest_id": "V-W001", "skin_temp_c": 99})
    assert r.status_code == 422


def test_sim_config(client):
    state = client.get(f"{API}/sim").json()
    assert state["scenario"] == "normal_day" and len(state["scenarios"]) == 5
    r = client.put(f"{API}/sim", json={"scenario": "midday_peak", "speed": 10})
    assert r.json()["scenario"] == "midday_peak" and r.json()["speed"] == 10
    assert client.put(f"{API}/sim", json={"scenario": "nope"}).status_code == 400


def test_methodology(client):
    data = client.get(f"{API}/methodology").json()
    assert len(data["bands"]) == 5 and len(data["work_rest_table"]) == 4


def test_websocket_accepts_connections(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_text("ping")


def test_mqtt_topic_parsing():
    env = parse_message("thermaguard/v1/stations/ST-Z1/env", json.dumps({"air_temp_c": 40, "rh_pct": 20}).encode())
    assert isinstance(env, schemas.EnvIngest) and env.station_id == "ST-Z1"
    vest = parse_message("thermaguard/v1/vests/V-W001/telemetry", b'{"skin_temp_c": 35.2}')
    assert isinstance(vest, schemas.VestIngest) and vest.vest_id == "V-W001"
    with pytest.raises(ValueError):
        parse_message("thermaguard/v1/vests/V-W001/telemetry", b"not json")
    with pytest.raises(ValueError):
        parse_message("other/topic", b"{}")
