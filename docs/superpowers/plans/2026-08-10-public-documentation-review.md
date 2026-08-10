# Public Documentation Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct evidence-backed inconsistencies in the published README, eight English guides, and third-party notices without broadening the documentation scope or publishing the result.

**Architecture:** Use `origin/main` as the only content baseline in an isolated worktree. Keep the README as the repository orientation layer, the eight `ENG/*.md` files as domain sources, and `THIRD_PARTY_NOTICES.md` as the provenance boundary. Apply small edits by responsibility, then validate the complete documentation set and inspect the final diff against `origin/main`.

**Tech Stack:** English Markdown; Python 3 standard-library validators; Node.js test runner; existing Markdownlint and Lychee configuration when those tools are already installed.

## Global Constraints

- Review only `README.md`, every file in `ENG/*.md`, and `THIRD_PARTY_NOTICES.md`.
- Use `origin/main` as the baseline because it contains the latest merged design-reference integration.
- Preserve the existing local `agent/add-gradient-studio-reference` branch and its internal planning files.
- Keep all root and `ENG/` prose in English.
- Edit only claims, commands, paths, links, metadata, and wording supported by repository evidence or authoritative sources.
- Preserve valid numbers, exceptions, examples, safety boundaries, and domain-specific requirements.
- Do not add dependencies, generated assets, code, workflow changes, endorsements, or blanket license claims.
- Update synchronized guide metadata only when normative guide content changes; include the validator constant only when the repository contract requires it.
- Do not push, open a pull request, or merge unless the user separately requests publication.
- Do not install missing Markdown or link tools; report unavailable tools or external rate limits.

---

### Task 1: Establish the isolated documentation baseline

**Files:**

- Read: `README.md`
- Read: `ENG/*.md`
- Read: `THIRD_PARTY_NOTICES.md`
- Read: `package.json`, `src/cli.js`, `src/commands/*.js`, `scripts/*.py`, `.github/workflows/docs-quality.yml`
- Create locally: worktree at `/Users/cassio/Documents/github/mdfiles/.worktrees/codex-public-documentation-review`

**Interfaces:**

- Consumes: `origin/main`, the approved specification at `/Users/cassio/Documents/github/mdfiles/docs/superpowers/specs/2026-08-10-public-documentation-review-design.md`, and repository instructions.
- Produces: a clean branch named `codex/public-documentation-review` based on `origin/main`, plus an evidence map kept outside the final repository diff.

- [ ] **Step 1: Confirm the source branch and local safety state**

  Run from the current repository:

  ```bash
  git status --short --branch
  git fetch origin main
  git rev-parse origin/main
  git diff --stat origin/main...HEAD
  ```

  Expected: the existing branch remains untouched and `origin/main` resolves to
  the latest published merge commit.

- [ ] **Step 2: Create the isolated implementation worktree**

  Create the worktree using the repository's worktree workflow with:

  ```bash
  git worktree add -b codex/public-documentation-review \
    /Users/cassio/Documents/github/mdfiles/.worktrees/codex-public-documentation-review \
    origin/main
  ```

  Confirm the new worktree is clean and based on `origin/main`:

  ```bash
  git -C /Users/cassio/Documents/github/mdfiles/.worktrees/codex-public-documentation-review status --short --branch
  git -C /Users/cassio/Documents/github/mdfiles/.worktrees/codex-public-documentation-review log -1 --oneline
  ```

- [ ] **Step 3: Build the evidence map without editing files**

  Inspect the source of every documented command, path, package claim, guide
  name, version, external reference, and license boundary:

  ```bash
  cd /Users/cassio/Documents/github/mdfiles/.worktrees/codex-public-documentation-review
  rg -n 'npx |node src/cli|python3 |npm |version:|last-reviewed:|https?://|ENG/|docs/|LICENSE' README.md ENG THIRD_PARTY_NOTICES.md
  sed -n '1,260p' package.json
  rg -n 'command|option|--path|--dry-run|--json|--strict|--adopt|manifest|PROJECT_PROFILE|supported' src tests README.md
  rg -n 'on:|push:|pull_request:|markdownlint|lychee|validate_|scan_secrets|node-version' .github/workflows scripts tests
  ```

  Record findings in a temporary file outside the repository, separating
  confirmed corrections from text that should remain unchanged.

- [ ] **Step 4: Run the baseline documentation gates**

  ```bash
  python3 scripts/validate_markdown.py --self-test
  python3 scripts/validate_markdown.py
  python3 scripts/validate_loop_system.py --self-test
  python3 scripts/validate_loop_system.py
  python3 scripts/scan_secrets.py
  ```

  Expected: the baseline is green before any public-documentation edit.

