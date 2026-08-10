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
            ):
                self.assertIn(reference, text, f"{relative_path}: {reference}")

    def test_public_documents_point_to_the_canonical_boundary(self) -> None:
        design = self.read("LOOP_SYSTEM_DESIGN.md")
        compatibility = self.read("AGENT_COMPATIBILITY.md")
        readme = self.read("README.md")
        notices = self.read("THIRD_PARTY_NOTICES.md")
        templates = self.read("src/core/templates.js")

        self.assertIn("process gates", design)
        self.assertIn("not proof of a callable", compatibility)
        self.assertIn("LOOP_ENGINEERING.md", readme)
        self.assertIn("### Superpowers", notices)
        self.assertIn("MIT", notices)
        self.assertIn("not a dependency", notices)
        self.assertNotIn("superpowers", templates.lower())


if __name__ == "__main__":
    unittest.main()
