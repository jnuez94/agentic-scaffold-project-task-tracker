"""Security posture and mutation attribution over a live server."""

from __future__ import annotations

import json
import unittest

from coordination_ui.web import build_server

from .live_server import LiveServerTestCase


class SecurityTests(LiveServerTestCase):
    def test_external_host_header_is_refused(self) -> None:
        # DNS rebinding: a hostile domain pointed at 127.0.0.1 still sends its
        # own name in the Host header.
        status, payload = self.get_json("/api/meta", host="evil.example.com")
        self.assertEqual(status, 421)
        self.assertEqual(payload["error"]["code"], "host_not_allowed")

    def test_rebinding_host_cannot_reach_a_mutation(self) -> None:
        status, _ = self.post_json(
            "/api/agents",
            {"id": "mallory", "name": "M", "role": "r"},
            host="evil.example.com",
        )
        self.assertEqual(status, 421)
        self.assertEqual([a["id"] for a in self.get_json("/api/agents")[1]["data"]], ["alice"])

    def test_localhost_host_header_is_accepted(self) -> None:
        status, _ = self.get_json("/api/meta", host=f"localhost:{self.port}")
        self.assertEqual(status, 200)

    def test_security_headers_on_api_responses(self) -> None:
        _, headers, _ = self.request("GET", "/api/meta")
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(headers["Referrer-Policy"], "no-referrer")
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertIn("default-src 'none'", headers["Content-Security-Policy"])

    def test_security_headers_on_static_responses(self) -> None:
        _, headers, _ = self.request("GET", "/")
        self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")

    def test_no_cors_headers_are_emitted(self) -> None:
        _, headers, _ = self.request("GET", "/api/meta")
        for header in (
            "Access-Control-Allow-Origin",
            "Access-Control-Allow-Credentials",
            "Access-Control-Allow-Methods",
        ):
            self.assertNotIn(header, headers)

    def test_form_content_type_cannot_reach_a_mutation(self) -> None:
        status, payload = self.post_json(
            "/api/agents",
            {"id": "mallory", "name": "M", "role": "r"},
            content_type="application/x-www-form-urlencoded",
        )
        self.assertEqual(status, 400)
        self.assertIn("Content-Type", payload["error"]["message"])

    def test_static_traversal_is_refused(self) -> None:
        status, _, _ = self.request("GET", "/../support.py")
        self.assertEqual(status, 404)

    def test_non_loopback_bind_is_refused(self) -> None:
        for host in ("0.0.0.0", "192.168.1.10"):
            with self.subTest(host=host):
                with self.assertRaises(ValueError):
                    build_server(self.temp.project(), host, 0)


class MutationTests(LiveServerTestCase):
    def test_session_header_reaches_the_cli(self) -> None:
        self.temp.seed_session("s-1", "alice")
        status, payload = self.post_json(
            "/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1}, session="s-1"
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["data"]["session_id"], "s-1")

    def test_claim_without_the_session_header_is_400(self) -> None:
        status, payload = self.post_json(
            "/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1}
        )
        self.assertEqual(status, 400)
        self.assertEqual(payload["error"]["code"], "session_required")

    def test_conflict_maps_to_409_with_details(self) -> None:
        self.temp.seed_session("s-2", "alice")
        self.post_json(
            "/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1}, session="s-2"
        )
        status, payload = self.post_json(
            "/api/tasks/T-1/status",
            {"status": "review", "actor": "alice", "if_revision": 1},
            session="s-2",
        )
        self.assertEqual(status, 409)
        self.assertEqual(payload["error"]["code"], "stale_task_revision")
        self.assertEqual(payload["error"]["details"]["actual_revision"], 2)

    def test_not_found_maps_to_404(self) -> None:
        status, payload = self.get_json("/api/tasks/ABSENT")
        self.assertEqual(status, 404)
        self.assertEqual(payload["error"]["code"], "not_found")

    def test_malformed_json_is_400(self) -> None:
        connection = self.connect()
        try:
            connection.request(
                "POST",
                "/api/agents",
                body=b"{not json",
                headers={
                    "Host": f"127.0.0.1:{self.port}",
                    "Content-Type": "application/json",
                },
            )
            response = connection.getresponse()
            payload = json.loads(response.read())
            self.assertEqual(response.status, 400)
            self.assertEqual(payload["error"]["code"], "invalid_arguments")
        finally:
            connection.close()

    def test_oversized_body_is_refused_from_the_header_alone(self) -> None:
        """The cap is enforced before any body bytes are read."""

        connection = self.connect()
        try:
            connection.putrequest("POST", "/api/agents", skip_host=True)
            connection.putheader("Host", f"127.0.0.1:{self.port}")
            connection.putheader("Content-Type", "application/json")
            connection.putheader("Content-Length", str(3 * 1024 * 1024))
            connection.endheaders()
            response = connection.getresponse()
            payload = json.loads(response.read())
            self.assertEqual(response.status, 400)
            self.assertIn("at most", payload["error"]["message"])
        finally:
            connection.close()


if __name__ == "__main__":
    unittest.main()
