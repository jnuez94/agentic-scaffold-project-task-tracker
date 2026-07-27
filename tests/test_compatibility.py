"""The startup compatibility gate (UI-26).

The console ships separately from the CLI it drives and mirrors one version of
the contract, so "which CLI am I actually talking to" is a question it has to
ask and act on. It asked, and discarded the answer, until this existed.
"""

from __future__ import annotations

import unittest

from coordination_ui.compatibility import (
    BELOW_CLI_VERSION,
    MINIMUM_CLI_VERSION,
    cli_version_supported,
    describe_cli_problem,
    describe_schema_problem,
    parse_version,
    schema_version_supported,
    verify,
)


class ParseVersionTests(unittest.TestCase):
    def test_parses_a_plain_version(self) -> None:
        self.assertEqual(parse_version("1.2.0"), (1, 2, 0))

    def test_tolerates_a_leading_v_and_a_suffix(self) -> None:
        self.assertEqual(parse_version("v1.2.3-rc1"), (1, 2, 3))

    def test_refuses_what_it_cannot_read(self) -> None:
        # "Unreadable" and "compatible" are different claims.
        for raw in ("", "1.2", "next", None, 12, {"cli_version": "1.2.0"}):
            with self.subTest(raw=raw):
                self.assertIsNone(parse_version(raw))


class CliRangeTests(unittest.TestCase):
    def test_accepts_the_minimum(self) -> None:
        self.assertTrue(cli_version_supported(MINIMUM_CLI_VERSION))

    def test_accepts_later_compatible_releases(self) -> None:
        # A range, not a pin: the contract documents a stable surface, so
        # pinning would break an operator on every CLI patch release.
        for version in ("1.2.1", "1.3.0", "1.99.99"):
            with self.subTest(version=version):
                self.assertTrue(cli_version_supported(version))

    def test_refuses_older_than_the_contract_it_mirrors(self) -> None:
        for version in ("1.1.9", "1.0.0", "0.9.0"):
            with self.subTest(version=version):
                self.assertFalse(cli_version_supported(version))

    def test_refuses_the_next_major(self) -> None:
        self.assertFalse(cli_version_supported(BELOW_CLI_VERSION))
        self.assertFalse(cli_version_supported("2.0.1"))

    def test_refuses_an_unreadable_version(self) -> None:
        self.assertFalse(cli_version_supported("unknown"))
        self.assertFalse(cli_version_supported(None))


class SchemaTests(unittest.TestCase):
    def test_accepts_the_supported_schema_as_int_or_string(self) -> None:
        self.assertTrue(schema_version_supported(1))
        self.assertTrue(schema_version_supported("1"))
        self.assertTrue(schema_version_supported("v1"))

    def test_refuses_another_schema(self) -> None:
        self.assertFalse(schema_version_supported(2))
        self.assertFalse(schema_version_supported(0))

    def test_refuses_nonsense(self) -> None:
        for raw in (None, "", "one", True):
            with self.subTest(raw=raw):
                self.assertFalse(schema_version_supported(raw))


class MessageTests(unittest.TestCase):
    def test_a_compatible_pair_has_nothing_to_say(self) -> None:
        self.assertIsNone(describe_cli_problem("1.2.0"))
        self.assertIsNone(describe_schema_problem(1))

    def test_the_refusal_names_found_required_and_remedy(self) -> None:
        message = describe_cli_problem("1.1.0")
        assert message is not None
        self.assertIn("1.1.0", message)
        self.assertIn(MINIMUM_CLI_VERSION, message)
        self.assertIn(BELOW_CLI_VERSION, message)
        # An operator who reads only this line must know what to do next.
        self.assertIn("COORDINATION_BIN", message)
        self.assertIn("agentic-project-scaffold-lite", message)

    def test_an_unreadable_version_says_so_rather_than_guessing(self) -> None:
        message = describe_cli_problem("banana")
        assert message is not None
        self.assertIn("cannot read", message)

    def test_the_schema_refusal_points_at_the_database_not_the_cli(self) -> None:
        message = describe_schema_problem(2)
        assert message is not None
        self.assertIn("schema v2", message)
        self.assertIn("Migrate", message)


class VerifyTests(unittest.TestCase):
    def test_a_supported_installation_passes(self) -> None:
        self.assertIsNone(
            verify({"cli_version": "1.2.0", "schema_version": 1}, {"schema_version": 1})
        )

    def test_an_old_cli_is_refused(self) -> None:
        message = verify({"cli_version": "1.1.0"}, {"schema_version": 1})
        assert message is not None
        self.assertIn("1.1.0", message)

    def test_a_future_major_is_refused(self) -> None:
        message = verify({"cli_version": "2.0.0"}, {"schema_version": 1})
        self.assertIsNotNone(message)

    def test_an_unsupported_schema_is_refused(self) -> None:
        message = verify({"cli_version": "1.2.0"}, {"schema_version": 2})
        assert message is not None
        self.assertIn("schema", message)

    def test_the_cli_is_reported_before_the_schema(self) -> None:
        # Both wrong: a CLI outside the range is the likelier cause of an
        # unrecognised schema, so leading with the schema sends the operator
        # after the wrong thing.
        message = verify({"cli_version": "0.9.0"}, {"schema_version": 99})
        assert message is not None
        self.assertIn("0.9.0", message)
        self.assertNotIn("Migrate", message)

    def test_doctor_is_authoritative_for_the_served_database(self) -> None:
        # `version` reports what the CLI was built for; `doctor` reports the
        # database actually being served, which is the one that matters.
        message = verify(
            {"cli_version": "1.2.0", "schema_version": 1}, {"schema_version": 2}
        )
        self.assertIsNotNone(message)

    def test_a_missing_version_field_is_refused(self) -> None:
        self.assertIsNotNone(verify({}, {"schema_version": 1}))


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
