# ForgeLoop Troubleshooting Guide

This guide provides symptom-first recovery procedures for common ForgeLoop protocol, state, and verification issues.

---

## Quick Symptom Index

- [`preflight` is `BLOCKED`](#symptom-preflight-is-blocked)
- [`forgeloop next` returns `RESOLVE_BLOCKER`](#symptom-forgeloop-next-returns-resolve_blocker)
- [`forgeloop next` returns `RECORD_DIAGNOSIS`](#symptom-forgeloop-next-returns-record_diagnosis)
- [Progress is `STALLED` or `forgeloop next` returns `CHANGE_STRATEGY`](#symptom-progress-is-stalled)
- [Protocol state or contract is `STALE`](#symptom-state-or-contract-is-stale)
- [Execution continuity is `STALE`](#symptom-continuity-is-stale)
- [Multiple tasks ambiguous (`E_TASK_AMBIGUOUS`)](#symptom-multiple-tasks-ambiguous)
- [Verification tool is missing (`E_VERIFICATION_TOOL_UNAVAILABLE`)](#symptom-verification-tool-is-missing)
- [Installation authority required (`E_INSTALLATION_AUTHORITY_REQUIRED`)](#symptom-installation-authority-required)
- [Execution reference invalid (`E_EXECUTION_REF_INVALID`)](#symptom-execution-reference-invalid)
- [`forgeloop complete` returns `INCOMPLETE`](#symptom-forgeloop-complete-returns-incomplete)
- [`forgeloop complete` returns `INVALID`](#symptom-forgeloop-complete-returns-invalid)
- [Policy lock mismatch (`E_POLICY_LOCK_MISMATCH`)](#symptom-policy-lock-mismatch)
- [Invalid policy artifacts fail closed (`E_POLICY_INVALID`)](#symptom-invalid-policy-artifacts-fail-closed)
- [Policy weakening detected (`E_POLICY_WEAKENING`)](#symptom-policy-weakening-detected)
- [Baseline re-record blocked during active task (`E_BASELINE_RECORD_DURING_ACTIVE_TASK`)](#symptom-baseline-re-record-blocked-during-active-task)
- [Mutation checker execution error (`E_CHECK_MUTATION_EXECUTION_ERROR`)](#symptom-mutation-checker-execution-error)
- [Another harness cannot resume the task](#symptom-another-harness-cannot-resume)
- [Stable Error & Reason Code Reference](#stable-error-and-reason-codes)

---

## Symptoms and Recovery

Confirm the local CLI's public metadata before diagnosing a harness/version
mismatch. This check does not create or mutate task state.

<!-- FORGELOOP EXAMPLE: troubleshooting:protocol-info | exit=0 | json.errors.0.code=E_AUTHORITY_INVALID -->
```bash
forgeloop protocol-info --json
```
<!-- END FORGELOOP EXAMPLE -->

### Symptom: `preflight` is `BLOCKED`

#### What it means

Pre-implementation gates (e.g. `design`, `threat-boundary`) are unsatisfied, missing, or referencing stale files, or the contract contains unresolved blocking decisions. ForgeLoop preserves specific preflight error codes (`E_CONTRACT_UNRESOLVED_DECISION`, `E_CONTRACT_STALE`, `E_ROUTE_STALE`, `E_GATE_UNVERIFIED`) in `reasons` instead of reducing them to generic readiness errors.

#### Likely causes

1. A gate required by an activated guide has no corresponding `.forgeloop/task-state/<taskKey>/gates/<gate>.json` file (`E_GATE_UNVERIFIED`).
2. The gate artifact references files whose SHA-256 hashes changed after the gate was satisfied (`E_GATE_STALE`).
3. Contract `unresolvedDecisions` contains blocking decisions (`E_CONTRACT_UNRESOLVED_DECISION`).

#### Inspect

```bash
forgeloop task-show --task <id> --json
forgeloop preflight --task <id> --json
forgeloop next --task <id> --json
```

#### Safe recovery

1. If a gate is missing, satisfy required gates or create the gate artifact with status `"satisfied"`.
2. If an artifact hash changed, update the artifact SHA-256 in the gate file.
3. If `unresolvedDecisions` contains blocking items:
   - Record settlement guidance with `forgeloop record-decision-criterion --decision="..." --settled-by="..."` to provide context.
   - Resolve or remove the blocking decision in `contract.json`.
4. Re-run `forgeloop preflight --task <id> --json`.

#### Do not

Do not bypass preflight by manually editing `work-state.json`.

---

### Symptom: `forgeloop next` returns `RESOLVE_BLOCKER`

#### What it means

The protocol has encountered a condition that prevents automatic progression until an explicit blocker is resolved.

#### Likely causes

1. Task `work-state.json` was deleted or is out of sync with `contract.json`.
2. A verification check failed and no diagnostic hypothesis was recorded.
3. A required gate is unsatisfied.

#### Inspect

```bash
forgeloop status --task <id> --json
forgeloop next --task <id> --json
```

#### Safe recovery

1. Check the `reasons` field in the `forgeloop next --json` output.
2. Follow the suggested command in `commands` or `commandSpecs`.
3. If in `VERIFYING` after a failure, advance to `DIAGNOSING`, record a diagnosis with `forgeloop record-diagnosis`, and advance to `CORRECTING`.

---

### Symptom: `forgeloop next` returns `RECORD_DIAGNOSIS`

#### What it means

The task is in `DIAGNOSING` phase following a verification failure, but no append-only diagnosis event (`DIAGNOSIS_RECORDED`) has been recorded for the active verification cycle (`E_DIAGNOSIS_REQUIRED`).

#### Likely causes

1. A check failed in `VERIFYING` and the phase was advanced to `DIAGNOSING` without calling `record-diagnosis`.
2. An attempt was made to advance directly to `CORRECTING` without recording an evidence-backed root cause hypothesis.

#### Inspect

```bash
forgeloop status --task <id> --json
forgeloop next --task <id> --json
```

#### Safe recovery

Record an append-only diagnosis referencing at least one failed or blocked check from the current verification cycle:

```bash
forgeloop record-diagnosis --task <id> \
  --hypothesis="Root cause explanation" \
  --failure-class="VERIFICATION_FAILURE" \
  --evidence-ref="failed-check-id" \
  --settled-by="Observable condition that settles the hypothesis" \
  --next-safe-action="Smallest safe action to address the hypothesis"
```

Then advance to `CORRECTING`:

```bash
forgeloop advance --task <id> --to CORRECTING
```

---

### Symptom: Progress is `STALLED`

#### What it means

Deterministic progress evaluation detected that iterative correction cycles are not advancing (`E_PROGRESS_STALLED`). The latest diagnosis produced `informationGain: NONE` (signal `NO_DIAGNOSTIC_INFORMATION_GAIN`), or a specific contract requirement failed across 3+ verification cycles with an identical diagnosis (`REPEATED_FAILURE_WITH_SAME_DIAGNOSIS`).

#### Likely causes

1. A recorded diagnosis in a new cycle repeated the previous hypothesis with the exact same evidence references (`informationGain: NONE`). Note: technical retries within the *same* cycle are idempotent and do not cause stalls, but repeating in a *new* cycle does.
2. The same requirement has repeatedly failed across 3 or more verification cycles with unchanged diagnostic hypotheses.
3. Minor cosmetic changes were made to `settledBy` or `nextSafeAction` without changing the root hypothesis or evidence references.

#### Inspect

```bash
forgeloop progress --task <id> --json
forgeloop next --task <id> --json
```

#### Safe recovery

1. When stalled, `forgeloop next` returns `nextAction: "CHANGE_STRATEGY"` with error code `E_PROGRESS_STALLED`.
2. Do not repeat the same retry or correction action.
3. Re-examine the failure evidence from a new angle or gather fresh diagnostic evidence.
4. Formulate a genuinely new root-cause hypothesis with new evidence references and record it with `forgeloop record-diagnosis`.
5. Once a diagnosis with positive information gain (`NEW_HYPOTHESIS`, `NEW_EVIDENCE`, `NEW_HYPOTHESIS_AND_EVIDENCE`) is recorded, `forgeloop next` returns `CORRECT` and status returns to `ADVANCING`.

---

### Symptom: State or Contract is `STALE`

#### What it means

An upstream artifact was modified, invalidating downstream cryptographic fingerprint bindings.

#### Likely causes

1. `contract.json` was edited after `work-state.json` or `routing-result.json` was created (`E_CONTRACT_STALE`).
2. Git `HEAD` changed (commit or checkout) while in `EXECUTING` or `VERIFYING`.

#### Inspect

```bash
forgeloop task-show --task <id> --json
forgeloop status --task <id> --json
```

#### Safe recovery

1. If the contract changed intentionally:

   ```bash
   forgeloop route --task <id> --work <type> [options] --json
   forgeloop preflight --task <id> --json
   ```

2. Re-validate state:

   ```bash
   forgeloop validate-protocol --task <id> --json
   ```

---

### Symptom: `EXECUTING`/`VERIFYING` task is stale because the repository moved (`E_REPOSITORY_CHANGED`)

#### What it means

A task entered `EXECUTING` at an older checkout and the repository HEAD changed (commit, merge, or checkout). The work-state checkpoint fingerprint no longer matches, so transitions and completion are fail-closed with `E_REPOSITORY_CHANGED` / `E_STATE_REVALIDATION_REQUIRED`. This is intentional: execution must not silently continue against different code.

If the task's objective is already satisfied by the current repository (for example, the work was merged by another change), the checkpoint can be reconciled with executed evidence:

```bash
forgeloop reconcile-closure --task <id> --id <verification-id> \
  --requirement "<exact contract verification text>" -- <command>
```

`reconcile-closure` requires:

1. The task is `EXECUTING` or `VERIFYING` (later phases are not reconcilable; work must return to a verification phase first).
2. The only drift is `REPOSITORY_CHANGED` (contract or required-artifact drift stays blocked).
3. The append-only event ledger is valid.
4. `--id` and `--requirement` exactly match a `VERIFICATION` item of the task contract, and the executed command exits 0, proving the objective is present in the current repository.

It then appends a `CHECKPOINT_RECONCILED` ledger event (previous/current repository fingerprints plus the evidence) and refreshes the work-state repository fingerprint. Closure still goes through the canonical pipeline:

```bash
forgeloop advance --task <id> --to VERIFYING
forgeloop prepare-completion --task <id>
forgeloop run-check --task <id> --id <id> --requirement "<text>" -- <command>
forgeloop advance --task <id> --to REVIEWING
forgeloop complete --task <id>
```

Write claims release only when completion is validator-backed (`COMPLETE`).

---

### Symptom: Continuity is `STALE`

#### What it means

`.forgeloop/task-state/<taskKey>/continuity.json` references a previous `work-state.json` fingerprint or older checkout state.

#### Likely causes

Another harness or developer committed changes or advanced lifecycle phases without updating continuity.

#### Inspect

```bash
forgeloop continuity --task <id> --json
```

#### Safe recovery

1. Reconcile continuity with current state:

   ```bash
   forgeloop reconcile-continuity --task <id> --json
   ```

2. If continuity is obsolete, clear it:

   ```bash
   forgeloop clear-continuity --task <id>
   ```

   *Note: Clearing continuity does not lose lifecycle state; `work-state.json` remains intact.*

---

### Symptom: Multiple Tasks Ambiguous

#### Error Code: `E_TASK_AMBIGUOUS`

#### What it means

Multiple active tasks exist in `.forgeloop/task-state/`, but the command was run without an explicit `--task` flag or `FORGELOOP_TASK` environment variable.

#### Inspect

```bash
forgeloop task-list --json
```

#### Safe recovery

Specify the task ID explicitly using the `--task` flag:

```bash
forgeloop status --task <task-id> --json
forgeloop next --task <task-id> --json
```

Or set the environment variable for your shell session:

```bash
export FORGELOOP_TASK="<task-id>"
```

---

### Symptom: Verification Tool is Missing

#### Error Code: `E_VERIFICATION_TOOL_UNAVAILABLE`

#### What it means

A verification check requires an executable or tool that is not installed in the local environment.

#### Likely causes

1. The toolchain is missing a package or global binary (e.g. `linter`, `test runner`).
2. Running in an isolated or sandboxed environment without network access.

#### Safe recovery

1. Use an already available local equivalent (e.g. `node scripts/run-tests.js` instead of an external runner).
2. If an authorized host authority grant is available, install the tool.
3. If no equivalent exists and installation is unauthorized, record the check as `NOT_VERIFIED` or `BLOCKED`.

#### Do not

**Do not run ad-hoc install commands (e.g. `npm i -g tool` or `npx tool`) without explicit operator authority.**

---

### Symptom: Installation Authority Required

#### Error Code: `E_INSTALLATION_AUTHORITY_REQUIRED`

#### What it means

ForgeLoop intercepted a command that attempted to install software or fetch remote packages without a verified host authority grant.

#### Likely causes

Running `npx`, `npm install`, `yarn add`, or `pnpm add` during `run-check` or `record-check`.

#### Safe recovery

Use non-installing execution equivalents (e.g. `npm test`, `node <script>`, `./node_modules/.bin/<tool>`).

---

### Symptom: Execution Reference Invalid

#### Error Code: `E_EXECUTION_REF_INVALID`

#### What it means

A check was claimed with a reference to an execution ID that does not exist in `.forgeloop/task-state/<taskKey>/executions/`.

#### Safe recovery

Execute the check through ForgeLoop CLI so that execution provenance is attested:

```bash
forgeloop run-check --task <id> --id <check-id> --requirement <requirement-id> -- <command...>
```

---

### Symptom: `forgeloop complete` returns `INCOMPLETE`

#### What it means

One or more contract success criteria have not been covered by passing verification checks.

#### Inspect

```bash
forgeloop audit --task <id> --json
```

Inspect the `coverage` array to find items with status `"NOT_VERIFIED"` or `"FAILED"`.

#### Safe recovery

1. Advance to `VERIFYING` if not already there:

   ```bash
   forgeloop advance --task <id> --to VERIFYING
   ```

2. Execute the missing check:

   ```bash
   forgeloop run-check --task <id> --id <id> --requirement <uncovered-requirement> -- <command...>
   ```

3. Advance to `REVIEWING` and retry `forgeloop complete --task <id> --json`.

---

### Symptom: `forgeloop complete` returns `INVALID`

#### What it means

Protocol integrity checks failed (e.g. ledger sequence error, missing contract deliverable, or hash mismatch).

#### Inspect

```bash
forgeloop validate-protocol --task <id> --json
```

#### Safe recovery

Inspect the specific error reported in `errors[]` and correct the inconsistent artifact.

---

### Symptom: Policy Lock Mismatch

#### Error Code: `E_POLICY_LOCK_MISMATCH`

#### What it means

The persisted `.forgeloop/policy/policy.lock` digest or required subdigests (`rulesDigest`, `baselineDigest`, `algorithm`) do not match current effective rules or baseline.

#### Inspect

```bash
forgeloop policy-status --json
```

#### Safe recovery

1. If rules or baseline were legitimately modified, re-evaluate and update the lock via discovery/baseline commands:

   ```bash
   forgeloop policy-discover --write --json
   forgeloop baseline --update --json
   ```

2. If modifications were unintentional, restore the previous `.forgeloop/policy/rules.json` or `.forgeloop/policy/baseline.json`.

3. Follow `forgeloop next --json` if returned recovery action is `RESTORE_POLICY`.

---

### Symptom: Invalid Policy Artifacts Fail Closed

#### Error Code: `E_POLICY_INVALID`

#### What it means

One or more executable policy artifacts (`.forgeloop/policy/rules.json`, `.forgeloop/policy/baseline.json`, `.forgeloop/policy/discovery.json`, or `.forgeloop/policy/policy.lock`) is present but malformed or fails schema validation. ForgeLoop does not silently ignore corrupt policy: preflight and completion fail closed.

#### Inspect

```bash
forgeloop policy-status --json
```

#### Safe recovery

1. Validate each policy artifact against its schema and repair the malformed JSON or invalid fields.

2. Re-run preflight:

   ```bash
   forgeloop preflight --task <id> --json
   ```

3. Follow `forgeloop next --task <id> --json` if the returned recovery action is `REPAIR_POLICY`.

---

### Symptom: Policy Weakening Detected

#### Error Code: `E_POLICY_WEAKENING`

#### What it means

Policy rules were relaxed or baseline debt expanded after the task policy snapshot was captured during preflight.

#### Safe recovery

1. Inspect the policy diff:

   ```bash
   forgeloop policy-diff --task <id> --json
   ```

2. Restore the original policy configuration captured in `.forgeloop/task-state/<taskKey>/policy-snapshot.json`.

3. Re-query `forgeloop next --task <id> --json` (returns `RESTORE_POLICY`).

---

### Symptom: Baseline Re-Record Blocked During Active Task

#### Error Code: `E_BASELINE_RECORD_DURING_ACTIVE_TASK`

#### What it means

`forgeloop baseline --record` was executed during an active task bound to a preflight policy snapshot. Re-recording during active tasks is blocked to prevent converting new violations into accepted debt.

#### Safe recovery

1. Fix newly introduced violations instead of recording them into baseline debt.

2. If resolving legacy debt, use monotonic ratchet-down:

   ```bash
   forgeloop baseline --update --json
   ```

3. If an intentional full baseline re-recording is authorized by an operator, supply the explicit authority flag:

   ```bash
   forgeloop baseline --record --policy-reset-authorized --json
   ```

---

### Symptom: Mutation Checker Execution Error

#### Error Code: `E_CHECK_MUTATION_EXECUTION_ERROR`

#### What it means

A policy rule checker threw an unhandled exception while evaluating its synthetic mutation fixture during `rule-verify`. A crashing checker cannot prove its mutation detection efficacy.

#### Safe recovery

1. Inspect the checker error stack and adapter implementation:

   ```bash
   forgeloop rule-verify --rule <rule-id> --json
   ```

2. Repair the unhandled exception path in the checker adapter.

3. Re-run `forgeloop rule-verify --rule <rule-id> --json` until the mutation is proven (`PROVEN`).

---

### Symptom: Another Harness Cannot Resume

#### Likely causes

1. The new harness started by creating a new contract instead of discovering existing tasks via `task-list` or `status`.
2. State is locked in a terminal or blocked condition.

#### Safe recovery

In the new harness:

```bash
# 1. Discover existing state
forgeloop task-list --json
forgeloop status --task <id> --json

# 2. Reconcile continuity
forgeloop reconcile-continuity --task <id> --json

# 3. Ask for next action
forgeloop next --task <id> --json
```

---

## Stable Error and Reason Codes

<!-- BEGIN FORGELOOP GENERATED: public-error-codes -->

| Code | Meaning | Safe Resolution |
| --- | --- | --- |
| `E_AUTHORITY_INVALID` | Authority grant file is malformed or expired. | Obtain a valid authority grant from host operator. |
| `E_AUTHORITY_SCOPE_MISMATCH` | Authority grant does not cover the requested package. | Request updated authority scope. |
| `E_AUTHORITY_UNTRUSTED_SOURCE` | Authority file placed inside untrusted project tree. | Place authority file in host-managed trusted location. |
| `E_BASELINE_EXPANSION` | Attempted unauthorized addition of new violations to brownfield baseline. | Resolve new violations rather than expanding the baseline. |
| `E_BASELINE_RECORD_DURING_ACTIVE_TASK` | Cannot re-record baseline during an active task with policy snapshot. | Resolve new violations or use monotonic baseline --update. |
| `E_CHECK_INERT` | An enabled check has no effective scope or target files. | Provide an applicable target scope, configure matching files, or mark the rule unsupported. |
| `E_CHECK_INVALID` | Check structure or required parameters are invalid. | Provide valid check ID, requirement, and parameters. |
| `E_CHECK_MUTATION_EXECUTION_ERROR` | A policy checker threw an unhandled exception while evaluating its mutation fixture. | Repair the checker execution path and rerun rule verification. |
| `E_CHECK_MUTATION_NOT_DETECTED` | A blocking rule checker failed to detect an intentional mutation fixture. | Fix checker logic to properly identify target violations. |
| `E_CHECK_STATUS_CONTRADICTION` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_CIRCULAR_COMPLETION_REQUIREMENT` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_COMMAND_RESOLUTION_AMBIGUOUS` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_COMPLETION_RECOVERY_UNAUTHORIZED` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_COMPLETION_REJECTED` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_COMPLETION_REJECTION_LEDGER_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_COMPLETION_REJECTION_RECEIPT_FINGERPRINT_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_COMPLETION_REJECTION_STATE_FINGERPRINT_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_CONTINUITY_CONTRACT_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_CONTINUITY_INVALID` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_CONTINUITY_PHASE_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_CONTINUITY_RECONCILIATION_REQUIRED` | Continuity context has drifted from work state. | Run forgeloop reconcile-continuity --json. |
| `E_CONTINUITY_SCHEMA_UNSUPPORTED` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_CONTINUITY_STATE_MISSING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_CONTINUITY_TASK_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_CONTRACT_INVALID` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_CONTRACT_MISSING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_CONTRACT_STALE` | Contract modified after downstream artifacts were generated. | Re-run forgeloop route and forgeloop preflight. |
| `E_CONTRACT_UNRESOLVED_DECISION` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_DECISION_CRITERION_INVALID` | Decision settlement criterion details or parameters are malformed. | Provide non-empty decision text and settledBy criterion. |
| `E_DECISION_NOT_UNRESOLVED` | A settlement criterion referenced a decision not present in current unresolvedDecisions. | Use the exact current unresolved decision text or update the contract first. |
| `E_DIAGNOSIS_CYCLE_MISMATCH` | Diagnosis verification cycle does not match the active work state verification cycle. | Record diagnosis for the current active verification cycle. |
| `E_DIAGNOSIS_EVIDENCE_INVALID` | Referenced diagnosis evidence is missing or has no failed checks in the current cycle. | Reference at least one failed or blocked check ID from the active verification cycle. |
| `E_DIAGNOSIS_INVALID` | Diagnosis record details or parameters are malformed. | Provide valid failureClass, hypothesis, evidenceRefs, settledBy, and nextSafeAction. |
| `E_DIAGNOSIS_NO_NEW_INFORMATION` | The proposed retry repeats the previous hypothesis with the same evidence. | Change the hypothesis, collect independent evidence, or change strategy. |
| `E_DIAGNOSIS_REQUIRED` | Current correction cycle has no append-only diagnosis record. | Run forgeloop record-diagnosis with current failed evidence before correcting. |
| `E_EVIDENCE_COVERAGE_INVALID` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_EVIDENCE_COVERAGE_PARTIAL` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_EVIDENCE_INVALID` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_EVIDENCE_KIND_INVALID` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_EVIDENCE_PARTIAL` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_EVIDENCE_REQUIRED` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_EVIDENCE_STALE` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_EXECUTION_REF_INVALID` | Referenced execution ID does not exist. | Re-run check via forgeloop run-check. |
| `E_FUTURE_LIFECYCLE_EVIDENCE` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_FUTURE_TERMINAL_EVIDENCE` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_GATE_REQUIRED` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_GATE_STALE` | Referenced gate artifact changed after approval. | Update artifact SHA-256 in gate file. |
| `E_GATE_UNVERIFIED` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_INIT_KIT_CONFLICT` | A canonical ForgeLoop kit destination already exists with content that does not match the shipped canonical template. | Inspect the conflicting `.forgeloop/kit/...` file. If it is stale or partial ForgeLoop output, remove or restore it and rerun `forgeloop init`. Do not overwrite unknown content automatically. |
| `E_INSTALLATION_AUTHORITY_REQUIRED` | Attempted software installation without host authority grant. | Use local non-installing binaries or request host authority grant. |
| `E_MIGRATION_INCOMPLETE` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_MIGRATION_WRITE_VERIFY` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_MIXED_TERMINAL_REQUIREMENT` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_NATIVE_ADAPTER_STALE` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_NATIVE_ADAPTER_TARGET_MISSING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_NEW_POLICY_VIOLATION` | New executable policy violation detected that is not present in brownfield baseline. | Fix the violation before completing the task. |
| `E_PHASE_CHRONOLOGY_INVALID` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PHASE_PREREQUISITE_MISSING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PHASE_TRANSITION_INVALID` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_POLICY_DRIFT` | Active policy lock does not match the policy snapshot captured at task activation. | Re-verify affected checks or restore original policy. |
| `E_POLICY_DRIFT_UNKNOWN` | Task policy drift was detected but baseline snapshot details are unavailable. | Re-verify the task under the current policy state. |
| `E_POLICY_EVALUATION_FAILED` | Policy evaluation threw an unexpected error during execution. | Inspect policy configuration and checker adapters for unhandled errors. |
| `E_POLICY_INITIALIZATION_FAILED` | Executable policy bootstrap could not complete during initialization. | Repair the reported filesystem/schema error and rerun `forgeloop init`. Initialization is restartable while no committed manifest exists. |
| `E_POLICY_INVALID` | Policy artifact is malformed, corrupt, or schema-invalid. | Validate and repair rules.json, baseline.json, or discovery.json against schema. |
| `E_POLICY_LOCK_INVALID` | Policy lockfile is missing, malformed, or corrupt. | Run forgeloop policy-status or regenerate policy.lock. |
| `E_POLICY_LOCK_MISMATCH` | Persisted policy lock digest does not match current effective policy state. | Re-evaluate effective rules and update policy.lock or restore modified rules. |
| `E_POLICY_PROOF_STALE` | Mutation verification proof is stale due to checker or fixture modifications. | Re-run forgeloop rule-verify to refresh mutation proof. |
| `E_POLICY_SNAPSHOT_WRITE_FAILED` | Failed to persist task policy snapshot during preflight. | Ensure the target task directory is writable and repair filesystem permissions. |
| `E_POLICY_WEAKENING` | Policy rules were weakened during task execution without explicit authority. | Restore the original policy configuration. |
| `E_PREFLIGHT_EVENT_MISSING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PREFLIGHT_GATES_STALE` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PREFLIGHT_GATE_EVENT_MISSING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PREFLIGHT_NOT_READY` | Preflight gates or contract validations are incomplete. | Satisfy required gates and check preflight output. |
| `E_PREFLIGHT_READY_EVENT_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PREFLIGHT_READY_EVENT_MISSING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PRODUCTION_READINESS_UNVERIFIED` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PRODUCTION_REQUIREMENT_PENDING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PROFILE_SOURCE_MISCLASSIFIED` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PROFILE_SOURCE_MISSING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PROFILE_SOURCE_UNKNOWN` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PROFILE_UNVERIFIED` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PROGRESS_STALLED` | Persisted correction history shows no new diagnostic information. | Use an independent check, revisit assumptions, or record a materially different diagnosis. |
| `E_PUBLICATION_CLAIM_UNVERIFIED` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_PUBLICATION_REQUIREMENT_PENDING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_RECEIPT_CONTRACT_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_RECEIPT_CYCLE_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_RECEIPT_INVALID` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_RECEIPT_MISSING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_RECEIPT_PATH_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_RECEIPT_ROUTE_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_RECEIPT_STATE_MISMATCH` | Receipt does not match current state cycle or work state. | Run forgeloop prepare-completion --json. |
| `E_RECEIPT_TASK_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_RECONCILE_EVIDENCE_FAILED` | The executed objective-satisfaction evidence command did not pass. | Inspect the execution artifact; reconciliation is refused until evidence passes in the current repository. |
| `E_RECONCILE_LEDGER_INVALID` | The append-only event ledger is not valid, so reconciliation cannot be recorded. | Inspect the ledger errors and repair before reconciling. |
| `E_RECONCILE_NOT_STALE` | reconcile-closure was invoked for a work-state checkpoint that is already fresh. | No reconciliation is required; continue the normal lifecycle. |
| `E_RECONCILE_PHASE_INVALID` | reconcile-closure was invoked for a task that is not EXECUTING or VERIFYING. | reconcile-closure supports EXECUTING or VERIFYING tasks whose objective is already satisfied. |
| `E_RECONCILE_REQUIREMENT_UNKNOWN` | The supplied check id and requirement text do not exactly match a contract verification item of type VERIFICATION. | Supply the exact id and requirement text of an existing contract verification item. |
| `E_RECONCILE_UNSUPPORTED_DRIFT` | Work-state drift includes kinds other than REPOSITORY_CHANGED (contract or required-artifact drift). | Resolve contract or artifact drift through their dedicated recovery surfaces; reconcile-closure only refreshes repository fingerprint drift. |
| `E_REPOSITORY_CHANGED` | The repository fingerprint (branch or HEAD) moved after the work-state checkpoint was recorded. | If the task objective is already satisfied in the current repository, run forgeloop reconcile-closure; otherwise resume from a checkpoint that matches the current repository. |
| `E_ROUTE_GUIDE_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_ROUTE_INVALID` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_ROUTE_MISSING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_ROUTE_REASON_MISSING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_ROUTE_STALE` | Routing result does not match the active contract fingerprint. | Re-run forgeloop route. |
| `E_STATE_LEDGER_DIVERGENCE` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_STATE_MISSING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_STATE_MISSING_AFTER_PREFLIGHT_READY` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_STATE_REVALIDATION_REQUIRED` | The work-state checkpoint must be revalidated before the lifecycle can continue. | Run forgeloop reconcile-closure for externally satisfied EXECUTING tasks, or inspect the freshness reasons for other drift. |
| `E_STATE_TASK_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_ALREADY_EXISTS` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_AMBIGUOUS` | Multiple tasks exist in the project but no task selector was provided. | Select a task explicitly using --task <id> or FORGELOOP_TASK=<id>. |
| `E_TASK_CHANGE_ATTRIBUTION_UNAVAILABLE` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_CHANGE_OUTSIDE_SCOPE` | Modified paths in repository exceed the declared task write claims. | Update write claims with forgeloop task-scope or revert out-of-scope modifications. |
| `E_TASK_CONTEXT_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_DESCRIPTOR_INVALID` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_KEY_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_LAYOUT_LEGACY` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_LOCKED` | Task mutation is currently locked by another concurrent process or run-check. | Wait for the active mutation to complete or inspect the lock with forgeloop task-show. |
| `E_TASK_LOCK_INVALID` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_MIGRATION_IDENTITY_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_MIGRATION_INVALID` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_NOT_FOUND` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_REQUIRED` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_SCOPE_CONFLICT` | Task write claims overlap with another non-complete task in the same checkout. | Adjust write claims to non-overlapping paths or run tasks in separate worktrees. |
| `E_TASK_SCOPE_DIRTY` | Claimed paths contain pre-existing uncommitted changes. | Commit or stash changes in claimed paths before defining or adopting the scope. |
| `E_TASK_SCOPE_FROZEN` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_SCOPE_REQUIRED` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TASK_SELECTOR_CONFLICT` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TERMINAL_REQUIREMENT_NOT_TERMINAL` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TERMINAL_REQUIREMENT_PENDING` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TERMINAL_REQUIREMENT_TYPE_MISMATCH` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TERMINAL_REQUIREMENT_UNKNOWN` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_TERMINAL_STATUS_REGRESSION` | A ForgeLoop protocol validation or lifecycle condition was not satisfied. | Inspect the structured command result, correct the named artifact or prerequisite, then run forgeloop next --json. |
| `E_VERIFICATION_TOOL_UNAVAILABLE` | Required verification executable is missing in environment. | Use local equivalent, obtain host authority, or record NOT_VERIFIED. |

<!-- END FORGELOOP GENERATED: public-error-codes -->
