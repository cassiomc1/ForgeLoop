# mdfiles 10/10 Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all seven phases of `MDFILES_10_OF_10_ROADMAP.md` as a versioned, testable, framework-neutral protocol while preserving the existing `init`, `doctor`, and `update` contracts.

**Architecture:** Add small Node built-in modules for protocol constants, schema validation, routing, receipts, work state, repository fingerprints, inspection, and delegation. Keep Markdown as the human-readable contract, JSON Schema as the serializable contract, and the CLI as a validator/explainer rather than an agent runtime. Deliver the phases in dependency order: foundations → routing → observability → state → delegation → portability → graph readiness.

**Tech Stack:** Node.js ESM, Node built-ins only, JSON Schema documents, Node test runner, Python `unittest` validators, GitHub Actions.

## Global Constraints

- The first protocol version is `1` and is independent of the npm package version.
- Existing `init`, `doctor`, and `update` behavior remains compatible unless a documented safety correction requires an explicit error.
- Markdown remains the human-readable source of operational meaning.
- The CLI validates and explains; the compatible agent performs the task.
- No LLM/provider/scheduler/database/remote-service dependency may be added.
- Do not add `mdfiles run`, `mdfiles execute`, `mdfiles agent`, or `mdfiles orchestrate`.
- State and receipt files must contain no secrets, credentials, hidden prompts, or chain-of-thought.
- Every new filesystem path must pass the existing safe-path and realpath containment checks.
- New writes that can be partially observed must use the existing atomic-write helper.
- Every structured result must use stable ordering, explicit versions, and deterministic reason codes.
- A retry requires new evidence or a changed hypothesis; identical evidence cannot create an immediate retry.
- New commands are read-only by default; `clear-state` may remove only `.mdfiles/work-state.json`.
- Final local verification must include npm tests, package checks, Python validators, Markdown/loop checks, secret scanning, and `git diff --check`.

## File Map

### Protocol and validation

- Create `src/core/protocol.js` for protocol version, failure classes, workflow phases, guide IDs, and transition predicates.
- Create `src/core/schema-validation.js` for the dependency-free JSON Schema subset used by protocol artifacts.
- Create `schemas/routing-input.schema.json`, `schemas/routing-result.schema.json`, `schemas/work-state.schema.json`, `schemas/execution-receipt.schema.json`, `schemas/task-brief.schema.json`, and `schemas/delegated-result.schema.json`.
- Modify `scripts/validate_loop_system.py` and `tests/test_validate_loop_system.py` to require protocol documents, schemas, and semantic markers.

### Routing and observability

- Create `src/core/router.js` for declared-signal normalization and deterministic guide expansion.
- Create `src/commands/route.js` for CLI output formatting.
- Create `src/core/receipt.js` for receipt creation and validation.
- Create `src/commands/inspect.js` and `src/core/inspect.js` for target health summaries.
- Create `src/commands/validate-receipt.js` for safe local receipt validation.
- Modify `src/commands/doctor.js` to include remediation and evidence fields in every finding.

### Work state and delegation

- Create `src/core/repository.js` for optional fixed-argument Git fingerprints.
- Create `src/core/work-state.js` for state validation, fingerprints, atomic writes, stale classification, and safe clearing.
- Create `src/commands/status.js`, `src/commands/validate-state.js`, and `src/commands/clear-state.js`.
- Create `src/core/delegation.js` for task-brief/result validation, ownership conflicts, dependency cycles, review independence, and normalization.

### Canonical documentation and distribution

- Create `QUALITY_SCORECARD.md`, `TERMINOLOGY.md`, `EXECUTION_STATE.md`, `DELEGATION_PROTOCOL.md`, `ORCHESTRATOR_INTEGRATION.md`, and `.mdfiles/.gitignore`.
- Modify `LOOP_ENGINEERING.md`, `LOOP_SYSTEM_DESIGN.md`, `GUIDE_ROUTER.md`, `README.md`, `AGENT_COMPATIBILITY.md`, `THIRD_PARTY_NOTICES.md`, `src/core/templates.js`, `package.json`, and package-content tests.
- Add `tests/router.test.js`, `tests/observability.test.js`, `tests/work-state.test.js`, `tests/delegation.test.js`, `tests/portability.test.js`, and protocol fixtures under `tests/fixtures/`.
- Modify `.github/workflows/docs-quality.yml` with an OS smoke matrix.

---

### Task 1: Add protocol constants, schema validation, and measurable quality contracts

