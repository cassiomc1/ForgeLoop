import { evaluateRoute } from "../core/router.js";
import { persistRoute } from "../core/route-artifact.js";
import { readContract } from "../core/contract.js";
import { withTaskMutation } from "../core/task-command.js";

export async function runRoute({ target, packageRoot, workType, surfaces, risks, platforms, behaviorChange, executableChange, taskId, task }) {
  return withTaskMutation(target, { taskId: taskId ?? task, packageRoot }, "route", async (ctx) => {
    const effectiveTaskId = ctx?.taskId ?? null;
    const route = evaluateRoute({
      workType,
      surfaces,
      risks,
      platforms,
      behaviorChange,
      executableChange,
    });
    if (target && packageRoot) {
      let contractFingerprint;
      try {
        contractFingerprint = (await readContract(target, packageRoot, { taskId: effectiveTaskId })).fingerprint;
      } catch {
        contractFingerprint = undefined;
      }
      await persistRoute(target, route, packageRoot, { contractFingerprint, taskId: effectiveTaskId });
    }
    return route;
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
