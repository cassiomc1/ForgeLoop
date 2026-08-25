import { transitionAction } from "../core/actions.js";
import { withTaskMutation } from "../core/task-command.js";
import {
  E_ACTION_AUTHORIZATION_INVALID,
  E_ACTION_INVALID,
  E_ACTION_VERIFICATION_REQUIRED,
} from "../core/error-codes.js";

// Public action-record may only record observations that do not create
// authority. AUTHORIZED and VERIFIED are owned by canonical core services and
// are rejected here even if a transport mistakenly exposes this command.
const CALLER_RECORDABLE_ACTION_STATES = Object.freeze([
  "STARTED",
  "COMMITTED",
  "COMMIT_UNKNOWN",
  "FAILED",
  "CANCELLED",
]);

export async function runActionRecord({ target, packageRoot, taskId, actionId, state, provenance, evidenceRef }) {
  if (!["CALLER_REPORTED", "EXTERNAL_OBSERVED"].includes(provenance)) {
    const error = new Error("action-record provenance must be CALLER_REPORTED or EXTERNAL_OBSERVED");
    error.code = E_ACTION_INVALID;
    throw error;
  }
  if (state === "AUTHORIZED") {
    const error = new Error("AUTHORIZED is owned by the canonical authorization service; caller surfaces cannot authorize actions");
    error.code = E_ACTION_AUTHORIZATION_INVALID;
    throw error;
  }
  if (state === "VERIFIED") {
    const error = new Error("VERIFIED requires canonical independent postcondition evidence via forgeloop action-verify");
    error.code = E_ACTION_VERIFICATION_REQUIRED;
    throw error;
  }
  if (!CALLER_RECORDABLE_ACTION_STATES.includes(state)) {
    const error = new Error(`action-record state must be one of ${CALLER_RECORDABLE_ACTION_STATES.join(", ")}`);
    error.code = E_ACTION_INVALID;
    throw error;
  }
  return withTaskMutation(target, { taskId, packageRoot }, "action-record", (ctx) =>
    transitionAction(target, { packageRoot, taskId: ctx.taskId, actionId, to: state,
      details: { ...(evidenceRef ? { evidenceRef } : {}), reportedProvenance: provenance } }));
}
export function formatActionRecordResult(result) {
  return `FORGELOOP ACTION RECORDED\naction: ${result.actionId}\nstate: ${result.state}\n`;
}