**Files:**
- Create: `src/core/protocol.js`
- Create: `src/core/schema-validation.js`
- Create: `schemas/routing-input.schema.json`
- Create: `schemas/routing-result.schema.json`
- Create: `schemas/work-state.schema.json`
- Create: `schemas/execution-receipt.schema.json`
- Create: `schemas/task-brief.schema.json`
- Create: `schemas/delegated-result.schema.json`
- Create: `QUALITY_SCORECARD.md`
- Create: `TERMINOLOGY.md`
- Modify: `LOOP_ENGINEERING.md`
- Modify: `LOOP_SYSTEM_DESIGN.md`
- Modify: `scripts/validate_loop_system.py`
- Test: `tests/protocol.test.js`
- Test: `tests/test_validate_loop_system.py`

**Interfaces:**
- `protocol.js` exports `PROTOCOL_VERSION`, `FAILURE_CLASSES`, `WORK_PHASES`, `GUIDE_IDS`, `GUIDE_ORDER`, `isValidTransition(from, to)`, and `assertFailureClass(value)`.
- `schema-validation.js` exports `SchemaValidationError`, `validateSchema(value, schema, options)`, `assertSchema(value, schema, label)`, and `readSchema(name, packageRoot)`.
- Every schema uses `schemaVersion: 1` in its artifact contract and rejects unknown enum values, malformed required fields, and secret-like protocol properties.

- [ ] **Step 1: Write failing protocol tests.** Add assertions that version is `1`, all twelve failure classes are present, all thirteen workflow phases are unique, unknown failure classes throw, valid transitions pass, invalid transitions fail, and each schema JSON parses with a top-level object schema.

```js
test("protocol exposes stable versions and phases", () => {
  assert.equal(PROTOCOL_VERSION, 1);
  assert.equal(new Set(FAILURE_CLASSES).size, 12);
  assert.equal(new Set(WORK_PHASES).size, 13);
});

test("invalid transition and failure class are rejected", () => {
  assert.equal(isValidTransition("VERIFYING", "DIAGNOSING"), true);
  assert.equal(isValidTransition("COMPLETE", "EXECUTING"), false);
  assert.throws(() => assertFailureClass("UNKNOWN_FAILURE"), /failure class/i);
});
```

- [ ] **Step 2: Run the focused test to confirm the missing contract.**

Run: `node --test tests/protocol.test.js`

Expected: FAIL because the protocol module and schemas do not yet exist.

- [ ] **Step 3: Implement protocol constants and transitions.** Use frozen arrays and an explicit transition map. Permit proportional skips only through documented edges such as `ROUTED → PLANNED`, `ROUTED → DESIGNING`, `PLANNED → EXECUTING`, `VERIFYING → DIAGNOSING`, `VERIFYING → REVIEWING`, and `any non-terminal → BLOCKED`.

- [ ] **Step 4: Implement the minimal JSON Schema validator.** Support exactly the keywords used by the six schemas: `$schema`, `$id`, `title`, `type`, `required`, `properties`, `additionalProperties`, `items`, `enum`, `const`, `minItems`, `maxItems`, `minLength`, `pattern`, and `oneOf`. Return all errors with JSON paths, and throw `SchemaValidationError` from `assertSchema`.

- [ ] **Step 5: Add the six schema documents.** Keep properties plain JSON-compatible. Define required fields for routing input/result, work state, receipt, task brief, and delegated result; disallow unknown top-level fields except explicitly documented extension maps.

- [ ] **Step 6: Add scorecard, glossary, and loop contract sections.** Document the failure taxonomy, retry rule, ten loop invariants, evidence categories (`Observed`, `Inferred`, `Not verified`, `Blocked`), protocol version policy, and the rule that completion requires verification evidence. Add the canonical state/transition table to `LOOP_SYSTEM_DESIGN.md` without duplicating the detailed operational text.

- [ ] **Step 7: Extend the Python validator and tests.** Require the new canonical documents and schemas, validate JSON schema top-level shapes, and assert the loop contains every failure code, invariant marker, and protocol-version policy marker. Add invalid fixtures for a missing schema, duplicate failure code, and missing invariant.

- [ ] **Step 8: Run focused checks and commit the foundation.**

Run: `node --test tests/protocol.test.js` and `python3 -m unittest tests.test_validate_loop_system -v`

Expected: PASS with the new protocol and structural contracts.

