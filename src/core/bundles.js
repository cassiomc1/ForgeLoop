import { readdir } from "node:fs/promises";

import { ARTIFACT_PATHS, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { validateContract } from "./contract.js";
import { assertSafePath, ensureWithin, fileExists, readBytes, writeFileAtomic } from "./filesystem.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { validateChecksExecutionProvenance } from "./completion-artifacts.js";
import { readExecutionArtifact } from "./execution.js";
import { assertContinuitySemantics } from "./continuity.js";
import { taskArtifactPath, taskDirectory } from "./task-paths.js";
import { resolveTaskClaimState } from "./task-claim-state.js";
import { E_TASK_CLAIM_OWNERSHIP_INCONSISTENT } from "./error-codes.js";

export const BUNDLE_SCHEMA_VERSION = 1;
const BUNDLE_ROOT = ".forgeloop/tasks";

function safeTaskId(taskId) {
  if (typeof taskId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(taskId)) {
    const error = new Error(`Invalid task ID for bundle: ${taskId}`);
    error.code = "E_BUNDLE_PATH_INVALID";
    throw error;
  }
  return taskId;
}

function bundleDirectory(taskId) {
  return `${BUNDLE_ROOT}/${safeTaskId(taskId)}`;
}

async function copyJson(target, sourcePath, destinationPath, schemaName, packageRoot, artifacts, relativeName) {
  try {
    const value = await readJsonArtifact(target, sourcePath, schemaName, packageRoot);
    await writeJsonArtifact(target, destinationPath, value.value, schemaName, packageRoot);
    artifacts.push(relativeName);
    return value;
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") return null;
    throw error;
  }
}

async function tryReadJson(target, taskPath, legacyPath, schemaName, packageRoot) {
  try {
    return await readJsonArtifact(target, taskPath, schemaName, packageRoot);
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING" && legacyPath) {
      return await readJsonArtifact(target, legacyPath, schemaName, packageRoot);
    }
    throw error;
  }
}

export async function exportTaskBundle(target, taskId, packageRoot) {
  safeTaskId(taskId);
  const directory = bundleDirectory(taskId);
  const artifacts = [];

  if (await fileExists(ensureWithin(target, taskArtifactPath(taskId, "descriptor")))) {
    const claimProjection = await resolveTaskClaimState(target, { taskId, packageRoot });
    if (!claimProjection.valid) {
      const error = new Error(`Task ${taskId} claim ownership is inconsistent and cannot be exported safely`);
      error.code = E_TASK_CLAIM_OWNERSHIP_INCONSISTENT;
      error.reasonCodes = claimProjection.reasonCodes;
      error.errors = claimProjection.ownershipErrors;
      throw error;
    }
  }

  const stateSource = await tryReadJson(target, taskArtifactPath(taskId, "state"), ARTIFACT_PATHS.state, "work-state", packageRoot);
  let receiptSource = null;
  try {
    receiptSource = await tryReadJson(target, taskArtifactPath(taskId, "receipt"), ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot);
  } catch (error) {
    if (error.code !== "ARTIFACT_MISSING") throw error;
  }

  await validateChecksExecutionProvenance(stateSource.value.checks, {
    target,
    packageRoot,
    taskId,
    artifactPath: ARTIFACT_PATHS.state,
  });
  if (receiptSource?.value?.checks) {
    await validateChecksExecutionProvenance(receiptSource.value.checks, {
      target,
      packageRoot,
      taskId,
      artifactPath: ARTIFACT_PATHS.receipt,
    });
  }

  const required = [
    [taskArtifactPath(taskId, "contract"), ARTIFACT_PATHS.contract, "contract.json", "current-contract"],
    [taskArtifactPath(taskId, "route"), ARTIFACT_PATHS.route, "route.json", "routing-result"],
    [taskArtifactPath(taskId, "state"), ARTIFACT_PATHS.state, "state.json", "work-state"],
  ];
  for (const [taskRel, legacyRel, destinationName, schemaName] of required) {
    const source = await tryReadJson(target, taskRel, legacyRel, schemaName, packageRoot);
    if (schemaName === "current-contract") {
      await validateContract(source.value, packageRoot);
    }
    if (source.value.taskId !== undefined && source.value.taskId !== taskId) {
      const error = new Error(`${taskRel} belongs to ${source.value.taskId}, not ${taskId}`);
      error.code = "E_BUNDLE_TASK_MISMATCH";
      throw error;
    }
    await writeJsonArtifact(target, `${directory}/${destinationName}`, source.value, schemaName, packageRoot);
    artifacts.push(destinationName);
  }

  const optional = [
    [taskArtifactPath(taskId, "preflight"), ARTIFACT_PATHS.preflight, "preflight.json", "preflight"],
    [taskArtifactPath(taskId, "receipt"), ARTIFACT_PATHS.receipt, "receipt.json", "execution-receipt"],
    [taskArtifactPath(taskId, "descriptor"), null, "task.json", "task-descriptor"],
    [ARTIFACT_PATHS.sources, null, "sources.json", "source-registry"],
    [ARTIFACT_PATHS.config, null, "config.json", "config"],
    [taskArtifactPath(taskId, "continuity"), ARTIFACT_PATHS.continuity, "continuity.json", "continuity"],
    [taskArtifactPath(taskId, "recovery"), null, "recovery.json", "task-recovery"],
  ];
  for (const [taskRel, legacyRel, destinationName, schemaName] of optional) {
    let copied = null;
    try {
      copied = await copyJson(target, taskRel, `${directory}/${destinationName}`, schemaName, packageRoot, artifacts, destinationName);
    } catch {
      if (legacyRel) {
        copied = await copyJson(target, legacyRel, `${directory}/${destinationName}`, schemaName, packageRoot, artifacts, destinationName);
      }
    }
    if (copied && !artifacts.includes(destinationName)) artifacts.push(destinationName);
  }

  const executionRefs = [...new Set([
    ...(stateSource.value.checks ?? []),
    ...(receiptSource?.value?.checks ?? []),
  ].map((check) => check?.executionRef).filter(Boolean))].sort();
  for (const executionRef of executionRefs) {
    const execution = await readExecutionArtifact({ target, executionRef, packageRoot, taskId });
    const destination = `${directory}/executions/${execution.value.executionId}.json`;
    await writeJsonArtifact(target, destination, execution.value, "execution", packageRoot);
    artifacts.push(`executions/${execution.value.executionId}.json`);
  }

  // Events
  let eventsPath = ensureWithin(target, taskArtifactPath(taskId, "events"));
  if (!(await fileExists(eventsPath))) {
    eventsPath = ensureWithin(target, ARTIFACT_PATHS.events);
  }
  if (await fileExists(eventsPath)) {
    await assertSafePath(target, `${directory}/events.ndjson`);
    await writeFileAtomic(ensureWithin(target, `${directory}/events.ndjson`), await readBytes(eventsPath));
    artifacts.push("events.ndjson");
  }

  // Gates
  let gateDirectory = ensureWithin(target, `${taskDirectory(taskId)}/gates`);
  if (!(await fileExists(gateDirectory))) {
    gateDirectory = ensureWithin(target, ARTIFACT_PATHS.gates);
  }
  if (await fileExists(gateDirectory)) {
    const entries = await readdir(gateDirectory, { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".json")).sort((left, right) => left.name.localeCompare(right.name))) {
      const gateName = entry.name.slice(0, -5);
      const sourcePath = `${gateDirectory.replace(target + "/", "")}/${entry.name}`;
      const destinationPath = `${directory}/gates/${entry.name}`;
      const gate = await readJsonArtifact(target, sourcePath, "gate", packageRoot);
      if (gate.value.taskId !== taskId) continue;
      await writeJsonArtifact(target, destinationPath, gate.value, "gate", packageRoot);
      artifacts.push(`gates/${gateName}.json`);
    }
  }

  artifacts.sort();
  const manifest = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    taskId,
    artifacts,
  };
  await writeJsonArtifact(target, `${directory}/bundle.json`, manifest, "task-bundle", packageRoot);
  return { ...manifest, path: `${directory}/bundle.json` };
}

