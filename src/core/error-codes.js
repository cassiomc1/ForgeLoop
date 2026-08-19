import { FAILURE_CODES } from "./protocol.js";
import {
  E_AUTHORITY_INVALID,
  E_AUTHORITY_SCOPE_MISMATCH,
  E_COMMAND_RESOLUTION_AMBIGUOUS,
  E_INSTALLATION_AUTHORITY_REQUIRED,
  E_VERIFICATION_TOOL_UNAVAILABLE,
} from "./verification-constants.js";

export const E_TASK_REQUIRED = "E_TASK_REQUIRED";
export const E_TASK_NOT_FOUND = "E_TASK_NOT_FOUND";
export const E_TASK_ALREADY_EXISTS = "E_TASK_ALREADY_EXISTS";
export const E_TASK_AMBIGUOUS = "E_TASK_AMBIGUOUS";
export const E_TASK_SELECTOR_CONFLICT = "E_TASK_SELECTOR_CONFLICT";
export const E_TASK_DESCRIPTOR_INVALID = "E_TASK_DESCRIPTOR_INVALID";
export const E_TASK_KEY_MISMATCH = "E_TASK_KEY_MISMATCH";
export const E_TASK_CONTEXT_MISMATCH = "E_TASK_CONTEXT_MISMATCH";

export const E_TASK_LOCKED = "E_TASK_LOCKED";
export const E_TASK_LOCK_INVALID = "E_TASK_LOCK_INVALID";

export const E_TASK_SCOPE_REQUIRED = "E_TASK_SCOPE_REQUIRED";
export const E_TASK_SCOPE_CONFLICT = "E_TASK_SCOPE_CONFLICT";
export const E_TASK_SCOPE_DIRTY = "E_TASK_SCOPE_DIRTY";
export const E_TASK_SCOPE_FROZEN = "E_TASK_SCOPE_FROZEN";
export const E_TASK_CHANGE_OUTSIDE_SCOPE = "E_TASK_CHANGE_OUTSIDE_SCOPE";
export const E_TASK_CHANGE_ATTRIBUTION_UNAVAILABLE = "E_TASK_CHANGE_ATTRIBUTION_UNAVAILABLE";

export const E_TASK_LAYOUT_LEGACY = "E_TASK_LAYOUT_LEGACY";
export const E_TASK_MIGRATION_INVALID = "E_TASK_MIGRATION_INVALID";
export const E_TASK_MIGRATION_IDENTITY_MISMATCH = "E_TASK_MIGRATION_IDENTITY_MISMATCH";

export const E_DIAGNOSIS_REQUIRED = "E_DIAGNOSIS_REQUIRED";
export const E_DIAGNOSIS_INVALID = "E_DIAGNOSIS_INVALID";
export const E_DIAGNOSIS_EVIDENCE_INVALID = "E_DIAGNOSIS_EVIDENCE_INVALID";
export const E_DIAGNOSIS_CYCLE_MISMATCH = "E_DIAGNOSIS_CYCLE_MISMATCH";
export const E_DIAGNOSIS_NO_NEW_INFORMATION = "E_DIAGNOSIS_NO_NEW_INFORMATION";
export const E_PROGRESS_STALLED = "E_PROGRESS_STALLED";
export const E_DECISION_CRITERION_INVALID = "E_DECISION_CRITERION_INVALID";
export const E_DECISION_NOT_UNRESOLVED = "E_DECISION_NOT_UNRESOLVED";

