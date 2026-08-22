import { runProtocolInfo } from "../commands/protocol-info.js";
import { readContract } from "./contract.js";
import { discoverTasks } from "./task-discovery.js";
import { resolveTaskClaimState } from "./task-claim-state.js";
import { runStatus } from "../commands/status.js";
import { runContinuity } from "../commands/continuity.js";

/**
 * Canonical integration resource allowlist.
 *
 * This is NOT a replacement for ARTIFACT_REGISTRY: the artifact registry
 * describes persisted protocol artifacts; this registry describes what is
 * safe to expose through structured integrations. Anything not listed here
 * must never be readable through an integration transport.
 *
 * task/ownership is derived exclusively from resolveTaskClaimState() — the
 * canonical claim resolver. Integrations must present these values; they
 * must never derive them from raw artifacts such as task.json or
 * recovery.json.
 */
export const INTEGRATION_RESOURCE_DEFINITIONS = Object.freeze({
  "protocol/info": Object.freeze({
    scope: "PROJECT",
    description: "ForgeLoop protocol version, schema compatibility, features, and command metadata.",
  }),
  "project/tasks": Object.freeze({
    scope: "PROJECT",
    description: "All discovered tasks with canonical ownership projection fields.",
  }),
  "task/status": Object.freeze({
    scope: "TASK",
    description: "Canonical status projection for one task, including ownership fields.",
  }),
  "task/ownership": Object.freeze({
    scope: "TASK",
    description: "Canonical validated claim ownership for one task.",
  }),
  "task/contract": Object.freeze({
    scope: "TASK",
    description: "The task's current contract.",
  }),
  "task/continuity": Object.freeze({
    scope: "TASK",
    description: "Cross-harness continuity state for one task.",
  }),
});

function ownershipProjection(projection) {
  return {
    taskId: projection.taskId,
    phase: projection.phase,
    claimState: projection.claimState,
    mutationAllowed: projection.mutationAllowed,
    ownershipValid: projection.ownershipValid,
    recoveryStatus: projection.recoveryStatus,
    historicalWriteClaims: [...(projection.historicalWriteClaims ?? [])],
    effectiveWriteClaims: [...(projection.effectiveWriteClaims ?? [])],
    reasonCodes: [...(projection.reasonCodes ?? [])],
  };
}

export async function readForgeLoopIntegrationResource(uri, {
  projectPath = ".",
  packageRoot = undefined,
  packageVersion = null,
  taskId = null,
} = {}) {
  const resource = INTEGRATION_RESOURCE_DEFINITIONS[uri];
  if (!resource) {
    const error = new Error(`Unknown ForgeLoop integration resource: ${uri}`);
    error.code = "E_INTEGRATION_RESOURCE_UNKNOWN";
    throw error;
  }

  switch (uri) {
    case "protocol/info": {
      return { uri, data: await runProtocolInfo({ packageVersion }) };
    }
    case "project/tasks": {
      const tasks = await discoverTasks(projectPath, packageRoot);
      return {
        uri,
        data: {
          count: tasks.length,
          tasks: tasks.map((task) => ({
            taskId: task.taskId,
            healthy: task.healthy !== false,
            phase: task.phase ?? null,
            mutationAllowed: task.mutationAllowed !== false,
          })),
        },
      };
    }
    case "task/status":
    case "task/ownership":
    case "task/contract":
    case "task/continuity": {
      if (typeof taskId !== "string" || !taskId) {
        const error = new Error(`Resource ${uri} requires a taskId`);
        error.code = "E_TASK_REQUIRED";
        throw error;
      }
      break;
    }
    default:
      break;
  }

  if (uri === "task/ownership") {
    const projection = await resolveTaskClaimState(projectPath, { taskId, packageRoot });
    return { uri, taskId, data: ownershipProjection(projection) };
  }
  if (uri === "task/status") {
    const result = await runStatus({ target: projectPath, packageRoot, taskId });
    return { uri, taskId, data: result };
  }
  if (uri === "task/contract") {
    try {
      const contract = await readContract(projectPath, packageRoot, { taskId });
      return { uri, taskId, data: contract.value };
    } catch (error) {
      error.message = `Resource task/contract unavailable: ${error.message}`;
      throw error;
    }
  }
  // task/continuity
  const continuity = await runContinuity({ target: projectPath, packageRoot, taskId });
  return { uri, taskId, data: continuity };
}