```bash
git add src/core/protocol.js src/core/schema-validation.js schemas QUALITY_SCORECARD.md TERMINOLOGY.md LOOP_ENGINEERING.md LOOP_SYSTEM_DESIGN.md scripts/validate_loop_system.py tests/protocol.test.js tests/test_validate_loop_system.py
git commit -m "feat: add versioned protocol foundations"
```

### Task 2: Implement deterministic routing and route schemas

**Files:**
- Create: `src/core/router.js`
- Modify: `schemas/routing-input.schema.json`
- Modify: `schemas/routing-result.schema.json`
- Create: `tests/router.test.js`
- Create: `tests/fixtures/routes/documentation.json`
- Create: `tests/fixtures/routes/complete-website.json`
- Create: `tests/fixtures/routes/api-auth.json`
- Create: `tests/fixtures/routes/backend-refactor.json`
- Create: `tests/fixtures/routes/static-ui-copy.json`
- Create: `tests/fixtures/routes/invalid-signal.json`
- Modify: `GUIDE_ROUTER.md`

**Interfaces:**
- `normalizeRouteInput(input)` returns `{ workType, surfaces, risks, platforms, behaviorChange, executableChange }` with sorted unique arrays.
- `evaluateRoute(input)` returns `{ schemaVersion, protocolVersion, input, primary, guides, reasons, excluded }`.
- Known work types are `documentation`, `code`, `bug`, `refactor`, `backend`, `api`, `api-auth`, `complete-website`, `mobile-ui`, `web-game`, `html-video`, `infrastructure`, `security-review`, `performance`, `accessibility`, `test-only`, `dependency-update`, and `release`.
- Known surfaces are `ui`, `forms`, `api`, `auth`, `data`, `database`, `mobile`, `desktop`, `game`, `video`, `ci`, `config`, and `critical-path`.
- Known platforms are `web`, `mobile`, `desktop`, `server`, `ci`, and `cross-platform`; known risks are `untrusted-input`, `personal-data`, `secrets`, `external-service`, `publication`, `critical-path`, `performance`, and `accessibility`.

- [ ] **Step 1: Write route fixture tests.** Load every fixture, call `evaluateRoute`, assert exact guide ordering, exact primary guide, one reason per selected guide, no duplicates, and forbidden guides absent.

```js
test("complete website uses the full required guide closure", () => {
  const result = evaluateRoute({
    workType: "complete-website",
    surfaces: ["ui", "forms"],
    risks: ["untrusted-input", "critical-path"],
    platforms: ["web"],
  });
  assert.deepEqual(result.guides, [
    "premium", "design", "accessibility", "clean", "test", "security", "performance",
  ]);
  assert.ok(result.reasons.security.includes("RISK_UNTRUSTED_INPUT"));
});
```

- [ ] **Step 2: Run the routing tests to confirm they fail.**

Run: `node --test tests/router.test.js`

Expected: FAIL because `src/core/router.js` is missing.

- [ ] **Step 3: Implement input normalization and signal validation.** Reject unknown values, duplicate entries, non-array signal fields, and non-boolean change flags; retain explicit `executableChange: true` evidence as authoritative when it conflicts with a semantic `behaviorChange: false` declaration.

- [ ] **Step 4: Implement deterministic rule expansion.** Add the primary guide, UI/form complements, clean/test behavior rules, risk additions, mandatory work-type closures, exclusions, reason codes, and canonical insertion order. Documentation-only input returns no automatic technical guide and records `DOCUMENTATION_DOMAIN_GUIDE_REQUIRED` in `excluded`.

- [ ] **Step 5: Add conflict and negative cases.** Prove documentation mentioning OAuth does not activate security; backend refactor does not activate design/accessibility; static UI copy does not activate security; executable configuration adds clean/test even when the natural-language work type says documentation; and unknown signals fail before evaluation.

- [ ] **Step 6: Document the declared-signal contract.** Extend `GUIDE_ROUTER.md` with the signal enums, precedence, reason-code policy, negative examples, and the distinction between agent semantic classification and deterministic route expansion.

- [ ] **Step 7: Run focused tests and commit routing.**

Run: `node --test tests/router.test.js`

Expected: PASS for all positive, negative, exclusion, and conflict fixtures.

```bash
git add src/core/router.js schemas/routing-input.schema.json schemas/routing-result.schema.json tests/router.test.js tests/fixtures/routes GUIDE_ROUTER.md
git commit -m "feat: add deterministic guide routing"
```

