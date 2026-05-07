from __future__ import annotations

from datetime import datetime, timedelta
from math import asin, cos, radians, sin, sqrt
from typing import Iterable

from .domain import (
    AllocationResult,
    Assignment,
    Resource,
    ScoringConfig,
    ServiceRequest,
)


INFEASIBLE_COST = 1_000_000_000.0


def haversine_km(origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float) -> float:
    radius_km = 6371.0088
    dlat = radians(dest_lat - origin_lat)
    dlon = radians(dest_lon - origin_lon)
    lat1 = radians(origin_lat)
    lat2 = radians(dest_lat)
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * radius_km * asin(sqrt(a))


def _busy_adjusted_start(
    resource: Resource,
    earliest_start: datetime,
    latest_start: datetime,
    duration: timedelta,
) -> datetime | None:
    candidate = earliest_start
    busy_windows = sorted(resource.busy_windows, key=lambda window: window.start)

    changed = True
    while changed:
        changed = False
        if candidate > latest_start:
            return None

        end = candidate + duration
        for window in busy_windows:
            if window.overlaps(candidate, end):
                candidate = max(candidate, window.end)
                changed = True
                break

    return candidate if candidate <= latest_start else None


def build_candidate(
    resource: Resource,
    request: ServiceRequest,
    config: ScoringConfig,
    algorithm: str,
) -> Assignment | None:
    if request.required_skill not in resource.skills:
        return None

    travel_km = haversine_km(
        resource.location.lat,
        resource.location.lon,
        request.location.lat,
        request.location.lon,
    )
    if travel_km > config.max_travel_km:
        return None

    duration = timedelta(minutes=request.duration_minutes)
    travel_minutes = (travel_km / config.travel_speed_kmh) * 60
    arrival_ready = resource.available_from + timedelta(minutes=travel_minutes)
    earliest_start = max(arrival_ready, request.window_start)
    latest_start = min(request.window_end, resource.available_until - duration)
    start_time = _busy_adjusted_start(resource, earliest_start, latest_start, duration)
    if start_time is None:
        return None

    end_time = start_time + duration
    lateness_minutes = max(
        0.0, (start_time - request.window_start).total_seconds() / 60
    )
    service_cost = (request.duration_minutes / 60) * resource.hourly_cost
    score = (
        travel_km * config.distance_weight
        + lateness_minutes * config.lateness_weight
        + (service_cost / 100) * config.cost_weight
        - request.priority * config.priority_weight
    )

    explanation = (
        f"{resource.name} has {request.required_skill}, can arrive at "
        f"{start_time.strftime('%H:%M')}, travels {travel_km:.1f} km, and scores "
        f"{score:.1f} after priority and cost weighting."
    )
    return Assignment(
        resource_id=resource.id,
        request_id=request.id,
        algorithm=algorithm,
        score=score,
        travel_km=travel_km,
        start_time=start_time,
        end_time=end_time,
        explanation=explanation,
    )


def _unassigned_reason(request: ServiceRequest, resources: Iterable[Resource]) -> str:
    skill_matches = [
        resource.name for resource in resources if request.required_skill in resource.skills
    ]
    if not skill_matches:
        return f"No technician has the required {request.required_skill} skill."
    return (
        f"No unused {request.required_skill} technician satisfied the travel, "
        "availability, and busy-window constraints."
    )


def _request_lookup(requests: Iterable[ServiceRequest]) -> dict[str, ServiceRequest]:
    return {request.id: request for request in requests}


def _metrics(
    algorithm: str,
    assignments: list[Assignment],
    unassigned: list[dict[str, str]],
    requests: list[ServiceRequest],
    resources: list[Resource],
    config: ScoringConfig,
) -> dict[str, float]:
    assigned_request_ids = {assignment.request_id for assignment in assignments}
    total_priority = sum(request.priority for request in requests) or 1
    served_priority = sum(
        request.priority for request in requests if request.id in assigned_request_ids
    )
    total_score = sum(assignment.score for assignment in assignments)
    unassigned_cost = sum(
        config.unassigned_penalty
        + _request_lookup(requests)[item["request_id"]].priority * config.priority_weight
        for item in unassigned
    )
    total_travel = sum(assignment.travel_km for assignment in assignments)

    return {
        "request_count": float(len(requests)),
        "resource_count": float(len(resources)),
        "assigned_count": float(len(assignments)),
        "unassigned_count": float(len(unassigned)),
        "fill_rate": (len(assignments) / len(requests)) if requests else 0.0,
        "priority_served_rate": served_priority / total_priority,
        "total_travel_km": total_travel,
        "average_travel_km": total_travel / len(assignments) if assignments else 0.0,
        "objective_score": total_score + unassigned_cost,
        "utilization_rate": (len(assignments) / len(resources)) if resources else 0.0,
        "algorithm_rank_hint": 0.0 if algorithm == "hungarian" else 1.0,
    }


