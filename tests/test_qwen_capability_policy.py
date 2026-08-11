from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]


class QwenCapabilityPolicyTests(unittest.TestCase):
    def read(self, relative_path: str) -> str:
        return (ROOT / relative_path).read_text(encoding="utf-8")

    def test_loop_requires_capability_discovery_and_verification(self) -> None:
        loop = self.read("LOOP_ENGINEERING.md")
        for phrase in (
            "## Capability discovery and on-demand extensions",
            "qwen-mm-plugins-core",
            "verify",
        ):
            self.assertIn(phrase, loop)

    def test_public_docs_explain_optional_installation_and_provenance(self) -> None:
        readme = self.read("README.md")
        compatibility = self.read("AGENT_COMPATIBILITY.md")
        design = self.read("LOOP_SYSTEM_DESIGN.md")
        notices = self.read("THIRD_PARTY_NOTICES.md")

        self.assertIn("## Optional multimodal capabilities", readme)
        self.assertIn("No API key is used by default", readme)
        for variable in ("DASHSCOPE_API_KEY", "SERPER_API_KEY", "SAM3_SERVER_URL"):
            self.assertIn(variable, readme)
        self.assertIn("task-scoped", compatibility)
        self.assertIn("Qwen-MM-Plugins", design)
        self.assertIn("Qwen-MM-Plugins", notices)
        self.assertIn("Apache-2.0", notices)

    def test_docs_do_not_assign_api_key_values(self) -> None:
        documents = "\n".join(
            self.read(path)
            for path in (
                "LOOP_ENGINEERING.md",
                "README.md",
                "AGENT_COMPATIBILITY.md",
                "LOOP_SYSTEM_DESIGN.md",
                "THIRD_PARTY_NOTICES.md",
            )
        )
        self.assertIsNone(
            re.search(r"(?:DASHSCOPE|SERPER)_API_KEY\s*=\s*[^<$\{\s][^\n]*", documents)
        )


if __name__ == "__main__":
    unittest.main()
