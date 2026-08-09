from pathlib import Path
import tempfile
import unittest

from scripts.validate_english_only import ValidationError, validate_repository


GUIDES = (
    "accessibility-eng.md",
    "clean-code-eng.md",
    "design-code-eng.md",
    "games-code-design-web-eng.md",
    "perf-code-eng.md",
    "premium-sites-studio-eng.md",
    "sec-code-eng.md",
    "test-code-eng.md",
)


class EnglishOnlyRepositoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.addCleanup(self.temporary_directory.cleanup)
        self.write_valid_fixture()

    def write_valid_fixture(self) -> None:
        for filename in GUIDES:
            name = Path(filename).stem
            self.write(
                f"ENG/{filename}",
                "---\n"
                f"name: {name}\n"
                "language: en\n"
                'description: "English guide."\n'
                'version: "2026.08"\n'
                'last-reviewed: "2026-08-08"\n'
                "---\n"
                "# English guide\n",
            )

        self.write(
            "GUIDE_ROUTER.md",
            "# Guide Router\n"
            "<!-- route:bug-without-ui=clean,test -->\n"
            "<!-- route:documentation=domain -->\n",
        )
        self.write("README.md", "# English instruction guides\n")

    def write(self, relative: str, text: str) -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def assert_invalid(self, expected_fragment: str) -> None:
        with self.assertRaisesRegex(ValidationError, expected_fragment):
            validate_repository(self.root)

    def test_accepts_valid_english_repository(self) -> None:
        validate_repository(self.root)

    def test_rejects_portuguese_tree(self) -> None:
        self.write("PT-BR/legacy.md", "# Legacy\n")
        self.assert_invalid("PT-BR directory is forbidden")

    def test_rejects_counterpart_metadata(self) -> None:
        guide = self.root / "ENG/clean-code-eng.md"
        guide.write_text(
            guide.read_text(encoding="utf-8").replace(
                "language: en\n",
                "language: en\ncounterpart: ../PT-BR/clean-code-pt.md\n",
            ),
            encoding="utf-8",
        )
        self.assert_invalid("counterpart metadata is forbidden")

    def test_rejects_non_english_guide_metadata(self) -> None:
        guide = self.root / "ENG/clean-code-eng.md"
        guide.write_text(
            guide.read_text(encoding="utf-8").replace(
                "language: en",
                "language: pt-BR",
            ),
            encoding="utf-8",
        )
        self.assert_invalid("language must be en")

    def test_rejects_missing_canonical_guide(self) -> None:
        (self.root / "ENG/accessibility-eng.md").unlink()
        self.assert_invalid("English guide set differs from canonical catalog")

    def test_rejects_legacy_route_identifiers(self) -> None:
        router = self.root / "GUIDE_ROUTER.md"
        router.write_text(
            router.read_text(encoding="utf-8").replace(
                "bug-without-ui",
                "bug-sem-interface",
            ),
            encoding="utf-8",
        )
        self.assert_invalid("legacy Portuguese route identifier")

    def test_rejects_portuguese_operational_text(self) -> None:
        text = "".join(
            chr(code)
            for code in (69, 115, 116, 101, 32, 112, 114, 111, 106, 101, 116, 111)
        )
        self.write("README.md", text + "\n")
        self.assert_invalid("Portuguese text detected")

    def test_accepts_proper_names_with_diacritics(self) -> None:
        self.write("README.md", "Adapted from Felipe A. Carriço.\n")
        validate_repository(self.root)

    def test_accepts_legacy_filename_inside_inline_code(self) -> None:
        self.write("README.md", "Historical path: `acessibilidade-code-pt.md`.\n")
        validate_repository(self.root)


if __name__ == "__main__":
    unittest.main()
