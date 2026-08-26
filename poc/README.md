# ForgeLoop Real Execution Proof of Concept (PoC)

This directory contains a real, reproducible, evidence-backed **Proof of Concept (PoC)** demonstrating that the ForgeLoop engineering protocol governs an actual development task from initial request through contract formulation, preflight gate validation, implementation, trusted command verification, review, and validator-backed completion.

This is **not** a simulated scenario, mocked transcript, or documentation-only exercise. Every lifecycle transition and verification check in this PoC was executed by the actual project-local ForgeLoop CLI (`node src/cli.js`) and recorded in the append-only protocol event ledger.

---

## 1. Directory Structure

```text
poc/
├── README.md                              # This document: PoC overview, reproduction, and architecture
├── workload/                              # Real engineering workload created under ForgeLoop governance
│   ├── README.md                          # Workload documentation, API, and CLI reference
│   ├── src/
│   │   ├── cli.js                         # CLI entrypoint for risk evaluation
│   │   ├── evaluator.js                   # Core risk engine and score computation
│   │   ├── rules.js                       # Deterministic risk rule catalog and weights
│   │   └── schemas.js                     # Input schema validation logic
│   └── test/
│       ├── cli.test.js                    # CLI integration and exit code tests
│       └── evaluator.test.js              # Unit tests for scoring, rules, and boundaries
├── test/
│   └── poc-evidence-publication.test.js   # Automated regression tests for evidence verification
├── reports/
│   ├── poc-20260826-real-execution-technical-audit-v2.md  # Canonical technical audit report (v2)
│   └── poc-20260826-real-execution-technical-audit.md     # Historical technical audit report (v1)
└── evidence/
    └── poc-20260826-real-execution/       # Preserved evidence package and publication metadata
        ├── README.md                      # Evidence package taxonomy and drift explanation
        ├── manifest.json                  # Cryptographic manifest of published evidence artifacts
        ├── manifest.sha256                # Detached SHA-256 hash of manifest.json
        ├── hashes.txt                     # Non-recursive SHA-256 integrity checksums
        ├── publication.json               # GitHub publication metadata (PR #110)
        ├── protocol-info.json             # Protocol compatibility handshake
        ├── completion.json                # Recovered CLI complete output (VALID)
        ├── completion-attestation.json    # Derived completion attestation
        ├── history.json                   # Full append-only event ledger history projection
        ├── trace.json                     # Structured lifecycle trace projection
        ├── inspect.json                   # Task state inspection snapshot
        ├── progress.json                  # Progress anomaly signal report
        ├── status-final.json              # Post-publication status projection
        ├── validate-state.json            # Work state consistency validation
        ├── validate-receipt.json          # Execution receipt integrity validation
        ├── validate-protocol.json         # Protocol invariant validation (VALID)
        ├── audit.json                     # Preserved post-publication drift audit (INVALID / E_RECEIPT_PATH_MISMATCH)
        ├── report.json                    # Preserved post-publication drift report (INVALID)
        └── task-state/                    # Preserved original task-state directory
            ├── task.json                  # Task descriptor and write claims
            ├── contract.json              # Authoritative task contract specification
            ├── routing-result.json        # Deterministic guide router output
            ├── preflight.json             # Preflight readiness evaluation (READY)
            ├── work-state.json            # Canonical work-state checkpoint (COMPLETE)
            ├── execution-receipt.json     # Compiled execution receipt with trusted provenance
            ├── continuity.json            # Operational handoff checkpoint
            ├── policy-snapshot.json       # Bound capability policy digest
            ├── events.ndjson              # Raw append-only protocol event ledger
            ├── events.ndjson.index.json   # Event ledger sequence index
            ├── gates/
            │   └── threat-boundary.json   # Satisfied security gate artifact
            └── executions/                # Detailed execution records from forgeloop run-check
                └── exec-*.json            # Exact process argv, exit code, and resolution
```

---

## 2. Key Lifecycle Milestones & Dual Status Dimensions

The PoC explicitly documents both **execution-time lifecycle validity** and **post-publication drift detection**:

| Milestone | Command / Artifact | Status / Result | Verifiable Artifact |
| --- | --- | --- | --- |
| **Discovery** | `forgeloop protocol-info --json` | Protocol v1, package 1.6.0 | `evidence/.../protocol-info.json` |
| **Task Creation** | `forgeloop task-create ...` | Task `poc-real-protocol-execution-20260826` created | `evidence/.../task-state/task.json` |
| **Routing** | `forgeloop route ...` | Activated `clean`, `test`, `documentation`, `security` | `evidence/.../task-state/routing-result.json` |
| **Preflight Gate** | `forgeloop preflight --json` | Status: `READY` (threat-boundary satisfied) | `evidence/.../task-state/preflight.json` |
| **Execution** | `forgeloop advance --to EXECUTING` | Implemented workload & tests | `evidence/.../task-state/work-state.json` |
| **Trusted Checks** | `forgeloop run-check ...` | 9 verification checks executed (`FORGELOOP_EXECUTED`) | `evidence/.../task-state/executions/*.json` |
| **Completion** | `forgeloop complete --json` | Status: `VALID` (Phase: `COMPLETE`, claims released) | `evidence/.../completion.json` |
| **GitHub Publication** | PR #110 (`098f3c16...`) | Merged into `main` | `evidence/.../publication.json` |
| **Post-Publication Drift** | `forgeloop audit --strict --json` | Status: `INVALID` (`E_RECEIPT_PATH_MISMATCH`) | `evidence/.../audit.json` |

> **Why is `audit.json` marked `INVALID`?**  
> When the evidence files were exported into `poc/evidence/` after completion, 32 new files were added to the repository. ForgeLoop's strict audit detected that the repository contained paths not covered by the original execution receipt (`E_RECEIPT_PATH_MISMATCH`). Both states are preserved intentionally: the successful completion evidence and the subsequent fail-closed drift detection.

---

## 3. How to Reproduce & Verify the PoC

### 3.1 Verify Evidence Package Integrity

Run the deterministic, zero-dependency evidence verifier:

```bash
npm run poc:evidence:verify
```

Or run the automated regression tests:

```bash
node --test poc/test/poc-evidence-publication.test.js
```

### 3.2 Run the Workload Test Suite

Execute the workload unit and integration test suite:

```bash
node --test poc/workload/test/*.test.js
```

### 3.3 Test the Workload CLI

Run the deterministic risk evaluator CLI on a sample input:

```bash
node poc/workload/src/cli.js --eval '{
  "serviceName": "payment-api",
  "environment": "production",
  "changeType": "standard",
  "hasBreakingChange": false,
  "securityReviewCompleted": true,
  "maintenanceWindow": true,
  "canaryPercentage": 10,
  "automatedRollback": true
}'
```

### 3.4 Read the Technical Audit Reports

- **Canonical Report (v2):** [`poc/reports/poc-20260826-real-execution-technical-audit-v2.md`](./reports/poc-20260826-real-execution-technical-audit-v2.md)
- **Historical Report (v1):** [`poc/reports/poc-20260826-real-execution-technical-audit.md`](./reports/poc-20260826-real-execution-technical-audit.md)