def allocate_greedy(
    resources: list[Resource],
    requests: list[ServiceRequest],
    config: ScoringConfig,
) -> AllocationResult:
    assignments: list[Assignment] = []
    unassigned: list[dict[str, str]] = []
    used_resource_ids: set[str] = set()

    ordered_requests = sorted(
        requests,
        key=lambda request: (-request.priority, request.window_start, request.id),
    )

    for request in ordered_requests:
        candidates = [
            candidate
            for resource in resources
            if resource.id not in used_resource_ids
            for candidate in [build_candidate(resource, request, config, "greedy")]
            if candidate is not None
        ]
        if candidates:
            best = min(candidates, key=lambda candidate: candidate.score)
            assignments.append(best)
            used_resource_ids.add(best.resource_id)
        else:
            unassigned.append(
                {"request_id": request.id, "reason": _unassigned_reason(request, resources)}
            )

    assignments.sort(key=lambda assignment: assignment.request_id)
    metrics = _metrics("greedy", assignments, unassigned, requests, resources, config)
    return AllocationResult(
        algorithm="greedy",
        assignments=tuple(assignments),
        unassigned=tuple(unassigned),
        metrics=metrics,
    )


def _hungarian_minimize(cost_matrix: list[list[float]]) -> list[int]:
    if not cost_matrix:
        return []
    row_count = len(cost_matrix)
    col_count = len(cost_matrix[0])
    if row_count > col_count:
        raise ValueError("Hungarian implementation requires rows <= columns")

    u = [0.0] * (row_count + 1)
    v = [0.0] * (col_count + 1)
    p = [0] * (col_count + 1)
    way = [0] * (col_count + 1)

    for i in range(1, row_count + 1):
        p[0] = i
        j0 = 0
        minv = [float("inf")] * (col_count + 1)
        used = [False] * (col_count + 1)

        while True:
            used[j0] = True
            i0 = p[j0]
            delta = float("inf")
            j1 = 0

            for j in range(1, col_count + 1):
                if used[j]:
                    continue
                current = cost_matrix[i0 - 1][j - 1] - u[i0] - v[j]
                if current < minv[j]:
                    minv[j] = current
                    way[j] = j0
                if minv[j] < delta:
                    delta = minv[j]
                    j1 = j

            for j in range(0, col_count + 1):
                if used[j]:
                    u[p[j]] += delta
                    v[j] -= delta
                else:
                    minv[j] -= delta
            j0 = j1

            if p[j0] == 0:
                break

        while True:
            j1 = way[j0]
            p[j0] = p[j1]
            j0 = j1
            if j0 == 0:
                break

    assignment = [-1] * row_count
    for j in range(1, col_count + 1):
        if p[j] > 0:
            assignment[p[j] - 1] = j - 1
    return assignment


def allocate_hungarian(
    resources: list[Resource],
    requests: list[ServiceRequest],
    config: ScoringConfig,
) -> AllocationResult:
    if not requests:
        return AllocationResult(
            algorithm="hungarian",
            assignments=(),
            unassigned=(),
            metrics=_metrics("hungarian", [], [], requests, resources, config),
        )

    candidate_cache: dict[tuple[int, int], Assignment] = {}
    cost_matrix: list[list[float]] = []

    for row, request in enumerate(requests):
        costs: list[float] = []
        for col, resource in enumerate(resources):
            candidate = build_candidate(resource, request, config, "hungarian")
            if candidate is None:
                costs.append(INFEASIBLE_COST)
            else:
                candidate_cache[(row, col)] = candidate
                costs.append(candidate.score)

        dummy_cost = config.unassigned_penalty + request.priority * config.priority_weight
        costs.extend([dummy_cost] * len(requests))
        cost_matrix.append(costs)

    chosen_columns = _hungarian_minimize(cost_matrix)
    assignments: list[Assignment] = []
    unassigned: list[dict[str, str]] = []

    for row, col in enumerate(chosen_columns):
        request = requests[row]
        if col < len(resources) and (row, col) in candidate_cache:
            assignments.append(candidate_cache[(row, col)])
        else:
            unassigned.append(
                {"request_id": request.id, "reason": _unassigned_reason(request, resources)}
            )

    assignments.sort(key=lambda assignment: assignment.request_id)
    metrics = _metrics("hungarian", assignments, unassigned, requests, resources, config)
    return AllocationResult(
        algorithm="hungarian",
        assignments=tuple(assignments),
        unassigned=tuple(unassigned),
        metrics=metrics,
    )


def compare_allocations(
    resources: list[Resource],
    requests: list[ServiceRequest],
    config: ScoringConfig,
) -> dict[str, AllocationResult]:
    return {
        "greedy": allocate_greedy(resources, requests, config),
        "hungarian": allocate_hungarian(resources, requests, config),
    }
