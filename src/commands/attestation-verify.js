import { verifyAttestation } from "../core/attestation-verifier.js";

export async function runAttestationVerify(options = {}) {
  return verifyAttestation({
    target: options.target,
    packageRoot: options.packageRoot,
    taskId: options.taskId,
    revision: options.attestationRef,
    bundlePath: options.attestationBundle,
    identity: options.attestationIdentity,
    issuer: options.attestationIssuer,
    revisionProvider: options.revisionProvider,
    signingProvider: options.signingProvider,
    trustedRoot: options.trustedRoot,
    requireSignature: options.requireSignature === true,
  });
}

export function formatAttestationVerifyResult(result) {
  const lines = [`FORGELOOP ATTESTATION: ${result.status}`, `LEVEL: ${result.level}`, `CONTENT: ${result.content.status}`];
  for (const error of result.errors ?? []) lines.push(`${error.code}: ${error.message}`);
  return `${lines.join("\n")}\n`;
}
