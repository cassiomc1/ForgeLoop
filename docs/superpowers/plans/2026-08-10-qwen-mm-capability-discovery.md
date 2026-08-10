# Qwen-MM-Plugins Capability Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach agents following the portable loop to detect missing multimodal capabilities, install the smallest required Qwen-MM-Plugins capability on demand, verify it, and use it while keeping API-backed features opt-in.

**Architecture:** Keep the behavior in the canonical `LOOP_ENGINEERING.md` contract so every native and compatible adapter inherits it. Explain adoption and configuration in `README.md`, record compatibility and system boundaries in the architecture documents, and record upstream provenance without bundling Qwen code. Add one focused documentation regression test; do not add runtime code or an npm dependency.

**Tech Stack:** English Markdown; Python 3 standard-library unittest and validators; Node.js test runner; existing package and secret-scan checks.

## Global Constraints

- Preserve the repository's English-only content and current source-kit `PROJECT_PROFILE.md` template state.
- Install only the smallest Qwen capability required by the current task; do not install Qwen or system tools during `mdfiles init`, `update`, or `doctor`.
- Use keyless multimodal reading by default; document `DASHSCOPE_API_KEY`, `SERPER_API_KEY`, `SAM3_SERVER_URL`, and system dependencies without storing values.
- Use the official Qwen repository as the source for current capability names, harness commands, dependencies, and Windows/WSL limits.
- Keep credentials outside Git, `PROJECT_PROFILE.md`, copied instruction files, and examples.
- Do not add an npm dependency, MCP server, model runtime, generated asset, workflow, or external publication.
- Preserve the approved design in `docs/superpowers/specs/2026-08-10-qwen-mm-capability-discovery-design.md`.

---

### Task 1: Add a documentation regression contract

**Files:**

- Create: `tests/test_qwen_capability_policy.py`
- Read: `LOOP_ENGINEERING.md`, `README.md`, `AGENT_COMPATIBILITY.md`, `LOOP_SYSTEM_DESIGN.md`, `THIRD_PARTY_NOTICES.md`

**Interfaces:**

- Consumes: the approved design specification and the repository's Markdown/secret-validation conventions.
- Produces: a focused unittest that fails until the canonical Qwen capability policy, API boundary, and provenance notice are present, while rejecting inline API-key assignments.

- [ ] **Step 1: Write the failing test**

Create `tests/test_qwen_capability_policy.py` with this behavior:

```python
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
            re.search(r"(?:DASHSCOPE|SERPER)_API_KEY\\s*=\\s*[^<$\\{\\s][^\\n]*", documents)
        )


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
python3 -m unittest tests.test_qwen_capability_policy -v
```

Expected: failure because the new canonical heading and public documentation
contract do not yet exist; no test collection error is acceptable.

- [ ] **Step 3: Keep the test scoped to the documented contract**

Confirm that the test checks observable policy text and secret boundaries, not
an implementation-specific Qwen command or a live external service. Do not add
fake credentials or network calls to the test.

---

### Task 2: Implement the canonical capability-discovery contract

**Files:**

- Modify: `LOOP_ENGINEERING.md`
- Modify: `AGENT_COMPATIBILITY.md`
- Modify: `LOOP_SYSTEM_DESIGN.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `.cursor/rules/project-loop.mdc`
- Modify: `.github/copilot-instructions.md`

**Interfaces:**

- Consumes: Task 1's failing documentation contract and the approved design.
- Produces: a shared instruction that every supported agent can follow to inspect native capability, install the smallest missing Qwen capability, verify registration, and stop safely when API or system prerequisites are absent.

- [ ] **Step 1: Add the loop section after project discovery**

Insert `## Capability discovery and on-demand extensions` between `Project
discovery` and `Guide selection` in `LOOP_ENGINEERING.md`. The section must
state this exact sequence in operational language:

1. Classify the task's required media or tool capability.
2. Inspect the active model/harness for native support, registered skills,
   MCP servers, and callable tools.
3. Reuse an existing callable capability when sufficient.
4. Install only the smallest missing keyless Qwen capability, normally
   `qwen-mm-plugins-core` for multimodal reading.
5. For API-backed operations, require the configured key or endpoint before
   enabling them; otherwise continue with keyless support or report the
   prerequisite.
6. Verify registration and dependencies with the harness and upstream plugin
   checks.
7. Use the callable tool and report limitations instead of claiming success
   from a package name alone.

Make clear that installation is task-scoped, not startup-wide; API keys are
never created or guessed; system-level package installation remains subject to
host controls; and a harness without callable skill/MCP support cannot claim
the capability.

- [ ] **Step 2: Document the compatibility boundary**

Add a short `## Optional capability extensions` section to
`AGENT_COMPATIBILITY.md` after the introductory paragraph. State that the
package still does not run a model or provider, but the installed loop directs
the active agent to use its native plugin mechanism or the official Qwen
installer when a task-scoped capability is missing. State that live model and
external installation behavior remains outside `npm test`.

