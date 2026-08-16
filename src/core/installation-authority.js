import {
  E_AUTHORITY_INVALID,
  E_AUTHORITY_SCOPE_MISMATCH,
  E_INSTALLATION_AUTHORITY_REQUIRED,
} from "./verification-constants.js";
import { classifyCommandResolution } from "./command-resolution.js";
import {
  E_AUTHORITY_UNTRUSTED_SOURCE,
  resolveTrustedAuthority,
} from "./trusted-authority.js";

export { E_AUTHORITY_UNTRUSTED_SOURCE };

export function getInstallationAuthorityRef(check) {
  return (
    check?.details?.installationAuthorityRef
    ?? check?.details?.authorityRef
    ?? check?.installationAuthorityRef
    ?? check?.authorityRef
    ?? null
  );
}

function normalizeToolName(toolName) {
  if (typeof toolName !== "string") return "";
  if (toolName.startsWith("@")) {
    const parts = toolName.slice(1).split("@");
    return `@${parts[0]}`;
  }
  return toolName.split("@")[0];
}

export function validateAuthorityGrant({ authority, taskId, type = "SOFTWARE_INSTALLATION", tool } = {}) {
  if (!authority || typeof authority !== "object") {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: "Authority grant artifact is missing or invalid",
      },
    };
  }

  if (authority.schemaVersion !== 1 || authority.protocolVersion !== 1) {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: `Authority grant schema version (${authority.schemaVersion}) or protocol version (${authority.protocolVersion}) is invalid`,
      },
    };
  }

  if (authority.type !== type) {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: `Authority grant type '${authority.type}' does not match expected '${type}'`,
      },
    };
  }

  if (authority.status !== "AUTHORIZED") {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: `Authority grant is not active (status: '${authority.status}')`,
      },
    };
  }

  if (authority.source === "agent-self") {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: "Self-asserted authority grants with source 'agent-self' are not permitted",
      },
    };
  }

  if (!["operator", "host", "project-policy"].includes(authority.source)) {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: `Authority grant source '${authority.source}' is not recognized`,
      },
    };
  }

  if (taskId && authority.taskId && authority.taskId !== taskId) {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: `Authority grant taskId '${authority.taskId}' does not match current task '${taskId}'`,
      },
    };
  }

  if (tool && authority.scope?.tool && authority.scope.tool !== "*") {
    const requestedNorm = normalizeToolName(tool);
    const scopeNorm = normalizeToolName(authority.scope.tool);
    const exactMatch = authority.scope.tool === tool
      || tool.startsWith(`${authority.scope.tool}@`)
      || authority.scope.tool.startsWith(`${tool}@`)
      || requestedNorm === scopeNorm;

    if (!exactMatch) {
      return {
        valid: false,
        error: {
          code: E_AUTHORITY_SCOPE_MISMATCH,
          message: `Authority grant scope tool '${authority.scope.tool}' does not match requested verification tool '${tool}'`,
        },
      };
    }
  }

  return { valid: true, error: null };
}

export function validateVerificationAuthority(check, options = {}) {
  const canonicalResolution = check?.execution?.resolution ?? check?.details?.execution?.resolution;
  const command = check?.details?.command
    ?? (check?.kind === "command" && typeof check?.source === "string" && !check.source.startsWith("check:")
      ? check.source
      : null);

  if (!canonicalResolution && (!command || typeof command !== "string")) return { valid: true, error: null };

  const classification = canonicalResolution ?? classifyCommandResolution(command);
  if (!classification.mayInstall) return { valid: true, error: null };

  const authorityRef = getInstallationAuthorityRef(check);
  if (!authorityRef) {
    return {
      valid: false,
      error: {
        code: E_INSTALLATION_AUTHORITY_REQUIRED,
        message: `Verification command '${command}' uses installation-capable resolution (${classification.resolutionMode}) without recorded installation authority reference`,
      },
    };
  }

  const resolved = resolveTrustedAuthority({
    authorityRef,
    target: options.target,
    trustedAuthorityFile: options.trustedAuthorityFile,
    trustedAuthorityDir: options.trustedAuthorityDir,
    authorities: options.authorities,
    authority: options.authority,
    authorityContext: options.authorityContext,
    runtimeContext: options.runtimeContext,
  });
  if (!resolved.trusted) {
    if (resolved.error?.code === E_AUTHORITY_INVALID && resolved.sourceConfigured === false) {
      return {
        valid: false,
        error: {
          code: E_INSTALLATION_AUTHORITY_REQUIRED,
          message: "Installation-capable verification requires a host-attested authority context",
        },
      };
    }
    return { valid: false, error: resolved.error };
  }

  return validateAuthorityGrant({
    authority: resolved.authority,
    taskId: options.taskId,
    type: "SOFTWARE_INSTALLATION",
    tool: classification.tool,
  });
}
