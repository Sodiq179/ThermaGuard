"""Optional serving of the built dashboard from the backend (single-container deployments).

Docker Compose serves the dashboard from nginx. Platforms that run one container per
service (e.g. Render's free plan) set ``STATIC_DIR`` so the API and the dashboard share
one origin. API routes and the WebSocket are registered first and always take priority.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

RESERVED_PREFIXES = ("api/", "ws", "docs", "redoc", "openapi.json")


def mount_dashboard(app: FastAPI, static_dir: str) -> bool:
    root = Path(static_dir).resolve()
    index = root / "index.html"
    if not index.is_file():
        return False

    if (root / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=root / "assets"), name="assets")
    # Missing photos must 404 so the UI falls back to initials.
    app.mount("/avatars", StaticFiles(directory=root / "avatars", check_dir=False), name="avatars")

    @app.get("/{full_path:path}", include_in_schema=False)
    def dashboard(full_path: str) -> FileResponse:
        if full_path.startswith(RESERVED_PREFIXES):
            raise HTTPException(status_code=404)
        candidate = (root / full_path).resolve()
        if full_path and candidate.is_file() and root in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index)  # client-side routing

    return True
