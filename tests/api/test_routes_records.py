"""Evidence, dependency, review, and decision routes."""

from __future__ import annotations

import unittest

from coordination_ui.cli import CoordinationError

from .route_case import RouteTestCase


class RecordTestCase(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_task("T-1", actor="alice")
        self.temp.seed_task("T-2", actor="alice")


class EvidenceTests(RecordTestCase):
    def test_add_evidence_defaults_the_type(self) -> None:
        self.post("/api/evidence", {"task": "T-1", "uri": "file://a", "actor": "alice"})
        self.assertEqual(
            self.get("/api/tasks/T-1/evidence")[0]["evidence_type"], "artifact"
        )

    def test_add_evidence_accepts_an_explicit_type(self) -> None:
        self.post(
            "/api/evidence",
            {"task": "T-1", "uri": "file://b", "actor": "alice", "type": "test-run"},
        )
        self.assertEqual(
            self.get("/api/tasks/T-1/evidence")[0]["evidence_type"], "test-run"
        )

    def test_evidence_increments_the_task_count(self) -> None:
        self.post("/api/evidence", {"task": "T-1", "uri": "file://c", "actor": "alice"})
        row = next(t for t in self.get("/api/tasks") if t["id"] == "T-1")
        self.assertEqual(row["evidence_count"], 1)

    def test_evidence_requires_a_uri(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post("/api/evidence", {"task": "T-1", "actor": "alice"})

    def test_evidence_for_an_unknown_task_is_not_found(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.get("/api/tasks/ABSENT/evidence")
        self.assertEqual(caught.exception.http_status, 404)


class DependencyTests(RecordTestCase):
    def test_add_dependency_defaults_to_blocks(self) -> None:
        added = self.post(
            "/api/dependencies", {"task": "T-1", "depends_on": "T-2", "actor": "alice"}
        )
        self.assertEqual(added["type"], "blocks")
        self.assertEqual(added["status"], "active")

    def test_dependency_accepts_each_documented_type(self) -> None:
        for index, kind in enumerate(
            ("informs", "review_required", "evidence_required")
        ):
            with self.subTest(kind=kind):
                added = self.post(
                    "/api/dependencies",
                    {
                        "task": "T-1",
                        "depends_on": "T-2",
                        "actor": "alice",
                        "type": kind,
                        "rationale": f"reason {index}",
                    },
                )
                self.assertEqual(added["type"], kind)

    def test_dependency_rejects_an_unknown_type(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/dependencies",
                {"task": "T-1", "depends_on": "T-2", "actor": "alice", "type": "vibes"},
            )
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_dependency_cannot_reference_itself(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/dependencies", {"task": "T-1", "depends_on": "T-1", "actor": "alice"}
            )

    def test_dependency_appears_on_the_task(self) -> None:
        self.post("/api/dependencies", {"task": "T-1", "depends_on": "T-2", "actor": "alice"})
        self.assertEqual(self.get("/api/tasks/T-1")["dependencies"][0]["depends_on_task_id"], "T-2")

    def test_resolve_dependency_marks_it_resolved(self) -> None:
        self.post("/api/dependencies", {"task": "T-1", "depends_on": "T-2", "actor": "alice"})
        resolved = self.post(
            "/api/dependencies/resolve",
            {"task": "T-1", "depends_on": "T-2", "actor": "alice"},
        )
        self.assertEqual(resolved["status"], "resolved")

    def test_resolving_an_absent_dependency_is_not_found(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/dependencies/resolve",
                {"task": "T-1", "depends_on": "T-2", "actor": "alice"},
            )
        self.assertEqual(caught.exception.http_status, 404)


if __name__ == "__main__":
    unittest.main()
