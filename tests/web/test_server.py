"""Read endpoints and static serving over a live loopback server."""

from __future__ import annotations

import unittest

from .live_server import LiveServerTestCase


class ReadEndpointTests(LiveServerTestCase):
    def test_meta_succeeds(self) -> None:
        status, payload = self.get_json("/api/meta")
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["data"]["cli_version"], "1.2.0")

    def test_response_is_json_with_a_charset(self) -> None:
        _, headers, _ = self.request("GET", "/api/meta")
        self.assertEqual(headers["Content-Type"], "application/json; charset=utf-8")

    def test_tasks_list(self) -> None:
        status, payload = self.get_json("/api/tasks")
        self.assertEqual(status, 200)
        self.assertEqual(payload["data"][0]["id"], "T-1")

    def test_query_parameters_are_applied(self) -> None:
        _, payload = self.get_json("/api/tasks?status=done")
        self.assertEqual(payload["data"], [])

    def test_percent_encoded_path_is_decoded(self) -> None:
        status, payload = self.get_json("/api/tasks/T%2D1")
        self.assertEqual(status, 200)
        self.assertEqual(payload["data"]["id"], "T-1")

    def test_export_returns_markdown(self) -> None:
        status, headers, raw = self.request("GET", "/api/export")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "text/markdown; charset=utf-8")
        self.assertIn(b"#", raw)

    def test_audit_reports_a_total(self) -> None:
        _, payload = self.get_json("/api/audit?limit=1")
        self.assertGreater(payload["data"]["total"], 0)

    def test_unknown_route_is_404_with_a_stable_code(self) -> None:
        status, payload = self.get_json("/api/nope")
        self.assertEqual(status, 404)
        self.assertEqual(payload["error"]["code"], "not_found")

    def test_wrong_method_is_405_listing_allowed_verbs(self) -> None:
        status, payload = self.post_json("/api/meta", {})
        self.assertEqual(status, 405)
        self.assertEqual(payload["error"]["code"], "method_not_allowed")
        self.assertEqual(payload["error"]["details"]["allowed"], ["GET"])

    def test_head_returns_headers_without_a_body(self) -> None:
        status, headers, raw = self.request("HEAD", "/api/meta")
        self.assertEqual(status, 200)
        self.assertEqual(raw, b"")
        self.assertIn("Content-Length", headers)


class StaticServingTests(LiveServerTestCase):
    def test_root_serves_index(self) -> None:
        status, headers, raw = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "text/html")
        self.assertIn(b"ok", raw)

    def test_missing_asset_is_404(self) -> None:
        status, _, _ = self.request("GET", "/missing.js")
        self.assertEqual(status, 404)

    def test_post_to_a_static_path_is_405(self) -> None:
        status, payload = self.post_json("/", {})
        self.assertEqual(status, 405)
        self.assertEqual(payload["error"]["code"], "method_not_allowed")


if __name__ == "__main__":
    unittest.main()
