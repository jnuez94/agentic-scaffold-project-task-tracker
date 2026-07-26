"""HostPolicy and SecurityHeaders."""

from __future__ import annotations

import unittest

from coordination_ui.web import CONTENT_SECURITY_POLICY, HostPolicy, SecurityHeaders


class HostnameOfTests(unittest.TestCase):
    def test_strips_the_port(self) -> None:
        self.assertEqual(HostPolicy.hostname_of("127.0.0.1:8787"), "127.0.0.1")

    def test_keeps_a_bare_hostname(self) -> None:
        self.assertEqual(HostPolicy.hostname_of("localhost"), "localhost")

    def test_preserves_bracketed_ipv6(self) -> None:
        self.assertEqual(HostPolicy.hostname_of("[::1]:8787"), "[::1]")

    def test_handles_unclosed_bracket(self) -> None:
        self.assertEqual(HostPolicy.hostname_of("[::1"), "[::1")

    def test_trims_whitespace(self) -> None:
        self.assertEqual(HostPolicy.hostname_of("  localhost:1  "), "localhost")

    def test_empty_stays_empty(self) -> None:
        self.assertEqual(HostPolicy.hostname_of(""), "")


class AllowsHeaderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.policy = HostPolicy()

    def test_accepts_loopback_names(self) -> None:
        for header in ("localhost:8787", "127.0.0.1:8787", "[::1]:8787", "LOCALHOST"):
            with self.subTest(header=header):
                self.assertTrue(self.policy.allows_header(header))

    def test_rejects_external_names(self) -> None:
        # This is the DNS-rebinding control: a hostile domain resolving to
        # 127.0.0.1 still sends its own name in the Host header.
        for header in (
            "evil.example.com",
            "evil.example.com:8787",
            "127.0.0.1.nip.io",
            "192.168.1.10:8787",
        ):
            with self.subTest(header=header):
                self.assertFalse(self.policy.allows_header(header))

    def test_rejects_missing_or_empty(self) -> None:
        self.assertFalse(self.policy.allows_header(None))
        self.assertFalse(self.policy.allows_header(""))
        self.assertFalse(self.policy.allows_header("   "))


class AllowsBindTests(unittest.TestCase):
    def test_accepts_loopback_addresses(self) -> None:
        for address in ("127.0.0.1", "localhost", "::1"):
            with self.subTest(address=address):
                self.assertTrue(HostPolicy.allows_bind(address))

    def test_rejects_wildcard_and_lan_addresses(self) -> None:
        for address in ("0.0.0.0", "", "192.168.1.10", "::", "10.0.0.1"):
            with self.subTest(address=address):
                self.assertFalse(HostPolicy.allows_bind(address))


class SecurityHeadersTests(unittest.TestCase):
    def setUp(self) -> None:
        self.headers = SecurityHeaders()

    def test_includes_the_standard_hardening_set(self) -> None:
        names = dict(self.headers.items())
        self.assertEqual(names["X-Content-Type-Options"], "nosniff")
        self.assertEqual(names["Referrer-Policy"], "no-referrer")
        self.assertEqual(names["Cache-Control"], "no-store")

    def test_csp_denies_everything_by_default(self) -> None:
        self.assertIn("default-src 'none'", CONTENT_SECURITY_POLICY)

    def test_csp_confines_scripts_styles_and_connections_to_self(self) -> None:
        for directive in ("script-src 'self'", "style-src 'self'", "connect-src 'self'"):
            with self.subTest(directive=directive):
                self.assertIn(directive, CONTENT_SECURITY_POLICY)

    def test_csp_blocks_framing_and_form_submission(self) -> None:
        self.assertIn("frame-ancestors 'none'", CONTENT_SECURITY_POLICY)
        self.assertIn("form-action 'none'", CONTENT_SECURITY_POLICY)

    def test_csp_allows_no_remote_origin(self) -> None:
        self.assertNotIn("http://", CONTENT_SECURITY_POLICY)
        self.assertNotIn("https://", CONTENT_SECURITY_POLICY)
        self.assertNotIn("*", CONTENT_SECURITY_POLICY)

    def test_get_returns_a_single_header(self) -> None:
        self.assertEqual(self.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertIsNone(self.headers.get("X-Absent"))

    def test_custom_headers_are_copied_not_aliased(self) -> None:
        source = {"A": "1"}
        headers = SecurityHeaders(source)
        source["A"] = "2"
        self.assertEqual(headers.get("A"), "1")


if __name__ == "__main__":
    unittest.main()
