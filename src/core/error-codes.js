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
});

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
  E_TASK_CHANGE_ATTRIBUTION_UNAVAILABLE,
  E_TASK_LAYOUT_LEGACY,
  E_TASK_MIGRATION_INVALID,
  E_TASK_MIGRATION_IDENTITY_MISMATCH,
]));
