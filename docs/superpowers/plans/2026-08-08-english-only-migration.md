# English-Only Repository Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current repository tree into an English-only instruction
kit, close the documented secret-detection gap, require third-party notices, and
remove implicit tool installation while preserving Git history and the existing
English guide paths.

**Architecture:** Keep the eight canonical guides under `ENG/`, replace paired
guide metadata with a single-language catalog, and keep structural, language,
and secret validation as separate Python responsibilities. Root documentation
and thin agent adapters become English-only; CI composes the validators without
changing the external Gatling link check.

**Tech Stack:** Markdown, Python 3 standard library, GitHub Actions,
markdownlint-cli2.

## Global Constraints

- Preserve Git history; do not rewrite existing commits.
- Keep all eight `ENG/*-eng.md` paths unchanged.
- Delete `PT-BR/` from the current tree.
- Do not fix, suppress, or otherwise change the Gatling link-check failure.
- Do not publish, push, or open a pull request without a separate request.
- Keep `version: "2026.08"` and `last-reviewed: "2026-08-08"` in every guide.
- Require explicit approval before any local command downloads the Markdown
  linter.
- Never print a complete candidate secret in validation output.

---

## File Map

### New files

- `scripts/scan_secrets.py`: detect secret-shaped values in repository text and
  Markdown table fields without revealing candidates.
- `scripts/validate_english_only.py`: enforce the single-language tree and scan
  maintained text for Portuguese operational prose.
- `tests/__init__.py`: make the standard-library test suite importable by module
  name.
- `tests/test_scan_secrets.py`: regression tests for secret formats,
  assignments, table cells, placeholders, and redacted diagnostics.
- `tests/test_validate_english_only.py`: regression tests for tree shape,
  frontmatter, route identifiers, and language scanning.

### Modified files

- `scripts/validate_loop_system.py`: use an eight-guide English catalog, require
  third-party notices, accept only `language: en`, and use English route IDs.
- `.github/workflows/docs-quality.yml`: validate eight English guides, remove
  counterpart logic, invoke the new validators, and translate remaining
  comments/fixtures.
- `ENG/*.md`: remove `counterpart` metadata and translate the one remaining
  Portuguese code comment.
- `README.md`: become English-only, document the eight-guide catalog, safe lint
  workflow, portable file set, and maintenance commands.
- `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`,
  `.cursor/rules/project-loop.mdc`: become English-only thin adapters.
- `GUIDE_ROUTER.md`: use only English paths/content and English scenario IDs.
- `LOOP_ENGINEERING.md`, `LOOP_SYSTEM_DESIGN.md`, `PROJECT_PROFILE.md`: become
  English-only canonical operational documents.
- `THIRD_PARTY_NOTICES.md`: become English-only and remain the provenance source.
- `.lychee.toml`, `.markdownlint-cli2.jsonc`: translate comments only.
- `.gitignore`: ignore Python test caches if the new test invocation creates
  them.

### Deleted files

- `PT-BR/acessibilidade-code-pt.md`
- `PT-BR/clean-code-pt.md`
- `PT-BR/design-code-pt.md`
- `PT-BR/games-code-design-web-pt.md`
- `PT-BR/perf-code-pt.md`
- `PT-BR/premium-sites-studio-pt.md`
- `PT-BR/sec-code-pt.md`
- `PT-BR/test-code-pt.md`

---

### Task 1: Convert the Loop Validator Contract to English Only

**Files:**

- Modify: `scripts/validate_loop_system.py`

**Interfaces:**

- Consumes: repository root supplied through `--root` or `Path.cwd()`.
- Produces: `GUIDES: dict[str, str]`, English route markers, validation of the
  portable file set, and a zero/non-zero CLI exit status.

- [ ] **Step 1: Change self-test fixtures before production constants**

Change `_valid_fixture()` to create only these guide paths:

```python
guides = {
    "premium": "ENG/premium-sites-studio-eng.md",
    "clean": "ENG/clean-code-eng.md",
    "test": "ENG/test-code-eng.md",
    "security": "ENG/sec-code-eng.md",
    "design": "ENG/design-code-eng.md",
    "performance": "ENG/perf-code-eng.md",
    "accessibility": "ENG/accessibility-eng.md",
    "games": "ENG/games-code-design-web-eng.md",
}
```

