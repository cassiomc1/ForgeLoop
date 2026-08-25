import {
  E_ACTION_RECONCILIATION_AUTHORITY_REQUIRED,
  E_ACTION_RECONCILIATION_EVIDENCE_INVALID,
} from "./error-codes.js";
import { isTrustedHostAuthorityContext } from "./capability-policy.js";

/**
 * Only these outcomes settle external commit state. They relax or resolve the
 * COMMIT_UNKNOWN safety posture and therefore require trusted evidence;
 * UNKNOWN is a pure observation and is always caller-recordable
 * (INV-RECON-01, INV-RECON-02).
 */
export function reconciliationRequiresAuthority(outcome) {
  return outcome === "COMMITTED" || outcome === "NOT_COMMITTED";
}

/**
 * Validate that a reconciliation invocation may settle external state.
 * Settlement requires:
 * - a trusted host-boundary authority context (out-of-band), and
 * - at least one bounded evidence reference binding the observation.
 */
export function assertReconciliationSettlementAllowed({ outcome, authorityContext, evidenceRefs }) {
  if (!reconciliationRequiresAuthority(outcome)) return null;

  if (!isTrustedHostAuthorityContext(authorityContext)) {
    const error = new Error("settling external commit state requires trusted host attestation");
    error.code = E_ACTION_RECONCILIATION_AUTHORITY_REQUIRED;
    throw error;
  }
  if (
    !Array.isArray(evidenceRefs)
    || evidenceRefs.length === 0
    || evidenceRefs.some((ref) => typeof ref !== "string" || !ref || ref.length > 256)
  ) {
    const error = new Error("settling external commit state requires bounded non-empty evidence references");
    error.code = E_ACTION_RECONCILIATION_EVIDENCE_INVALID;
    throw error;
  }
  if (typeof authorityContext.grantRef !== "string" || !authorityContext.grantRef) {
    const error = new Error("trusted settlement authority must carry a bounded grant reference");
    error.code = E_ACTION_RECONCILIATION_AUTHORITY_REQUIRED;
    throw error;
  }
  return {
    authorityKind: "HOST_ATTESTED",
    authorityRef: authorityContext.grantRef,
  };
}
