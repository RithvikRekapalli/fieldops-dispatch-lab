from __future__ import annotations

from copy import deepcopy
from typing import Any


SAMPLE_SCENARIO: dict[str, Any] = {
    "config": {
        "distance_weight": 1.0,
        "lateness_weight": 0.3,
        "cost_weight": 0.4,
        "priority_weight": 45.0,
        "unassigned_penalty": 720.0,
        "max_travel_km": 68.0,
        "travel_speed_kmh": 55.0,
    },
    "resources": [
        {
            "id": "tech-1",
            "name": "Maya Chen",
            "location": {"lat": 41.8781, "lon": -87.6298, "label": "Chicago Loop"},
            "skills": ["electrical", "instrumentation"],
            "available_from": "2026-02-02T08:00:00",
            "available_until": "2026-02-02T17:00:00",
            "busy_windows": [
                {"start": "2026-02-02T11:30:00", "end": "2026-02-02T12:30:00"}
            ],
            "hourly_cost": 98,
        },
        {
            "id": "tech-2",
            "name": "Luis Rivera",
            "location": {"lat": 41.9742, "lon": -87.9073, "label": "O'Hare"},
            "skills": ["mechanical", "hvac"],
            "available_from": "2026-02-02T08:00:00",
            "available_until": "2026-02-02T16:30:00",
            "busy_windows": [],
            "hourly_cost": 91,
        },
        {
            "id": "tech-3",
            "name": "Anika Patel",
            "location": {"lat": 41.7606, "lon": -88.3201, "label": "Aurora"},
            "skills": ["electrical", "mechanical", "controls"],
            "available_from": "2026-02-02T08:00:00",
            "available_until": "2026-02-02T17:00:00",
            "busy_windows": [],
            "hourly_cost": 115,
        },
        {
            "id": "tech-4",
            "name": "Owen Brooks",
            "location": {"lat": 41.5834, "lon": -87.5000, "label": "Hammond"},
            "skills": ["instrumentation", "safety"],
            "available_from": "2026-02-02T09:00:00",
            "available_until": "2026-02-02T18:00:00",
            "busy_windows": [],
            "hourly_cost": 87,
        },
        {
            "id": "tech-5",
            "name": "Priya Nair",
            "location": {"lat": 41.7508, "lon": -88.1535, "label": "Naperville"},
            "skills": ["network", "controls"],
            "available_from": "2026-02-02T08:30:00",
            "available_until": "2026-02-02T17:00:00",
            "busy_windows": [
                {"start": "2026-02-02T13:00:00", "end": "2026-02-02T14:00:00"}
            ],
            "hourly_cost": 102,
        },
    ],
    "requests": [
        {
            "id": "req-1",
            "customer": "Northside Water PLC alarm",
            "location": {"lat": 42.0451, "lon": -87.6877, "label": "Evanston"},
            "required_skill": "controls",
            "priority": 4,
            "window_start": "2026-02-02T09:00:00",
            "window_end": "2026-02-02T11:30:00",
            "duration_minutes": 75,
        },
        {
            "id": "req-2",
            "customer": "Airport conveyor vibration",
            "location": {"lat": 41.9796, "lon": -87.9045, "label": "O'Hare Terminal"},
            "required_skill": "mechanical",
            "priority": 4,
            "window_start": "2026-02-02T09:00:00",
            "window_end": "2026-02-02T12:00:00",
            "duration_minutes": 100,
        },
        {
            "id": "req-3",
            "customer": "Gary flame sensor check",
            "location": {"lat": 41.5934, "lon": -87.3464, "label": "Gary"},
            "required_skill": "instrumentation",
            "priority": 3,
            "window_start": "2026-02-02T10:00:00",
            "window_end": "2026-02-02T13:00:00",
            "duration_minutes": 60,
        },
        {
            "id": "req-4",
            "customer": "Naperville SCADA gateway",
            "location": {"lat": 41.7508, "lon": -88.1535, "label": "Naperville"},
            "required_skill": "network",
            "priority": 4,
            "window_start": "2026-02-02T08:30:00",
            "window_end": "2026-02-02T11:00:00",
            "duration_minutes": 90,
        },
        {
            "id": "req-5",
            "customer": "Aurora motor starter",
            "location": {"lat": 41.7634, "lon": -88.3186, "label": "Aurora"},
            "required_skill": "electrical",
            "priority": 5,
            "window_start": "2026-02-02T09:00:00",
            "window_end": "2026-02-02T11:30:00",
            "duration_minutes": 90,
        },
        {
            "id": "req-6",
            "customer": "Joliet pump seal failure",
            "location": {"lat": 41.5250, "lon": -88.0817, "label": "Joliet"},
            "required_skill": "mechanical",
            "priority": 4,
            "window_start": "2026-02-02T10:00:00",
            "window_end": "2026-02-02T13:00:00",
            "duration_minutes": 120,
        },
        {
            "id": "req-7",
            "customer": "Skokie panel retrofit",
            "location": {"lat": 42.0324, "lon": -87.7416, "label": "Skokie"},
            "required_skill": "electrical",
            "priority": 3,
            "window_start": "2026-02-02T13:00:00",
            "window_end": "2026-02-02T16:00:00",
            "duration_minutes": 90,
        },
    ],
}


def get_sample_scenario() -> dict[str, Any]:
    return deepcopy(SAMPLE_SCENARIO)
