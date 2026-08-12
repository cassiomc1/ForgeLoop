# Post-Execution Lifecycle Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, read-only `forgeloop next` guidance through the persisted ForgeLoop lifecycle and close the observed `EXECUTING` to `VERIFYING` navigation gap.

**Architecture:** A new `src/core/next-action.js` reads validated contract, route, preflight, state, events, checks, and receipt artifacts and returns stable action data. `src/commands/next.js` and `src/cli.js` expose the same data as text and JSON. Existing `advance --to VERIFYING` remains the only mutation and reconciles the implementation step.

**Tech Stack:** Node.js 20+, native ESM, `node:test`, existing artifact validators, Markdown instruction templates.

## Global Constraints

- Preserve protocol version 1, all existing phases/transitions, strict evidence, receipts, completion validation, security boundaries, and publication semantics.
- `forgeloop next` must be read-only and must never execute project commands, invoke agents, write files, schedule work, publish, or deploy.
- Decisions must use persisted schema-valid artifacts, not source scans, timestamps, prose, or completion claims.
- Use existing CLI conventions; do not add a redundant step command.
- Preserve the pre-existing untracked `.forgeloop/routing-result.json` and never stage it.
- Run RED, focused GREEN, full Node regression, and repository validators.

---

### Task 1: Add failing next-action tests and the third-run fixture

**Files:**
- Create: `tests/next-action.test.js`
- Create: `tests/fixtures/states/third-live-executing.json`
- Later create: `src/core/next-action.js`

**Interfaces:**
- Test `getNextAction({ target, packageRoot })` and `NEXT_ACTIONS`.
- Build fixtures with real contract, route, gate, preflight, state, event, check, evidence, and receipt helpers.

- [ ] **Step 1: Write the empty-target RED test**

Create a temporary-target helper and assert:

```js
const before = await readdir(target);
const result = await getNextAction({ target, packageRoot });

assert.equal(result.schemaVersion, 1);
assert.equal(result.protocolVersion, 1);
assert.equal(result.taskId, "unknown");
assert.equal(result.currentPhase, "RECEIVED");
assert.equal(result.nextAction, NEXT_ACTIONS.DISCOVER);
assert.equal(result.terminal, false);
assert.deepEqual(await readdir(target), before);
```

Run `node --test tests/next-action.test.js`. Expected: a missing-module failure for `src/core/next-action.js`.

- [ ] **Step 2: Build a schema-valid fixture helper**

Implement a test-only `setupTarget` helper using existing functions `createContract`, `writeContract`, `evaluateRoute`, `persistRoute`, `createWorkState`, `writeWorkState`, `appendProtocolEvent`, `runPreflight`, `createCheck`, `prepareCompletion`, and `recordCheck`.

Support phase, completed/pending steps, checks, evidence, receipt, preflight readiness, and stale route overrides. Do not mock the decision module.

- [ ] **Step 3: Add phase-matrix tests**

Assert:

| State | Action |
| --- | --- |
| absent or RECEIVED | DISCOVER |
| DISCOVERING | CREATE_CONTRACT |
| CONTRACT_READY | ROUTE |
| ROUTED with missing gate | SATISFY_GATES |
| ROUTED with valid gates | PLAN or RUN_PREFLIGHT |
| DESIGNING | PLAN |
| PLANNED without READY preflight | RUN_PREFLIGHT |
| PLANNED with READY preflight | START_EXECUTION |
| EXECUTING with valid chronology | ENTER_VERIFYING |
| DIAGNOSING | CORRECT |
| CORRECTING | ENTER_VERIFYING |
| COMPLETE | NONE and terminal |
| BLOCKED | RESOLVE_BLOCKER |

Assert every returned action is in the exported stable action set.

- [ ] **Step 4: Add evidence-aware tests**

Cover:

```text
VERIFYING with no checks -> RECORD_VERIFICATION
VERIFYING with a failed check -> DIAGNOSE
VERIFYING with all required observed checks -> ENTER_REVIEWING
REVIEWING without receipt and with valid coverage -> PREPARE_COMPLETION
REVIEWING with valid receipt and valid coverage -> RUN_COMPLETE
```

Only a passed check with `OBSERVED` evidence may contribute coverage.

- [ ] **Step 5: Add the exact third-run regression fixture**

Create `tests/fixtures/states/third-live-executing.json`:

