import { runPreflight as evaluateAndPersistPreflight } from "../core/preflight.js";

export { evaluateAndPersistPreflight as runPreflight };

export function formatPreflightResult(result) {
  const lines = [`FORGELOOP PREFLIGHT: ${result.status}`];
  for (const error of result.errors) {
    lines.push(`${error.code}: ${error.message}`);
    if (error.next) lines.push(`NEXT: ${error.next}`);
  }
  return `${lines.join("\n")}\n`;
}
