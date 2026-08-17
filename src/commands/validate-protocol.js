import { assertSafePath, ensureWithin, fileExists, readBytes } from "../core/filesystem.js";
import { assertJsonBytes, assertJsonLimits } from "../core/json-safety.js";
import { validateTaskArtifactSet } from "../core/conformance.js";
import { assertSchema, readSchema } from "../core/schema-validation.js";
import { assertRouteInvariants } from "../core/router.js";
import { assertWorkStateSemantics, classifyLoadedWorkState } from "../core/work-state.js";
import { validateReceipt } from "../core/receipt.js";
import { validateTaskBrief, validateDelegatedResult } from "../core/delegation.js";
import { ARTIFACT_PATHS, readJsonArtifact } from "../core/artifacts.js";
import { evaluatePreflight, validateReadyProtocolConsistency } from "../core/preflight.js";
import { validateEventLedger, validateStateLedgerCoherence } from "../core/events.js";
import { validateChecksExecutionProvenance } from "../core/completion-artifacts.js";
import { assertContinuitySemantics } from "../core/continuity.js";
import { currentChangedPaths, currentRepositoryFingerprint } from "../core/repository.js";

async function readArtifact(target, relativePath, label) {
  if (!relativePath) return null;
  await assertSafePath(target, relativePath);
  const artifactPath = ensureWithin(target, relativePath);
  if (!(await fileExists(artifactPath))) {
    return {
      error: {
        code: "ARTIFACT_MISSING",
        message: `${label} is missing: ${relativePath}`,
        artifacts: [relativePath],
      },
    };
  }
  const bytes = await readBytes(artifactPath);
  try {
    assertJsonBytes(bytes, label);
    const value = JSON.parse(bytes.toString("utf8"));
    assertJsonLimits(value, label);
    return { value };
  } catch (error) {
    return {
      error: {
        code: error.code === "JSON_LIMIT_EXCEEDED" ? error.code : "ARTIFACT_INVALID_JSON",
        message: `${label} is invalid: ${error.message}`,
        artifacts: [relativePath],
      },
    };
  }
}

import { taskArtifactPath } from "../core/task-paths.js";

