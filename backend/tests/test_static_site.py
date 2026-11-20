"""Single-container mode: the backend serves the built dashboard alongside the API."""

from __future__ import annotations

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def site_client(tmp_path):
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    (static / "avatars").mkdir()
    (static / "index.html").write_text("<html>ThermaGuard</html>")
    (static / "assets" / "app.js").write_text("console.log(1)")
    (static / "avatars" / "W001.jpg").write_bytes(b"\xff\xd8\xff")
    (tmp_path / "secret.txt").write_text("nope")
    settings = replace(get_settings(), database_url=f"sqlite:///{tmp_path / 'db.sqlite'}", mqtt_enabled=False,
                       static_dir=str(static))
    with TestClient(create_app(settings, start_background=False)) as client:
        yield client


def test_dashboard_routes_fall_back_to_index(site_client):
    for path in ("/", "/workers", "/zones/Z1", "/workers/W003"):
        r = site_client.get(path)
        assert r.status_code == 200 and "ThermaGuard" in r.text


def test_assets_and_avatars(site_client):
    assert site_client.get("/assets/app.js").status_code == 200
    assert site_client.get("/avatars/W001.jpg").status_code == 200
    assert site_client.get("/avatars/W999.jpg").status_code == 404


def test_api_wins_and_unknown_api_is_404(site_client):
    health = site_client.get("/api/v1/health").json()
    assert health["status"] == "ok" and health["mqtt_enabled"] is False
    assert site_client.get("/api/v1/nope").status_code == 404


def test_no_path_traversal(site_client):
    assert "nope" not in site_client.get("/..%2Fsecret.txt").text
