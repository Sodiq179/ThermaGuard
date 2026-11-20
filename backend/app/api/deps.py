"""FastAPI dependencies."""

from __future__ import annotations

from typing import Iterator

from fastapi import Request
from sqlalchemy.orm import Session

from ..container import Container


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_session(request: Request) -> Iterator[Session]:
    container: Container = request.app.state.container
    with container.db.session() as session:
        yield session