export const E_RECONCILE_NOT_STALE = "E_RECONCILE_NOT_STALE";
export const E_RECONCILE_PHASE_INVALID = "E_RECONCILE_PHASE_INVALID";
export const E_RECONCILE_UNSUPPORTED_DRIFT = "E_RECONCILE_UNSUPPORTED_DRIFT";
export const E_RECONCILE_LEDGER_INVALID = "E_RECONCILE_LEDGER_INVALID";
export const E_RECONCILE_REQUIREMENT_UNKNOWN = "E_RECONCILE_REQUIREMENT_UNKNOWN";
export const E_RECONCILE_EVIDENCE_FAILED = "E_RECONCILE_EVIDENCE_FAILED";
export const E_REPOSITORY_CHANGED = "E_REPOSITORY_CHANGED";
export const E_STATE_REVALIDATION_REQUIRED = "E_STATE_REVALIDATION_REQUIRED";

/**
 * Public, stable ForgeLoop error and reason codes documented for users and harnesses.
 */
export const PUBLIC_ERROR_CODES = Object.freeze({
  E_PREFLIGHT_NOT_READY: Object.freeze({
    code: "E_PREFLIGHT_NOT_READY",
    category: "preflight",
    classification: "PUBLIC_STABLE",
    meaning: "Preflight gates or contract validations are incomplete.",
    safeResolution: "Satisfy required gates and check preflight output.",
  }),
  E_CONTRACT_STALE: Object.freeze({
    code: "E_CONTRACT_STALE",
    category: "freshness",
    classification: "PUBLIC_STABLE",
    meaning: "Contract modified after downstream artifacts were generated.",
    safeResolution: "Re-run forgeloop route and forgeloop preflight.",
  }),
  E_ROUTE_STALE: Object.freeze({
    code: "E_ROUTE_STALE",
    category: "freshness",
    classification: "PUBLIC_STABLE",
    meaning: "Routing result does not match the active contract fingerprint.",
    safeResolution: "Re-run forgeloop route.",
  }),
  E_GATE_STALE: Object.freeze({
    code: "E_GATE_STALE",
    category: "freshness",
    classification: "PUBLIC_STABLE",
    meaning: "Referenced gate artifact changed after approval.",
    safeResolution: "Update artifact SHA-256 in gate file.",
  }),
  E_VERIFICATION_TOOL_UNAVAILABLE: Object.freeze({
    code: "E_VERIFICATION_TOOL_UNAVAILABLE",
    category: "capability",
    classification: "PUBLIC_STABLE",
    meaning: "Required verification executable is missing in environment.",
    safeResolution: "Use local equivalent, obtain host authority, or record NOT_VERIFIED.",
  }),
  E_INSTALLATION_AUTHORITY_REQUIRED: Object.freeze({
    code: "E_INSTALLATION_AUTHORITY_REQUIRED",
    category: "authority",
    classification: "PUBLIC_STABLE",
    meaning: "Attempted software installation without host authority grant.",
    safeResolution: "Use local non-installing binaries or request host authority grant.",
  }),
  E_AUTHORITY_INVALID: Object.freeze({
    code: "E_AUTHORITY_INVALID",
    category: "authority",
    classification: "PUBLIC_STABLE",
    meaning: "Authority grant file is malformed or expired.",
    safeResolution: "Obtain a valid authority grant from host operator.",
  }),
  E_AUTHORITY_SCOPE_MISMATCH: Object.freeze({
    code: "E_AUTHORITY_SCOPE_MISMATCH",
    category: "authority",
    classification: "PUBLIC_STABLE",
    meaning: "Authority grant does not cover the requested package.",
    safeResolution: "Request updated authority scope.",
  }),
  E_AUTHORITY_UNTRUSTED_SOURCE: Object.freeze({
    code: "E_AUTHORITY_UNTRUSTED_SOURCE",
    category: "authority",
    classification: "PUBLIC_STABLE",
    meaning: "Authority file placed inside untrusted project tree.",
    safeResolution: "Place authority file in host-managed trusted location.",
  }),
  E_EXECUTION_REF_INVALID: Object.freeze({
    code: "E_EXECUTION_REF_INVALID",
    category: "provenance",
    classification: "PUBLIC_STABLE",
    meaning: "Referenced execution ID does not exist.",
    safeResolution: "Re-run check via forgeloop run-check.",
  }),
  E_CHECK_INVALID: Object.freeze({
    code: "E_CHECK_INVALID",
    category: "verification",
    classification: "PUBLIC_STABLE",
    meaning: "Check structure or required parameters are invalid.",
    safeResolution: "Provide valid check ID, requirement, and parameters.",
  }),
  E_RECEIPT_STATE_MISMATCH: Object.freeze({
    code: "E_RECEIPT_STATE_MISMATCH",
    category: "verification",
    classification: "PUBLIC_STABLE",
    meaning: "Receipt does not match current state cycle or work state.",
    safeResolution: "Run forgeloop prepare-completion --json.",
  }),
  E_CONTINUITY_RECONCILIATION_REQUIRED: Object.freeze({
    code: "E_CONTINUITY_RECONCILIATION_REQUIRED",
    category: "continuity",
    classification: "PUBLIC_STABLE",
    meaning: "Continuity context has drifted from work state.",
    safeResolution: "Run forgeloop reconcile-continuity --json.",
  }),
  E_TASK_AMBIGUOUS: Object.freeze({
    code: "E_TASK_AMBIGUOUS",
    category: "task-resolution",
    classification: "PUBLIC_STABLE",
    meaning: "Multiple tasks exist in the project but no task selector was provided.",
    safeResolution: "Select a task explicitly using --task <id> or FORGELOOP_TASK=<id>.",
  }),
  E_TASK_LOCKED: Object.freeze({
    code: "E_TASK_LOCKED",
    category: "concurrency",
    classification: "PUBLIC_STABLE",
    meaning: "Task mutation is currently locked by another concurrent process or run-check.",
    safeResolution: "Wait for the active mutation to complete or inspect the lock with forgeloop task-show.",
  }),
  E_TASK_SCOPE_CONFLICT: Object.freeze({
    code: "E_TASK_SCOPE_CONFLICT",
    category: "scope",
    classification: "PUBLIC_STABLE",
    meaning: "Task write claims overlap with another non-complete task in the same checkout.",
    safeResolution: "Adjust write claims to non-overlapping paths or run tasks in separate worktrees.",
  }),
  E_TASK_SCOPE_DIRTY: Object.freeze({
    code: "E_TASK_SCOPE_DIRTY",
    category: "scope",
    classification: "PUBLIC_STABLE",
    meaning: "Claimed paths contain pre-existing uncommitted changes.",
    safeResolution: "Commit or stash changes in claimed paths before defining or adopting the scope.",
  }),
  E_TASK_CHANGE_OUTSIDE_SCOPE: Object.freeze({
    code: "E_TASK_CHANGE_OUTSIDE_SCOPE",
    category: "scope",
    classification: "PUBLIC_STABLE",
    meaning: "Modified paths in repository exceed the declared task write claims.",
    safeResolution: "Update write claims with forgeloop task-scope or revert out-of-scope modifications.",
  }),
  E_RECONCILE_NOT_STALE: Object.freeze({
    code: "E_RECONCILE_NOT_STALE",
    category: "lifecycle",
    classification: "PUBLIC_STABLE",
    meaning: "reconcile-closure was invoked for a work-state checkpoint that is already fresh.",
    safeResolution: "No reconciliation is required; continue the normal lifecycle.",
  }),
  E_RECONCILE_PHASE_INVALID: Object.freeze({
    code: "E_RECONCILE_PHASE_INVALID",
    category: "lifecycle",
    classification: "PUBLIC_STABLE",
    meaning: "reconcile-closure was invoked for a task that is not EXECUTING or VERIFYING.",
    safeResolution: "reconcile-closure supports EXECUTING or VERIFYING tasks whose objective is already satisfied.",
  }),
  E_RECONCILE_UNSUPPORTED_DRIFT: Object.freeze({
    code: "E_RECONCILE_UNSUPPORTED_DRIFT",
    category: "freshness",
    classification: "PUBLIC_STABLE",
    meaning: "Work-state drift includes kinds other than REPOSITORY_CHANGED (contract or required-artifact drift).",
    safeResolution: "Resolve contract or artifact drift through their dedicated recovery surfaces; reconcile-closure only refreshes repository fingerprint drift.",
  }),
  E_RECONCILE_LEDGER_INVALID: Object.freeze({
    code: "E_RECONCILE_LEDGER_INVALID",
    category: "integrity",
    classification: "PUBLIC_STABLE",
    meaning: "The append-only event ledger is not valid, so reconciliation cannot be recorded.",
    safeResolution: "Inspect the ledger errors and repair before reconciling.",
  }),
  E_RECONCILE_REQUIREMENT_UNKNOWN: Object.freeze({
    code: "E_RECONCILE_REQUIREMENT_UNKNOWN",
    category: "verification",
    classification: "PUBLIC_STABLE",
    meaning: "The supplied check id and requirement text do not exactly match a contract verification item of type VERIFICATION.",
    safeResolution: "Supply the exact id and requirement text of an existing contract verification item.",
  }),
  E_RECONCILE_EVIDENCE_FAILED: Object.freeze({
    code: "E_RECONCILE_EVIDENCE_FAILED",
    category: "verification",
    classification: "PUBLIC_STABLE",
    meaning: "The executed objective-satisfaction evidence command did not pass.",
    safeResolution: "Inspect the execution artifact; reconciliation is refused until evidence passes in the current repository.",
  }),
  E_REPOSITORY_CHANGED: Object.freeze({
    code: "E_REPOSITORY_CHANGED",
    category: "freshness",
    classification: "PUBLIC_STABLE",
    meaning: "The repository fingerprint (branch or HEAD) moved after the work-state checkpoint was recorded.",
    safeResolution: "If the task objective is already satisfied in the current repository, run forgeloop reconcile-closure; otherwise resume from a checkpoint that matches the current repository.",
  }),
  E_STATE_REVALIDATION_REQUIRED: Object.freeze({
    code: "E_STATE_REVALIDATION_REQUIRED",
    category: "freshness",
    classification: "PUBLIC_STABLE",
    meaning: "The work-state checkpoint must be revalidated before the lifecycle can continue.",
    safeResolution: "Run forgeloop reconcile-closure for externally satisfied EXECUTING tasks, or inspect the freshness reasons for other drift.",
  }),
  E_DIAGNOSIS_REQUIRED: Object.freeze({
    code: "E_DIAGNOSIS_REQUIRED",
    category: "diagnosis",
    classification: "PUBLIC_STABLE",
    meaning: "Current correction cycle has no append-only diagnosis record.",
    safeResolution: "Run forgeloop record-diagnosis with current failed evidence before correcting.",
  }),
  E_DIAGNOSIS_INVALID: Object.freeze({
    code: "E_DIAGNOSIS_INVALID",
    category: "diagnosis",
    classification: "PUBLIC_STABLE",
    meaning: "Diagnosis record details or parameters are malformed.",
    safeResolution: "Provide valid failureClass, hypothesis, evidenceRefs, settledBy, and nextSafeAction.",
  }),
  E_DIAGNOSIS_EVIDENCE_INVALID: Object.freeze({
    code: "E_DIAGNOSIS_EVIDENCE_INVALID",
    category: "diagnosis",
    classification: "PUBLIC_STABLE",
    meaning: "Referenced diagnosis evidence is missing or has no failed checks in the current cycle.",
    safeResolution: "Reference at least one failed or blocked check ID from the active verification cycle.",
  }),
  E_DIAGNOSIS_CYCLE_MISMATCH: Object.freeze({
    code: "E_DIAGNOSIS_CYCLE_MISMATCH",
    category: "diagnosis",
    classification: "PUBLIC_STABLE",
    meaning: "Diagnosis verification cycle does not match the active work state verification cycle.",
    safeResolution: "Record diagnosis for the current active verification cycle.",
  }),
  E_DIAGNOSIS_NO_NEW_INFORMATION: Object.freeze({
    code: "E_DIAGNOSIS_NO_NEW_INFORMATION",
    category: "diagnosis",
    classification: "PUBLIC_STABLE",
    meaning: "The proposed retry repeats the previous hypothesis with the same evidence.",
    safeResolution: "Change the hypothesis, collect independent evidence, or change strategy.",
  }),
  E_PROGRESS_STALLED: Object.freeze({
    code: "E_PROGRESS_STALLED",
    category: "progress",
    classification: "PUBLIC_STABLE",
    meaning: "Persisted correction history shows no new diagnostic information.",
    safeResolution: "Use an independent check, revisit assumptions, or record a materially different diagnosis.",
  }),
  E_DECISION_CRITERION_INVALID: Object.freeze({
    code: "E_DECISION_CRITERION_INVALID",
    category: "contract",
    classification: "PUBLIC_STABLE",
    meaning: "Decision settlement criterion details or parameters are malformed.",
    safeResolution: "Provide non-empty decision text and settledBy criterion.",
  }),
  E_DECISION_NOT_UNRESOLVED: Object.freeze({
    code: "E_DECISION_NOT_UNRESOLVED",
    category: "contract",
    classification: "PUBLIC_STABLE",
    meaning: "A settlement criterion referenced a decision not present in current unresolvedDecisions.",
    safeResolution: "Use the exact current unresolved decision text or update the contract first.",
  }),
  E_CHECK_INERT: Object.freeze({
    code: "E_CHECK_INERT",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "An enabled check has no effective scope or target files.",
    safeResolution: "Provide an applicable target scope, configure matching files, or mark the rule unsupported.",
  }),
  E_CHECK_MUTATION_NOT_DETECTED: Object.freeze({
    code: "E_CHECK_MUTATION_NOT_DETECTED",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "A blocking rule checker failed to detect an intentional mutation fixture.",
    safeResolution: "Fix checker logic to properly identify target violations.",
  }),
  E_POLICY_DRIFT: Object.freeze({
    code: "E_POLICY_DRIFT",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "Active policy lock does not match the policy snapshot captured at task activation.",
    safeResolution: "Re-verify affected checks or restore original policy.",
  }),
  E_POLICY_WEAKENING: Object.freeze({
    code: "E_POLICY_WEAKENING",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "Policy rules were weakened during task execution without explicit authority.",
    safeResolution: "Restore the original policy configuration.",
  }),
  E_POLICY_LOCK_INVALID: Object.freeze({
    code: "E_POLICY_LOCK_INVALID",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "Policy lockfile is missing, malformed, or corrupt.",
    safeResolution: "Run forgeloop policy-status or regenerate policy.lock.",
  }),
  E_NEW_POLICY_VIOLATION: Object.freeze({
    code: "E_NEW_POLICY_VIOLATION",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "New executable policy violation detected that is not present in brownfield baseline.",
    safeResolution: "Fix the violation before completing the task.",
  }),
  E_BASELINE_EXPANSION: Object.freeze({
    code: "E_BASELINE_EXPANSION",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "Attempted unauthorized addition of new violations to brownfield baseline.",
    safeResolution: "Resolve new violations rather than expanding the baseline.",
  }),
  E_POLICY_PROOF_STALE: Object.freeze({
    code: "E_POLICY_PROOF_STALE",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "Mutation verification proof is stale due to checker or fixture modifications.",
    safeResolution: "Re-run forgeloop rule-verify to refresh mutation proof.",
  }),
  E_CHECK_MUTATION_EXECUTION_ERROR: Object.freeze({
    code: "E_CHECK_MUTATION_EXECUTION_ERROR",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "A policy checker threw an unhandled exception while evaluating its mutation fixture.",
    safeResolution: "Repair the checker execution path and rerun rule verification.",
  }),
  E_POLICY_EVALUATION_FAILED: Object.freeze({
    code: "E_POLICY_EVALUATION_FAILED",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "Policy evaluation threw an unexpected error during execution.",
    safeResolution: "Inspect policy configuration and checker adapters for unhandled errors.",
  }),
  E_POLICY_INVALID: Object.freeze({
    code: "E_POLICY_INVALID",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "Policy artifact is malformed, corrupt, or schema-invalid.",
    safeResolution: "Validate and repair rules.json, baseline.json, or discovery.json against schema.",
  }),
  E_POLICY_SNAPSHOT_WRITE_FAILED: Object.freeze({
    code: "E_POLICY_SNAPSHOT_WRITE_FAILED",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "Failed to persist task policy snapshot during preflight.",
    safeResolution: "Ensure the target task directory is writable and repair filesystem permissions.",
  }),
  E_POLICY_LOCK_MISMATCH: Object.freeze({
    code: "E_POLICY_LOCK_MISMATCH",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "Persisted policy lock digest does not match current effective policy state.",
    safeResolution: "Re-evaluate effective rules and update policy.lock or restore modified rules.",
  }),
  E_POLICY_DRIFT_UNKNOWN: Object.freeze({
    code: "E_POLICY_DRIFT_UNKNOWN",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "Task policy drift was detected but baseline snapshot details are unavailable.",
    safeResolution: "Re-verify the task under the current policy state.",
  }),
  E_BASELINE_RECORD_DURING_ACTIVE_TASK: Object.freeze({
    code: "E_BASELINE_RECORD_DURING_ACTIVE_TASK",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "Cannot re-record baseline during an active task with policy snapshot.",
    safeResolution: "Resolve new violations or use monotonic baseline --update.",
  }),
  E_POLICY_INITIALIZATION_FAILED: Object.freeze({
    code: "E_POLICY_INITIALIZATION_FAILED",
    category: "policy",
    classification: "PUBLIC_STABLE",
    meaning: "Executable policy bootstrap could not complete during initialization.",
    safeResolution: "Repair the reported filesystem/schema error and rerun `forgeloop init`. Initialization is restartable while no committed manifest exists.",
  }),
  E_INIT_KIT_CONFLICT: Object.freeze({
    code: "E_INIT_KIT_CONFLICT",
    category: "project-maintenance",
    classification: "PUBLIC_STABLE",
    meaning: "A canonical ForgeLoop kit destination already exists with content that does not match the shipped canonical template.",
    safeResolution: "Inspect the conflicting `.forgeloop/kit/...` file. If it is stale or partial ForgeLoop output, remove or restore it and rerun `forgeloop init`. Do not overwrite unknown content automatically.",
  }),
});

