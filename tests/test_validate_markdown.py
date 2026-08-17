from pathlib import Path
import tempfile
import unittest

from scripts.validate_loop_system import _valid_fixture
from scripts.validate_markdown import ValidationError, validate_repository


class MarkdownValidationTests(unittest.TestCase):
    def test_accepts_current_repository(self) -> None:
        validate_repository(Path.cwd())

    def test_rejects_an_unclosed_code_fence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _valid_fixture(root)
            path = root / "LOOP_ENGINEERING.md"
            path.write_text(path.read_text(encoding="utf-8") + "\n```\n", encoding="utf-8")

            with self.assertRaisesRegex(ValidationError, "unclosed code fence"):
                validate_repository(root)

    def test_rejects_a_missing_relative_link(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _valid_fixture(root)
            path = root / "LOOP_ENGINEERING.md"
            path.write_text(
                path.read_text(encoding="utf-8") + "\n[Missing](./missing.md)\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValidationError, "missing relative link target"):
                validate_repository(root)

    def test_rejects_missing_guide_registry(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _valid_fixture(root)
            (root / "src" / "config" / "guides.json").unlink()
            with self.assertRaisesRegex(ValidationError, "missing canonical guide registry"):
                validate_repository(root)

    def test_rejects_unregistered_guide_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _valid_fixture(root)
            orphan = root / "ENG" / "orphan-eng.md"
            orphan.write_text(
                "---\n"
                "name: orphan-eng\n"
                "language: en\n"
                'description: "Fixture guide."\n'
                'version: "2026.09"\n'
                'last-reviewed: "2026-08-17"\n'
                "guide-id: orphan\n"
                "---\n"
                "# Guide\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValidationError, "unregistered guide files"):
                validate_repository(root)


if __name__ == "__main__":
    unittest.main()
