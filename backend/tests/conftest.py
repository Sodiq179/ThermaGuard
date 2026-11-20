from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.domain.thresholds import get_thresholds  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture
def thresholds():
    return get_thresholds()


@pytest.fixture
def app(tmp_path):
    settings = replace(get_settings(), database_url=f"sqlite:///{tmp_path / 'test.db'}", mqtt_enabled=False)
    return create_app(settings, start_background=False)


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def container(app):
    return app.state.container