The fixture profile must use `language: en`, the fixture must create
`THIRD_PARTY_NOTICES.md`, and route markers must use `bug-without-ui` and
`documentation`.

- [ ] **Step 2: Add failing self-test cases**

Add cases that expect rejection when:

```python
(root / "THIRD_PARTY_NOTICES.md").unlink()
_expect_invalid(root, "missing required file")
```

```python
profile = (root / "PROJECT_PROFILE.md").read_text(encoding="utf-8")
_write(root / "PROJECT_PROFILE.md", profile.replace("language: en", "language: pt-BR"))
_expect_invalid(root, "language must be one of")
```

```python
(root / "PT-BR").mkdir()
_write(root / "PT-BR/legacy.md", "# Legacy\n")
_expect_invalid(root, "Portuguese guide tree is forbidden")
```

Also update the missing-route case to remove
`<!-- route:documentation=domain -->`.

- [ ] **Step 3: Run the self-tests and verify RED**

Run:

```bash
python3 scripts/validate_loop_system.py --self-test
```

Expected: failure because production constants and validation still require
bilingual pairs and accept the old profile/route contract.

- [ ] **Step 4: Implement the English-only production contract**

Replace `GUIDE_PAIRS` with:

```python
GUIDES = {
    "premium": "ENG/premium-sites-studio-eng.md",
    "clean": "ENG/clean-code-eng.md",
    "test": "ENG/test-code-eng.md",
    "security": "ENG/sec-code-eng.md",
    "design": "ENG/design-code-eng.md",
    "performance": "ENG/perf-code-eng.md",
    "accessibility": "ENG/accessibility-eng.md",
    "games": "ENG/games-code-design-web-eng.md",
}
```

Add `THIRD_PARTY_NOTICES.md` to `REQUIRED_FILES`, make `language` accept only
`en`, reject an existing `PT-BR/` directory, and rename the two route scenario
keys. `validate_router()` must verify one path per guide ID instead of a pair.
Remove secret-pattern logic from `validate_profile()` because Task 2 gives that
responsibility to the dedicated scanner.

- [ ] **Step 5: Run loop self-tests and verify GREEN**

Run:

```bash
python3 scripts/validate_loop_system.py --self-test
```

Expected: all loop self-tests pass and report the new total case count.

- [ ] **Step 6: Commit the isolated validator contract**

```bash
git add scripts/validate_loop_system.py
git commit -m "refactor: validate English-only guide catalog"
```

---

### Task 2: Add Dedicated Secret Detection

**Files:**

- Create: `scripts/scan_secrets.py`
- Create: `tests/__init__.py`
- Create: `tests/test_scan_secrets.py`
- Modify: `.gitignore`

**Interfaces:**

- Produces: `Finding(rule: str, path: Path, line: int)`,
  `scan_text(text: str, path: Path) -> list[Finding]`, and
  `scan_repository(root: Path) -> list[Finding]`.
- CLI: `python3 scripts/scan_secrets.py [--root PATH]`; exit `1` when findings
  exist and never print candidate values.

- [ ] **Step 1: Write the scanner tests first**

Create `tests/test_scan_secrets.py` with `unittest` cases that construct token
prefixes from fragments so the repository scan does not flag its own fixtures:

```python
from pathlib import Path
import unittest

from scripts.scan_secrets import scan_text


class SecretScannerTests(unittest.TestCase):
    def assert_detected(self, value: str, rule: str) -> None:
        findings = scan_text(value, Path("fixture.md"))
        self.assertIn(rule, {finding.rule for finding in findings})

    def test_detects_openai_shaped_token(self) -> None:
        self.assert_detected("sk" + "-proj-" + "A" * 32, "openai-token")

    def test_detects_gitlab_shaped_token(self) -> None:
        self.assert_detected("glpat" + "-" + "A" * 24, "gitlab-token")

    def test_detects_sensitive_markdown_table_value(self) -> None:
        self.assert_detected(
            "| API token | live-value-that-must-not-be-committed | vault |",
            "sensitive-table-value",
        )

    def test_accepts_safe_placeholders(self) -> None:
        text = "\n".join(
            (
                "token = <from-environment>",
                "| API key | not identified | source not identified |",
                "password: ${APP_PASSWORD}",
                "secret = REDACTED",
            )
        )
        self.assertEqual([], scan_text(text, Path("fixture.md")))
```

