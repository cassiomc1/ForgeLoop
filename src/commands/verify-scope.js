import { captureVerificationScope } from "../core/verification-scope.js";

export async function runVerifyScope({ target, packageRoot, taskId, verificationScopeMode } = {}) {
  return captureVerificationScope(target, { packageRoot, taskId, mode: verificationScopeMode ?? "AUTO" });
}

export function formatVerifyScopeResult(result) {
  return `FORGELOOP VERIFICATION SCOPE: ${result.scope.resolvedMode}\ntask: ${result.scope.taskId}\nselected paths: ${result.scope.selectedPaths.length}\npath: ${result.path}\n\n`;
}
