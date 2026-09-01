import { evaluateStructuralQuality } from "../core/structural-quality/service.js";

export async function runQualityVerify({ target, packageRoot, taskId, timeoutMs, authorityContext, runtimeContext } = {}) {
  return evaluateStructuralQuality({
    target,
    packageRoot,
    taskId,
    timeoutMs,
    authorityContext,
    runtimeContext,
  });
}

export function formatQualityVerifyResult(result) {
  return [
    "FORGELOOP STRUCTURAL QUALITY VERIFICATION",
    `status: ${result.evaluation?.status ?? result.status}`,
    `cycle: ${result.evaluation?.verificationCycle ?? "none"}`,
    `attempt: ${result.evaluation?.attempt ?? "none"}`,
    `provider: ${result.evaluation?.provider?.id ?? "none"}`,
    `provider-version: ${result.evaluation?.provider?.version ?? "unknown"}`,
    `quality: ${result.evaluation?.currentSignal ?? result.evaluation?.snapshot?.qualitySignal ?? "none"}`,
    `delta: ${result.evaluation?.comparison?.qualityDelta ?? "none"}`,
    `bottleneck: ${result.evaluation?.snapshot?.bottleneck ?? "none"}`,
    `artifact: ${result.evaluation?.artifactRef ?? "none"}`,
    `check: ${result.check?.status ?? "not-recorded"}`,
    `next: ${result.evaluation?.status === "FAIL" ? "DIAGNOSE_STRUCTURAL_QUALITY_REGRESSION" : result.evaluation?.status === "BLOCKED" ? "RESOLVE_STRUCTURAL_QUALITY_BLOCKER" : "none"}`,
    "",
  ].join("\n");
}
