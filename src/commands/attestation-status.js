import { resolveAttestationStatus } from "../core/attestation.js";

export async function runAttestationStatus({ target, packageRoot, taskId } = {}) {
  return resolveAttestationStatus({ target, packageRoot, taskId });
}

export function formatAttestationStatusResult(result) {
  const lines = [`FORGELOOP ATTESTATION: ${result.status}`, `TASK: ${result.taskId}`, `LEVEL: ${result.level}`, `CONTENT: ${result.content}`, `RECEIPT: ${result.receipt}`, `LEDGER: ${result.ledger}`, `SIGNATURE: ${result.signature}`, `FILES: ${result.files}`];
  if (result.subject) lines.push(`SUBJECT: ${result.subject}`);
  for (const error of result.errors ?? []) lines.push(`${error.code}: ${error.message}`);
  return `${lines.join("\n")}\n`;
}