---

### Task 2: Correct README orientation and usage claims

**Files:**

- Modify: `README.md`
- Test: `README.md` through `scripts/validate_markdown.py`

**Interfaces:**

- Consumes: Task 1's evidence map and the actual CLI, package, adapter, and workflow sources.
- Produces: a README whose catalog, loop explanation, installation instructions, commands, target-project copy list, local checks, and license boundary describe the current repository without duplicating domain-guide content.

- [ ] **Step 1: Audit the catalog and repository orientation**

  Compare the catalog, guide count, front-matter explanation, loop references,
  adapter claims, and structure tree against:

  ```bash
  rg -n '^name:|^language:|^description:|^version:|^last-reviewed:' ENG/*.md
  sed -n '1,280p' AGENT_COMPATIBILITY.md
  sed -n '1,240p' GUIDE_ROUTER.md
  sed -n '1,220p' LOOP_ENGINEERING.md
  ```

  Keep the catalog labels and links synchronized with the actual eight guide
  files and do not add unsupported agent or platform claims.

- [ ] **Step 2: Audit npm, checkout, and target-install instructions**

  Verify every command and option against the CLI entry point and tests:

  ```bash
  node src/cli.js --help
  node src/cli.js init --help
  node src/cli.js doctor --help
  node src/cli.js update --help
  rg -n 'npx|npm|--path|--dry-run|--json|--strict|--adopt|manifest|PROJECT_PROFILE|symlink|template' src tests package.json README.md
  ```

  Correct only inaccurate command syntax, package availability wording,
  copied-file lists, or behavior claims. Keep conditional or pre-publication
  fallbacks explicitly labeled.

- [ ] **Step 3: Audit local checks, maintenance, and rights language**

  Align the documented validators, optional tool policy, package checks, and
  license/provenance boundary with the actual workflow and notices. Avoid
  claiming that a missing local tool was run or that the npm package relicenses
  documentation.

- [ ] **Step 4: Validate and commit the README-only change**

  ```bash
  python3 scripts/validate_markdown.py --self-test
  python3 scripts/validate_markdown.py
  git diff --check
  git add README.md
  git diff --cached --check
  git commit -m "docs: clarify README usage and maintenance"
  ```

---

### Task 3: Synchronize shared guide contracts

**Files:**

- Modify: `ENG/accessibility-eng.md`
- Modify: `ENG/clean-code-eng.md`
- Modify: `ENG/design-code-eng.md`
- Modify: `ENG/games-code-design-web-eng.md`
- Modify: `ENG/perf-code-eng.md`
- Modify: `ENG/premium-sites-studio-eng.md`
- Modify: `ENG/sec-code-eng.md`
- Modify: `ENG/test-code-eng.md`
- Modify: `scripts/validate_loop_system.py` only if a normative edit requires the synchronized metadata contract

**Interfaces:**

- Consumes: the README catalog and the validator's authoritative guide metadata contract.
- Produces: eight guides with consistent names, descriptions, language, version, review date, cross-references, and no contradiction with the router.

- [ ] **Step 1: Compare front matter and guide identity**

  ```bash
  rg -n '^(name|language|description|version|last-reviewed):' ENG/*.md
  rg -n 'ENG/|premium|clean|test|security|design|performance|accessibility|games' README.md GUIDE_ROUTER.md scripts/validate_loop_system.py
  ```

  Correct stale guide names, descriptions, link labels, or cross-reference
  text only when the repository sources demonstrate the mismatch.

- [ ] **Step 2: Decide whether metadata is normative**

  Leave the synchronized version and date unchanged for typo, grammar, or
  link-only edits. If a guide's requirement, default, standard, or checklist
  changes, update all eight front matters and the authoritative validator
  constants together, then run the loop validator before continuing.

- [ ] **Step 3: Check shared language and contract boundaries**

  Search for contradictory terms and unsupported absolutes:

  ```bash
  rg -n 'must|always|never|only|optional|required|recommended|version|license|source|reference' ENG/*.md
  ```

  Preserve intentional normative language, but clarify statements that
  conflict with `LOOP_ENGINEERING.md`, `GUIDE_ROUTER.md`, the README, or the
  guide's own verification checklist.

- [ ] **Step 4: Run the shared contract checks and commit**

  ```bash
  python3 scripts/validate_loop_system.py --self-test
  python3 scripts/validate_loop_system.py
  python3 scripts/validate_markdown.py
  git diff --check
  git add ENG scripts/validate_loop_system.py
  git diff --cached --check
  git commit -m "docs: align guide contracts"
  ```

