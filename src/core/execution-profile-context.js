import { readContract } from "./contract.js";
import { assertExecutionProfile, LEGACY_EXECUTION_PROFILE } from "./execution-profile.js";
import { getNextAction } from "./next-action.js";
import { readPersistedRoute } from "./route-artifact.js";
import { readWorkState } from "./work-state.js";

export const PROFILE_CONTEXT_POLICIES = Object.freeze({
  light: Object.freeze({
    contextDepth: "targeted",
    output: "compact",
    planDepth: "short",
    guideStrategy: "targeted",
    verificationStrategy: "focused",
    optionalArtifacts: "lazy",
    requiredSections: ["objective", "scope", "implementation", "verification"],
    excludedContext: ["full-history", "full-trace", "all-schemas", "all-guides", "reflection", "unrelated-repository-context"],
  }),
  balanced: Object.freeze({
    contextDepth: "relevant",
    output: "standard",
    planDepth: "standard",
    guideStrategy: "relevant",
    verificationStrategy: "normal",
    optionalArtifacts: "lazy",
    requiredSections: ["objective", "scope", "implementation", "verification", "relevant-history"],
    excludedContext: ["unrelated-repository-context"],
  }),
  full: Object.freeze({
    contextDepth: "expanded",
    output: "expanded",
    planDepth: "deep",
    guideStrategy: "broad-risk",
    verificationStrategy: "expanded-when-justified",
    optionalArtifacts: "when-required-or-useful",
    requiredSections: ["objective", "scope", "implementation", "verification", "risk", "relevant-history"],
    excludedContext: [],
  }),
});

const OPTIONAL_CONTEXT_BY_PROFILE = Object.freeze({
  light: Object.freeze([]),
  balanced: Object.freeze(["task-history", "relevant-artifacts"]),
  full: Object.freeze([
    "task-history",
    "relevant-artifacts",
    "risk-context",
    "dependency-context",
    "review-context",
    "verification-context",
  ]),
});

const PROFILE_INVARIANTS = Object.freeze({
  lifecyclePhasesPreserved: true,
  requiredGatesPreserved: true,
  evidenceRequirementsPreserved: true,
  verificationTruthPreserved: true,
  authorityChecksPreserved: true,
  provenancePreserved: true,
  completionValidationPreserved: true,
  safetyFloorPreserved: true,
  lifecyclePhaseSkippingAllowed: false,
});

function contextError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function legacyExecutionProfile() {
  return {
    requested: LEGACY_EXECUTION_PROFILE,
    floor: LEGACY_EXECUTION_PROFILE,
    resolved: LEGACY_EXECUTION_PROFILE,
    reasons: ["LEGACY_ROUTE_COMPATIBILITY"],
    escalated: false,
  };
}

export function getExecutionProfileContextPolicy(profile) {
  if (!Object.prototype.hasOwnProperty.call(PROFILE_CONTEXT_POLICIES, profile)) {
    throw contextError("E_EXECUTION_PROFILE_INVALID", `Unsupported resolved execution profile: ${profile}`);
  }
  return {
    ...PROFILE_CONTEXT_POLICIES[profile],
    allowedOptionalContext: [...OPTIONAL_CONTEXT_BY_PROFILE[profile]],
  };
}

function verificationRequirements(contract) {
  if (Array.isArray(contract.verification)) {
    return contract.verification.map((requirement) => {
      if (typeof requirement === "string") return { id: requirement, text: requirement, type: "VERIFICATION" };
      return {
        id: requirement.id ?? null,
        text: requirement.text ?? null,
        type: requirement.type ?? "VERIFICATION",
      };
    });
  }
  return (contract.successCriteria ?? []).map((criterion, index) => ({
    id: `success-criterion-${index + 1}`,
    text: criterion,
    type: "SUCCESS_CRITERION",
  }));
}

export function projectExecutionProfileContext({
  taskId,
  contract,
  route,
  state,
  nextAction,
} = {}) {
  if (typeof taskId !== "string" || !taskId) throw contextError("E_TASK_REQUIRED", "taskId is required");
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    throw contextError("E_EXECUTION_PROFILE_CONTEXT_INVALID", "contract is required for profile-aware context");
  }
  if (!route || typeof route !== "object" || Array.isArray(route)) {
    throw contextError("E_EXECUTION_PROFILE_CONTEXT_INVALID", "route is required for profile-aware context");
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw contextError("E_EXECUTION_PROFILE_CONTEXT_INVALID", "work state is required for profile-aware context");
  }
  const profile = route.executionProfile ? assertExecutionProfile(route.executionProfile) : legacyExecutionProfile();
  const resolvedProfile = profile.resolved;
  const policy = getExecutionProfileContextPolicy(resolvedProfile);
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId,
    executionProfile: profile,
    phase: state.phase,
    nextAction: nextAction?.nextAction ?? null,
    objective: contract.objective ?? null,
    deliverables: [...(contract.deliverables ?? [])],
    constraints: [...(contract.constraints ?? [])],
    selectedGuideIds: [...(state.selectedGuides ?? [])],
    verificationRequirements: verificationRequirements(contract),
    contextPolicy: policy,
    optionalContext: {
      available: [...OPTIONAL_CONTEXT_BY_PROFILE[resolvedProfile]],
      loaded: [],
    },
    invariants: { ...PROFILE_INVARIANTS },
  };
}

export async function buildExecutionProfileContext({
  target,
  packageRoot,
  taskId,
  authorityContext,
  runtimeContext,
} = {}) {
  if (typeof taskId !== "string" || !taskId) throw contextError("E_TASK_REQUIRED", "taskId is required");
  const [contractArtifact, routeArtifact, state] = await Promise.all([
    readContract(target, packageRoot, { taskId }),
    readPersistedRoute(target, packageRoot, { taskId }),
    readWorkState(target, { packageRoot, taskId }),
  ]);
  const nextAction = await getNextAction({
    target,
    packageRoot,
    taskId,
    authorityContext,
    runtimeContext,
  });
  return projectExecutionProfileContext({
    taskId,
    contract: contractArtifact.value,
    route: routeArtifact.value,
    state,
    nextAction,
  });
}
