import { evaluateRoute } from "../core/router.js";

export function runRoute({ workType, surfaces, risks, platforms, behaviorChange, executableChange }) {
  return evaluateRoute({
    workType,
    surfaces,
    risks,
    platforms,
    behaviorChange,
    executableChange,
  });
}

export function formatRouteResult(result) {
  const lines = ["Selected:"];
  if (result.guides.length === 0) {
    lines.push("- none (use the relevant domain guide for this documentation task)");
  } else {
    for (const guide of result.guides) {
      lines.push(`- ${guide}: ${result.reasons[guide].join(", ")}`);
    }
  }

  const excludedEntries = Object.entries(result.excluded);
  if (excludedEntries.length > 0) {
    lines.push("Excluded:");
    for (const [guide, reasons] of excludedEntries) {
      lines.push(`- ${guide}: ${reasons.join(", ")}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