---

### Task 4: Review accessibility, clean-code, and testing guidance

**Files:**

- Modify: `ENG/accessibility-eng.md`
- Modify: `ENG/clean-code-eng.md`
- Modify: `ENG/test-code-eng.md`

**Interfaces:**

- Consumes: Task 1's evidence map and the shared contract from Task 3.
- Produces: clearer, internally consistent guidance for accessibility,
  maintainability, error handling, debugging, and risk-based verification.

- [ ] **Step 1: Audit accessibility requirements and verification language**

  Compare the WCAG-oriented claims, keyboard/focus rules, reduced-motion
  guidance, manual checks, and Definition of Done with the guide's references
  and the design guide's shared contracts. Keep compliance profiles explicit
  and do not turn recommendations into unsupported legal guarantees.

- [ ] **Step 2: Audit clean-code examples and commands**

  Check that examples demonstrate the stated contracts, error behavior,
  observability, cancellation, retries, and dependency boundaries. Remove only
  duplicated or misleading prose; do not replace valid framework-independent
  examples with a new style system.

- [ ] **Step 3: Audit testing strategy and evidence requirements**

  Ensure the testing guide distinguishes unit, integration, end-to-end,
  accessibility, performance, mobile, desktop, migration, and release checks;
  that commands are conditional when tool availability varies; and that its
  approval checklist agrees with the repository loop.

- [ ] **Step 4: Validate the three guides and commit**

  ```bash
  python3 scripts/validate_markdown.py --self-test
  python3 scripts/validate_markdown.py
  python3 scripts/scan_secrets.py
  git diff --check
  git add ENG/accessibility-eng.md ENG/clean-code-eng.md ENG/test-code-eng.md
  git diff --cached --check
  git commit -m "docs: clarify quality and testing guidance"
  ```

---

### Task 5: Review design and premium-experience guidance

**Files:**

- Modify: `ENG/design-code-eng.md`
- Modify: `ENG/premium-sites-studio-eng.md`

**Interfaces:**

- Consumes: the published design-reference map, existing accessibility and performance contracts, and authoritative external sources when a current claim needs verification.
- Produces: coherent guidance for visual direction, components, motion,
  responsive behavior, progressive enhancement, premium website gates, and
  the provenance boundaries for the nine requested design sites.

- [ ] **Step 1: Audit the design-reference map**

  Confirm that each supplied site has a useful role, concrete guardrail, and
  matching entry in `THIRD_PARTY_NOTICES.md`:

  ```bash
  rg -n '21st\.dev|reactbits\.dev|fancycomponents\.dev|motion-primitives\.com|component\.gallery|number-flow\.barvian\.me|cursify\.ui-layouts\.com|uncut\.wtf|cables\.gl' ENG/design-code-eng.md THIRD_PARTY_NOTICES.md
  ```

  Use official site or repository documentation only when a live claim must be
  corrected. Do not add catalog counts, endorsement language, or blanket reuse
  permissions.

- [ ] **Step 2: Audit visual, motion, canvas, and responsive contracts**

  Check that the design guide's tokens, semantics, touch/coarse-pointer rules,
  reduced-motion behavior, canvas/WebGL fallback, performance budgets, and
  component states do not contradict one another or the accessibility and
  performance guides. Preserve optional-enhancement boundaries.

- [ ] **Step 3: Audit premium-site gates and cross-references**

  Verify that the premium guide's brief, content, direction, design system,
  prototype, implementation, QA, SEO/trust, launch, and operations gates are
  ordered and linked consistently. Correct only concrete duplication,
  ambiguity, stale path, or conflict with the canonical loop.

- [ ] **Step 4: Validate and commit the design group**

  ```bash
  python3 scripts/validate_markdown.py --self-test
  python3 scripts/validate_markdown.py
  python3 scripts/validate_loop_system.py
  git diff --check
  git add ENG/design-code-eng.md ENG/premium-sites-studio-eng.md
  git diff --cached --check
  git commit -m "docs: refine design guidance"
  ```

---

### Task 6: Review performance, security, and web-game guidance

**Files:**

- Modify: `ENG/perf-code-eng.md`
- Modify: `ENG/sec-code-eng.md`
- Modify: `ENG/games-code-design-web-eng.md`

**Interfaces:**

- Consumes: the repository's current commands and contracts plus primary
  standards references for claims that may have changed.
- Produces: accurate guidance for measurable performance, security trust
  boundaries, procedural/game-loop behavior, compatibility, accessibility,
  testing, and release gates.