### Task 3: Add `mdfiles route` and route explainability

**Files:**
- Create: `src/commands/route.js`
- Modify: `src/cli.js`
- Modify: `tests/cli.test.js`
- Modify: `README.md`
- Modify: `AGENT_COMPATIBILITY.md`

**Interfaces:**
- `parseArgs` accepts `route` with repeated `--surface`, `--risk`, and `--platform`, scalar `--work`, boolean `--behavior-change` and `--executable-change`, and `--json`.
- `runRoute({ input })` returns the `evaluateRoute` result.
- Human output prints each selected guide with its reason codes and each exclusion when requested; JSON output prints the stable result object.

- [ ] **Step 1: Add failing CLI tests.** Test the roadmap command form, JSON output, repeated options, unknown-signal errors, deterministic ordering, and rejection of `--dry-run`/`--adopt` for route.

```js
test("route emits stable JSON and reason codes", () => {
  const result = runCliDirect(repositoryRoot, "route", "--work", "api-auth", "--json");
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.guides, ["clean", "test", "security", "performance"]);
  assert.ok(report.reasons.security.includes("WORK_API_AUTH"));
});
```

- [ ] **Step 2: Run the focused CLI test and confirm the command is absent.**

Run: `node --test tests/cli.test.js --test-name-pattern="route"`

Expected: FAIL because the parser does not recognize `route`.

- [ ] **Step 3: Extend command parsing and usage.** Keep existing option compatibility, make command-specific flags fail before target resolution, and include route help without exposing init/update/doctor-only options.

- [ ] **Step 4: Implement route formatting.** Use no timestamps or environment-dependent values. Include `Selected:` lines, reason codes, and an explicit message for documentation-domain routing.

- [ ] **Step 5: Run route CLI tests and update README.** Document both agent-declared signal input and the example command; state that the CLI never interprets natural language or calls a model.

- [ ] **Step 6: Commit the route command.**

```bash
git add src/commands/route.js src/cli.js tests/cli.test.js README.md AGENT_COMPATIBILITY.md
git commit -m "feat: expose route explanation command"
```

### Task 4: Add rich findings, receipts, inspection, and no-telemetry guarantees

**Files:**
- Create: `src/core/receipt.js`
- Create: `src/core/inspect.js`
- Create: `src/commands/inspect.js`
- Create: `src/commands/validate-receipt.js`
- Modify: `src/commands/doctor.js`
- Modify: `src/cli.js`
- Modify: `schemas/execution-receipt.schema.json`
- Create: `tests/observability.test.js`
- Modify: `README.md`
- Modify: `LOOP_ENGINEERING.md`

**Interfaces:**
- `createReceipt(input)` returns a normalized receipt with `schemaVersion: 1`, `protocolVersion: 1`, explicit publication booleans/nulls, and no secret-like fields.
- `validateReceipt(receipt)` returns the receipt or throws `SchemaValidationError`.
- `inspectTarget({ target, packageRoot })` returns `{ target, manifest, profile, adapters, protocol, state, compatibility, findings, ok }`.
- Doctor findings become `{ code, severity, path, message, remediation, evidence }` while preserving existing codes and exit behavior.

- [ ] **Step 1: Write failing receipt and finding tests.** Cover required receipt fields, ambiguous publication rejection, secret-like key rejection, rich doctor fields, and inspect JSON sections.

- [ ] **Step 2: Run focused tests to confirm missing modules/fields.**

Run: `node --test tests/observability.test.js`

Expected: FAIL because receipt/inspect modules and rich finding fields do not exist.

- [ ] **Step 3: Implement receipt normalization and validation.** Use stable arrays, explicit `publication: { committed, pushed, pullRequest, deployed }`, and reject keys matching credential/token/password/secret/private-key patterns or values that look like common secret assignments.

- [ ] **Step 4: Extend doctor findings.** Add remediation and evidence at every call site. Evidence must describe an observed path/hash/mode/result; it must not expose file contents or credentials.

- [ ] **Step 5: Implement inspection.** Reuse `runDoctor`, `readManifest`, template entries, adapter support, profile mode, protocol version, and a state summary. Treat missing manifest as a reported health state rather than throwing from the command.

- [ ] **Step 6: Add `inspect` and `validate-receipt` CLI commands.** `validate-receipt --file <relative-path>` must resolve only inside the selected target and never execute data from the file. `inspect --json` exposes structured sections; human output remains concise.

