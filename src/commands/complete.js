import { runComplete as evaluateAndComplete } from "../core/completion.js";

export { evaluateAndComplete as runComplete };

export function formatCompleteResult(result) {
  const lines = [`FORGELOOP COMPLETE: ${result.status}`];
  if (result.status === "VALID") {
    lines.push(`TASK: ${result.taskStatus}`);
    lines.push(`VERIFICATION: ${result.verificationStatus}`);
    lines.push(`PUBLICATION: ${result.publicationStatus}`);
    lines.push(`PRODUCTION_READINESS: ${result.productionReadiness}`);
  }
  for (const error of result.errors) lines.push(`${error.code}: ${error.message}`);
  return `${lines.join("\n")}\n`;
}
