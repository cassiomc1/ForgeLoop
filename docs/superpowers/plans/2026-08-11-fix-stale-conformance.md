# Fix STALE Conformance Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive `STALE` conformance from current checkpoint freshness without persisting derived status in work-state artifacts.

**Architecture:** Extract the current-evidence portion of `readAndClassifyWorkState` into a reusable helper that accepts an already validated state object. Pass its runtime classification separately into `validateTaskArtifactSet`, and have `validate-protocol` use the helper before conformance. Keep the persisted schema, protocol version, CLI read-only boundary, and existing status/inspect contracts unchanged.

**Tech Stack:** Node.js ESM, Node built-ins, JSON Schema subset, Node test runner, Python repository validators, Markdown documentation.

## Global Constraints

- Keep `schemas/work-state.schema.json` unchanged regarding derived freshness fields.
- Keep protocol version `1`; do not add a runtime, provider, scheduler, or graph dependency.
- `validate-protocol` must remain read-only and must recompute repository, contract, and required-artifact evidence from the selected target.
- Invalid or inconsistent artifact relationships retain precedence over `STALE`; `STALE` takes precedence over `INCOMPLETE`.
- Preserve `status` and `inspect` behavior through the shared freshness helper.
- Use RED → expected failure → minimal GREEN → regression verification for behavior changes.

---

### Task 1: Separate derived freshness from conformance input

**Files:**

- Modify: `src/core/conformance.js`
- Modify: `src/core/work-state.js`
- Test: `tests/conformance.test.js`
- Test: `tests/checkpoint-freshness.test.js`

**Interfaces:**

- `classifyLoadedWorkState({ target, state, packageRoot, contractFile, maxAgeMs })` returns the existing classification fields plus repository, contract, error, and evidence metadata for an already validated state.
- `validateTaskArtifactSet({ route, state, stateClassification, receipt, taskBriefs, delegatedResults })` derives `STALE` only from `stateClassification.status`.

- [ ] **Step 1: Replace the synthetic stale test with runtime classification input.**

  Change the conformance regression to pass:

  ```js
  stateClassification: {
    status: "REVALIDATION_REQUIRED",
    reasons: ["CONTRACT_CHANGED"],
    warnings: [],
    repositoryComparison: "MATCH",
    contractComparison: "MISMATCH",
    artifactComparison: "NOT_APPLICABLE",
  }
  ```

  Assert `STALE`, an empty error list, and the derived `stale` comparison/reason fields.

- [ ] **Step 2: Run the focused conformance test and confirm the old implementation fails.**

  Run: `node --test tests/conformance.test.js`

  Expected: the new runtime-classification stale assertion fails because conformance still reads the non-persisted `state.status` field.

- [ ] **Step 3: Add the shared loaded-state freshness helper.**

  Move the repository, optional contract, required-artifact, error, and evidence assembly currently inside `readAndClassifyWorkState` into `classifyLoadedWorkState`. Keep the existing missing/invalid canonical checkpoint branches in `readAndClassifyWorkState`, and make its valid-state branch call the helper.

- [ ] **Step 4: Change conformance precedence and stale details.**

  Replace the `state?.status` check with `stateClassification?.status`. Return `stale: null` for non-stale results and, for stale results, return:

  ```js
  {
    reasons: stateClassification.reasons,
    warnings: stateClassification.warnings,
    repositoryComparison: stateClassification.repositoryComparison,
    contractComparison: stateClassification.contractComparison,
    artifactComparison: stateClassification.artifactComparison,
  }
  ```

- [ ] **Step 5: Run focused tests and the existing freshness tests.**

  Run: `node --test tests/conformance.test.js tests/checkpoint-freshness.test.js`

  Expected: PASS with no persisted `status` field added.

### Task 2: Route validate-protocol through freshness classification

**Files:**

- Modify: `src/commands/validate-protocol.js`
- Modify: `src/cli.js`
- Test: `tests/validate-protocol-cli.test.js`
- Test: `tests/cli.test.js`

**Interfaces:**

- `runValidateProtocol({ target, packageRoot, routeFile, stateFile, receiptFile, contractFile, taskBriefFiles, delegatedResultFiles })` derives state freshness before final conformance.
- CLI accepts `--contract-file <path>` for `validate-protocol` and rejects it for unrelated commands.

- [ ] **Step 1: Add CLI regressions for the new option and stale cases.**

  Add read-only temporary-target cases for: changed contract, omitted contract, changed repository fingerprint, changed required artifact, missing required artifact, and matching contract/artifacts. Each complete case supplies coherent route/state/receipt/task-brief/delegated-result artifacts and asserts `STALE` or `VALID` plus the exact reason/comparison.

- [ ] **Step 2: Run the focused CLI tests and confirm they fail before implementation.**

  Run: `node --test tests/validate-protocol-cli.test.js tests/cli.test.js --test-name-pattern="validate-protocol|contract-file"`

  Expected: failures because `validate-protocol` does not accept `--contract-file` and does not pass freshness metadata to conformance.

- [ ] **Step 3: Add `contractFile` to validate-protocol argument validation and invocation.**

  Expose it in command usage, allow it only for `validate-protocol`, and pass it to `runValidateProtocol`. Keep all existing artifact path safety checks.

- [ ] **Step 4: Classify a validated loaded state before conformance.**

  After schema/semantic validation of the supplied state, call `classifyLoadedWorkState` with the selected target, package root, and optional contract path. Pass the returned classification as `stateClassification` to `validateTaskArtifactSet`. Do not mutate the loaded state object.

- [ ] **Step 5: Expose stale details in human-readable output.**

  Extend `formatValidateProtocolResult` with repository, contract, required-artifact, and reason lines when `result.stale` is present. Keep JSON output deterministic and preserve error/incomplete formatting.

- [ ] **Step 6: Run focused CLI and JSON-output tests.**

  Run: `node --test tests/validate-protocol-cli.test.js tests/cli.test.js tests/json-output.test.js`

  Expected: PASS with `VALID`, `STALE`, `INCOMPLETE`, `INCONSISTENT`, and `INVALID` behavior preserved.

### Task 3: Document and verify the aligned contract

**Files:**

- Modify: `README.md`
- Modify: `EXECUTION_STATE.md`
- Modify: `QUALITY_SCORECARD.md`
- Modify: `CONTRACT_COVERAGE.md`

**Interfaces:**

- Documentation states that `STALE` is derived from current evidence and never persisted.
- Coverage maps the shared freshness helper and all stale negative cases to executable tests.

- [ ] **Step 1: Update documentation examples and boundaries.**

  Document `validate-protocol --contract-file`, the conservative `CONTRACT_NOT_VERIFIED` behavior, stale comparison output, and the prohibition on adding `status` to persisted work state.

- [ ] **Step 2: Run documentation-focused checks.**

  Run: `python3 scripts/validate_markdown.py --self-test && python3 scripts/validate_markdown.py && python3 scripts/validate_loop_system.py --self-test && python3 scripts/validate_loop_system.py`

  Expected: all Markdown and universal-loop checks pass.

- [ ] **Step 3: Run proportional regression and inspect the complete diff.**

  Run: `npm test && npm run pack:check && python3 -m unittest discover -s tests -v && python3 scripts/scan_secrets.py && git diff --check`

  Confirm no schema status field, no protocol-version change, no runtime dependency, and no unrelated file changes.