- [ ] **Step 7: Document observed/inferred/unverified/blocked evidence and the offline no-telemetry guarantee.** Add a receipt example without secrets and state that local success never implies publication.

- [ ] **Step 8: Run focused and existing CLI tests, then commit.**

Run: `node --test tests/observability.test.js tests/cli.test.js`

```bash
git add src/core/receipt.js src/core/inspect.js src/commands/inspect.js src/commands/validate-receipt.js src/commands/doctor.js src/cli.js schemas/execution-receipt.schema.json tests/observability.test.js README.md LOOP_ENGINEERING.md
git commit -m "feat: add explainable inspection and receipts"
```

### Task 5: Implement atomic work state, fingerprints, and stale detection

**Files:**
- Create: `src/core/repository.js`
- Create: `src/core/work-state.js`
- Modify: `src/core/filesystem.js`
- Modify: `schemas/work-state.schema.json`
- Create: `.mdfiles/.gitignore`
- Create: `tests/work-state.test.js`
- Modify: `LOOP_ENGINEERING.md`
- Create: `EXECUTION_STATE.md`

**Interfaces:**
- `contractFingerprint(contract)` returns a lowercase SHA-256 of canonical JSON with sorted object keys.
- `currentRepositoryFingerprint(target)` returns `{ branch, head }`, using fixed-argument Git calls and `{ branch: null, head: null }` when the target is not a Git checkout.
- `createWorkState(input)` returns a schema-valid state with `schemaVersion: 1` and `protocolVersion: 1`.
- `readWorkState(target)` returns `null` when absent or throws `WorkStateError` on invalid JSON/schema/secret content.
- `writeWorkState(target, state, options)` validates, safe-path checks, and atomically writes `.mdfiles/work-state.json`.
- `classifyWorkState(state, currentFingerprint)` returns `ABSENT`, `FRESH`, `REVALIDATION_REQUIRED`, or `INVALID` plus reason codes.
- `clearWorkState(target)` removes only `.mdfiles/work-state.json` and returns `{ removed, path }`.

- [ ] **Step 1: Write failing state tests.** Cover valid state creation, canonical contract fingerprints, truncated JSON, unknown protocol version, invalid phase, missing blocker for `BLOCKED`, missing verification for `COMPLETE`, branch/HEAD drift, non-Git targets, safe clear boundaries, and atomic temporary-file cleanup.

```js
test("changed HEAD requires state revalidation", async () => {
  const state = createWorkState({
    taskId: "task-1",
    contractFingerprint: contractFingerprint({ objective: "x" }),
    repositoryFingerprint: { branch: "main", head: "old" },
    phase: "VERIFYING",
    selectedGuides: ["clean", "test"],
    completedSteps: ["implementation"],
    pendingSteps: ["verification"],
    checks: [], failures: [], blockers: [],
  });
  assert.equal(classifyWorkState(state, { branch: "main", head: "new" }).status, "REVALIDATION_REQUIRED");
});
```

- [ ] **Step 2: Run state tests to confirm missing implementation.**

Run: `node --test tests/work-state.test.js`

Expected: FAIL because state helpers do not exist.

- [ ] **Step 3: Implement canonical JSON and repository fingerprinting.** Sort object keys recursively, preserve array order where the contract defines order, and use `spawn`/`execFile` with no shell and fixed Git arguments. Do not read or execute project profile commands.

- [ ] **Step 4: Implement state schema/semantic validation.** Enforce known guides/phases, status-specific evidence/blocker requirements, non-empty IDs, bounded strings, secret rejection, and valid previous-to-current transition when `previousPhase` is present.

- [ ] **Step 5: Implement safe atomic write/read/clear.** Call `assertSafePath(target, ".mdfiles/work-state.json")` before every operation. Reuse `writeFileAtomic`; do not delete `.mdfiles`, manifest, or any sibling file during clear.

- [ ] **Step 6: Add execution-state documentation.** Define the state shape, phase transitions, stale rules, resume rules, atomic-write limitation, safe clearing, and the rule not to rerun destructive/publication actions automatically.

- [ ] **Step 7: Run focused tests and commit.**

Run: `node --test tests/work-state.test.js`

```bash
git add src/core/repository.js src/core/work-state.js src/core/filesystem.js schemas/work-state.schema.json .mdfiles/.gitignore tests/work-state.test.js LOOP_ENGINEERING.md EXECUTION_STATE.md
git commit -m "feat: add atomic resumable work state"
```

