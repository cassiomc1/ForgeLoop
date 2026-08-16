import {
  E_INSTALLATION_AUTHORITY_REQUIRED,
  E_VERIFICATION_TOOL_UNAVAILABLE,
} from "./verification-constants.js";

export {
  E_COMMAND_RESOLUTION_AMBIGUOUS,
  E_INSTALLATION_AUTHORITY_REQUIRED,
  E_AUTHORITY_INVALID,
  E_AUTHORITY_SCOPE_MISMATCH,
  E_VERIFICATION_TOOL_UNAVAILABLE,
  RESOLUTION_MODES,
} from "./verification-constants.js";
export { E_AUTHORITY_UNTRUSTED_SOURCE } from "./installation-authority.js";
export {
  classifyCommandResolution,
  resolveExecutionResolution,
  MAX_NPM_SCRIPT_DEPTH,
} from "./command-resolution.js";
export {
  classifyNpmInvocation,
  getNpmLifecycleCandidates,
  getNpmScriptName,
  npmWorkspaceSelection,
  parseNpmInvocation,
  parseNpmInvocationArgs,
} from "./npm-classifier.js";
export {
  getInstallationAuthorityRef,
  validateAuthorityGrant,
  validateVerificationAuthority,
} from "./installation-authority.js";
export {
  AUTHORITY_TRUST_MODES,
  createAuthorityContext,
  createForgeLoopContext,
} from "./runtime-context.js";

export function classifyVerificationCapability({
  available = false,
  equivalentAvailable = false,
  installationAuthorized = false,
  installationRequired = false,
} = {}) {
  if (available) {
    return {
      action: "USE_AVAILABLE",
      reasonCode: null,
      message: "Verification tool is locally available.",
    };
  }

  if (equivalentAvailable) {
    return {
      action: "USE_EQUIVALENT",
      reasonCode: null,
      message: "An existing local equivalent verifier is available.",
    };
  }

  if (installationAuthorized) {
    return {
      action: "INSTALL_AUTHORIZED",
      reasonCode: null,
      message: "Installation is explicitly authorized for this verification requirement.",
    };
  }

  if (installationRequired) {
    return {
      action: "REQUEST_AUTHORITY",
      reasonCode: E_INSTALLATION_AUTHORITY_REQUIRED,
      message: "Verification tool is required but installation authority has not been granted.",
    };
  }

  return {
    action: "RECORD_NOT_VERIFIED",
    reasonCode: E_VERIFICATION_TOOL_UNAVAILABLE,
    message: "Verification tool is absent and installation was not authorized.",
  };
}
