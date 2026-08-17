import { FAILURE_CODES } from "./protocol.js";
import {
  E_AUTHORITY_INVALID,
  E_AUTHORITY_SCOPE_MISMATCH,
  E_COMMAND_RESOLUTION_AMBIGUOUS,
  E_INSTALLATION_AUTHORITY_REQUIRED,
  E_VERIFICATION_TOOL_UNAVAILABLE,
} from "./verification-constants.js";

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
]));
