from __future__ import annotations

import unittest
from datetime import datetime

from app.allocation import allocate_greedy, allocate_hungarian, build_candidate
from app.domain import (
    Location,
    Resource,
    ScoringConfig,
    ServiceRequest,
    TimeWindow,
    scenario_from_payload,
)
from app.sample_data import get_sample_scenario


class AllocationEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        scenario = get_sample_scenario()
        self.resources, self.requests, self.config = scenario_from_payload(scenario)

    def test_sample_shows_meaningful_algorithm_tradeoff(self) -> None:
        greedy = allocate_greedy(self.resources, self.requests, self.config)
        hungarian = allocate_hungarian(self.resources, self.requests, self.config)

        self.assertEqual(greedy.metrics["assigned_count"], 5)
        self.assertEqual(hungarian.metrics["assigned_count"], 5)
        self.assertGreater(
            hungarian.metrics["priority_served_rate"],
            greedy.metrics["priority_served_rate"],
        )
        self.assertLess(
            hungarian.metrics["objective_score"],
            greedy.metrics["objective_score"],
        )
        self.assertGreater(
            hungarian.metrics["total_travel_km"],
            greedy.metrics["total_travel_km"],
        )

    def test_assignments_respect_hard_constraints(self) -> None:
        result = allocate_hungarian(self.resources, self.requests, self.config)
        resource_by_id = {resource.id: resource for resource in self.resources}
        request_by_id = {request.id: request for request in self.requests}

        for assignment in result.assignments:
            resource = resource_by_id[assignment.resource_id]
            request = request_by_id[assignment.request_id]
            self.assertIn(request.required_skill, resource.skills)
            self.assertLessEqual(assignment.travel_km, self.config.max_travel_km)
            self.assertGreaterEqual(assignment.start_time, request.window_start)
            self.assertLessEqual(assignment.start_time, request.window_end)
            self.assertLessEqual(assignment.end_time, resource.available_until)

            for busy_window in resource.busy_windows:
                self.assertFalse(
                    busy_window.overlaps(assignment.start_time, assignment.end_time)
                )

    def test_busy_window_pushes_start_time(self) -> None:
        resource = Resource(
            id="tech-a",
            name="Busy Tech",
            location=Location(41.0, -87.0, "Base"),
            skills=("electrical",),
            available_from=datetime(2026, 2, 2, 8, 0),
            available_until=datetime(2026, 2, 2, 17, 0),
            busy_windows=(
                TimeWindow(
                    datetime(2026, 2, 2, 9, 0),
                    datetime(2026, 2, 2, 10, 30),
                ),
            ),
            hourly_cost=100,
        )
        request = ServiceRequest(
            id="req-a",
            customer="Panel inspection",
            location=Location(41.0, -87.0, "Site"),
            required_skill="electrical",
            priority=3,
            window_start=datetime(2026, 2, 2, 9, 0),
            window_end=datetime(2026, 2, 2, 12, 0),
            duration_minutes=45,
        )

        assignment = build_candidate(resource, request, ScoringConfig(), "test")

        self.assertIsNotNone(assignment)
        self.assertEqual(assignment.start_time, datetime(2026, 2, 2, 10, 30))
        self.assertEqual(assignment.end_time, datetime(2026, 2, 2, 11, 15))

    def test_incompatible_skill_is_unassigned(self) -> None:
        resource = Resource(
            id="tech-network",
            name="Network Tech",
            location=Location(41.0, -87.0, "Base"),
            skills=("network",),
            available_from=datetime(2026, 2, 2, 8, 0),
            available_until=datetime(2026, 2, 2, 17, 0),
        )
        request = ServiceRequest(
            id="req-mechanical",
            customer="Pump repair",
            location=Location(41.0, -87.0, "Plant"),
            required_skill="mechanical",
            priority=5,
            window_start=datetime(2026, 2, 2, 9, 0),
            window_end=datetime(2026, 2, 2, 12, 0),
            duration_minutes=60,
        )

        result = allocate_hungarian([resource], [request], ScoringConfig())

        self.assertEqual(result.metrics["assigned_count"], 0)
        self.assertEqual(result.unassigned[0]["request_id"], "req-mechanical")
        self.assertIn("required mechanical skill", result.unassigned[0]["reason"])


if __name__ == "__main__":
    unittest.main()

