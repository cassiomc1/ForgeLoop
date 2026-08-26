# ForgeLoop PoC Evidence Package (`poc-20260826-real-execution`)

This directory contains the complete, frozen evidence package from the real ForgeLoop engineering execution run `poc-20260826-real-execution` (Task ID: `poc-real-protocol-execution-20260826`).

---

## 1. Two-Layer Evidence Model

To ensure scientific integrity and eliminate ambiguity, this evidence package strictly separates **Layer A (Original Execution Evidence)** from **Layer B (Publication & Interpretation Metadata)**.

> **Integrity Notice:** Files under `task-state/` are preserved copies of original ForgeLoop task artifacts. Publication-layer files do not become protocol-authoritative merely because they are stored next to them.

```
poc/evidence/poc-20260826-real-execution/
├── task-state/                               [Layer A: Preserved Task-State Directory]
│   ├── contract.json                         (Agent-authored task contract)
│   ├── routing-result.json                   (Deterministic guide router output)
│   ├── preflight.json                        (Preflight readiness gate attestation)
│   ├── work-state.json                       (Canonical work-state checkpoint)
│   ├── execution-receipt.json                (Compiled requirement-to-evidence receipt)
│   ├── continuity.json                       (Operational handoff checkpoint)
│   ├── policy-snapshot.json                  (Bound capability policy digest)
│   ├── task.json                             (Task descriptor and claim bounds)
│   ├── events.ndjson                         (Append-only protocol event ledger)
│   ├── events.ndjson.index.json              (Ledger sequence index)
│   ├── gates/
│   │   └── threat-boundary.json              (Satisfied security gate artifact)
│   └── executions/                           (Trusted process execution provenance)
│       └── exec-*.json                       (Exact argv, exit code, stdout/stderr)
│
├── protocol-info.json                        [Layer B: Protocol discovery handshake]
├── completion.json                           [Layer B: Recovered CLI complete output]
├── completion-attestation.json               [Layer B: Derived completion attestation]
├── history.json                              [Layer B: Read-only event ledger projection]
├── trace.json                                [Layer B: Structured phase transition trace]
├── inspect.json                              [Layer B: Full task state inspection]
├── progress.json                             [Layer B: Progress anomaly signal report]
├── status-final.json                         [Layer B: Post-publication status projection]
├── validate-protocol.json                    [Layer B: Invariant validation result]
├── validate-receipt.json                     [Layer B: Receipt cryptographic integrity]
├── validate-state.json                       [Layer B: State revision validation]
├── audit.json                                [Layer B: Post-publication drift audit (INVALID)]
├── report.json                               [Layer B: Post-publication drift report (INVALID)]
├── publication.json                          [Layer B: GitHub PR #110 publication record]
├── manifest.json                             [Layer B: Cryptographic payload manifest]
├── manifest.sha256                           [Layer B: Detached manifest SHA-256 hash]
└── hashes.txt                                [Layer B: Non-recursive checksum catalog]
```

---

## 2. Artifact Classification Taxonomy

Every file in this evidence package belongs to an explicit classification:

| Classification | Meaning | Files |
| --- | --- | --- |
| **`PROTOCOL_AUTHORITATIVE`** | Protocol-managed append-only event ledger. | `task-state/events.ndjson`, `task-state/events.ndjson.index.json` |
| **`PROTOCOL_GENERATED`** | Created directly by ForgeLoop core state machine and lifecycle commands. | `task-state/work-state.json`, `task-state/preflight.json`, `task-state/routing-result.json`, `task-state/execution-receipt.json`, `task-state/continuity.json`, `task-state/policy-snapshot.json`, `task-state/task.json`, `protocol-info.json`, `completion.json` |
| **`PROTOCOL_EXECUTED`** | Captured process execution records with exact argv and exit code provenance. | `task-state/executions/exec-*.json` |
| **`AGENT_AUTHORED`** | Authored by the engineering agent and validated by ForgeLoop schema checks. | `task-state/contract.json`, `task-state/gates/threat-boundary.json` |
| **`READ_ONLY_PROJECTION`** | Non-mutating read projections computed from protocol state. | `history.json`, `trace.json`, `inspect.json`, `progress.json`, `status-final.json`, `task-show.json`, `validate-protocol.json`, `validate-receipt.json`, `validate-state.json` |
| **`POST_PUBLICATION_DRIFT_EVIDENCE`** | Preserved read-only outputs captured *after* evidence export altered the repository. | `audit.json`, `report.json` |
| **`PUBLICATION_METADATA`** | Metadata documenting the publication, packaging, hashing, and GitHub context. | `manifest.json`, `manifest.sha256`, `hashes.txt`, `publication.json`, `completion-attestation.json`, `README.md` |

---

## 3. Explaining Post-Publication Drift (`E_RECEIPT_PATH_MISMATCH`)

The published `audit.json` and `report.json` in this directory contain:

```json
{
  "status": "INVALID",
  "errors": [
    {
      "code": "E_RECEIPT_PATH_MISMATCH",
      "message": "Working tree contains paths not covered by execution receipt"
    }
  ]
}
```

### Why is this preserved?

1. **Original Completion Was Valid:** When `forgeloop complete` was executed during the task lifecycle, the receipt covered the exact 10 changed paths created by the workload and report. The completion validator verified receipt coverage, git scope, test executions, and ledger integrity, returning `status: VALID` and releasing write claims (`RELEASED_BY_COMPLETION`).
2. **Evidence Export Changed the Working Tree:** Immediately after completion, the agent exported the task state and projections into `poc/evidence/poc-20260826-real-execution/`. This created 32 new files in the repository.
3. **ForgeLoop Fail-Closed Detection:** When `forgeloop audit --strict` was subsequently run on the expanded repository, ForgeLoop's scope checker immediately flagged that the working tree contained paths not present in the original sealed receipt (`E_RECEIPT_PATH_MISMATCH`).
4. **Intentional Preservation:** Rather than deleting or doctoring this invalid audit, it is preserved here as positive proof that ForgeLoop detects repository drift and refuses to falsely certify an expanded working tree without a new verification cycle.

---

## 4. Cryptographic Verification

To independently verify the integrity of all evidence files:

```bash
# High-level verifier script
npm run poc:evidence:verify

# Low-level standard sha256 check
cd poc/evidence/poc-20260826-real-execution
shasum -a 256 -c hashes.txt
```
