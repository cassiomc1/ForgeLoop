# ForgeLoop Troubleshooting Guide

This guide provides symptom-first recovery procedures for common ForgeLoop protocol, state, and verification issues.

---

## Quick Symptom Index

- [`preflight` is `BLOCKED`](#symptom-preflight-is-blocked)
- [`forgeloop next` returns `RESOLVE_BLOCKER`](#symptom-forgeloop-next-returns-resolve_blocker)
- [Protocol state or contract is `STALE`](#symptom-state-or-contract-is-stale)
- [Execution continuity is `STALE`](#symptom-continuity-is-stale)
- [Verification tool is missing (`E_VERIFICATION_TOOL_UNAVAILABLE`)](#symptom-verification-tool-is-missing)
- [Installation authority required (`E_INSTALLATION_AUTHORITY_REQUIRED`)](#symptom-installation-authority-required)
- [Execution reference invalid (`E_EXECUTION_REF_INVALID`)](#symptom-execution-reference-invalid)
- [`forgeloop complete` returns `INCOMPLETE`](#symptom-forgeloop-complete-returns-incomplete)
- [`forgeloop complete` returns `INVALID`](#symptom-forgeloop-complete-returns-invalid)
- [Another harness cannot resume the task](#symptom-another-harness-cannot-resume)
- [Stable Error & Reason Code Reference](#stable-error-and-reason-codes)

---

## Symptoms and Recovery

### Symptom: `preflight` is `BLOCKED`

#### What it means

Pre-implementation gates (e.g. `design`, `threat-boundary`) are unsatisfied, missing, or referencing stale files.

#### Likely causes

1. A gate required by an activated guide has no corresponding `.forgeloop/gates/<gate>.json` file.
2. The gate artifact references files whose SHA-256 hashes changed after the gate was satisfied.
3. Contract `unresolvedDecisions` contains blocking decisions.

#### Inspect

```bash
forgeloop preflight --json
```

#### Safe recovery

1. If a gate is missing, create `.forgeloop/gates/<gate>.json` with status `"satisfied"`.
2. If an artifact hash changed, update the artifact SHA-256 in the gate file.
3. Re-run `forgeloop preflight --json`.

#### Do not

Do not bypass preflight by manually editing `work-state.json`.

---

### Symptom: `forgeloop next` returns `RESOLVE_BLOCKER`

#### What it means

The protocol has encountered a condition that prevents automatic progression until an explicit blocker is resolved.

#### Likely causes

1. `work-state.json` was deleted or is out of sync with `current-contract.json`.
2. A verification check failed and no diagnostic hypothesis was recorded.
3. A required gate is unsatisfied.

#### Inspect

```bash
forgeloop status --json
forgeloop next --json
```

#### Safe recovery

1. Check the `reasons` field in the `forgeloop next --json` output.
2. Follow the suggested command in `commands` or `commandSpecs`.
3. If in `VERIFYING` after a failure, record a hypothesis, apply the fix, and re-run `run-check`.

---

### Symptom: State or Contract is `STALE`

#### What it means

An upstream artifact was modified, invalidating downstream cryptographic fingerprint bindings.

#### Likely causes

1. `.forgeloop/current-contract.json` was edited after `work-state.json` or `routing-result.json` was created (`E_CONTRACT_STALE`).
2. Git `HEAD` changed (commit or checkout) while in `EXECUTING` or `VERIFYING`.

#### Inspect

```bash
forgeloop status --json
```

#### Safe recovery

1. If the contract changed intentionally:

   ```bash
   forgeloop route --work <type> [options] --json
   forgeloop preflight --json
   ```

2. Re-validate state:

   ```bash
   forgeloop validate-protocol --json
   ```

---

### Symptom: Continuity is `STALE`

#### What it means

`.forgeloop/continuity.json` references a previous `work-state.json` fingerprint or older checkout state.

#### Likely causes

Another harness or developer committed changes or advanced lifecycle phases without updating continuity.

#### Inspect

```bash
forgeloop continuity --json
```

#### Safe recovery

1. Reconcile continuity with current state:

   ```bash
   forgeloop reconcile-continuity --json
   ```

2. If continuity is obsolete, clear it:

   ```bash
   forgeloop clear-continuity
   ```

   *Note: Clearing continuity does not lose lifecycle state; `work-state.json` remains intact.*

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

A check was claimed with a reference to an execution ID that does not exist in `.forgeloop/executions/`.

#### Safe recovery

Execute the check through ForgeLoop CLI so that execution provenance is attested:

```bash
forgeloop run-check --id <check-id> --requirement <requirement-id> -- <command...>
```

---

### Symptom: `forgeloop complete` returns `INCOMPLETE`

#### What it means

One or more contract success criteria have not been covered by passing verification checks.

#### Inspect

```bash
forgeloop audit --json
```

Inspect the `coverage` array to find items with status `"NOT_VERIFIED"` or `"FAILED"`.

#### Safe recovery

1. Advance to `VERIFYING` if not already there:

   ```bash
   forgeloop advance --to VERIFYING
   ```

2. Execute the missing check:

   ```bash
   forgeloop run-check --id <id> --requirement <uncovered-requirement> -- <command...>
   ```

3. Advance to `REVIEWING` and retry `forgeloop complete --json`.

---

### Symptom: `forgeloop complete` returns `INVALID`

#### What it means

Protocol integrity checks failed (e.g. ledger sequence error, missing contract deliverable, or hash mismatch).

#### Inspect

```bash
forgeloop validate-protocol --json
```

#### Safe recovery

Inspect the specific error reported in `errors[]` and correct the inconsistent artifact.

---

### Symptom: Another Harness Cannot Resume

#### Likely causes

1. The new harness started by creating a new contract instead of checking `.forgeloop/work-state.json`.
2. State is locked in a terminal or blocked condition.

#### Safe recovery

In the new harness:

```bash
# 1. Discover existing state
forgeloop status --json

# 2. Reconcile continuity
forgeloop reconcile-continuity --json

# 3. Ask for next action
forgeloop next --json
```

---

## Stable Error and Reason Codes

<!-- BEGIN FORGELOOP GENERATED: public-error-codes -->

| Code | Meaning | Safe Resolution |
| --- | --- | --- |
| `E_PREFLIGHT_NOT_READY` | Preflight gates or contract validations are incomplete. | Satisfy required gates and check preflight output. |
| `E_CONTRACT_STALE` | Contract modified after downstream artifacts were generated. | Re-run forgeloop route and forgeloop preflight. |
| `E_ROUTE_STALE` | Routing result does not match the active contract fingerprint. | Re-run forgeloop route. |
| `E_GATE_STALE` | Referenced gate artifact changed after approval. | Update artifact SHA-256 in gate file. |
| `E_VERIFICATION_TOOL_UNAVAILABLE` | Required verification executable is missing in environment. | Use local equivalent, obtain host authority, or record NOT_VERIFIED. |
| `E_INSTALLATION_AUTHORITY_REQUIRED` | Attempted software installation without host authority grant. | Use local non-installing binaries or request host authority grant. |
| `E_AUTHORITY_INVALID` | Authority grant file is malformed or expired. | Obtain a valid authority grant from host operator. |
| `E_AUTHORITY_SCOPE_MISMATCH` | Authority grant does not cover the requested package. | Request updated authority scope. |
| `E_AUTHORITY_UNTRUSTED_SOURCE` | Authority file placed inside untrusted project tree. | Place authority file in host-managed trusted location. |
| `E_EXECUTION_REF_INVALID` | Referenced execution ID does not exist. | Re-run check via forgeloop run-check. |
| `E_CHECK_INVALID` | Check structure or required parameters are invalid. | Provide valid check ID, requirement, and parameters. |
| `E_RECEIPT_STATE_MISMATCH` | Receipt does not match current state cycle or work state. | Run forgeloop prepare-completion --json. |
| `E_CONTINUITY_RECONCILIATION_REQUIRED` | Continuity context has drifted from work state. | Run forgeloop reconcile-continuity --json. |

<!-- END FORGELOOP GENERATED: public-error-codes -->
