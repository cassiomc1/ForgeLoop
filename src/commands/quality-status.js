import { withResolvedTask } from "../core/task-command.js";
import { projectStructuralQualityStatus } from "../core/structural-quality/status.js";

export async function runQualityStatus({ target, packageRoot, taskId, runtimeContext } = {}) {
  return withResolvedTask(target, { taskId, packageRoot }, async (ctx) => projectStructuralQualityStatus({
    target,
    packageRoot,
    taskId: ctx?.taskId ?? taskId,
    runtimeContext,
  }), { explicitRequired: true });
}

export function formatQualityStatusResult(result) {
  const status = result.mode === "off"
    ? "OFF"
    : result.current.status === "PASS"
      ? "PASS"
      : result.current.status === "FAIL"
        ? "FAIL"
        : result.current.status === "BLOCKED" || (result.mode === "gate" && result.baseline.status !== "OBSERVED")
          ? "BLOCKED"
          : "NOT OBSERVED";
  return [
    `STRUCTURAL QUALITY: ${status}`,
    `mode: ${result.mode}`,
    `provider: ${result.provider ?? "none"}`,
    `baseline: ${result.baseline.status}`,
    `current: ${result.current.status}`,
    `quality: ${result.current.qualitySignal ?? result.baseline.qualitySignal ?? "none"}`,
    `delta: ${result.current.delta ?? "none"}`,
    `next: ${result.next ?? "none"}`,
    "",
  ].join("\n");
}
