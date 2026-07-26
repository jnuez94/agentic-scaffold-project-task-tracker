"""StaticFileResolver."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from coordination_ui.web import StaticFileResolver


class StaticFileResolverTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name).resolve()
        (self.root / "index.html").write_text("<!doctype html>home\n", encoding="utf-8")
        (self.root / "app.js").write_text("export const a = 1;\n", encoding="utf-8")
        (self.root / "assets").mkdir()
        (self.root / "assets" / "style.css").write_text("body{}\n", encoding="utf-8")
        (self.root.parent / "outside.txt").write_text("secret\n", encoding="utf-8")
        self.resolver = StaticFileResolver(self.root)

    def test_root_serves_the_default_document(self) -> None:
        self.assertEqual(self.resolver.resolve("/"), self.root / "index.html")

    def test_empty_path_serves_the_default_document(self) -> None:
        self.assertEqual(self.resolver.resolve(""), self.root / "index.html")

    def test_resolves_a_nested_asset(self) -> None:
        self.assertEqual(
            self.resolver.resolve("/assets/style.css"), self.root / "assets" / "style.css"
        )

    def test_rejects_parent_traversal(self) -> None:
        self.assertIsNone(self.resolver.resolve("/../outside.txt"))

    def test_rejects_deep_traversal(self) -> None:
        self.assertIsNone(self.resolver.resolve("/assets/../../outside.txt"))

    def test_absolute_looking_path_stays_inside_the_root(self) -> None:
        # Leading slashes are stripped, so "//etc/passwd" addresses a file
        # under the static root rather than the system one.
        resolved = self.resolver.resolve("//etc/passwd")
        self.assertEqual(resolved, self.root / "etc" / "passwd")
        self.assertIsNone(self.resolver.read("//etc/passwd"))

    def test_rejects_a_symlink_escaping_the_root(self) -> None:
        link = self.root / "escape.txt"
        link.symlink_to(self.root.parent / "outside.txt")
        self.assertIsNone(self.resolver.resolve("/escape.txt"))

    def test_read_returns_body_and_content_type(self) -> None:
        found = self.resolver.read("/index.html")
        assert found is not None
        body, content_type = found
        self.assertEqual(body, b"<!doctype html>home\n")
        self.assertEqual(content_type, "text/html")

    def test_javascript_content_type(self) -> None:
        found = self.resolver.read("/app.js")
        assert found is not None
        self.assertIn("javascript", found[1])

    def test_css_content_type(self) -> None:
        found = self.resolver.read("/assets/style.css")
        assert found is not None
        self.assertEqual(found[1], "text/css")

    def test_unknown_extension_falls_back_to_octet_stream(self) -> None:
        (self.root / "blob.unknownext").write_bytes(b"\x00\x01")
        found = self.resolver.read("/blob.unknownext")
        assert found is not None
        self.assertEqual(found[1], "application/octet-stream")

    def test_read_returns_none_for_a_missing_file(self) -> None:
        self.assertIsNone(self.resolver.read("/absent.html"))

    def test_read_returns_none_for_a_directory(self) -> None:
        self.assertIsNone(self.resolver.read("/assets"))

    def test_read_returns_none_for_traversal(self) -> None:
        self.assertIsNone(self.resolver.read("/../outside.txt"))


if __name__ == "__main__":
    unittest.main()
