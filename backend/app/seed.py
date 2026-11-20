"""Demo site: four zones on a Dammam construction site and twelve harnessed workers.

Workers are checked in with staggered start times so exposure clocks are meaningful
from the first minute of a demo.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models

ZONES = [
    ("Z1", "Tower Crane Deck", "Exposed rooftop slab, level 12. Full sun, no shade.", "ST-Z1", "heavy"),
    ("Z2", "Rebar Yard", "Ground-level rebar cutting and bending area.", "ST-Z2", "moderate"),
    ("Z3", "Facade Scaffold", "East facade scaffold, shaded until late morning.", "ST-Z3", "moderate"),
    ("Z4", "MEP Basement", "Basement level B1, ventilated, mechanical and electrical fit-out.", "ST-Z4", "light"),
]

# id, name, trade, zone, intensity, minutes since check-in
WORKERS = [
    ("W001", "Ahmed Al-Qahtani", "Steel fixer", "Z1", "heavy", 48),
    ("W002", "Rajesh Kumar", "Concrete finisher", "Z1", "heavy", 35),
    ("W003", "Omar Farouk", "Crane signaller", "Z1", "moderate", 62),
    ("W004", "Bilal Hassan", "Rebar cutter", "Z2", "moderate", 22),
    ("W005", "Juan Dela Cruz", "Rebar bender", "Z2", "moderate", 41),
    ("W006", "Faisal Al-Otaibi", "Forklift operator", "Z2", "light", 15),
    ("W007", "Mohammed Saleh", "Scaffolder", "Z3", "heavy", 55),
    ("W008", "Arjun Nair", "Facade installer", "Z3", "moderate", 30),
    ("W009", "Khalid Al-Harbi", "Glazier", "Z3", "moderate", 12),
    ("W010", "Samuel Okafor", "Electrician", "Z4", "light", 70),
    ("W011", "Yousef Ibrahim", "Pipefitter", "Z4", "moderate", 26),
    ("W012", "Nasser Al-Dossari", "Site foreman", None, "light", 0),
]


def seed_demo(session: Session, now: datetime) -> bool:
    """Insert the demo site if the database is empty. Returns True when seeding happened."""
    if session.scalars(select(models.Zone.id).limit(1)).first() is not None:
        return False
    for zone_id, name, description, station, intensity in ZONES:
        session.add(models.Zone(id=zone_id, name=name, description=description, station_id=station,
                                default_intensity=intensity))
    session.flush()
    for worker_id, name, trade, zone_id, intensity, minutes in WORKERS:
        status = "working" if zone_id else "off"
        session.add(models.Worker(id=worker_id, name=name, trade=trade, intensity=intensity,
                                  vest_id=f"V-{worker_id}", zone_id=zone_id, status=status))
        if zone_id:
            session.add(models.Segment(worker_id=worker_id, zone_id=zone_id, kind="work",
                                       start=now - timedelta(minutes=minutes)))
    return True