```json
{
  "phase": "EXECUTING",
  "completedSteps": ["discovery", "contract", "routing", "design", "planning", "preflight"],
  "pendingSteps": ["implementation", "verification", "review"],
  "checks": [],
  "verificationEvidence": [],
  "evidenceCoverage": [],
  "executionStarted": true,
  "preflightStatus": "READY"
}
```

Materialize valid surrounding artifacts in the test. Assert `ENTER_VERIFYING`, a command containing `advance --to VERIFYING`, a non-terminal result, and never `NONE` or `COMPLETE`.

- [ ] **Step 6: Add safety/read-only tests**

Cover stale route or contract, executing without READY preflight, premature reviewing without evidence, malformed state, deterministic repeated JSON, and unchanged hashes for all target artifacts.

- [ ] **Step 7: Run RED**

Run `node --test tests/next-action.test.js`. Production assertions must fail until Task 2.

### Task 2: Implement the read-only decision module

**Files:**
- Create: `src/core/next-action.js`
- Test: `tests/next-action.test.js`

**Interfaces:**
- Export `NEXT_ACTIONS` and `getNextAction({ target, packageRoot })`.
- Return `schemaVersion`, `protocolVersion`, `taskId`, `currentPhase`, `nextAction`, `terminal`, `reasonCodes`, `reasons`, `commands`, `requiredArtifacts`, and `missingArtifacts`.

- [ ] **Step 1: Define stable action identifiers**

Implement:

```js
export const NEXT_ACTIONS = Object.freeze({
  DISCOVER: "DISCOVER",
  CREATE_CONTRACT: "CREATE_CONTRACT",
  ROUTE: "ROUTE",
  SATISFY_GATES: "SATISFY_GATES",
  RUN_PREFLIGHT: "RUN_PREFLIGHT",
  PLAN: "PLAN",
  START_EXECUTION: "START_EXECUTION",
  ENTER_VERIFYING: "ENTER_VERIFYING",
  RECORD_VERIFICATION: "RECORD_VERIFICATION",
  DIAGNOSE: "DIAGNOSE",
  CORRECT: "CORRECT",
  ENTER_REVIEWING: "ENTER_REVIEWING",
  PREPARE_COMPLETION: "PREPARE_COMPLETION",
  RUN_COMPLETE: "RUN_COMPLETE",
  RESOLVE_STALE_ROUTE: "RESOLVE_STALE_ROUTE",
  RESOLVE_BLOCKER: "RESOLVE_BLOCKER",
  NONE: "NONE"
});
```

Use one deterministic result builder for all branches.

- [ ] **Step 2: Implement artifact and freshness guards**

Absent work state returns `RECEIVED` and `DISCOVER` with `WORK_STATE_ABSENT` and no writes.

Malformed state returns `RESOLVE_BLOCKER` with `WORK_STATE_INVALID`.

Read contract and route through existing validators. Compare fingerprints and relationships. Stale contract or route returns `RESOLVE_STALE_ROUTE` with `E_CONTRACT_STALE` or `E_ROUTE_STALE`. Missing artifacts include exact relative paths.

Read `evaluatePreflight({ target, packageRoot })` and `validateEventLedger(target, packageRoot)` without persistence. Missing gates return `SATISFY_GATES`. Executing without READY preflight or required chronology returns `RESOLVE_BLOCKER` with `E_PREFLIGHT_NOT_READY` or `E_PHASE_CHRONOLOGY_INVALID`.

- [ ] **Step 3: Implement phase decisions**

Use persisted `state.phase` only:

```text
RECEIVED       -> DISCOVER
DISCOVERING    -> CREATE_CONTRACT
CONTRACT_READY -> ROUTE
ROUTED         -> SATISFY_GATES, RUN_PREFLIGHT, or PLAN
DESIGNING      -> SATISFY_GATES or PLAN
PLANNED        -> RUN_PREFLIGHT or START_EXECUTION
EXECUTING      -> ENTER_VERIFYING
VERIFYING      -> RECORD_VERIFICATION, DIAGNOSE, or ENTER_REVIEWING
DIAGNOSING     -> CORRECT
CORRECTING     -> ENTER_VERIFYING
REVIEWING      -> PREPARE_COMPLETION or RUN_COMPLETE
COMPLETE       -> NONE
BLOCKED        -> RESOLVE_BLOCKER
```

Use only existing commands: `advance --to PLANNED`, `preflight --json`, `advance --to EXECUTING`, `advance --to VERIFYING`, `advance --to DIAGNOSING`, `advance --to CORRECTING`, `advance --to REVIEWING`, `prepare-completion --json`, and `complete --json`. For host artifact creation, return guidance without inventing a command.