export const E_CHECK_INERT = "E_CHECK_INERT";
export const E_CHECK_MUTATION_NOT_DETECTED = "E_CHECK_MUTATION_NOT_DETECTED";
export const E_POLICY_DRIFT = "E_POLICY_DRIFT";
export const E_POLICY_WEAKENING = "E_POLICY_WEAKENING";
export const E_POLICY_LOCK_INVALID = "E_POLICY_LOCK_INVALID";
export const E_NEW_POLICY_VIOLATION = "E_NEW_POLICY_VIOLATION";
export const E_BASELINE_EXPANSION = "E_BASELINE_EXPANSION";
export const E_POLICY_PROOF_STALE = "E_POLICY_PROOF_STALE";
export const E_CHECK_MUTATION_EXECUTION_ERROR = "E_CHECK_MUTATION_EXECUTION_ERROR";
export const E_POLICY_EVALUATION_FAILED = "E_POLICY_EVALUATION_FAILED";
export const E_POLICY_INVALID = "E_POLICY_INVALID";
export const E_POLICY_SNAPSHOT_WRITE_FAILED = "E_POLICY_SNAPSHOT_WRITE_FAILED";
export const E_POLICY_LOCK_MISMATCH = "E_POLICY_LOCK_MISMATCH";
export const E_POLICY_DRIFT_UNKNOWN = "E_POLICY_DRIFT_UNKNOWN";
export const E_BASELINE_RECORD_DURING_ACTIVE_TASK = "E_BASELINE_RECORD_DURING_ACTIVE_TASK";
export const E_POLICY_INITIALIZATION_FAILED = "E_POLICY_INITIALIZATION_FAILED";
export const E_INIT_KIT_CONFLICT = "E_INIT_KIT_CONFLICT";

