# ForgeLoop Real Execution Proof of Concept (PoC)

This directory contains a real, reproducible, evidence-backed **Proof of Concept (PoC)** demonstrating that the ForgeLoop engineering protocol governs an actual development task from initial request through contract formulation, preflight gate validation, implementation, trusted command verification, audit, and validator-backed completion.

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
├── reports/
│   └── poc-20260826-real-execution-technical-audit.md  # Formal independent technical audit report
└── evidence/
    └── poc-20260826-real-execution/       # Publication snapshot of protocol-attested evidence
        ├── manifest.json                  # Cryptographic manifest of published evidence artifacts
        ├── hashes.txt                     # SHA-256 integrity checksums
        ├── protocol-info.json             # Protocol compatibility handshake
        ├── task-show.json                 # Task descriptor and write claims
        ├── preflight.json                 # Preflight readiness evaluation (READY)
        ├── routing-result.json            # Deterministic guide router output
        ├── execution-receipt.json         # Compiled execution receipt with trusted provenance
        ├── executions/                    # Detailed execution records from forgeloop run-check
        ├── validate-state.json            # Work state consistency validation
        ├── validate-receipt.json          # Execution receipt integrity validation
        ├── validate-protocol.json         # Protocol invariant validation
        ├── audit.json                     # Strict protocol audit evaluation
        ├── report.json                    # Final multi-dimensional status report
        ├── completion.json                # Authoritative validator-backed completion result
        ├── history.json                   # Full append-only event ledger history
        ├── trace.json                     # Structured lifecycle trace
        └── inspect.json                   # Task state inspection snapshot
```

---

## 2. Key Lifecycle Milestones

| Lifecycle Phase | Command Executed | Result / Output | Verifiable Artifact |
| --- | --- | --- | --- |
| **Discovery** | `forgeloop protocol-info --json` | Protocol version 1, package 1.6.0 | `evidence/.../protocol-info.json` |
| **Task Creation** | `forgeloop task-create --task poc-real-protocol-execution-20260826 --claim poc --claim DOCS_INDEX.md` | Task created with isolated write claims | `evidence/.../task-show.json` |
| **Routing** | `forgeloop route --work code --surface documentation ...` | Activated `clean`, `test`, `documentation`, `security` | `evidence/.../routing-result.json` |
| **Preflight Gate** | `forgeloop preflight --json` | Status: `READY` (threat-boundary satisfied) | `evidence/.../preflight.json` |
| **Planning** | `forgeloop advance --to PLANNED` | Phase advanced to `PLANNED` | `evidence/.../history.json` |
| **Execution** | `forgeloop advance --to EXECUTING` | Implemented workload & tests | `evidence/.../history.json` |
| **Verification** | `forgeloop advance --to VERIFYING` | Receipt initialized via `prepare-completion` | `evidence/.../execution-receipt.json` |
| **Trusted Checks** | `forgeloop run-check --id <id> --requirement <req> -- <cmd>` | All 5 verification checks passed (`FORGELOOP_EXECUTED`) | `evidence/.../executions/*.json` |
| **State Audit** | `forgeloop audit --strict --json` | Status: `VALID` (0 audit errors) | `evidence/.../audit.json` |
| **Completion** | `forgeloop complete --json` | Status: `VALID` (Validator-backed completion) | `evidence/.../completion.json` |

---

## 3. How to Reproduce & Verify the PoC

### 3.1 Run the Workload Test Suite

Execute the automated test suite directly using the native Node.js test runner:

```bash
node --test poc/workload/test/*.test.js
```

### 3.2 Test the Workload CLI

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

### 3.3 Verify Evidence Integrity

Verify the cryptographic SHA-256 hashes of all published evidence files:

```bash
shasum -a 256 -c poc/evidence/poc-20260826-real-execution/hashes.txt
```

### 3.4 Read the Technical Audit Report

Inspect the full independent technical audit report:
[`poc/reports/poc-20260826-real-execution-technical-audit.md`](./reports/poc-20260826-real-execution-technical-audit.md)
