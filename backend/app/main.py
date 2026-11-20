"""ThermaGuard backend entry point."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .api import actions, admin, ingest, read
from .config import Settings, get_settings
from .container import Container
from .services.commands import Conflict, NotFound
from .static_site import mount_dashboard

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app(settings: Optional[Settings] = None, start_background: bool = True) -> FastAPI:
    container = Container(settings or get_settings())

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        container.init_storage()
        container.hub.bind_loop(asyncio.get_running_loop())
        task = None
        if start_background:
            container.start_mqtt()
            task = asyncio.create_task(container.hub.run(container.evaluate))
        yield
        if task is not None:
            task.cancel()
        container.stop()

    app = FastAPI(
        title="ThermaGuard API",
        version=__version__,
        description="Heat-stress decision support for construction sites: zone heat assessment, "
        "work-rest guidance and worker attention flags.",
        lifespan=lifespan,
    )
    app.state.container = container
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(container.settings.cors_origins),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(NotFound)
    async def _not_found(_: Request, exc: NotFound):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(Conflict)
    async def _conflict(_: Request, exc: Conflict):
        return JSONResponse(status_code=409, content={"detail": str(exc)})

    for router in (read.router, actions.router, admin.router, ingest.router):
        app.include_router(router, prefix="/api/v1")

    @app.websocket("/ws")
    async def websocket(ws: WebSocket):
        await container.hub.connect(ws)
        try:
            while True:
                await ws.receive_text()  # keep-alive; clients do not send commands
        except WebSocketDisconnect:
            container.hub.disconnect(ws)

    if container.settings.static_dir and mount_dashboard(app, container.settings.static_dir):
        logging.getLogger(__name__).info("Serving dashboard from %s", container.settings.static_dir)

    return app


app = create_app()