- [ ] **Step 3: Update the system design without duplicating the loop**

In `LOOP_SYSTEM_DESIGN.md`:

- add a primary decision that Qwen-MM-Plugins is an optional, on-demand
  capability extension and not a package/runtime dependency;
- add a `Capability extensions` component subsection describing discovery,
  minimal installation, prerequisite checks, verification, and use;
- add the extension to the `LOOP_ENGINEERING.md` responsibility list;
- revise the out-of-scope wording from blanket automatic tool installation to
  “automatic installation of unrelated tools or provider runtimes,” while
  preserving the task-scoped Qwen exception and host approval boundary.

Do not add Qwen commands to adapters or create a second capability guide.

- [ ] **Step 4: Align the thin adapter boundaries**

In each of `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/project-loop.mdc`, and
`.github/copilot-instructions.md`, replace the blanket prohibition on automatic
installation with a narrow boundary: unrelated software, credentials, and
external changes remain gated, while task-scoped installation of the smallest
missing Qwen-MM-Plugins capability follows `LOOP_ENGINEERING.md`. Do not add
provider commands or duplicate the capability procedure in an adapter.

- [ ] **Step 5: Run the loop contract test to verify GREEN**

Run:

```bash
python3 -m unittest tests.test_qwen_capability_policy.QwenCapabilityPolicyTests.test_loop_requires_capability_discovery_and_verification -v
```

Expected: the loop contract test passes with no warnings or collection errors;
the public-docs assertions remain pending until Task 3.

- [ ] **Step 6: Commit the canonical contract**

```bash
git diff --check
git add LOOP_ENGINEERING.md AGENT_COMPATIBILITY.md LOOP_SYSTEM_DESIGN.md AGENTS.md CLAUDE.md .cursor/rules/project-loop.mdc .github/copilot-instructions.md tests/test_qwen_capability_policy.py
git diff --cached --check
git commit -m "docs: add qwen capability discovery contract"
```

---

### Task 3: Document setup, API prerequisites, and provenance

**Files:**

- Modify: `README.md`
- Modify: `THIRD_PARTY_NOTICES.md`

**Interfaces:**

- Consumes: Task 2's canonical policy and the official Qwen README and detailed installation guide.
- Produces: adopter-facing documentation that defaults to keyless use, names every optional credential/service prerequisite, and records that the upstream project is linked rather than bundled.

- [ ] **Step 1: Add the optional multimodal section to README**

Insert `## Optional multimodal capabilities` after `## Tool approval policy`
and before `## HyperFrames for video and motion`. Include:

- a link to `https://github.com/QwenLM/Qwen-MM-Plugins`;
- the rule that the agent checks native/harness capabilities first and installs
  the smallest missing `qwen-mm-plugins-<cap>` capability only when the task
  needs it;
- the explicit sentence `No API key is used by default for native image,
  video, or document reading.`;
- a table that maps `DASHSCOPE_API_KEY` to vision chat/OCR/grounding/audio
  transcription/Omni/generation/video-memory, `SERPER_API_KEY` to web and
  image search, and `SAM3_SERVER_URL` to the optional segmentation service;
- the note that `ffmpeg`, Office/Blender/FreeCAD/browser tools, and other
  system dependencies are prepared only when the chosen capability needs
  them;
- the official configuration boundary: environment variables or
  `~/.qwen-mm-plugins/config`, never Git or `PROJECT_PROFILE.md`;
- the instruction to consult the upstream per-harness installation guide for
  current commands, supported harnesses, and WSL2/native-Windows limits;