- [ ] **Step 1: Audit performance claims and budgets**

  Check metric names, measurement instructions, platform sections, suggested
  budgets, and security/performance interactions. Keep budgets labeled as
  defaults or targets unless the repository provides a binding project budget.

- [ ] **Step 2: Audit security standards and operational claims**

  Verify references to OWASP, browser controls, identity, uploads, SSRF,
  secrets, supply chain, mobile, desktop, and release verification. Use primary
  standards documentation for current-version corrections and do not weaken
  trust-boundary or negative-test requirements.

- [ ] **Step 3: Audit game architecture and platform guidance**

  Check fixed-step simulation, procedural determinism, input, assets, audio,
  rendering fallbacks, multiplayer, accessibility, performance, PWA/CDN, and
  release language against the guide's own checklists. Keep optional
  technologies explicitly conditional.

- [ ] **Step 4: Validate and commit the platform group**

  ```bash
  python3 scripts/validate_markdown.py --self-test
  python3 scripts/validate_markdown.py
  python3 scripts/validate_loop_system.py
  python3 scripts/scan_secrets.py
  git diff --check
  git add ENG/perf-code-eng.md ENG/sec-code-eng.md ENG/games-code-design-web-eng.md
  git diff --cached --check
  git commit -m "docs: refine platform quality guidance"
  ```

---

### Task 7: Align third-party notices with public references

**Files:**

- Modify: `THIRD_PARTY_NOTICES.md`

**Interfaces:**

- Consumes: every external source linked by the README and eight guides, plus the design-reference map from Task 5.
- Produces: a concise notice file that distinguishes original documentation,
  adapted material, external standards, design references, software,
  dependencies, fonts, assets, premium content, and their separate terms.

- [ ] **Step 1: Inventory external references**

  ```bash
  rg -o 'https?://[^) >]+' README.md ENG THIRD_PARTY_NOTICES.md | sort -u
  ```

  Compare the resulting inventory with the existing notice sections. Group
  references only when the shared boundary is accurate for every member.

- [ ] **Step 2: Correct provenance and rights language**

  Ensure each identified source is described as a reference or adapted source,
  not as a dependency or permission grant. Retain exact author, license, and
  current-terms caveats where evidence exists; remove unsupported legal or
  endorsement wording.

- [ ] **Step 3: Validate and commit the notices**

  ```bash
  python3 scripts/scan_secrets.py
  python3 scripts/validate_markdown.py
  git diff --check
  git add THIRD_PARTY_NOTICES.md
  git diff --cached --check
  git commit -m "docs: align third-party notices"
  ```

---

### Task 8: Run full regression checks and inspect the publication boundary

**Files:**

- Test: all changed public-documentation files
- Do not add: `docs/superpowers/`, source code, assets, dependencies, or workflow files

**Interfaces:**

- Consumes: the commits from Tasks 2–7.
- Produces: a clean local review branch with verified documentation and an
  explicit publication report; no remote mutation.

- [ ] **Step 1: Run structural and content validators**

  ```bash
  python3 -m unittest tests.test_validate_markdown -v
  python3 scripts/validate_markdown.py --self-test
  python3 scripts/validate_markdown.py
  python3 -m unittest tests.test_validate_loop_system -v
  python3 scripts/validate_loop_system.py --self-test
  python3 scripts/validate_loop_system.py
  python3 -m unittest tests.test_scan_secrets -v
  python3 scripts/scan_secrets.py
  ```

- [ ] **Step 2: Run package regression checks**

  ```bash
  npm test
  npm run pack:check
  ```

  These checks confirm that documentation edits did not alter package behavior
  or package contents.

- [ ] **Step 3: Run available Markdown and link tooling**

  ```bash
  command -v markdownlint-cli2
  command -v lychee
  ```

  Run an installed tool with repository configuration. Do not download missing
  tools. Record exact external status codes, such as `429`, if a link service
  blocks automated checking.

- [ ] **Step 4: Inspect exact scope and final diff**

  ```bash
  git diff --check origin/main...HEAD
  git diff --name-status origin/main...HEAD
  git status --short --branch
  git log --oneline --decorate -8
  ```

  Expected: only `README.md`, `ENG/*.md`, `THIRD_PARTY_NOTICES.md`, and an
  explicitly justified synchronized metadata file have changed relative to
  `origin/main`; the worktree is clean; no internal planning document is part
  of the public-documentation branch.

- [ ] **Step 5: Commit only verified final corrections**

  If the final inspection finds an uncommitted correction, stage only the
  affected public-documentation file, run `git diff --cached --check`, and
  commit it with a message that names the documented surface. Do not push or
  merge this branch.
