from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sim.engine import Engine, WorkerInfo, ZoneInfo  # noqa: E402
from sim.scenarios import SCENARIOS, diurnal_fraction, zone_environment  # noqa: E402

ZONES = [ZoneInfo("Z1", "ST-Z1"), ZoneInfo("Z2", "ST-Z2"), ZoneInfo("Z3", "ST-Z3"), ZoneInfo("Z4", "ST-Z4")]
WORKERS = [
    WorkerInfo("W003", "V-W003", "Z1", "working", "moderate", 20),
    WorkerInfo("W005", "V-W005", "Z2", "working", "moderate", 20),
    WorkerInfo("W012", "V-W012", None, "off", "light", 0),
]

BACKEND_KEYS = {"normal_day", "midday_peak", "hot_zone_escalation", "worker_overheating", "sensor_dropout"}


def test_scenarios_match_backend_catalog():
    assert set(SCENARIOS) == BACKEND_KEYS


def test_diurnal_curve_bounds():
    assert diurnal_fraction(5.0) == 0.0
    assert abs(diurnal_fraction(14.5) - 1.0) < 1e-9
    assert diurnal_fraction(10.0) < diurnal_fraction(13.0)


def test_payloads_are_within_ingest_validation_ranges():
    engine = Engine("midday_peak")
    for _ in range(30):
        env, vests = engine.tick(1.0, ZONES, WORKERS)
        for p in env.values():
            assert -30 <= p["air_temp_c"] <= 70 and 0 <= p["rh_pct"] <= 100
        for p in vests.values():
            assert 20 <= p["skin_temp_c"] <= 45 and 0 <= p["battery_pct"] <= 100
    assert set(env) == {"ST-Z1", "ST-Z2", "ST-Z3", "ST-Z4"}
    assert "V-W012" not in vests  # off-shift harnesses do not report


def test_globe_only_on_equipped_stations():
    env, _ = Engine("normal_day").tick(1.0, ZONES, WORKERS)
    assert "globe_temp_c" in env["ST-Z1"] and "globe_temp_c" not in env["ST-Z4"]


def test_hot_zone_escalates_relative_to_other_zones():
    s = SCENARIOS["hot_zone_escalation"]
    early = zone_environment(s, "Z1", 12.0, 0).air_temp_c - zone_environment(s, "Z2", 12.0, 0).air_temp_c
    late = zone_environment(s, "Z1", 12.0, 30).air_temp_c - zone_environment(s, "Z2", 12.0, 30).air_temp_c
    assert late > early + 5


def test_overheating_worker_skin_rises():
    engine = Engine("worker_overheating")
    _, first = engine.tick(0.5, ZONES, WORKERS)
    for _ in range(40):
        _, vests = engine.tick(0.5, ZONES, WORKERS)
    assert vests["V-W003"]["skin_temp_c"] > first["V-W003"]["skin_temp_c"] + 2.0
    assert vests["V-W003"]["skin_temp_c"] > vests["V-W005"]["skin_temp_c"]


def test_sensor_dropout_silences_devices():
    engine = Engine("sensor_dropout")
    env, vests = engine.tick(0.5, ZONES, WORKERS)
    assert "ST-Z3" in env and "V-W005" in vests
    env, vests = engine.tick(3.0, ZONES, WORKERS)
    assert "ST-Z3" not in env and "V-W005" not in vests
