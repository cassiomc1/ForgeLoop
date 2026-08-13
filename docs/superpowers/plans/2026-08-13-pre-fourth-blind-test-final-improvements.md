# Pre-Fourth Blind Test Final Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove future-result fabrication from `record-check` guidance, prove pass/fail lifecycle behavior, align canonical closure documentation, and release package version `0.1.3`.

**Architecture:** Keep `src/core/next-action.js` as the read-only decision boundary and change only its command specification builder. Runtime result fields will be declared as structured inputs while deterministic identity fields remain in `argv`; existing `recordCheck` persistence and lifecycle evaluators remain authoritative. Documentation and package metadata will be updated as a small release-surface change.

**Tech Stack:** Node.js 20+, native `node:test`, ES modules, JSON protocol artifacts, Markdown, npm package metadata.

## Global Constraints

- Preserve protocol version 1 and existing lifecycle semantics.
- Do not redesign the protocol core.
- Keep untrusted requirement text as direct-process data, never shell syntax.
- Do not execute project commands from structured guidance.
- Do not install unrelated software, publish, or deploy.
- Execute inline without subagents.

---

### Task 1: Add regression tests for unresolved and observed outcomes

**Files:**
- Modify: `tests/next-action.test.js`
- Test: `tests/next-action.test.js`

**Interfaces:**
- Consumes: `getNextAction`, `recordCheck`, `prepareCompletion`, `advanceWorkState`, and the existing `setupTarget` fixture.
- Produces: assertions proving the command spec is unresolved before execution and persisted pass/fail observations drive the next action.

- [ ] **Step 1: Write the failing future-result invariant test**

In the existing `valid receipt requests verification recording` scenario, replace
the expected command spec with this result-independent shape:

```js
assert.deepEqual(result.commandSpecs, [{
  commandId: "record-check",
  executable: "forgeloop",
  subcommand: "record-check",
  argv: ["record-check", "--id=requirement-59830ebc3a418411", "--requirement=tests"],
  requiredInputs: [
    { name: "status", option: "--status=<passed|failed|blocked|not-run>" },
    { name: "evidenceKind", option: "--evidence-kind=<OBSERVED|INFERRED|NOT_VERIFIED|BLOCKED>" },
    { name: "result", option: "--result=<text>" },
    { name: "exitCode", option: "--exit-code=<number>", optional: true },
  ],
}]);
const serialized = JSON.stringify(result.commandSpecs);
assert.doesNotMatch(serialized, /status.*passed|evidenceKind.*OBSERVED|exitCode.*0|tests passed/);
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run `node --test tests/next-action.test.js`.

Expected: the command-spec assertion fails because the current guidance
contains `--status passed`, `--evidence-kind OBSERVED`, and `--exit-code 0`.

- [ ] **Step 3: Add an explicit observed-pass sequence test**

Add a test that executes the actual lifecycle and asserts review guidance only
after a recorded observed pass:

```js
await setupTarget(target, { phase: "EXECUTING" });
await advanceWorkState(target, "VERIFYING", { packageRoot });
await prepareCompletion({ target, packageRoot });
assert.equal((await getNextAction({ target, packageRoot })).nextAction, NEXT_ACTIONS.RECORD_VERIFICATION);
await recordCheck({
  target, packageRoot, id: "tests", kind: "command", requirement: "tests",
  status: "passed", evidenceKind: "OBSERVED", result: "tests passed", exitCode: 0,
});
assert.equal((await getNextAction({ target, packageRoot })).nextAction, NEXT_ACTIONS.ENTER_REVIEWING);
```

- [ ] **Step 4: Add an explicit observed-failure sequence test**

Add a parallel sequence that records a non-zero observed failure and asserts
diagnosis guidance:

```js
await recordCheck({
  target, packageRoot, id: "tests", kind: "command", requirement: "tests",
  status: "failed", evidenceKind: "OBSERVED", result: "tests failed", exitCode: 1,
});
assert.equal((await getNextAction({ target, packageRoot })).nextAction, NEXT_ACTIONS.DIAGNOSE);
```

- [ ] **Step 5: Run the targeted tests again**

Run `node --test tests/next-action.test.js` and confirm the new unresolved
guidance assertion is the expected RED failure before production code changes.

### Task 2: Remove pre-assumed result fields from command guidance

**Files:**
- Modify: `src/core/next-action.js:107-120`
- Test: `tests/next-action.test.js`

**Interfaces:**
- Consumes: the existing `requirement` string and stable `sha256` helper.
- Produces: `recordCheckCommandSpec(requirement)` with deterministic `argv` and unresolved `requiredInputs`.

- [ ] **Step 1: Change only the command specification builder**

Replace its result-bearing `argv` suffix with this safe deterministic prefix and
runtime input list:

```js
function recordCheckCommandSpec(requirement) {
  const checkId = `requirement-${sha256(Buffer.from(requirement)).slice(0, 16)}`;
  return {
    commandId: "record-check",
    executable: "forgeloop",
    subcommand: "record-check",
    argv: ["record-check", `--id=${checkId}`, `--requirement=${requirement}`],
    requiredInputs: [
      { name: "status", option: "--status=<passed|failed|blocked|not-run>" },
      { name: "evidenceKind", option: "--evidence-kind=<OBSERVED|INFERRED|NOT_VERIFIED|BLOCKED>" },
      { name: "result", option: "--result=<text>" },
      { name: "exitCode", option: "--exit-code=<number>", optional: true },
    ],
  };
}
```

- [ ] **Step 2: Run the targeted test to verify GREEN**

Run `node --test tests/next-action.test.js`.

Expected: all next-action tests pass, including unresolved guidance, direct
process safety, observed pass, and observed failure behavior.

- [ ] **Step 3: Review the focused diff**

Run `git diff -- src/core/next-action.js tests/next-action.test.js` and verify
that no shell execution path, phase transition, evidence validator, or receipt
semantics changed.

### Task 3: Align canonical closure documentation and release metadata

**Files:**
- Modify: `LOOP_ENGINEERING.md:69-100`
- Modify: `package.json:3`

**Interfaces:**
- Consumes: the executable `next`, `prepare-completion`, `record-check`,
  `advance`, and `complete` commands.
- Produces: canonical documentation matching the persisted receipt prerequisite
  and package version `0.1.3`.

- [ ] **Step 1: Replace the post-implementation diagram**

Use this exact order and explain the receipt boundary:

```text
EXECUTING
    ↓ forgeloop next
advance --to VERIFYING
    ↓ forgeloop next
prepare-completion
    ↓
run applicable project checks
    ↓
record observed results with record-check
    ↓ forgeloop next
advance --to REVIEWING
    ↓ forgeloop next
complete
    ↓ VALID