Add equivalent cases for AWS, GitHub classic/fine-grained, Slack, Google, a
JWT-like value, private-key header, plain assignments, diagnostics that omit the
candidate, and ignored binary/cache paths.

- [ ] **Step 2: Run scanner tests and verify RED**

Run:

```bash
python3 -m unittest tests.test_scan_secrets -v
```

Expected: import failure because `scripts/scan_secrets.py` does not exist.

- [ ] **Step 3: Implement scanner patterns and placeholder handling**

Use a frozen dataclass and named patterns:

```python
@dataclass(frozen=True)
class Finding:
    rule: str
    path: Path
    line: int
```

Pattern matching must cover the families listed in the approved specification.
`scan_text()` checks both regex token families and line-oriented assignments or
Markdown table cells. `is_placeholder()` accepts only the documented safe
values. The CLI prints diagnostics in this form:

```text
relative/path.md:42: secret-like value detected [openai-token]
```

- [ ] **Step 4: Run scanner tests and verify GREEN**

Run:

```bash
python3 -m unittest tests.test_scan_secrets -v
```

Expected: all scanner tests pass.

- [ ] **Step 5: Scan the current repository**

Run:

```bash
python3 scripts/scan_secrets.py
```

Expected: exit `0` with a concise scanned-file count. If it finds a real
candidate, inspect the source and either remove the value or narrow a false
positive with a test-backed placeholder rule; never blanket-exclude the file.

- [ ] **Step 6: Commit the secret scanner**

```bash
git add .gitignore scripts/scan_secrets.py tests/test_scan_secrets.py
git commit -m "feat: detect secrets in project documentation"
```

---

### Task 3: Add the English-Only Repository Validator

**Files:**

- Create: `scripts/validate_english_only.py`
- Create: `tests/test_validate_english_only.py`

**Interfaces:**

- Produces: `validate_repository(root: Path) -> None` and a CLI with `--root`.
- Enforces: no `PT-BR/` tree, exactly eight canonical English guides, exact
  frontmatter keys, English route IDs, and no known Portuguese operational
  prose in maintained current-tree text.

- [ ] **Step 1: Write repository-language tests first**

Create temporary fixtures in `tests/test_validate_english_only.py` and assert:

```python
def test_rejects_portuguese_tree(self):
    root = self.valid_fixture()
    (root / "PT-BR").mkdir()
    self.assert_invalid(root, "PT-BR directory is forbidden")

def test_rejects_counterpart_metadata(self):
    root = self.valid_fixture()
    guide = root / "ENG/clean-code-eng.md"
    guide.write_text(
        guide.read_text(encoding="utf-8").replace(
            "language: en\n", "language: en\ncounterpart: ../PT-BR/clean-code-pt.md\n"
        ),
        encoding="utf-8",
    )
    self.assert_invalid(root, "counterpart metadata is forbidden")

def test_rejects_portuguese_operational_text(self):
    root = self.valid_fixture()
    text = "".join(chr(code) for code in (69, 115, 116, 101, 32, 112, 114, 111, 106, 101, 116, 111))
    (root / "README.md").write_text(text + "\n", encoding="utf-8")
    self.assert_invalid(root, "Portuguese text detected")
```

Also test acceptance of English prose and the proper name `Felipe A. Carriço`,
which must not be rejected solely because it contains a diacritic.

- [ ] **Step 2: Run language tests and verify RED**

Run:

```bash
python3 -m unittest tests.test_validate_english_only -v
```

Expected: import failure because `scripts/validate_english_only.py` does not
exist.

- [ ] **Step 3: Implement structural and language checks**

The validator must use the same canonical eight paths as the loop validator,
parse only the exact English frontmatter keys, and use word-boundary phrases for
common Portuguese operational text rather than rejecting all non-ASCII names.
Exclude `.git/`, `.worktrees/`, caches, and binary files. Do not exclude root
documentation, adapters, Python source, workflow/config comments, or English
guides.

- [ ] **Step 4: Run language tests and verify GREEN**

Run:

```bash
python3 -m unittest tests.test_validate_english_only -v
```

Expected: all English-only validator tests pass.

- [ ] **Step 5: Commit the validator**

```bash
git add scripts/validate_english_only.py tests/test_validate_english_only.py
git commit -m "feat: enforce English-only repository content"
```

---

