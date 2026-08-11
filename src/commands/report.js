import { evaluateReport } from "../core/report.js";

export { evaluateReport as runReport };

export function formatReportResult(result) {
  const lines = ["ForgeLoop Compliance"];
  for (const item of result.sections) lines.push(`${item.label.padEnd(20)} ${item.status}`);
  lines.push(`\nVERDICT: ${result.verdict}`);
  return `${lines.join("\n")}\n`;
}
