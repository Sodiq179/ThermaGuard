"""WebSocket fan-out plus the periodic evaluation loop.

Ingestion marks the site as changed; the loop (at most once per second) re-evaluates
alerts and tells connected dashboards to refresh. A slower heartbeat also runs so that
time-driven conditions (exposure clocks, offline sensors) are picked up without new data.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Callable, List, Set

from fastapi import WebSocket

log = logging.getLogger(__name__)


class Hub:
    def __init__(self) -> None:
        self._clients: Set[WebSocket] = set()
        self._dirty = asyncio.Event()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def mark_dirty(self) -> None:
        """Thread-safe: callable from the MQTT network thread."""
        if self._loop is None:
            return
        self._loop.call_soon_threadsafe(self._dirty.set)

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.discard(ws)

    async def broadcast(self, message: dict) -> None:
        if not self._clients:
            return
        text = json.dumps(message, default=str)
        dead: List[WebSocket] = []
        for ws in list(self._clients):
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def run(self, evaluate: Callable[[], List[dict]], heartbeat_s: float = 5.0) -> None:
        """``evaluate`` runs in a worker thread and returns newly raised alerts."""
        while True:
            try:
                await asyncio.wait_for(self._dirty.wait(), timeout=heartbeat_s)
            except asyncio.TimeoutError:
                pass
            self._dirty.clear()
            try:
                raised = await asyncio.to_thread(evaluate)
            except Exception:
                log.exception("State evaluation failed")
                await asyncio.sleep(1)
                continue
            for alert in raised:
                await self.broadcast({"type": "alert", "alert": alert})
            await self.broadcast({"type": "state", "ts": datetime.now(timezone.utc).isoformat()})
            await asyncio.sleep(1.0)  # throttle to at most one refresh per second