- a limitation note that missing credentials or system tools disable only the
  affected optional capability and must be reported.

Do not paste a `curl | bash` installer as a mandatory README command, and do
not present an API-backed operation as part of the default keyless path.

- [ ] **Step 2: Add the Qwen provenance notice**

Append a `### Qwen-MM-Plugins` subsection to `THIRD_PARTY_NOTICES.md` with:

- the upstream repository link;
- the upstream declared Apache-2.0 license link;
- the use boundary: this repository links to the project as an optional
  capability reference and does not copy, vendor, or relicense its source;
- the operational boundary: verify current upstream terms, dependencies,
  service costs, and harness instructions before installing or redistributing.

- [ ] **Step 3: Run documentation and focused regression checks**

```bash
python3 -m unittest tests.test_qwen_capability_policy -v
python3 scripts/validate_markdown.py
python3 scripts/scan_secrets.py
git diff --check
```

Expected: the focused policy test, Markdown validator, and secret scanner exit
successfully; no API key value is present in the diff.

- [ ] **Step 4: Commit the public documentation**

```bash
git add README.md THIRD_PARTY_NOTICES.md
git diff --cached --check
git commit -m "docs: add qwen multimodal setup guidance"
```

---

### Task 4: Run proportional regression checks and review the final diff

**Files:**

- Read: all changed files and the approved design/plan
- Modify if the baseline scanner reproduces the ignored-artifact false positive: `scripts/scan_secrets.py`
- Test if the scanner fix is required: `tests/test_scan_secrets.py`
- Verify: repository validators, package tests, and package contents

**Interfaces:**

- Consumes: Tasks 1–3's committed changes.
- Produces: evidence that the documentation contract is present, package behavior is unchanged, no secrets were introduced, and the final diff is scoped.

- [ ] **Step 1: Keep secret scanning scoped to maintained files**

If the repository-wide scanner reports a finding only inside the ignored
`.superpowers/` task-artifact tree, add this regression to
`tests/test_scan_secrets.py` before changing the scanner:

```python
def test_skips_internal_superpowers_artifacts(self) -> None:
    self.assertFalse(should_scan_path(Path(".superpowers/sdd/task-report.md")))
```

Run:

```bash
python3 -m unittest tests.test_scan_secrets.SecretScannerTests.test_skips_internal_superpowers_artifacts -v
```

Expected RED: the test fails because `.superpowers` is not yet in
`EXCLUDED_PARTS`. Add only `.superpowers` to that set, rerun the same test, and
expect GREEN. Do not delete or rewrite ignored task artifacts.

- [ ] **Step 2: Run the full repository checks**

```bash
python3 scripts/validate_loop_system.py --self-test
python3 scripts/validate_loop_system.py
python3 scripts/validate_markdown.py --self-test
python3 scripts/validate_markdown.py
python3 -m unittest discover -s tests -v
python3 scripts/scan_secrets.py
npm test
npm run pack:check
git diff --check
```

Expected: every command exits 0; the Python suite reports 28 tests after the
new focused test is added, the Node suite remains green, and package checks
contain no Qwen runtime dependency or unexpected file.

- [ ] **Step 3: Inspect the complete diff and package boundary**

```bash
git status --short --branch
git diff HEAD~2..HEAD --stat
git diff HEAD~2..HEAD -- README.md LOOP_ENGINEERING.md AGENT_COMPATIBILITY.md LOOP_SYSTEM_DESIGN.md THIRD_PARTY_NOTICES.md tests/test_qwen_capability_policy.py
rg -n -i 'qwen|DASHSCOPE_API_KEY|SERPER_API_KEY|SAM3_SERVER_URL|PROJECT_PROFILE|automatic installation' README.md LOOP_ENGINEERING.md AGENT_COMPATIBILITY.md LOOP_SYSTEM_DESIGN.md THIRD_PARTY_NOTICES.md
```

Confirm that only the approved specification/plan commits and the intended
documentation/test changes are present, that adapters and CLI behavior remain
unchanged, and that API names appear only as configuration names without
secret values.

- [ ] **Step 4: Record the final local state**

Report changed files, exact checks and counts, any unavailable optional link
or live-harness verification, and publication state. Do not push, open a PR,
or merge unless separately requested.
