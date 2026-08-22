import { assertTaskId, taskStorageKey } from "./task-identity.js";

export const TASK_STATE_ROOT = ".forgeloop/task-state";
export const TASK_LOCK_ROOT = ".forgeloop/locks";
export const SESSIONS_ROOT = ".forgeloop/sessions";

export const TASK_ARTIFACT_FILES = Object.freeze({
  descriptor: "task.json",
  contract: "contract.json",
  route: "routing-result.json",
  preflight: "preflight.json",
  state: "work-state.json",
  continuity: "continuity.json",
  receipt: "execution-receipt.json",
  events: "events.ndjson",
  gates: "gates",
  executions: "executions",
  lock: ".lock",
  policySnapshot: "policy-snapshot.json",
  recovery: "recovery.json",
});

export const POLICY_ROOT = ".forgeloop/policy";

export const PROJECT_ARTIFACT_PATHS = Object.freeze({
  config: ".forgeloop/config.json",
  sources: ".forgeloop/sources.json",
  manifest: ".forgeloop/.manifest.json",
  kit: ".forgeloop/kit",
  gitignore: ".forgeloop/.gitignore",
  policyDir: ".forgeloop/policy",
  policyRules: ".forgeloop/policy/rules.json",
  policyBaseline: ".forgeloop/policy/baseline.json",
  policyLock: ".forgeloop/policy/policy.lock",
  policyDiscovery: ".forgeloop/policy/discovery.json",
});

export const LEGACY_TASK_ARTIFACT_PATHS = Object.freeze({
  contract: ".forgeloop/current-contract.json",
  route: ".forgeloop/routing-result.json",
  preflight: ".forgeloop/preflight.json",
  state: ".forgeloop/work-state.json",
  continuity: ".forgeloop/continuity.json",
  receipt: ".forgeloop/execution-receipt.json",
  events: ".forgeloop/events.ndjson",
  gates: ".forgeloop/gates",
  executions: ".forgeloop/executions",
  session: ".forgeloop/session.json",
});

export function taskDirectory(taskId) {
  return `${TASK_STATE_ROOT}/${taskStorageKey(taskId)}`;
}

export function taskArtifactPath(taskId, key) {
  const relative = TASK_ARTIFACT_FILES[key];
  if (!relative) {
    throw new Error(`Unknown task artifact: ${key}`);
  }
  return `${taskDirectory(taskId)}/${relative}`;
}

export function taskGatePath(taskId, gateId) {
  if (typeof gateId !== "string" || !gateId || gateId.includes("/") || gateId.includes("\\") || gateId.includes("..")) {
    throw new Error(`Invalid gate ID: ${gateId}`);
  }
  const cleanId = gateId.endsWith(".json") ? gateId : `${gateId}.json`;
  return `${taskDirectory(taskId)}/${TASK_ARTIFACT_FILES.gates}/${cleanId}`;
}

export function taskExecutionPath(taskId, executionId) {
  if (typeof executionId !== "string" || !/^exec-[A-Za-z0-9_-]+$/.test(executionId)) {
    throw new Error(`Invalid execution ID: ${executionId}`);
  }
  return `${taskDirectory(taskId)}/${TASK_ARTIFACT_FILES.executions}/${executionId}.json`;
}

export function taskLockPath(taskId) {
  assertTaskId(taskId);
  return `${TASK_LOCK_ROOT}/${taskStorageKey(taskId)}.lock`;
}

export function sessionArtifactPath(sessionId) {
  if (typeof sessionId !== "string" || !sessionId || sessionId.includes("/") || sessionId.includes("\\") || sessionId.includes("..")) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }
  const cleanId = sessionId.endsWith(".json") ? sessionId : `${sessionId}.json`;
  return `${SESSIONS_ROOT}/${cleanId}`;
}

export function buildTaskArtifactPaths(taskId) {
  assertTaskId(taskId);
  const dir = taskDirectory(taskId);
  return Object.freeze({
    descriptor: `${dir}/${TASK_ARTIFACT_FILES.descriptor}`,
    contract: `${dir}/${TASK_ARTIFACT_FILES.contract}`,
    route: `${dir}/${TASK_ARTIFACT_FILES.route}`,
    preflight: `${dir}/${TASK_ARTIFACT_FILES.preflight}`,
    state: `${dir}/${TASK_ARTIFACT_FILES.state}`,
    continuity: `${dir}/${TASK_ARTIFACT_FILES.continuity}`,
    receipt: `${dir}/${TASK_ARTIFACT_FILES.receipt}`,
    events: `${dir}/${TASK_ARTIFACT_FILES.events}`,
    gates: `${dir}/${TASK_ARTIFACT_FILES.gates}`,
    executions: `${dir}/${TASK_ARTIFACT_FILES.executions}`,
    lock: `${dir}/${TASK_ARTIFACT_FILES.lock}`,
    policySnapshot: `${dir}/${TASK_ARTIFACT_FILES.policySnapshot}`,
    recovery: `${dir}/${TASK_ARTIFACT_FILES.recovery}`,
  });
}
