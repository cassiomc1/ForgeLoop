import { readdir } from "node:fs/promises";

import { ARTIFACT_PATHS, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { readContract, validateContract } from "./contract.js";
import { assertSafePath, ensureWithin, fileExists, readBytes, writeFileAtomic } from "./filesystem.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { validateChecksExecutionProvenance } from "./completion-artifacts.js";
import { readExecutionArtifact } from "./execution.js";
import { assertContinuitySemantics } from "./continuity.js";

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

export async function exportTaskBundle(target, taskId, packageRoot) {
  safeTaskId(taskId);
  const directory = bundleDirectory(taskId);
  const artifacts = [];
  const stateSource = await readJsonArtifact(target, ARTIFACT_PATHS.state, "work-state", packageRoot);
  let receiptSource = null;
  try {
    receiptSource = await readJsonArtifact(target, ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot);
  } catch (error) {
    if (error.code !== "ARTIFACT_MISSING") throw error;
  }
  const provenanceErrors = [
    ...(await validateChecksExecutionProvenance(stateSource.value.checks, {
      target,
      packageRoot,
      taskId,
      artifactPath: ARTIFACT_PATHS.state,
    })),
    ...(await validateChecksExecutionProvenance(receiptSource?.value?.checks, {
      target,
      packageRoot,
      taskId,
      artifactPath: ARTIFACT_PATHS.receipt,
    })),
  ];
  if (provenanceErrors.length > 0) {
    const first = provenanceErrors[0];
    const error = new Error(first.message);
    error.code = first.code;
    error.artifacts = first.artifacts;
    throw error;
  }
  const required = [
    [ARTIFACT_PATHS.contract, "contract.json", "current-contract"],
    [ARTIFACT_PATHS.route, "route.json", "routing-result"],
    [ARTIFACT_PATHS.state, "state.json", "work-state"],
  ];
  for (const [sourcePath, destinationName, schemaName] of required) {
    const source = schemaName === "current-contract"
      ? await readContract(target, packageRoot)
      : await readJsonArtifact(target, sourcePath, schemaName, packageRoot);
    if (source.value.taskId !== undefined && source.value.taskId !== taskId) {
      const error = new Error(`${sourcePath} belongs to ${source.value.taskId}, not ${taskId}`);
      error.code = "E_BUNDLE_TASK_MISMATCH";
      throw error;
    }
    await writeJsonArtifact(target, `${directory}/${destinationName}`, source.value, schemaName, packageRoot);
    artifacts.push(destinationName);
  }
  const optional = [
    [ARTIFACT_PATHS.preflight, "preflight.json", "preflight"],
    [ARTIFACT_PATHS.receipt, "receipt.json", "execution-receipt"],
    [ARTIFACT_PATHS.sources, "sources.json", "source-registry"],
    [ARTIFACT_PATHS.config, "config.json", "config"],
    [ARTIFACT_PATHS.continuity, "continuity.json", "continuity"],
  ];
  for (const [sourcePath, destinationName, schemaName] of optional) {
    const copied = await copyJson(target, sourcePath, `${directory}/${destinationName}`, schemaName, packageRoot, artifacts, destinationName);
    if (copied && !artifacts.includes(destinationName)) artifacts.push(destinationName);
  }
  const executionRefs = [...new Set([
    ...(stateSource.value.checks ?? []),
    ...(receiptSource?.value?.checks ?? []),
  ].map((check) => check?.executionRef).filter(Boolean))].sort();
  for (const executionRef of executionRefs) {
    const execution = await readExecutionArtifact({ target, executionRef, packageRoot });
    const destination = `${directory}/executions/${execution.value.executionId}.json`;
    await writeJsonArtifact(target, destination, execution.value, "execution", packageRoot);
    artifacts.push(`executions/${execution.value.executionId}.json`);
  }
  const eventsPath = ensureWithin(target, ARTIFACT_PATHS.events);
  if (await fileExists(eventsPath)) {
    await assertSafePath(target, `${directory}/events.ndjson`);
    await writeFileAtomic(ensureWithin(target, `${directory}/events.ndjson`), await readBytes(eventsPath));
    artifacts.push("events.ndjson");
  }
  const gateDirectory = ensureWithin(target, ARTIFACT_PATHS.gates);
  if (await fileExists(gateDirectory)) {
    const entries = await readdir(gateDirectory, { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".json")).sort((left, right) => left.name.localeCompare(right.name))) {
      const gateName = entry.name.slice(0, -5);
      const sourcePath = `${ARTIFACT_PATHS.gates}/${entry.name}`;
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
  const provenanceErrors = [
    ...(await validateChecksExecutionProvenance(loaded.state?.checks, {
      target,
      packageRoot,
      taskId,
      executionArtifacts: executions,
      allowForeignCwd: true,
      artifactPath: "state.json",
    })),
    ...(await validateChecksExecutionProvenance(loaded.receipt?.checks, {
      target,
      packageRoot,
      taskId,
      executionArtifacts: executions,
      allowForeignCwd: true,
      artifactPath: "receipt.json",
    })),
  ];
  if (provenanceErrors.length > 0) {
    const first = provenanceErrors[0];
    const error = new Error(first.message);
    error.code = first.code;
    error.artifacts = first.artifacts;
    throw error;
  }
  return { manifest: manifest.value, artifacts: loaded };
}
