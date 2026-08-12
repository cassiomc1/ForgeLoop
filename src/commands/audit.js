import { evaluateAudit } from "../core/audit.js";

export { evaluateAudit as runAudit };

export function formatAuditResult(result) {
  const lines = [`FORGELOOP AUDIT: ${result.status}`];
  for (const error of result.errors) {
    lines.push(`${error.code}: ${error.message}`);
    if (error.next) lines.push(`NEXT: ${error.next}`);
  }
  return `${lines.join("\n")}\n`;
}
