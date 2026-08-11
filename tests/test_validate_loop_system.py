import json
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

    def test_requires_protocol_assets(self) -> None:
        (self.root / "QUALITY_SCORECARD.md").unlink()
        with self.assertRaisesRegex(ValidationError, "QUALITY_SCORECARD.md: missing required file"):
            validate_repository(self.root)

    def test_rejects_schema_without_version_property(self) -> None:
        schema = self.root / "schemas/routing-input.schema.json"
        data = json.loads(schema.read_text(encoding="utf-8"))
        del data["properties"]["schemaVersion"]
        schema.write_text(json.dumps(data), encoding="utf-8")

        with self.assertRaisesRegex(ValidationError, "schemaVersion"):
            validate_repository(self.root)

    def test_rejects_missing_loop_invariant_marker(self) -> None:
        loop = self.root / "LOOP_ENGINEERING.md"
        loop.write_text(
            loop.read_text(encoding="utf-8").replace("no route without a reason code;", "", 1),
            encoding="utf-8",
        )

        with self.assertRaisesRegex(ValidationError, "loop invariant"):
            validate_repository(self.root)

    def test_rejects_missing_workflow_phase_name(self) -> None:
        integration = self.root / "ORCHESTRATOR_INTEGRATION.md"
        integration.write_text(
            integration.read_text(encoding="utf-8").replace("- `VERIFYING`\n", "", 1),
            encoding="utf-8",
        )

        with self.assertRaisesRegex(ValidationError, "phase name"):
            validate_repository(self.root)

    def test_rejects_missing_transition_row(self) -> None:
        integration = self.root / "ORCHESTRATOR_INTEGRATION.md"
        integration.write_text(
            integration.read_text(encoding="utf-8").replace(
                "| `VERIFYING` | transition condition | `REVIEWING` |\n",
                "",
                1,
            ),
            encoding="utf-8",
        )

        with self.assertRaisesRegex(ValidationError, "transition"):
            validate_repository(self.root)

    def test_rejects_complete_contract_without_verification_evidence(self) -> None:
        integration = self.root / "ORCHESTRATOR_INTEGRATION.md"
        integration.write_text(
            integration.read_text(encoding="utf-8").replace(
                "COMPLETE requires verification evidence",
                "COMPLETE requires a final response",
                1,
            ),
            encoding="utf-8",
        )

        with self.assertRaisesRegex(ValidationError, "verification evidence"):
            validate_repository(self.root)

    def test_rejects_route_without_reason_code_language(self) -> None:
        router = self.root / "GUIDE_ROUTER.md"
        router.write_text(
            router.read_text(encoding="utf-8").replace(
                "Reason codes are stable outputs.\n",
                "",
                1,
            ),
            encoding="utf-8",
        )

        with self.assertRaisesRegex(ValidationError, "reason code"):
            validate_repository(self.root)

    def test_rejects_prohibited_runtime_terms_in_architecture_contract(self) -> None:
        design = self.root / "LOOP_SYSTEM_DESIGN.md"
        for term in ("src/graph/", "src/llm/", "forgeloop run"):
            with self.subTest(term=term):
                design.write_text(f"# Design\n{term}\n", encoding="utf-8")
                with self.assertRaisesRegex(ValidationError, "prohibited runtime"):
                    validate_repository(self.root)
                design.write_text("# Design\n", encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
