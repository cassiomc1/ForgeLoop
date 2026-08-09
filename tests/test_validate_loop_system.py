from pathlib import Path
import tempfile
import unittest

from scripts.validate_loop_system import (
    ValidationError,
    _valid_fixture,
    validate_repository,
)


class LoopSystemValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.addCleanup(self.temporary_directory.cleanup)
        _valid_fixture(self.root)

    def test_accepts_valid_fixture(self) -> None:
        validate_repository(self.root)

    def test_rejects_unknown_guide_id_in_additional_route(self) -> None:
        router = self.root / "GUIDE_ROUTER.md"
        router.write_text(
            router.read_text(encoding="utf-8")
            + "<!-- route:extra=clean,unknown-guide -->\n",
            encoding="utf-8",
        )

        with self.assertRaisesRegex(ValidationError, "unknown IDs"):
            validate_repository(self.root)

    def test_rejects_unclosed_guide_frontmatter_quote(self) -> None:
        guide = self.root / "ENG/clean-code-eng.md"
        guide.write_text(
            "---\n"
            "name: clean-code-eng\n"
            "language: en\n"
            'description: "Unclosed description.\n'
            'version: "2026.08"\n'
            'last-reviewed: "2026-08-08"\n'
            "---\n"
            "# Guide\n",
            encoding="utf-8",
        )

        with self.assertRaisesRegex(ValidationError, "invalid double-quoted scalar"):
            validate_repository(self.root)


if __name__ == "__main__":
    unittest.main()