- [ ] **Step 4: Implement evidence-aware VERIFYING and REVIEWING**

For `VERIFYING`:

1. failed check -> `DIAGNOSE`;
2. blocked check -> `RESOLVE_BLOCKER`;
3. compute requirements with `requiredEvidenceForTarget`;
4. compute coverage with `coverageForRequirements`;
5. all requirements covered -> `ENTER_REVIEWING`;
6. otherwise -> `RECORD_VERIFICATION` with guidance to run checks and use `record-check`.

For `REVIEWING`:

1. recompute coverage;
2. missing coverage -> `RESOLVE_BLOCKER`, never completion;
3. missing/invalid receipt with valid coverage -> `PREPARE_COMPLETION`;
4. valid receipt and valid cross-artifact completion evaluation -> `RUN_COMPLETE`;
5. stale or premature state -> `RESOLVE_BLOCKER`.

The query itself never invokes `record-check`, `prepare-completion`, or `complete`.

- [ ] **Step 5: Run GREEN and commit**

Run `node --test tests/next-action.test.js`. Then commit:

```bash
git add src/core/next-action.js tests/next-action.test.js tests/fixtures/states/third-live-executing.json
git commit -m "feat: add deterministic lifecycle next action"
```

### Task 3: Expose the CLI and reconcile implementation completion

**Files:**
- Create: `src/commands/next.js`
- Modify: `src/cli.js`
- Modify: `src/core/phase.js`
- Modify: `tests/cli.test.js`
- Modify: `tests/lifecycle.test.js`

**Interfaces:**
- `runNext({ target, packageRoot })` calls the core function.
- `formatNextActionResult(result)` renders the shared result.
- Legal `EXECUTING` to `VERIFYING` moves `implementation` from pending to completed only at that transition.

- [ ] **Step 1: Add failing CLI/lifecycle tests**

Assert human and JSON output:

```js
const human = runCli(target, "next");
assert.equal(human.status, 0, human.stderr);
assert.match(human.stdout, /FORGELOOP NEXT: ENTER_VERIFYING/);
assert.match(human.stdout, /advance --to VERIFYING/);

const json = runCli(target, "next", "--json");
assert.equal(json.status, 0, json.stderr);
assert.equal(JSON.parse(json.stdout).nextAction, "ENTER_VERIFYING");
```

Assert transition reconciliation:

```js
const next = await advanceWorkState(target, "VERIFYING", { packageRoot: repositoryRoot });
assert.deepEqual(next.completedSteps, ["contract", "route", "implementation"]);
assert.deepEqual(next.pendingSteps, ["verification"]);
assert.deepEqual(next.verificationEvidence, []);
```

Run `node --test tests/cli.test.js tests/lifecycle.test.js`. Expected: CLI unknown-command failure and lifecycle mismatch.

- [ ] **Step 2: Add command and parser support**

Create `src/commands/next.js` with `runNext` and a formatter containing `FORGELOOP NEXT: <action>`, current phase, ordered reasons, existing commands, missing artifacts, and `STATE: TERMINAL` only for `NONE`.

Register `next` in CLI command names, usage, JSON-capable commands, imports, dispatch, and option validation. Reject unrelated flags.

- [ ] **Step 3: Reconcile implementation in phase transition**

In `src/core/phase.js` add:

```js
function reconcileImplementationStep(state, toPhase) {
  if (state.phase !== "EXECUTING" || toPhase !== "VERIFYING") return state;
  if (!state.pendingSteps.includes("implementation")) return state;
  return {
    ...state,
    completedSteps: state.completedSteps.includes("implementation")
      ? [...state.completedSteps]
      : [...state.completedSteps, "implementation"],
    pendingSteps: state.pendingSteps.filter((step) => step !== "implementation")
  };
}
```

Apply it before phase metadata is written. Preserve evidence arrays and append only existing `VERIFICATION_STARTED`.

- [ ] **Step 4: Run focused GREEN and commit**

Run:

```bash
node --test tests/next-action.test.js tests/lifecycle.test.js tests/cli.test.js
git add src/commands/next.js src/cli.js src/core/phase.js tests/cli.test.js tests/lifecycle.test.js
git commit -m "feat: expose lifecycle next guidance"
```

### Task 4: Update instructions, adapters, docs, and scorecard

