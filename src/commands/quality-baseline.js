import { withTaskMutation } from "../core/task-command.js";
import { captureStructuralQualityBaseline } from "../core/structural-quality/service.js";

export async function runQualityBaseline({ target, packageRoot, taskId, replace = false, timeoutMs, runtimeContext } = {}) {
  return withTaskMutation(target, { taskId, packageRoot }, "quality-baseline", async (ctx) => captureStructuralQualityBaseline({
    target,
    packageRoot,
    taskId: ctx?.taskId ?? taskId,
    replace,
    timeoutMs,
    runtimeContext,
  }));
}

export function formatQualityBaselineResult(result) {
  return [
    "FORGELOOP STRUCTURAL QUALITY BASELINE",
    `status: ${result.status}`,
    `mode: ${result.mode}`,
    `provider: ${result.provider?.id ?? "not-requested"}`,
    `provider-version: ${result.provider?.version ?? "unknown"}`,
    `quality: ${result.baseline?.snapshot?.qualitySignal ?? "none"}`,
    `bottleneck: ${result.baseline?.snapshot?.bottleneck ?? "none"}`,
    `artifact: ${result.artifactRef ?? "none"}`,
    `next: ${result.mode === "gate" ? "VERIFY_STRUCTURAL_QUALITY" : "none"}`,
    "",
  ].join("\n");
}