COMPLETE
```

State that `prepare-completion` creates or refreshes the in-progress execution
receipt and never claims completion; completion still requires observed
evidence, chronology, review state, and validator requirements.

- [ ] **Step 2: Bump only the npm patch version**

Change `package.json` from `0.1.2` to `0.1.3`; keep protocol and schema versions
at `1`.

- [ ] **Step 3: Run documentation and package checks**

Run:

```bash
npm run pack:check
python3 scripts/validate_loop_system.py
python3 scripts/validate_markdown.py
python3 scripts/scan_secrets.py
```

Expected: every command exits `0` with no new findings.

### Task 4: Verify protocol-backed completion and full regression

**Files:**
- Modify: `tests/cli.test.js` (keep route persistence isolated from the active target)
- Modify: task-scoped `.forgeloop` artifacts through ForgeLoop commands and
  APIs; do not hand-edit lifecycle evidence.

**Interfaces:**
- Consumes: the approved contract, persisted route, satisfied gate, and READY preflight.
- Produces: structured observed evidence, REVIEWING state, a valid execution receipt, and `forgeloop complete` status `VALID`.

- [ ] **Step 1: Run the complete regression suite**

Run `npm test`.

Expected: exit `0`, zero failures, and output includes the new next-action
regressions. Route CLI tests must use temporary targets so the suite does not
overwrite an active target's persisted routing artifact.

- [ ] **Step 2: Advance the task through the required lifecycle**

Initialize the legal `RECEIVED` checkpoint through the validated state API,
because the CLI intentionally does not invent a task contract or work-state:

```bash
node --input-type=module -e 'import { readContract } from "./src/core/contract.js"; import { readPersistedRoute } from "./src/core/route-artifact.js"; import { createWorkState, writeWorkState } from "./src/core/work-state.js"; const contract = await readContract(".", "."); const route = await readPersistedRoute(".", "."); await writeWorkState(".", createWorkState({ taskId: contract.value.taskId, contractFingerprint: contract.fingerprint, routeFingerprint: route.fingerprint, repositoryFingerprint: { branch: null, head: null }, phase: "RECEIVED", selectedGuides: route.value.guides, requiredGates: ["threat-boundary"], satisfiedGates: ["threat-boundary"], completedSteps: [], pendingSteps: ["contract", "route", "implementation"], checks: [], failures: [], blockers: [], verificationEvidence: [] }), { packageRoot: "." });'
```

Run:

```bash
node src/cli.js activate --json
node src/cli.js advance --to DISCOVERING --json
node src/cli.js advance --to CONTRACT_READY --json
node src/cli.js advance --to ROUTED --json
node src/cli.js preflight --json
node src/cli.js advance --to PLANNED --json
node src/cli.js advance --to EXECUTING --json
node src/cli.js next --json
node src/cli.js advance --to VERIFYING --json
node src/cli.js prepare-completion --json
```

Then query `node src/cli.js next --json`; it must return
`RECORD_VERIFICATION` with unresolved result fields. Run the applicable project
checks and record their observed outputs with `record-check`; do not use
guidance defaults as observed results.

- [ ] **Step 3: Record evidence and enter review**

Run each required check and record its actual observed result explicitly:

```bash
node --test tests/next-action.test.js
node src/cli.js record-check --id=tests-next-action --kind=command --requirement=tests --status=passed --evidence-kind=OBSERVED --command="node --test tests/next-action.test.js" --result="exit 0" --exit-code=0 --json
npm run pack:check
node src/cli.js record-check --id=package-check --kind=command --requirement=package --status=passed --evidence-kind=OBSERVED --command="npm run pack:check" --result="exit 0" --exit-code=0 --json
python3 scripts/validate_loop_system.py && python3 scripts/validate_markdown.py
node src/cli.js record-check --id=documentation-check --kind=command --requirement=documentation --status=passed --evidence-kind=OBSERVED --command="python3 scripts/validate_loop_system.py && python3 scripts/validate_markdown.py" --result="exit 0" --exit-code=0 --json
python3 scripts/scan_secrets.py
node src/cli.js record-check --id=security-check --kind=command --requirement=security-validation --status=passed --evidence-kind=OBSERVED --command="python3 scripts/scan_secrets.py" --result="exit 0" --exit-code=0 --json
node src/cli.js advance --to REVIEWING --json
```

- [ ] **Step 4: Require validator-backed completion**

Run `node src/cli.js audit --json` and `node src/cli.js complete --json`.

Expected: audit is valid and complete returns `status: "VALID"`; otherwise
report the exact blocking artifact/error instead of claiming completion.

- [ ] **Step 5: Inspect final scope and publication state**

Run:

```bash
git status --short --branch
git diff --check
git diff --stat
```

Expected: only the approved implementation, tests, documentation, version, and
task-scoped evidence are present; no push, PR, merge, or deployment is claimed.
