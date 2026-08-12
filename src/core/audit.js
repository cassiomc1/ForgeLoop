import { ARTIFACT_PATHS } from "./artifacts.js";
import { evaluateCompletion } from "./completion.js";
import { readManifest } from "./manifest.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { readJsonArtifact } from "./artifacts.js";
import { currentChangedPaths } from "./repository.js";

function sortErrors(errors) {
  return [...errors].sort((left, right) => left.code.localeCompare(right.code)
    || left.message.localeCompare(right.message));
}

async function compareChangedPaths(target, packageRoot) {
  let receipt;
  try {
    receipt = (await readJsonArtifact(target, ARTIFACT_PATHS.receipt, "execution-receipt", packageRoot)).value;
  } catch {
    return { status: "NOT_VERIFIED", expected: [], observed: [], missing: [], unexpected: [] };
  }
  const observed = await currentChangedPaths(target);
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

export async function evaluateAudit({ target, packageRoot, strict = false } = {}) {
  const completion = await evaluateCompletion({ target, packageRoot, strict });
  let manifest = null;
  let manifestError = null;
  try {
    manifest = await readManifest(target);
  } catch (error) {
    manifestError = error.message;
  }
  const errors = sortErrors(completion.errors);
  const changedPaths = await compareChangedPaths(target, packageRoot);
  if (changedPaths.status === "MISMATCH") {
    errors.push({
      code: "E_RECEIPT_PATH_MISMATCH",
      message: "Receipt changedPaths do not match observed repository paths",
      artifacts: [ARTIFACT_PATHS.receipt],
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
    completion,
    changedPaths,
    publicationStatus: completion.publicationStatus,
    productionReadiness: completion.productionReadiness,
    artifacts: {
      contract: ARTIFACT_PATHS.contract,
      route: ARTIFACT_PATHS.route,
      state: ARTIFACT_PATHS.state,
      receipt: ARTIFACT_PATHS.receipt,
    },
  };
}