### Task 6: Add status, validate-state, and clear-state commands

**Files:**
- Create: `src/commands/status.js`
- Create: `src/commands/validate-state.js`
- Create: `src/commands/clear-state.js`
- Modify: `src/cli.js`
- Modify: `tests/cli.test.js`
- Modify: `tests/work-state.test.js`
- Modify: `README.md`

**Interfaces:**
- `runStatus({ target })` returns `{ state, status, reasons, completed, pending, repository }`.
- `runValidateState({ target })` returns `{ ok, state, errors, warnings }` without mutation.
- `runClearState({ target })` returns `{ removed, path }` and never accepts a broader deletion target.

- [ ] **Step 1: Add failing command tests.** Test no-state status, fresh state, stale branch/HEAD state, JSON output, invalid/truncated state exit code, clear-state exact path, and preservation of manifest/project files.

- [ ] **Step 2: Run the command-focused tests and confirm parser/commands are absent.**

Run: `node --test tests/cli.test.js tests/work-state.test.js --test-name-pattern="status|validate-state|clear-state"`

Expected: FAIL because the commands are not registered.

- [ ] **Step 3: Extend CLI usage and parse rules.** Permit `--json` for status, validate-state, clear-state, and inspect/receipt; reject `--dry-run`, `--adopt`, route-only flags, and receipt-only flags on unrelated commands before resolving targets.

- [ ] **Step 4: Implement status and validation formatting.** Human output must name the exact state path, phase, freshness status, and revalidation reasons. JSON output must be stable and schema-compatible.

- [ ] **Step 5: Implement safe clear-state output.** Print `removed: .mdfiles/work-state.json` or `absent: .mdfiles/work-state.json`; do not accept a recursive path or a generic `--clear` option.

- [ ] **Step 6: Document resume commands and degraded non-Git behavior.** State that no Git checkout means repository drift cannot be detected and is reported as an explicit limitation.

- [ ] **Step 7: Run command tests and commit.**

```bash
git add src/commands/status.js src/commands/validate-state.js src/commands/clear-state.js src/cli.js tests/cli.test.js tests/work-state.test.js README.md
git commit -m "feat: add work-state inspection commands"
```

### Task 7: Implement the framework-neutral delegation protocol

**Files:**
- Create: `src/core/delegation.js`
- Modify: `schemas/task-brief.schema.json`
- Modify: `schemas/delegated-result.schema.json`
- Create: `DELEGATION_PROTOCOL.md`
- Create: `tests/delegation.test.js`
- Modify: `LOOP_ENGINEERING.md`
- Modify: `LOOP_SYSTEM_DESIGN.md`

**Interfaces:**
- `validateTaskBrief(brief)` returns a normalized brief or throws `SchemaValidationError`.
- `validateDelegatedResult(result)` returns a normalized result or throws `SchemaValidationError`.
- `findOwnershipConflicts(briefs)` returns `{ conflicts: [{ path, taskIds }] }` for overlapping allowed write paths, including parent/child path overlap.
- `findDependencyCycles(briefs)` returns an array of task-ID cycles.
- `isIndependentReview({ implementerId, reviewerId, reviewType })` returns `true` only for distinct identities and `reviewType: "independent"`.
- `normalizeDelegatedResult(result)` returns `{ status, changes, verification, openFindings, limitations }` with stable arrays.

- [ ] **Step 1: Write failing delegation tests.** Cover valid self-contained briefs, unknown guide IDs, duplicate task IDs, overlapping write paths, read-only/write overlap, dependency cycles, missing acceptance checks, same-identity review rejection, and sequential fallback semantics.

- [ ] **Step 2: Run focused delegation tests and confirm missing implementation.**

Run: `node --test tests/delegation.test.js`

Expected: FAIL because delegation helpers do not exist.

- [ ] **Step 3: Implement brief/result schema validation and normalization.** Keep all fields JSON-compatible. Normalize path separators to `/` for comparison while preserving the original validated path list for reporting.

- [ ] **Step 4: Implement ownership and dependency checks.** Detect exact and parent/child path overlap, reject a task writing a read-only path, and use a DFS cycle detector with deterministic task ordering.

- [ ] **Step 5: Implement reviewer independence and fallback rules.** A missing subagent capability is represented as `executionMode: "inline"`; it does not change the brief or claim independent review.

