import { canonicalFingerprint } from "./artifacts.js";
import { ACTION_CAPABILITIES } from "./action-constants.js";
import { validateCapabilityPolicy } from "./action-model.js";
import { PROJECT_ARTIFACT_PATHS } from "./task-paths.js";
import { assertSafePath, ensureWithin, fileExists } from "./filesystem.js";
import {
  E_ACTION_INVALID,
  E_POLICY_INVALID,
} from "./error-codes.js";

const ALLOWED_POLICY_PROPERTIES = new Set(["schemaVersion", "defaultDecision", "rules"]);

function policyError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function loadCapabilityPolicy(target, packageRoot) {
  const relativePath = PROJECT_ARTIFACT_PATHS.capabilityPolicy;
  await assertSafePath(target, relativePath);
  const absolutePath = ensureWithin(target, relativePath);
  if (!(await fileExists(absolutePath))) {
    return null;
  }
  let parsed;
  try {
    const { readFile } = await import("node:fs/promises");
    parsed = JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    throw policyError(E_POLICY_INVALID, `capability policy is not valid JSON: ${error.message}`);
  }
  for (const key of Object.keys(parsed ?? {})) {
    if (!ALLOWED_POLICY_PROPERTIES.has(key)) {
      throw policyError(
        E_POLICY_INVALID,
        `capability policy.${key} is not an allowed property; project-local policy can never declare authority or trust metadata`,
      );
    }
  }
  validateCapabilityPolicy(parsed);
  return {
    policy: parsed,
    fingerprint: canonicalFingerprint(parsed),
    path: relativePath,
  };
}

export function resolveCapabilityDecision(policy, capability) {
  if (typeof capability !== "string" || !capability) {
    throw policyError(E_ACTION_INVALID, "capability must be a non-empty string");
  }
  // Capabilities outside the canonical protocol vocabulary always fail closed.
  if (!ACTION_CAPABILITIES.includes(capability)) {
    return { decision: "DENY", reasonCode: "E_ACTION_CAPABILITY_UNKNOWN" };
  }
  const rule = policy.rules.find((candidate) => candidate.capability === capability);
  const decision = rule?.decision ?? policy.defaultDecision;
  switch (decision) {
    case "ALLOW":
      return { decision: "ALLOW", reasonCode: null };
    case "DENY":
      return { decision: "DENY", reasonCode: "E_ACTION_CAPABILITY_DENIED" };
    case "REQUIRE_AUTHORITY":
      return { decision: "REQUIRE_AUTHORITY", reasonCode: "E_ACTION_AUTHORITY_REQUIRED" };
    case "REQUIRE_APPROVAL":
      return { decision: "REQUIRE_APPROVAL", reasonCode: "E_ACTION_APPROVAL_REQUIRED" };
    default:
      return { decision: "DENY", reasonCode: "E_ACTION_CAPABILITY_DENIED" };
  }
}

export function isTrustedHostAuthorityContext(authorityContext) {
  // Only a genuine host-controlled trust boundary may satisfy
  // REQUIRE_AUTHORITY. A project-local file, environment-selected source,
  // CLI flag, or transport session can never promote itself to HOST_ATTESTED.
  if (!authorityContext || typeof authorityContext !== "object") return false;
  if (authorityContext.trustMode !== "HOST_ATTESTED") return false;
  const source = typeof authorityContext.source === "string" ? authorityContext.source : "";
  const forbiddenSources = ["project-local-file", "environment", "cli-flag", "transport-session"];
  if (forbiddenSources.includes(source)) return false;
  return authorityContext.hostSupplied === true && source === "host-boundary";
}

export async function evaluateActionCapability({
  target,
  packageRoot,
  action,
  authorityContext = { trustMode: "NONE" },
  approval,
}) {
  if (!action || typeof action !== "object") {
    throw policyError(E_ACTION_INVALID, "action is required for capability evaluation");
  }

  let loaded = null;
  try {
    loaded = await loadCapabilityPolicy(target, packageRoot);
  } catch (error) {
    if (error.code === E_POLICY_INVALID) throw error;
    throw error;
  }

  // A poisoned local policy artifact must never grant authority.
  if (
    loaded &&
    (loaded.policy.authority !== undefined ||
      loaded.policy.trustMode !== undefined ||
      loaded.policy.hostAttested !== undefined)
  ) {
    loaded = null;
  }

  if (!loaded) {
    // No capability policy present. v1 keeps legacy flows unchanged and fails
    // closed for new durable-action execution.
    return {
      capability: action.capability,
      decision: "REQUIRE_APPROVAL",
      allowed: false,
      reasonCode: "E_ACTION_APPROVAL_REQUIRED",
      policyFingerprint: null,
    };
  }

  const resolved = resolveCapabilityDecision(loaded.policy, action.capability);
  const base = {
    capability: action.capability,
    decision: resolved.decision,
    policyFingerprint: loaded.fingerprint,
  };

  if (resolved.decision === "ALLOW") {
    return { ...base, allowed: true, reasonCode: null };
  }
  if (resolved.decision === "DENY") {
    return { ...base, allowed: false, reasonCode: resolved.reasonCode ?? "E_ACTION_CAPABILITY_DENIED" };
  }
  if (resolved.decision === "REQUIRE_AUTHORITY") {
    if (isTrustedHostAuthorityContext(authorityContext)) {
      return { ...base, allowed: true, reasonCode: null };
    }
    return { ...base, allowed: false, reasonCode: "E_ACTION_AUTHORITY_REQUIRED" };
  }
  if (approval?.approvalId) {
    const { validateApprovalForAction } = await import("./approvals.js");
    try {
      const resolvedApproval = await validateApprovalForAction(target, {
        packageRoot,
        taskId: action.taskId,
        action,
        approvalId: approval.approvalId,
      });
      if (resolvedApproval.authorityKind !== "HOST_ATTESTED" || !resolvedApproval.hostGrantRef) {
        return { ...base, allowed: false, reasonCode: "E_ACTION_AUTHORITY_REQUIRED" };
      }
      return { ...base, allowed: true, reasonCode: null, approvalId: approval.approvalId };
    } catch (error) {
      return { ...base, allowed: false, reasonCode: error.code ?? "E_APPROVAL_INVALID" };
    }
  }
  return { ...base, allowed: false, reasonCode: "E_ACTION_APPROVAL_REQUIRED" };
}
