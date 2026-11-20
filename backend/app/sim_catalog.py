"""Scenarios the simulator implements (keys must match ``simulator/sim/scenarios.py``)."""

SCENARIOS = [
    {
        "key": "normal_day",
        "label": "Normal working day",
        "description": "A Dammam day from morning to afternoon: heat builds gradually, zones differ by sun exposure.",
    },
    {
        "key": "midday_peak",
        "label": "Midday peak",
        "description": "Peak summer heat around noon. Heavy work hits stop-work limits on exposed zones.",
    },
    {
        "key": "hot_zone_escalation",
        "label": "Hot zone escalation",
        "description": "The Tower Crane Deck heats up rapidly while other zones stay moderate.",
    },
    {
        "key": "worker_overheating",
        "label": "Worker overheating",
        "description": "Conditions are moderate, but one worker's skin temperature climbs steadily.",
    },
    {
        "key": "sensor_dropout",
        "label": "Sensor dropout",
        "description": "A zone station and a harness stop reporting, testing offline detection.",
    },
]

SCENARIO_KEYS = {s["key"] for s in SCENARIOS}