**Files:**
- Modify: `LOOP_ENGINEERING.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `.cursor/rules/project-loop.mdc`
- Modify: `.github/copilot-instructions.md`
- Modify: `README.md`
- Modify: `conformance/README.md`
- Modify: `QUALITY_SCORECARD.md`
- Modify: `tests/instructions.test.js`
- Modify: `tests/conformance-scenarios.test.js` only if exact prompt assertions require it

- [ ] **Step 1: Add failing instruction assertions**

Add to `tests/instructions.test.js`:

```js
const trigger = /After implementation work for the current task is complete, run `forgeloop next`/i;
for (const file of ["AGENTS.md", "CLAUDE.md", ".cursor/rules/project-loop.mdc", ".github/copilot-instructions.md"]) {
  assert.match(await readFile(file, "utf8"), trigger, file);
}
assert.match(await readFile("LOOP_ENGINEERING.md", "utf8"), /ACT.*QUERY NEXT.*ACT/s);
assert.match(await readFile("README.md", "utf8"), /forgeloop next --json/);
```

Run `node --test tests/instructions.test.js`. Expected: fail before documentation changes.

- [ ] **Step 2: Update canonical Loop Engineering**

Under post-implementation closure, add:

```text
ACT → QUERY NEXT → ACT → QUERY NEXT → … → TERMINAL

At each lifecycle boundary, query persisted state with `forgeloop next` before
choosing the next action. Always query after implementation, verification,
correction, and review. The query is advisory and read-only; the host agent
runs checks and applies the returned legal transition or repair action.
```

Keep strict completion language unchanged.

- [ ] **Step 3: Update all shipped adapters**

Add this exact paragraph to `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/project-loop.mdc`, and `.github/copilot-instructions.md`:

```text
After implementation work for the current task is complete, run `forgeloop next`
before returning a final result. Follow the returned lifecycle action until
ForgeLoop reaches a terminal state or an explicit blocker.
```

Do not duplicate the full lifecycle policy.

- [ ] **Step 4: Update README and conformance documentation**

Add `forgeloop next` and `forgeloop next --json` to README examples and explain that both read persisted state only. Document:

```text
implementation
→ forgeloop next
→ advance --to VERIFYING
→ checks + record-check
→ forgeloop next
→ advance --to REVIEWING
→ prepare-completion / forgeloop next
→ complete
```

Add the same query-driven path to `conformance/README.md` while keeping blind product prompts free of protocol coaching.

- [ ] **Step 5: Update scorecard**

Add separate rows for agent lifecycle navigation and execution-to-verification handoff. Preserve the third-run position:

```text
Execution → Verification     REPRODUCED FAILURE before this fix
Verification serialization   NOT_REACHED
Review transition             NOT_REACHED
Receipt generation            NOT_REACHED
Full conformance              PARTIAL
```

Do not classify unvisited phases as failures.

- [ ] **Step 6: Run documentation checks and commit**

Run:

```bash
node --test tests/instructions.test.js tests/conformance-scenarios.test.js
python3 scripts/validate_markdown.py --self-test
python3 scripts/validate_markdown.py
git add LOOP_ENGINEERING.md AGENTS.md CLAUDE.md .cursor/rules/project-loop.mdc .github/copilot-instructions.md README.md conformance/README.md QUALITY_SCORECARD.md tests/instructions.test.js tests/conformance-scenarios.test.js
git commit -m "docs: guide agents through lifecycle boundaries"
```

### Task 5: Full regression and handoff

**Files:** Only files listed in Tasks 1–4, except scoped test corrections.

- [ ] **Step 1: Run full Node tests**

```bash
npm test
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run repository validators**

```bash
npm run pack:check
python3 -m unittest discover -s tests -v
python3 scripts/validate_markdown.py --self-test
python3 scripts/validate_markdown.py
python3 scripts/validate_loop_system.py --self-test
python3 scripts/validate_loop_system.py
python3 scripts/scan_secrets.py
```

Expected: all commands exit 0. Run documented local link checking when available and report exact external failures separately.

- [ ] **Step 3: Verify read-only behavior manually**

Create a temporary valid third-run target. Run `node src/cli.js next --path "$TARGET" --json` twice. Compare byte-identical output and hashes for every existing `.forgeloop` artifact before and after.

- [ ] **Step 4: Inspect final diff**

Run `git diff --check`, `git diff --stat`, `git status --short --branch`, and `git diff HEAD~3..HEAD --name-only`. Confirm the pre-existing untracked `.forgeloop/routing-result.json` remains unstaged and no unrelated files are included.

- [ ] **Step 5: Do not run the fourth blind test**

The fourth blind test begins only after CI is green and the user explicitly requests it. Report branch, commits, checks, limitations, and publication state.