- [ ] **Step 6: Write `DELEGATION_PROTOCOL.md`.** Define eligibility, allowed/read-only/forbidden paths, dependency order, normalized result fields, reviewer distinction, merge/integration rules, and no-persona requirement.

- [ ] **Step 7: Run focused tests and commit.**

```bash
git add src/core/delegation.js schemas/task-brief.schema.json schemas/delegated-result.schema.json DELEGATION_PROTOCOL.md tests/delegation.test.js LOOP_ENGINEERING.md LOOP_SYSTEM_DESIGN.md
git commit -m "feat: add framework-neutral delegation contracts"
```

### Task 8: Integrate distribution, package contents, security documentation, and compatibility fixtures

**Files:**
- Modify: `src/core/templates.js`
- Modify: `package.json`
- Modify: `tests/package.test.js`
- Modify: `tests/compatibility.test.js`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `README.md`
- Create: `tests/fixtures/states/valid.json`
- Create: `tests/fixtures/states/truncated.json`
- Create: `tests/fixtures/receipts/valid.json`
- Create: `tests/fixtures/receipts/secret.json`
- Create: `tests/fixtures/compatibility/protocol-v1.json`

**Interfaces:**
- `TEMPLATE_PATHS` includes the new canonical documents, `.mdfiles/.gitignore`, and all six schemas in stable order.
- `package.json.files` includes `schemas`, the new root protocol documents, and `.mdfiles/.gitignore`; it excludes local work state and internal planning/spec files.

- [ ] **Step 1: Add failing package assertions.** Assert every new canonical path is shipped, `schemas/` is present, `.mdfiles/.gitignore` is present, and `.mdfiles/work-state.json` plus `docs/superpowers/` are absent from the npm tarball.

- [ ] **Step 2: Run the package test and confirm the new paths are absent.**

Run: `node --test tests/package.test.js`

Expected: FAIL until templates and package files are updated.

- [ ] **Step 3: Add the new paths to templates and package metadata.** Keep `PROJECT_PROFILE.md` preserved, keep internal plans/specs out of consumer templates, and preserve the package version while protocol version remains independent.

- [ ] **Step 4: Add compatibility fixtures and secret-free examples.** Validate the v1 fixture shape, reject the secret fixture, and document patch/minor/major compatibility guarantees.

- [ ] **Step 5: Add the CLI threat model.** Document path traversal, symlink escape, manifest tampering, untrusted state/profile data, command injection, credential leakage, unsafe update overwrite, dependency supply chain, and stale replay with mitigations or accepted limits.

- [ ] **Step 6: Run package and compatibility tests, then commit.**

```bash
git add src/core/templates.js package.json tests/package.test.js tests/compatibility.test.js THIRD_PARTY_NOTICES.md README.md tests/fixtures
git commit -m "chore: ship versioned protocol assets safely"
```

### Task 9: Add portability fixtures and CI OS smoke coverage

**Files:**
- Create: `tests/portability.test.js`
- Modify: `.github/workflows/docs-quality.yml`
- Modify: `README.md`
- Modify: `AGENT_COMPATIBILITY.md`

**Interfaces:**
- Portability tests use the same CLI and core APIs as consumers; no platform-specific dependency or shell command is required.
- CI keeps the existing Node 20/22/24 Linux depth and adds an `cli-portability` job for `ubuntu-latest`, `macos-latest`, and `windows-latest` at Node 20.

- [ ] **Step 1: Write portability tests.** Use a temporary target path containing spaces and Unicode, run `init`, verify managed files and state docs, write/read CRLF content, validate backslash-normalized delegation paths, and assert `path.win32` containment cases without assuming Windows on the development host.

- [ ] **Step 2: Run the portability test locally.**

Run: `node --test tests/portability.test.js`

Expected: PASS on macOS and exercise all cross-platform-safe branches.

- [ ] **Step 3: Add the CI smoke matrix.** Run `npm test` and `npm run pack:check` on all three OSes; keep Markdown/link/Python validators in the existing Linux matrix to avoid duplicating rate-limited checks.

- [ ] **Step 4: Document degraded mode.** Add adapter capability notes for no subagents, no worktrees, no web/MCP, no persistent state, and non-Git targets; each limitation must be explicit rather than silently treated as success.

- [ ] **Step 5: Run YAML-independent local checks and commit.**

Run: `node --test tests/portability.test.js tests/package.test.js`

```bash
git add tests/portability.test.js .github/workflows/docs-quality.yml README.md AGENT_COMPATIBILITY.md
git commit -m "ci: add cross-platform CLI smoke coverage"
```

