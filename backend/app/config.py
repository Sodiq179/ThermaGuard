"""Runtime settings, read from environment variables (see ``.env.example``)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


def _bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    site_name: str
    database_url: str
    mqtt_enabled: bool
    mqtt_host: str
    mqtt_port: int
    seed_demo: bool
    sim_scenario: str
    sim_speed: float
    retention_hours: int
    cors_origins: tuple
    static_dir: str


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    env = os.environ.get
    return Settings(
        site_name=env("SITE_NAME", "ThermaGuard Demo Site, Dammam"),
        database_url=env("DATABASE_URL", "sqlite:///./data/thermaguard.db"),
        mqtt_enabled=_bool(env("MQTT_ENABLED", "true")),
        mqtt_host=env("MQTT_HOST", "localhost"),
        mqtt_port=int(env("MQTT_PORT", "1883")),
        seed_demo=_bool(env("SEED_DEMO", "true")),
        sim_scenario=env("SIM_SCENARIO", "normal_day"),
        sim_speed=float(env("SIM_SPEED", "5")),
        retention_hours=int(env("RETENTION_HOURS", "24")),
        cors_origins=tuple(o for o in env("CORS_ORIGINS", "http://localhost:5173").split(",") if o),
        static_dir=env("STATIC_DIR", ""),
    )
