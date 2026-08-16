import { ARTIFACT_PATHS } from "./artifacts.js";
import { requiredEvidenceForTarget } from "./completion-artifacts.js";
import { coverageForRequirements } from "./coverage.js";
import { assertCheckList } from "./checks.js";

export function artifactError(code, message, artifacts = []) {
  return { code, message, artifacts };
}

export function staleReasons(state, contract, route) {
  const reasons = [];
  if (state.contractFingerprint !== contract.fingerprint) {
    reasons.push(artifactError(
      "E_CONTRACT_STALE",
      "Work state references a different current contract",
      [ARTIFACT_PATHS.state, ARTIFACT_PATHS.contract],
    ));
  }
  if (route.value.contractFingerprint !== undefined && route.value.contractFingerprint !== contract.fingerprint) {
    reasons.push(artifactError(
      "E_ROUTE_STALE",
      "Routing result references a different current contract",
      [ARTIFACT_PATHS.route, ARTIFACT_PATHS.contract],
    ));
  }
  if (state.routeFingerprint !== route.fingerprint) {
    reasons.push(artifactError(
      "E_ROUTE_STALE",
      "Work state references a different routing result",
      [ARTIFACT_PATHS.state, ARTIFACT_PATHS.route],
    ));
  }
  if (JSON.stringify(state.selectedGuides) !== JSON.stringify(route.value.guides)) {
    reasons.push(artifactError(
      "E_ROUTE_STALE",
      "Work state guides do not match the persisted routing result",
      [ARTIFACT_PATHS.state, ARTIFACT_PATHS.route],
    ));
  }
  return reasons;
}

export function freshnessReasons(state, classification) {
  const requiredArtifactPaths = state.requiredArtifacts?.map((artifact) => artifact.path) ?? [];
  const reasons = [artifactError(
    "E_STATE_REVALIDATION_REQUIRED",
    `Work-state checkpoint requires revalidation: ${classification.reasons.join(", ")}`,
    [ARTIFACT_PATHS.state],
  )];
  for (const reason of classification.reasons) {
    const contractRelated = ["CONTRACT_CHANGED", "CONTRACT_INVALID", "CONTRACT_NOT_VERIFIED"].includes(reason);
    const artifactRelated = reason.startsWith("REQUIRED_ARTIFACT");
    reasons.push(artifactError(
      contractRelated ? "E_CONTRACT_STALE" : artifactRelated ? "E_REQUIRED_ARTIFACT_STALE" : "E_REPOSITORY_CHANGED",
      `Work-state freshness check failed: ${reason}`,
      uniqueSorted([
        ARTIFACT_PATHS.state,
        ...(contractRelated ? [ARTIFACT_PATHS.contract] : []),
        ...(artifactRelated ? requiredArtifactPaths : []),
      ]),
    ));
  }
  return reasons;
}

export function checkListReasons(state) {
  try {
    assertCheckList(state.checks, "work-state.checks");
    return [];
  } catch (error) {
    return [artifactError(error.code ?? "E_CHECK_INVALID", error.message, [ARTIFACT_PATHS.state])];
  }
}

export async function loadArtifact(loader, fallback) {
  try {
    return { value: await loader(), error: null, missingArtifacts: [] };
  } catch (error) {
    return {
      value: null,
      error,
      missingArtifacts: error?.code === "ARTIFACT_MISSING"
        ? (error.artifacts?.length ? error.artifacts : [fallback])
        : [],
    };
  }
}

export async function requirementsAndCoverage({
  target,
  packageRoot,
  contract,
  route,
  checks,
  additionalEvidence = [],
  authorityContext,
  runtimeContext,
}) {
  const requirements = await requiredEvidenceForTarget({
    target,
    contract,
    route,
    packageRoot,
    additionalEvidence,
  });
  return {
    requirements,
    coverage: coverageForRequirements(requirements, checks, {
      target,
      taskId: contract?.value?.taskId,
      options: { authorityContext, runtimeContext },
    }),
  };
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}