### Task 10: Complete graph-readiness documentation and final semantic validators

**Files:**
- Create: `ORCHESTRATOR_INTEGRATION.md`
- Modify: `LOOP_SYSTEM_DESIGN.md`
- Modify: `LOOP_ENGINEERING.md`
- Modify: `GUIDE_ROUTER.md`
- Modify: `QUALITY_SCORECARD.md`
- Modify: `scripts/validate_loop_system.py`
- Modify: `tests/test_validate_loop_system.py`
- Modify: `tests/test_workflow_policy.py`
- Modify: `README.md`

**Interfaces:**
- `ORCHESTRATOR_INTEGRATION.md` maps serializable phase names, route input/result, state, receipts, and delegation contracts to a future host without naming a required framework.
- The structural validator checks one canonical workflow diagram, all phase names, transition/invariant sections, no-runtime boundary markers, and scorecard evidence references.

- [ ] **Step 1: Add failing semantic validator cases.** Reject missing phase names, missing transition rows, a `COMPLETE` section without verification evidence, a route without reason-code language, and prohibited runtime terms (`src/graph/`, `src/llm/`, `mdfiles run`) in the product architecture contract.

- [ ] **Step 2: Run the validator tests and observe the missing markers.**

Run: `python3 -m unittest tests.test_validate_loop_system tests.test_workflow_policy -v`

Expected: FAIL for the new semantic assertions until documentation is complete.

- [ ] **Step 3: Write the integration contract and canonical diagram.** Define serializable state/transition inputs and outputs, future adapter mapping, and explicit non-goals. Keep operational details in `LOOP_ENGINEERING.md` and route rules in `GUIDE_ROUTER.md`.

- [ ] **Step 4: Finish the scorecard evidence matrix.** Each dimension points to its implementation files and executable tests; literal graph runtime and runtime orchestration remain `N/A by design`.

- [ ] **Step 5: Run all repository validators and commit documentation.**

Run: `python3 scripts/validate_loop_system.py --self-test && python3 scripts/validate_loop_system.py && python3 -m unittest tests.test_validate_loop_system tests.test_workflow_policy -v`

```bash
git add ORCHESTRATOR_INTEGRATION.md LOOP_SYSTEM_DESIGN.md LOOP_ENGINEERING.md GUIDE_ROUTER.md QUALITY_SCORECARD.md scripts/validate_loop_system.py tests/test_validate_loop_system.py tests/test_workflow_policy.py README.md
git commit -m "docs: complete graph-readiness and quality evidence"
```

### Task 11: Run the complete regression gate and perform evidence-based correction

**Files:**
- Modify only files implicated by a failing check; do not broaden scope.

- [ ] **Step 1: Run targeted JavaScript tests.**

Run: `npm test`

Expected: PASS for existing CLI/core/package/compatibility tests plus all new route, observability, state, delegation, and portability tests.

- [ ] **Step 2: Verify the package boundary.**

Run: `npm run pack:check`

Expected: PASS with schemas and canonical protocol documents included and local state/internal planning records excluded.

- [ ] **Step 3: Run Python validators and self-tests.**

Run: `python3 -m unittest discover -s tests -v`

Expected: PASS for Markdown, secrets, loop, Qwen policy, workflow policy, and all semantic validator tests.

- [ ] **Step 4: Run executable validators.**

Run: `python3 scripts/validate_markdown.py --self-test`, `python3 scripts/validate_markdown.py`, `python3 scripts/validate_loop_system.py --self-test`, `python3 scripts/validate_loop_system.py`, and `python3 scripts/scan_secrets.py`

Expected: all commands exit `0`; any external link result remains reported separately from local correctness.

- [ ] **Step 5: Run diff hygiene and inspect final state.**

Run: `git diff --check`, `git status --short --branch`, and `git log --oneline --decorate -12`

Expected: no whitespace errors, only intended roadmap files changed, and publication state explicitly remains local unless separately authorized.

- [ ] **Step 6: Diagnose before correcting any failure.** Record the failing command, exact error, affected contract, and changed hypothesis; make one focused correction, rerun the failed check, then rerun the proportional regression gate. Never repeat an identical attempt without new evidence.

- [ ] **Step 7: Finish with a human-readable receipt.** Report observed checks, inferred coverage, unverified OS/remote checks, blockers, changed files, commit state, branch/push/PR state, and the explicit absence of an orchestration runtime.
