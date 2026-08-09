from pathlib import Path
import tempfile
import unittest

from scripts.scan_secrets import (
    format_finding,
    scan_repository,
    scan_text,
    should_scan_path,
)


class SecretScannerTests(unittest.TestCase):
    def assert_detected(self, value: str, rule: str) -> None:
        findings = scan_text(value, Path("fixture.md"))
        self.assertIn(rule, {finding.rule for finding in findings})

    def test_detects_openai_shaped_token(self) -> None:
        candidate = "sk" + "-proj-" + "A" * 32
        self.assert_detected(candidate, "openai-token")

    def test_detects_gitlab_shaped_token(self) -> None:
        candidate = "glpat" + "-" + "A" * 24
        self.assert_detected(candidate, "gitlab-token")

    def test_detects_github_classic_token(self) -> None:
        candidate = "gh" + "p_" + "A" * 36
        self.assert_detected(candidate, "github-token")

    def test_detects_github_fine_grained_token(self) -> None:
        candidate = "github" + "_pat_" + "A" * 40
        self.assert_detected(candidate, "github-token")

    def test_detects_slack_token(self) -> None:
        candidate = "xox" + "b-" + "1234567890-" + "A" * 24
        self.assert_detected(candidate, "slack-token")

    def test_detects_google_api_key(self) -> None:
        candidate = "AI" + "za" + "A" * 35
        self.assert_detected(candidate, "google-api-key")

    def test_detects_aws_access_key(self) -> None:
        candidate = "AK" + "IA" + "A" * 16
        self.assert_detected(candidate, "aws-access-key")

    def test_detects_jwt_like_value(self) -> None:
        candidate = ".".join(("eyJ" + "A" * 18, "eyJ" + "B" * 24, "C" * 32))
        self.assert_detected(candidate, "jwt-token")

    def test_detects_private_key_header(self) -> None:
        value = "-----BEGIN " + "PRIVATE KEY-----"
        self.assert_detected(value, "private-key")

    def test_detects_sensitive_assignment(self) -> None:
        assignment = "pass" + "word = live-value-that-must-not-be-committed"
        self.assert_detected(
            assignment,
            "sensitive-assignment",
        )

    def test_detects_sensitive_markdown_table_value(self) -> None:
        table_row = "| API " + "token | live-value-that-must-not-be-committed | vault |"
        self.assert_detected(
            table_row,
            "sensitive-table-value",
        )

    def test_accepts_safe_placeholders(self) -> None:
        text = "\n".join(
            (
                "token = <from-environment>",
                "| API key | not identified | source not identified |",
                "password: ${APP_PASSWORD}",
                "secret = REDACTED",
                "credential = ********",
                "private_key = unknown",
            )
        )
        self.assertEqual([], scan_text(text, Path("fixture.md")))

    def test_accepts_documentation_link_with_sensitive_word_in_title(self) -> None:
        text = "- OWASP Password Storage: https://example.com/password-storage"
        self.assertEqual([], scan_text(text, Path("fixture.md")))

    def test_diagnostic_does_not_reveal_candidate(self) -> None:
        candidate = "sk" + "-proj-" + "Z" * 32
        finding = scan_text(candidate, Path("docs/example.md"))[0]
        diagnostic = format_finding(finding)
        self.assertNotIn(candidate, diagnostic)
        self.assertEqual(
            "docs/example.md:1: secret-like value detected [openai-token]",
            diagnostic,
        )

    def test_skips_cache_and_binary_paths(self) -> None:
        self.assertFalse(should_scan_path(Path(".git/config")))
        self.assertFalse(should_scan_path(Path(".worktrees/feature/README.md")))
        self.assertFalse(should_scan_path(Path("scripts/__pycache__/module.pyc")))
        self.assertFalse(should_scan_path(Path("assets/logo.png")))
        self.assertTrue(should_scan_path(Path("PROJECT_PROFILE.md")))

    def test_scans_common_secret_file_names_and_suffixes(self) -> None:
        for path in (
            Path(".env"),
            Path(".env.local"),
            Path("config/.env.production"),
            Path("certificates/server.pem"),
            Path("certificates/server.key"),
        ):
            with self.subTest(path=path):
                self.assertTrue(should_scan_path(path))

    def test_detects_tokens_and_private_keys_in_common_secret_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / ".env").write_text(
                "OPENAI_API_KEY=sk-proj-" + "A" * 32 + "\n",
                encoding="utf-8",
            )
            (root / "server.pem").write_text(
                "-----BEGIN " + "PRIVATE KEY-----\n",
                encoding="utf-8",
            )

            rules = {finding.rule for finding in scan_repository(root)}

        self.assertIn("openai-token", rules)
        self.assertIn("private-key", rules)


if __name__ == "__main__":
    unittest.main()
