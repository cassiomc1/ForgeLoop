import { evaluateAttestationCoverage } from "../core/attestation-coverage.js";

export async function runAttestationVerifyRange(options = {}) {
  return evaluateAttestationCoverage({
    target: options.target,
    packageRoot: options.packageRoot,
    revisionProvider: options.revisionProvider ?? "git",
    baseRevision: options.baseRevision,
    headRevision: options.headRevision,
    requireCompleteCoverage: options.requireCompleteCoverage === true,
    requireSignature: options.requireSignature === true,
    signingProvider: options.signingProvider,
    signerPolicy: {
      identity: options.attestationIdentity,
      issuer: options.attestationIssuer,
      trustedRoot: options.trustedRoot,
    },
  });
}

export function formatAttestationVerifyRangeResult(result) {
  return [
    `FORGELOOP REVISION VERIFICATION: ${result.status}`,
    `LEVEL: ${result.level}`,
    `CHANGED: ${result.changedPaths}`,
    `COVERED: ${result.coveredPaths}`,
    `UNCOVERED: ${result.uncoveredPaths.length}`,
    `TASKS: ${result.tasks}`,
    ...result.errors.map((error) => `${error.code}: ${error.message}`),
    "",
  ].join("\n");
}
