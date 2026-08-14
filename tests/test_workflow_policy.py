from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
ADAPTERS = (
    "AGENTS.md",
    "CLAUDE.md",
    ".cursor/rules/project-loop.mdc",
    ".github/copilot-instructions.md",
)


class WorkflowPolicyTests(unittest.TestCase):
    def read(self, relative_path: str) -> str:
        return (ROOT / relative_path).read_text(encoding="utf-8")

    def test_loop_has_one_canonical_process_gate(self) -> None:
        loop = self.read("LOOP_ENGINEERING.md")
        for marker in (
            "## Design and implementation gates",
            "### Design gate",
            "### Plan contract and task briefs",
            "### Test-first implementation",
            "### Review and recovery",
            "### Worktree and capability degradation",
            "## Instruction and adapter hygiene",
        ):
            self.assertEqual(loop.count(marker), 1, marker)

    def test_loop_contains_required_process_boundaries(self) -> None:
        loop = self.read("LOOP_ENGINEERING.md")
        for phrase in (
            "RED",
            "GREEN",
            "self-review",
            "specification compliance before code quality",
            "load-bearing finding",
            "never invent a tool call",
            "unique marker",
        ):
            self.assertIn(phrase, loop)

    def test_loop_requires_plan_scoped_progress_ledger(self) -> None:
        loop = self.read("LOOP_ENGINEERING.md")
        self.assertIn("ignored ledger scoped to the plan", loop)
        self.assertIn("recovery and resume", loop)
        for status in (
            "`DONE`",
            "`DONE_WITH_CONCERNS`",
            "`NEEDS_CONTEXT`",
            "`BLOCKED`",
        ):
            self.assertIn(status, loop)

    def test_adapters_delegate_without_copied_process_sections(self) -> None:
        for relative_path in ADAPTERS:
            text = self.read(relative_path)
            self.assertLessEqual(len(text.splitlines()), 45, relative_path)
            for marker in (
                "Design and implementation gates",
                "Test-first implementation",
                "Review and recovery",
            ):
                self.assertNotIn(marker, text, f"{relative_path}: {marker}")
            for reference in (
                "LOOP_ENGINEERING.md",
                "PROJECT_PROFILE.md",
                "GUIDE_ROUTER.md",
                "PROTOCOL_INTEGRATION.md",
            ):
                self.assertIn(reference, text, f"{relative_path}: {reference}")

    def test_public_documents_point_to_the_canonical_boundary(self) -> None:
        design = self.read("LOOP_SYSTEM_DESIGN.md")
        protocol = self.read("PROTOCOL_INTEGRATION.md")
        readme = self.read("README.md")
        notices = self.read("THIRD_PARTY_NOTICES.md")
        templates = self.read("src/core/templates.js")

        self.assertIn("process gates", design)
        self.assertIn("CONFORMANCE_VERIFIED", protocol)
        self.assertIn("LOOP_ENGINEERING.md", readme)
        self.assertIn("### Superpowers", notices)
        self.assertIn("MIT", notices)
        self.assertIn("not a dependency", notices)
        self.assertNotIn("superpowers", templates.lower())

    def test_graph_readiness_contract_has_one_non_runtime_boundary(self) -> None:
        integration = self.read("ORCHESTRATOR_INTEGRATION.md")
        design = self.read("LOOP_SYSTEM_DESIGN.md")

        self.assertEqual(integration.count("## Canonical workflow diagram"), 1)
        self.assertIn("## Phase names", integration)
        self.assertIn("## Canonical transition table", integration)
        self.assertIn("## State invariants", integration)
        self.assertIn("does not provide a graph runtime", integration)
        self.assertNotIn("src/graph/", design)
        self.assertNotIn("src/llm/", design)
        self.assertNotIn("forgeloop run", integration)


if __name__ == "__main__":
    unittest.main()
