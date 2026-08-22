import {
  E_TASK_CLAIM_OWNERSHIP_INCONSISTENT,
  E_TASK_COMPLETE,
  E_TASK_RECOVERED,
  E_TASK_RECOVERY_INCONSISTENT,
} from "./error-codes.js";
import { validateEventLedger } from "./events.js";
import { classifyRecoveryHistory } from "./recovery-history.js";
import { readTaskDescriptor } from "./task-descriptor.js";
import { normalizeWriteClaims } from "./task-scope.js";
import {
  readTaskRecovery,
  validateTaskRecoveryConsistency,
} from "./task-recovery.js";
import { readWorkState } from "./work-state.js";

function ownershipError(message, cause = null) {
  return {
    code: E_TASK_RECOVERY_INCONSISTENT,
    message,
    ...(cause?.code ? { causeCode: cause.code } : {}),
  };
}

function appendClaims(target, claims, errors, source) {
  if (claims === undefined || claims === null) return;
  try {
    target.push(...normalizeWriteClaims(claims));
  } catch (error) {
    errors.push(ownershipError(`Invalid ${source} write claims: ${error.message}`, error));
  }
}

function inconsistentResult({ taskId, phase, historicalWriteClaims, recovery, errors }) {
  const reasonCodes = [
    E_TASK_CLAIM_OWNERSHIP_INCONSISTENT,
    ...errors.flatMap((error) => [error.code, error.causeCode]).filter(Boolean),
  ];
  return {
    taskId,
    phase,
    historicalWriteClaims,
    effectiveWriteClaims: historicalWriteClaims,
    writeClaims: historicalWriteClaims,
    claimState: "INCONSISTENT",
    mutationAllowed: false,
    recovery,
    recoveryStatus: "INCONSISTENT",
    valid: false,
    ownershipValid: false,
    reasonCodes: [...new Set(reasonCodes)],
    errors,
    ownershipErrors: errors,
  };
}

/**
 * Resolve claim ownership from the task descriptor, work state, recovery
 * tombstone, and the complete validated task ledger. Any disagreement retains
 * every claim that can be recovered from validated inputs and fails closed.
 */
export async function resolveTaskClaimState(target, {
  taskId,
  packageRoot,
  descriptor: suppliedDescriptor = null,
  state: suppliedState = null,
} = {}) {
  const errors = [];
  let descriptor = suppliedDescriptor;
  let state = suppliedState;
  let recovery = null;
  let ledger = { valid: false, events: [], errors: [] };

  if (!descriptor) {
    try {
      descriptor = (await readTaskDescriptor(target, taskId, packageRoot)).value;
    } catch (error) {
      errors.push(ownershipError(`Task descriptor cannot establish claim ownership: ${error.message}`, error));
    }
  }
  if (!state) {
    try {
      state = await readWorkState(target, { taskId, packageRoot });
    } catch (error) {
      errors.push(ownershipError(`Task work state cannot establish claim ownership: ${error.message}`, error));
    }
  }

  const phase = state?.phase ?? null;
  const descriptorClaims = [];
  appendClaims(descriptorClaims, descriptor?.writeClaims, errors, "descriptor");
  const normalizedDescriptorClaims = normalizeWriteClaims(descriptorClaims);

  // Completion independently and permanently removes mutation authority and
  // claim ownership. Recovery state cannot make a COMPLETE task mutable again.
  if (phase === "COMPLETE" && errors.length === 0) {
    return {
      taskId,
      phase,
      historicalWriteClaims: normalizedDescriptorClaims,
      effectiveWriteClaims: [],
      writeClaims: [],
      claimState: "RELEASED_BY_COMPLETION",
      mutationAllowed: false,
      recovery: null,
      recoveryStatus: "NOT_APPLICABLE",
      valid: true,
      ownershipValid: true,
      reasonCodes: [],
      errors: [],
      ownershipErrors: [],
    };
  }

  try {
    recovery = (await readTaskRecovery(target, { taskId, packageRoot }))?.value ?? null;
  } catch (error) {
    errors.push(ownershipError(`Task recovery artifact cannot establish claim ownership: ${error.message}`, error));
  }

  try {
    ledger = await validateEventLedger(target, packageRoot, { taskId });
  } catch (error) {
    errors.push(ownershipError(`Task event ledger cannot establish claim ownership: ${error.message}`, error));
  }
  if (!ledger.valid) {
    for (const error of ledger.errors) {
      errors.push(ownershipError(`Task event ledger is invalid: ${error.message}`, error));
    }
  }
  if (ledger.events.some((event) => event.taskId !== taskId)) {
    errors.push(ownershipError(`Task event ledger contains an event for a different task`));
  }

  const history = classifyRecoveryHistory(ledger.events);

  const historicalClaims = [...normalizedDescriptorClaims];
  for (const cycle of history.recoveries) {
    appendClaims(historicalClaims, cycle.event?.details?.releasedClaims, errors, "recovery ledger");
  }
  appendClaims(historicalClaims, recovery?.releasedClaims, errors, "recovery artifact");
  const historicalWriteClaims = normalizeWriteClaims(historicalClaims);

  errors.push(...validateTaskRecoveryConsistency({
    taskId,
    recovery,
    events: ledger.events,
    historicalWriteClaims: normalizedDescriptorClaims,
    recoveryHistory: history,
  }));

  if (errors.length > 0) {
    return inconsistentResult({ taskId, phase, historicalWriteClaims, recovery, errors });
  }

  if (history.activeRecovery) {
    // The consistency validator above guarantees that the active ledger cycle
    // and recovery artifact identify the same recovery before this branch.
    return {
      taskId,
      phase,
      historicalWriteClaims,
      effectiveWriteClaims: [],
      writeClaims: [],
      claimState: "RELEASED_BY_RECOVERY",
      mutationAllowed: false,
      recovery,
      recoveryStatus: "ACTIVE",
      valid: true,
      ownershipValid: true,
      reasonCodes: [],
      errors: [],
      ownershipErrors: [],
    };
  }

  return {
    taskId,
    phase,
    historicalWriteClaims,
    effectiveWriteClaims: normalizedDescriptorClaims,
    writeClaims: normalizedDescriptorClaims,
    claimState: "ACTIVE",
    mutationAllowed: true,
    recovery: null,
    recoveryStatus: history.completedRecoveries.length > 0 ? "COMPLETED" : "ABSENT",
    valid: true,
    ownershipValid: true,
    reasonCodes: [],
    errors: [],
    ownershipErrors: [],
  };
}

export async function assertTaskMutationAllowed(target, options = {}) {
  const result = await resolveTaskClaimState(target, options);
  if (result.mutationAllowed) return result;

  const inconsistent = result.claimState === "INCONSISTENT";
  const error = new Error(inconsistent
    ? `Task ${result.taskId} claim ownership is inconsistent; ordinary mutation is blocked`
    : result.claimState === "RELEASED_BY_COMPLETION"
      ? `Task ${result.taskId} is COMPLETE and cannot be mutated`
      : `Task ${result.taskId} is RECOVERED and its write claims are released; run task-resume before ordinary mutation`);
  error.code = inconsistent
    ? E_TASK_CLAIM_OWNERSHIP_INCONSISTENT
    : result.claimState === "RELEASED_BY_COMPLETION"
      ? E_TASK_COMPLETE
      : E_TASK_RECOVERED;
  error.taskId = result.taskId;
  error.claimState = result.claimState;
  error.reasonCodes = result.reasonCodes;
  error.errors = result.errors;
  error.recovery = result.recovery;
  throw error;
}