export async function readTaskBundle(target, taskId, packageRoot) {
  const directory = bundleDirectory(taskId);
  const manifest = await readJsonArtifact(target, `${directory}/bundle.json`, "task-bundle", packageRoot);
  const loaded = {};
  const mappings = {
    "contract.json": ["contract", "current-contract"],
    "route.json": ["route", "routing-result"],
    "state.json": ["state", "work-state"],
    "preflight.json": ["preflight", "preflight"],
    "receipt.json": ["receipt", "execution-receipt"],
    "sources.json": ["sources", "source-registry"],
    "config.json": ["config", "config"],
    "continuity.json": ["continuity", "continuity"],
    "task.json": ["descriptor", "task-descriptor"],
    "recovery.json": ["recovery", "task-recovery"],
  };
  const executions = {};
  for (const artifact of manifest.value.artifacts) {
    if (artifact.startsWith("executions/") && artifact.endsWith(".json")) {
      const execution = await readJsonArtifact(target, `${directory}/${artifact}`, "execution", packageRoot);
      executions[execution.value.executionId] = execution.value;
      continue;
    }
    const mapping = mappings[artifact];
    if (!mapping) continue;
    const loadedArtifact = await readJsonArtifact(target, `${directory}/${artifact}`, mapping[1], packageRoot);
    if (mapping[1] === "current-contract") {
      await validateContract(loadedArtifact.value, packageRoot);
    }
    if (mapping[1] === "continuity") {
      assertContinuitySemantics(loadedArtifact.value);
    }
    loaded[mapping[0]] = loadedArtifact.value;
  }
  if (Object.keys(executions).length > 0) loaded.executions = executions;
  if (loaded.state?.checks) {
    await validateChecksExecutionProvenance(loaded.state.checks, {
      target,
      packageRoot,
      taskId,
      executionArtifacts: executions,
      allowForeignCwd: true,
      artifactPath: "state.json",
    });
  }
  if (loaded.receipt?.checks) {
    await validateChecksExecutionProvenance(loaded.receipt.checks, {
      target,
      packageRoot,
      taskId,
      executionArtifacts: executions,
      allowForeignCwd: true,
      artifactPath: "receipt.json",
    });
  }
  return { manifest: manifest.value, artifacts: loaded };
}
