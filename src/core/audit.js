import { ARTIFACT_PATHS } from "./artifacts.js";
import { evaluateCompletion } from "./completion.js";
import { readManifest } from "./manifest.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { readJsonArtifact } from "./artifacts.js";
import { currentChangedPaths } from "./repository.js";
import { validateReadyProtocolConsistency } from "./preflight.js";
import { taskArtifactPath } from "./task-paths.js";
import { readTaskDescriptor } from "./task-descriptor.js";

function sortErrors(errors) {
  return [...errors].sort((left, right) => left.code.localeCompare(right.code)
    || left.message.localeCompare(right.message));
}

async function compareChangedPaths(target, packageRoot, options = {}) {
  const receiptRel = options.receiptPath ?? (options.taskId ? taskArtifactPath(options.taskId, "receipt") : ARTIFACT_PATHS.receipt);
  let receipt;
  try {
    receipt = (await readJsonArtifact(target, receiptRel, "execution-receipt", packageRoot)).value;
  } catch {
    return { status: "NOT_VERIFIED", expected: [], observed: [], missing: [], unexpected: [] };
  }

  let writeClaims = [];
  if (options.taskId) {
    try {
      const desc = await readTaskDescriptor(target, options.taskId, packageRoot);
      writeClaims = desc.value.writeClaims ?? [];
    } catch {
      // ignore
    }
  }

  let observed;
  if (writeClaims.length > 0) {
    observed = await currentChangedPaths(target, { paths: writeClaims });
  } else {
    observed = await currentChangedPaths(target);
  }

  if (observed === null) {
    return { status: "NOT_VERIFIED", expected: receipt.changedPaths ?? [], observed: [], missing: [], unexpected: [] };
  }
  const expected = [...new Set(receipt.changedPaths ?? [])].sort();
  const missing = expected.filter((relativePath) => !observed.includes(relativePath));
  const unexpected = observed.filter((relativePath) => !expected.includes(relativePath));
  return {
    status: missing.length === 0 && unexpected.length === 0 ? "MATCH" : "MISMATCH",
    expected,
    observed,
    missing,
    unexpected,
  };
}

export async function evaluateAudit({
  target,
  packageRoot,
  strict = false,
  authorityContext,
  runtimeContext,
  taskId = null,
  contractPath = null,
  routePath = null,
  statePath = null,
  receiptPath = null,
  eventsPath = null,
  preflightPath = null,
} = {}) {
  const completion = await evaluateCompletion({
    target,
    packageRoot,
    strict,
    authorityContext,
    runtimeContext,
    taskId,
    contractPath,
    routePath,
    statePath,
    receiptPath,
    eventsPath,
    preflightPath,
  });
  const preflightRel = preflightPath ?? (taskId ? taskArtifactPath(taskId, "preflight") : ARTIFACT_PATHS.preflight);
  const receiptRel = receiptPath ?? (taskId ? taskArtifactPath(taskId, "receipt") : ARTIFACT_PATHS.receipt);
  const stateRel = statePath ?? (taskId ? taskArtifactPath(taskId, "state") : ARTIFACT_PATHS.state);
  const contractRel = contractPath ?? (taskId ? taskArtifactPath(taskId, "contract") : ARTIFACT_PATHS.contract);
  const routeRel = routePath ?? (taskId ? taskArtifactPath(taskId, "route") : ARTIFACT_PATHS.route);

  let manifest = null;
  let manifestError = null;
  try {
    manifest = await readManifest(target);
  } catch (error) {
    manifestError = error.message;
  }
  let readyConsistencyErrors = [];
  try {
    const persistedPreflight = await readJsonArtifact(target, preflightRel, "preflight", packageRoot);
    if (persistedPreflight.value.status === "READY") {
      readyConsistencyErrors = await validateReadyProtocolConsistency({
        target,
        packageRoot,
        persisted: persistedPreflight.value,
        current: completion.preflight,
        taskId,
      });
    }
  } catch {
    // Completion already reports missing or invalid preflight artifacts.
  }
  const errors = sortErrors([...completion.errors, ...readyConsistencyErrors]);
  const changedPaths = await compareChangedPaths(target, packageRoot, { taskId, receiptPath });
  if (changedPaths.status === "MISMATCH") {
    errors.push({
      code: "E_RECEIPT_PATH_MISMATCH",
      message: "Receipt changedPaths do not match observed repository paths",
      artifacts: [receiptRel],
      missing: changedPaths.missing,
      unexpected: changedPaths.unexpected,
      next: "Run forgeloop prepare-completion to refresh changed paths, then rerun audit.",
    });
  }
  const stale = errors.some((error) => error.code.includes("STALE") || error.code === "E_PHASE_ARTIFACT_STALE");
  const blocked = errors.some((error) => ["E_GATE_UNVERIFIED", "E_GATE_STALE", "E_EVIDENCE_COVERAGE_PARTIAL", "E_PHASE_PREREQUISITE_MISSING"].includes(error.code));
  const status = errors.length === 0 && completion.status === "VALID"
    ? "VALID"
    : stale
      ? "STALE"
      : blocked
        ? "INCOMPLETE"
        : "INVALID";
  let policyStatus = null;
  const { detectPolicyCapability, evaluateTargetPolicy } = await import("./policy-engine.js");
  const policyCapability = await detectPolicyCapability(target, packageRoot);
  if (policyCapability === "AVAILABLE") {
    try {
      const policyEval = await evaluateTargetPolicy({ target, packageRoot, taskId });
      policyStatus = {
        status: policyEval.status,
        provenRules: policyEval.provenRules,
        inertRules: policyEval.inertRules,
        unsupportedRules: policyEval.unsupportedRules,
        baselineViolations: policyEval.baselineViolations,
        drift: policyEval.drift?.detected ?? false,
      };
    } catch {
      policyStatus = { status: "INVALID", provenRules: 0, inertRules: 0, unsupportedRules: 0, baselineViolations: 0, drift: false };
    }
  } else if (policyCapability === "INVALID") {
    policyStatus = { status: "INVALID", provenRules: 0, inertRules: 0, unsupportedRules: 0, baselineViolations: 0, drift: false };
  } else {
    policyStatus = { status: "NOT_APPLICABLE", provenRules: 0, inertRules: 0, unsupportedRules: 0, baselineViolations: 0, drift: false };
  }

  return {
    schemaVersion: 1,
    protocolVersion: PROTOCOL_VERSION,
    status,
    strict,
    errors,
    warnings: [...completion.warnings, ...(manifestError ? [{ code: "E_INSTALLATION_INVALID", message: manifestError }] : [])],
    installation: {
      status: manifest ? "ready" : manifestError ? "invalid" : "missing",
      manifest: Boolean(manifest),
    },
    policy: policyStatus,
    completion,
    changedPaths,
    publicationStatus: completion.publicationStatus,
    productionReadiness: completion.productionReadiness,
    artifacts: {
      contract: contractRel,
      route: routeRel,
      state: stateRel,
      receipt: receiptRel,
    },
  };
}
