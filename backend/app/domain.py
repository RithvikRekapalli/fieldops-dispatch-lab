from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any


@dataclass(frozen=True)
class Location:
    lat: float
    lon: float
    label: str = ""


@dataclass(frozen=True)
class TimeWindow:
    start: datetime
    end: datetime

    def overlaps(self, start: datetime, end: datetime) -> bool:
        return start < self.end and self.start < end


@dataclass(frozen=True)
class Resource:
    id: str
    name: str
    location: Location
    skills: tuple[str, ...]
    available_from: datetime
    available_until: datetime
    busy_windows: tuple[TimeWindow, ...] = field(default_factory=tuple)
    hourly_cost: float = 0.0


@dataclass(frozen=True)
class ServiceRequest:
    id: str
    customer: str
    location: Location
    required_skill: str
    priority: int
    window_start: datetime
    window_end: datetime
    duration_minutes: int


@dataclass(frozen=True)
class ScoringConfig:
    distance_weight: float = 1.0
    lateness_weight: float = 0.25
    cost_weight: float = 0.35
    priority_weight: float = 45.0
    unassigned_penalty: float = 700.0
    max_travel_km: float = 70.0
    travel_speed_kmh: float = 55.0


@dataclass(frozen=True)
class Assignment:
    resource_id: str
    request_id: str
    algorithm: str
    score: float
    travel_km: float
    start_time: datetime
    end_time: datetime
    explanation: str


@dataclass(frozen=True)
class AllocationResult:
    algorithm: str
    assignments: tuple[Assignment, ...]
    unassigned: tuple[dict[str, str], ...]
    metrics: dict[str, float]


def parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


def serialize_datetime(value: datetime) -> str:
    return value.isoformat(timespec="minutes")


def location_from_dict(payload: dict[str, Any]) -> Location:
    return Location(
        lat=float(payload["lat"]),
        lon=float(payload["lon"]),
        label=str(payload.get("label", "")),
    )


def time_window_from_dict(payload: dict[str, Any]) -> TimeWindow:
    return TimeWindow(
        start=parse_datetime(payload["start"]),
        end=parse_datetime(payload["end"]),
    )


def resource_from_dict(payload: dict[str, Any]) -> Resource:
    return Resource(
        id=str(payload["id"]),
        name=str(payload["name"]),
        location=location_from_dict(payload["location"]),
        skills=tuple(str(skill) for skill in payload.get("skills", [])),
        available_from=parse_datetime(payload["available_from"]),
        available_until=parse_datetime(payload["available_until"]),
        busy_windows=tuple(
            time_window_from_dict(window) for window in payload.get("busy_windows", [])
        ),
        hourly_cost=float(payload.get("hourly_cost", 0)),
    )


def request_from_dict(payload: dict[str, Any]) -> ServiceRequest:
    return ServiceRequest(
        id=str(payload["id"]),
        customer=str(payload["customer"]),
        location=location_from_dict(payload["location"]),
        required_skill=str(payload["required_skill"]),
        priority=int(payload["priority"]),
        window_start=parse_datetime(payload["window_start"]),
        window_end=parse_datetime(payload["window_end"]),
        duration_minutes=int(payload["duration_minutes"]),
    )


def config_from_dict(payload: dict[str, Any] | None) -> ScoringConfig:
    if not payload:
        return ScoringConfig()

    defaults = ScoringConfig()
    return ScoringConfig(
        distance_weight=float(payload.get("distance_weight", defaults.distance_weight)),
        lateness_weight=float(payload.get("lateness_weight", defaults.lateness_weight)),
        cost_weight=float(payload.get("cost_weight", defaults.cost_weight)),
        priority_weight=float(payload.get("priority_weight", defaults.priority_weight)),
        unassigned_penalty=float(
            payload.get("unassigned_penalty", defaults.unassigned_penalty)
        ),
        max_travel_km=float(payload.get("max_travel_km", defaults.max_travel_km)),
        travel_speed_kmh=float(
            payload.get("travel_speed_kmh", defaults.travel_speed_kmh)
        ),
    )


def scenario_from_payload(
    payload: dict[str, Any],
) -> tuple[list[Resource], list[ServiceRequest], ScoringConfig]:
    resources = [resource_from_dict(item) for item in payload.get("resources", [])]
    requests = [request_from_dict(item) for item in payload.get("requests", [])]
    config = config_from_dict(payload.get("config"))
    return resources, requests, config


def assignment_to_dict(assignment: Assignment) -> dict[str, Any]:
    return {
        "resource_id": assignment.resource_id,
        "request_id": assignment.request_id,
        "algorithm": assignment.algorithm,
        "score": round(assignment.score, 2),
        "travel_km": round(assignment.travel_km, 2),
        "start_time": serialize_datetime(assignment.start_time),
        "end_time": serialize_datetime(assignment.end_time),
        "explanation": assignment.explanation,
    }


def result_to_dict(result: AllocationResult) -> dict[str, Any]:
    return {
        "algorithm": result.algorithm,
        "assignments": [assignment_to_dict(item) for item in result.assignments],
        "unassigned": list(result.unassigned),
        "metrics": {key: round(value, 3) for key, value in result.metrics.items()},
    }


def add_minutes(value: datetime, minutes: float) -> datetime:
    return value + timedelta(minutes=minutes)