export async function runValidateProtocol({
  target,
  packageRoot,
  routeFile = null,
  stateFile = null,
  receiptFile = null,
  contractFile = null,
  continuityFile = null,
  taskBriefFiles = [],
  delegatedResultFiles = [],
  taskId = null,
  task = null,
}) {
  const effectiveTaskId = taskId ?? task ?? null;
  const effectiveRouteFile = routeFile ?? (effectiveTaskId ? taskArtifactPath(effectiveTaskId, "route") : ARTIFACT_PATHS.route);
  const effectiveStateFile = stateFile ?? (effectiveTaskId ? taskArtifactPath(effectiveTaskId, "state") : ARTIFACT_PATHS.state);
  const effectiveReceiptFile = receiptFile ?? (effectiveTaskId ? taskArtifactPath(effectiveTaskId, "receipt") : ARTIFACT_PATHS.receipt);
  const effectiveContractFile = contractFile ?? (effectiveTaskId ? taskArtifactPath(effectiveTaskId, "contract") : null);
  const effectiveContinuityFile = continuityFile ?? (effectiveTaskId ? taskArtifactPath(effectiveTaskId, "continuity") : null);
  const effectiveEventsFile = effectiveTaskId ? taskArtifactPath(effectiveTaskId, "events") : ARTIFACT_PATHS.events;
  const effectivePreflightFile = effectiveTaskId ? taskArtifactPath(effectiveTaskId, "preflight") : ARTIFACT_PATHS.preflight;

  const descriptors = [
    ["route", effectiveRouteFile],
    ["state", effectiveStateFile],
    ["receipt", effectiveReceiptFile],
    ["continuity", effectiveContinuityFile],
    ...taskBriefFiles.map((file) => [`task brief:${file}`, file]),
    ...delegatedResultFiles.map((file) => [`delegated result:${file}`, file]),
  ];
  const loaded = [];
  for (const [label, relativePath] of descriptors) {
    const artifact = await readArtifact(target, relativePath, label);
    loaded.push({ label, relativePath, ...artifact });
  }

  const readErrors = loaded.filter((item) => item.error).map((item) => item.error);
  const route = loaded.find((item) => item.label === "route")?.value ?? null;
  const state = loaded.find((item) => item.label === "state")?.value ?? null;
  const receipt = loaded.find((item) => item.label === "receipt")?.value ?? null;
  const continuity = loaded.find((item) => item.label === "continuity")?.value ?? null;
  const taskBriefs = loaded.filter((item) => item.label.startsWith("task brief:") && item.value).map((item) => item.value);
  const delegatedResults = loaded.filter((item) => item.label.startsWith("delegated result:") && item.value).map((item) => item.value);
  const schemaErrors = [];
  const validateLoaded = async (item, schemaName, semanticValidator = null) => {
    if (!item.value) return;
    try {
      const schema = await readSchema(schemaName, packageRoot);
      assertSchema(item.value, schema, item.label);
      if (semanticValidator) await semanticValidator(item.value);
    } catch (error) {
      schemaErrors.push({
        code: "ARTIFACT_SCHEMA_INVALID",
        message: `${item.label} failed schema or semantic validation: ${error.message}`,
        artifacts: [item.relativePath],
      });
    }
  };
  await validateLoaded(loaded.find((item) => item.label === "route"), "routing-result", async (value) => assertRouteInvariants(value));
  await validateLoaded(loaded.find((item) => item.label === "state"), "work-state", async (value) => assertWorkStateSemantics(value));
  await validateLoaded(loaded.find((item) => item.label === "receipt"), "execution-receipt", async (value) => validateReceipt(value, packageRoot));
  await validateLoaded(loaded.find((item) => item.label === "continuity"), "continuity", async (value) => assertContinuitySemantics(value));
  for (const [value, artifactPath] of [
    [state, stateFile],
    [receipt, receiptFile],
  ]) {
    if (!value) continue;
    const provenanceErrors = await validateChecksExecutionProvenance(value.checks, {
      target,
      packageRoot,
      taskId: value.taskId,
      artifactPath,
    });
    schemaErrors.push(...provenanceErrors.map((error) => ({
      ...error,
      message: `Command provenance validation failed: ${error.message}`,
      artifacts: [artifactPath, ...(error.artifacts ?? [])],
    })));
  }
  for (const item of loaded.filter((candidate) => candidate.label.startsWith("task brief:"))) {
    await validateLoaded(item, "task-brief", async (value) => validateTaskBrief(value, packageRoot));
  }
  for (const item of loaded.filter((candidate) => candidate.label.startsWith("delegated result:"))) {
    await validateLoaded(item, "delegated-result", async (value) => validateDelegatedResult(value, packageRoot));
  }
  const stateValidationError = schemaErrors.some((error) => error.artifacts.includes(effectiveStateFile));
  const stateClassification = state && readErrors.length === 0 && !stateValidationError
    ? await classifyLoadedWorkState({ target, state, contractFile: effectiveContractFile, taskId: effectiveTaskId })
    : null;
  let readyConsistencyErrors = [];
  try {
    const persistedPreflight = await readJsonArtifact(target, effectivePreflightFile, "preflight", packageRoot);
    if (persistedPreflight.value.status === "READY") {
      readyConsistencyErrors = await validateReadyProtocolConsistency({
        target,
        packageRoot,
        persisted: persistedPreflight.value,
        current: await evaluatePreflight({ target, packageRoot, taskId: effectiveTaskId }),
        taskId: effectiveTaskId,
      });
    }
  } catch {
    // A missing or invalid preflight is already outside the optional protocol set.
  }
  let ledgerEvents = [];
  let ledgerErrors = [];
  if (state && !stateValidationError) {
    const ledger = await validateEventLedger(target, packageRoot, { taskId: effectiveTaskId, eventsPath: effectiveEventsFile });
    ledgerEvents = ledger.events ?? [];
    ledgerErrors = [
      ...ledger.errors.map((error) => ({ ...error, artifacts: [effectiveEventsFile] })),
      ...validateStateLedgerCoherence(state, ledger.events).map((error) => ({
        ...error,
        artifacts: [effectiveStateFile, effectiveEventsFile],
      })),
    ];
  }
  const continuityContext = continuity && state && !stateValidationError
    ? {
      contractFingerprint: state.contractFingerprint,
      repositoryFingerprint: await currentRepositoryFingerprint(target),
      changedPaths: await currentChangedPaths(target),
    }
    : {};
  const result = validateTaskArtifactSet({
    route,
    state,
    stateClassification,
    receipt,
    continuity,
    continuityContext,
    taskBriefs,
    delegatedResults,
    events: ledgerEvents,
  });
  if (readErrors.length > 0 || schemaErrors.length > 0 || readyConsistencyErrors.length > 0 || ledgerErrors.length > 0) {
    return {
      ...result,
      status: "INVALID",
      errors: [...result.errors, ...readErrors, ...schemaErrors, ...readyConsistencyErrors, ...ledgerErrors]
        .sort((left, right) => left.code.localeCompare(right.code) || left.message.localeCompare(right.message)),
    };
  }
  return result;
}

export function formatValidateProtocolResult(result) {
  const lines = [`Protocol: ${result.status}`];
  if (result.continuity) {
    lines.push(`Continuity: ${result.continuity.status}`);
    lines.push(`Continuity authority: ${result.continuity.authority}`);
  }
  if (result.stale) {
    lines.push(`Repository: ${result.stale.repositoryComparison}`);
    lines.push(`Contract: ${result.stale.contractComparison}`);
    lines.push(`Required artifacts: ${result.stale.artifactComparison}`);
    if (result.stale.reasons.length > 0) {
      lines.push("Reasons:");
      for (const reason of result.stale.reasons) lines.push(`- ${reason}`);
    }
    if (result.stale.warnings.length > 0) {
      lines.push("Warnings:");
      for (const warning of result.stale.warnings) lines.push(`- ${warning}`);
    }
  }
  for (const item of result.errors) lines.push(`- ${item.code}: ${item.message}`);
  for (const item of result.incomplete) lines.push(`- INCOMPLETE: ${item}`);
  return `${lines.join("\n")}\n`;
}