### Task 4: Migrate Guides and Canonical Documentation

**Files:**

- Delete: `PT-BR/*.md`
- Modify: `ENG/*.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `.github/copilot-instructions.md`
- Modify: `.cursor/rules/project-loop.mdc`
- Modify: `GUIDE_ROUTER.md`
- Modify: `LOOP_ENGINEERING.md`
- Modify: `LOOP_SYSTEM_DESIGN.md`
- Modify: `PROJECT_PROFILE.md`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `.lychee.toml`
- Modify: `.markdownlint-cli2.jsonc`

**Interfaces:**

- Consumes: the approved English-only catalog and portable-kit contract.
- Produces: English-only maintained prose with unchanged English guide paths.

- [ ] **Step 1: Run the new validator against the bilingual tree and verify RED**

Run:

```bash
python3 scripts/validate_english_only.py
```

Expected: failure identifying `PT-BR/`, bilingual metadata, old routes, and
Portuguese maintained text.

- [ ] **Step 2: Delete the Portuguese guide tree**

Delete exactly the eight tracked files listed in the File Map, then remove the
empty `PT-BR/` directory. Do not remove English guides or rewrite Git history.

- [ ] **Step 3: Update all English guide frontmatter**

Remove `counterpart` from each `ENG/*.md`. Preserve `name`, `language: en`, the
English description, version, review date, technical content, links, and file
names. Translate the JavaScript comment `// inicializar animações` in
`ENG/design-code-eng.md` to `// initialize animations`.

- [ ] **Step 4: Rewrite the README in English**

The README must contain:

- one English introduction and an eight-row catalog linking only to `ENG/`;
- the English-only loop description and flow diagram;
- the portable copy list including `THIRD_PARTY_NOTICES.md` and `ENG/`;
- first-run instructions with `language: en` as the only profile value;
- the tool approval policy;
- a local lint section that runs `markdownlint-cli2` directly and places
  `npx --yes markdownlint-cli2@0.23.2` only after an explicit approval step;
- maintenance commands for loop, language, and secret validators;
- English-only structure, maintenance, rights, and provenance sections.

- [ ] **Step 5: Translate adapters and canonical loop documents**

Preserve the thin-adapter responsibilities and links while translating all
content to English. `GUIDE_ROUTER.md` must link only to `ENG/`, remove language
selection rules, and use `bug-without-ui` and `documentation`. The project
profile must use `language: en`, English table labels, English placeholder
values, and no credential examples. `LOOP_SYSTEM_DESIGN.md` must describe a
single-language catalog and require third-party notices in distribution.

- [ ] **Step 6: Translate notices and configuration comments**

Keep all third-party attributions and reuse boundaries while removing the
Portuguese duplicate text from `THIRD_PARTY_NOTICES.md`. Translate only comments
in `.lychee.toml` and `.markdownlint-cli2.jsonc`; preserve their behavior and do
not add a Gatling exclusion.

- [ ] **Step 7: Run the repository-language validator and fix only scoped findings**

Run:

```bash
python3 scripts/validate_english_only.py
```

Expected: exit `0`, exactly eight canonical guides, no Portuguese tree, no
forbidden metadata, and no Portuguese operational prose.

- [ ] **Step 8: Run documentation checks**

Run:

```bash
npm exec --offline --yes markdownlint-cli2@0.23.2 --
python3 scripts/validate_loop_system.py
python3 scripts/scan_secrets.py
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 9: Commit the English-only content migration**

```bash
git add -A
git commit -m "docs: migrate repository to English only"
```

---

### Task 5: Update CI Structure Validation and Add New Gates

**Files:**

- Modify: `.github/workflows/docs-quality.yml`

**Interfaces:**

- Consumes: exactly eight `ENG/*.md` guides and the three Python validators.
- Produces: Markdown lint, unchanged external link check, guide structure check,
  loop validation, English-only validation, and secret scan.

- [ ] **Step 1: Execute the embedded structure validator before editing and verify RED**

Run:

```bash
sed -n '36,754p' .github/workflows/docs-quality.yml | sed 's/^          //' | bash
```

Expected: failure because the embedded validator still expects 16 bilingual
guides and counterpart metadata.

- [ ] **Step 2: Convert the embedded guide parser to eight English guides**

Change guide discovery to `sorted(root.glob("ENG/*.md"))`, require exactly eight
guides, and require these keys only:

```python
required = {"name", "language", "description", "version", "last-reviewed"}
```

Remove `counterpart` parsing, fixtures, bijection validation, PT/English language
branching, and counterpart summary text. Require `metadata["language"] == "en"`.
Retain fence parsing, Markdown link parsing, containment checks, and their
self-tests.

- [ ] **Step 3: Add the English-only and secret steps without changing Lychee**

Append steps after loop validation:

```yaml
      - name: Validate English-only repository
        run: python3 -m unittest tests.test_validate_english_only -v && python3 scripts/validate_english_only.py

      - name: Scan repository for secrets
        run: python3 -m unittest tests.test_scan_secrets -v && python3 scripts/scan_secrets.py
```

Do not change the Lychee action, `.lychee.toml` behavior, Gatling URL, or accepted
status codes.

- [ ] **Step 4: Run the embedded structure validator and verify GREEN**

Run the exact extraction command from Step 1. Expected output reports eight
English guides and successful frontmatter, fence, and relative-link validation.

- [ ] **Step 5: Run all Python gates together**

```bash
python3 scripts/validate_loop_system.py --self-test
python3 scripts/validate_loop_system.py
python3 -m unittest tests.test_validate_english_only -v
python3 scripts/validate_english_only.py
python3 -m unittest tests.test_scan_secrets -v
python3 scripts/scan_secrets.py
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit CI integration**

```bash
git add .github/workflows/docs-quality.yml
git commit -m "ci: validate English-only documentation"
```

---

### Task 6: Full Regression and Acceptance Verification

**Files:**

- Verify: all changed and deleted files.

**Interfaces:**

- Produces: evidence for every acceptance criterion and an explicit record of
  the intentionally unchanged external link failure.

- [ ] **Step 1: Verify repository state and deletion scope**

```bash
git status --short
test ! -d PT-BR
test "$(find ENG -maxdepth 1 -name '*.md' | wc -l | tr -d ' ')" = "8"
git diff origin/main --name-status
```

Expected: no `PT-BR/`, exactly eight English guides, and only scoped paths in the
diff.

- [ ] **Step 2: Run Markdown and whitespace validation**

```bash
npm exec --offline --yes markdownlint-cli2@0.23.2 --
git diff --check origin/main...HEAD
```

Expected: zero Markdown or whitespace issues.

- [ ] **Step 3: Run structural and security validation**

```bash
python3 scripts/validate_loop_system.py --self-test
python3 scripts/validate_loop_system.py
python3 -m unittest discover -s tests -v
python3 scripts/validate_english_only.py
python3 scripts/scan_secrets.py
python3 -m py_compile scripts/validate_loop_system.py scripts/validate_english_only.py scripts/scan_secrets.py
```

Expected: every command exits `0`; diagnostics contain no secret values.

- [ ] **Step 4: Run the workflow's embedded guide validator**

```bash
start=$(rg -n '^          python3 - <<' .github/workflows/docs-quality.yml | cut -d: -f1)
end=$(rg -n '^          PY$' .github/workflows/docs-quality.yml | tail -1 | cut -d: -f1)
sed -n "${start},${end}p" .github/workflows/docs-quality.yml | sed 's/^          //' | bash
```

Expected: eight English guides and all structural parser self-tests pass.

- [ ] **Step 5: Audit approval and notice requirements directly**

```bash
rg -n 'markdownlint-cli2|approval|THIRD_PARTY_NOTICES' README.md scripts/validate_loop_system.py
rg -n 'PT-BR/|language: pt-BR|^counterpart:' ENG README.md GUIDE_ROUTER.md PROJECT_PROFILE.md || true
```

Expected: README separates installed lint execution from approved download;
third-party notices appear in both distribution and required-file validation;
no English guide or active catalog contains bilingual metadata.

- [ ] **Step 6: Confirm Gatling was not changed**

```bash
git diff origin/main...HEAD -- .lychee.toml ENG/test-code-eng.md | rg -n 'Gatling|gatling' || true
```

Expected: no change to the Gatling URL or link-check treatment. Do not run or
claim the external link check passes; its known `403` remains outside scope.

- [ ] **Step 7: Review commit history and final diff**

```bash
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
git status --short --branch
```

Expected: focused local commits, clean whitespace, and no uncommitted changes.