export const ALL_KNOWN_ERROR_CODES = Object.freeze(new Set([
  ...FAILURE_CODES,
  E_VERIFICATION_TOOL_UNAVAILABLE,
  E_INSTALLATION_AUTHORITY_REQUIRED,
  E_COMMAND_RESOLUTION_AMBIGUOUS,
  E_AUTHORITY_INVALID,
  E_AUTHORITY_SCOPE_MISMATCH,
  "E_AUTHORITY_UNTRUSTED_SOURCE",
  "E_EXECUTION_REF_INVALID",
  "E_NATIVE_ADAPTER_STALE",
  "E_NATIVE_ADAPTER_TARGET_MISSING",
  "E_MIGRATION_INCOMPLETE",
  "E_MIGRATION_WRITE_VERIFY",
  E_TASK_REQUIRED,
  E_TASK_NOT_FOUND,
  E_TASK_ALREADY_EXISTS,
  E_TASK_AMBIGUOUS,
  E_TASK_SELECTOR_CONFLICT,
  E_TASK_DESCRIPTOR_INVALID,
  E_TASK_KEY_MISMATCH,
  E_TASK_CONTEXT_MISMATCH,
  E_TASK_LOCKED,
  E_TASK_LOCK_INVALID,
  E_TASK_SCOPE_REQUIRED,
  E_TASK_SCOPE_CONFLICT,
  E_TASK_SCOPE_DIRTY,
  E_TASK_SCOPE_FROZEN,
  E_TASK_CHANGE_OUTSIDE_SCOPE,
  E_RECONCILE_NOT_STALE,
  E_RECONCILE_PHASE_INVALID,
  E_RECONCILE_UNSUPPORTED_DRIFT,
  E_RECONCILE_LEDGER_INVALID,
  E_RECONCILE_REQUIREMENT_UNKNOWN,
  E_RECONCILE_EVIDENCE_FAILED,
  E_REPOSITORY_CHANGED,
  E_STATE_REVALIDATION_REQUIRED,
  E_TASK_CHANGE_ATTRIBUTION_UNAVAILABLE,
  E_TASK_LAYOUT_LEGACY,
  E_TASK_MIGRATION_INVALID,
  E_TASK_MIGRATION_IDENTITY_MISMATCH,
  E_CHECK_INERT,
  E_CHECK_MUTATION_NOT_DETECTED,
  E_POLICY_DRIFT,
  E_POLICY_WEAKENING,
  E_POLICY_LOCK_INVALID,
  E_NEW_POLICY_VIOLATION,
  E_BASELINE_EXPANSION,
  E_POLICY_PROOF_STALE,
  E_CHECK_MUTATION_EXECUTION_ERROR,
  E_POLICY_EVALUATION_FAILED,
  E_POLICY_INVALID,
  E_POLICY_SNAPSHOT_WRITE_FAILED,
  E_POLICY_LOCK_MISMATCH,
  E_POLICY_DRIFT_UNKNOWN,
  E_BASELINE_RECORD_DURING_ACTIVE_TASK,
  E_POLICY_INITIALIZATION_FAILED,
  E_INIT_KIT_CONFLICT,
]));
