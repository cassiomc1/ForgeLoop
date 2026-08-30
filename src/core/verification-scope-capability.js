import { ARTIFACT_PATHS, canonicalFingerprint, readJsonArtifact } from "./artifacts.js";

export const SCOPED_CHECKER_SCOPE_MODE = "PATH_ARGUMENTS";
export const SCOPED_CHECKER_PATH_INSERTION = "APPEND";
export const E_VERIFICATION_SCOPE_UNRESOLVED = "E_VERIFICATION_SCOPE_UNRESOLVED";

function capabilityError(message, cause = null) {
  const error = new Error(message);
  error.name = "VerificationScopeCapabilityError";
  error.code = E_VERIFICATION_SCOPE_UNRESOLVED;
  if (cause) error.cause = cause;
  return error;
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw capabilityError(`${label} must be a non-empty string`);
  }
  return value;
}

function argvPrefix(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw capabilityError(`${label} must be a non-empty exact argv prefix`);
  }
  return [...value];
}

function assertDescriptorKeys(value, label) {
  const allowed = new Set(["checkId", "scopeMode", "argvPrefix", "pathInsertion"]);
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));
  if (unexpected) throw capabilityError(`${label} contains unknown property: ${unexpected}`);
}

export function normalizeScopedCheckerDescriptor(value, label = "verification.checkers[]") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw capabilityError(`${label} must be an object`);
  }
  assertDescriptorKeys(value, label);
  const checkId = nonEmptyString(value.checkId, `${label}.checkId`).trim();
  if (value.scopeMode !== SCOPED_CHECKER_SCOPE_MODE) {
    throw capabilityError(`${label}.scopeMode must be ${SCOPED_CHECKER_SCOPE_MODE}`);
  }
  if (value.pathInsertion !== SCOPED_CHECKER_PATH_INSERTION) {
    throw capabilityError(`${label}.pathInsertion must be ${SCOPED_CHECKER_PATH_INSERTION}`);
  }
  return {
    checkId,
    scopeMode: SCOPED_CHECKER_SCOPE_MODE,
    argvPrefix: argvPrefix(value.argvPrefix, `${label}.argvPrefix`),
    pathInsertion: SCOPED_CHECKER_PATH_INSERTION,
  };
}

export function normalizeScopedCheckerDescriptors(value, label = "verification.checkers") {
  if (!Array.isArray(value)) throw capabilityError(`${label} must be an array`);
  const descriptors = value.map((item, index) => normalizeScopedCheckerDescriptor(item, `${label}[${index}]`));
  const seen = new Set();
  for (const descriptor of descriptors) {
    if (seen.has(descriptor.checkId)) throw capabilityError(`${label} contains duplicate checkId: ${descriptor.checkId}`);
    seen.add(descriptor.checkId);
  }
  return descriptors.sort((left, right) => left.checkId.localeCompare(right.checkId));
}

export function normalizeVerificationConfiguration(value, label = "verification") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw capabilityError(`${label} must be an object`);
  }
  const unexpected = Object.keys(value).find((key) => key !== "checkers");
  if (unexpected) throw capabilityError(`${label} contains unknown property: ${unexpected}`);
  return {
    checkers: normalizeScopedCheckerDescriptors(value.checkers ?? [], `${label}.checkers`),
  };
}

export function scopedCheckerCapabilitiesFingerprint(checkers = []) {
  return canonicalFingerprint({
    schemaVersion: 1,
    scopeMode: SCOPED_CHECKER_SCOPE_MODE,
    checkers: normalizeScopedCheckerDescriptors(checkers),
  });
}

export async function readScopedCheckerCapabilities(target, packageRoot) {
  try {
    const artifact = await readJsonArtifact(target, ARTIFACT_PATHS.config, "config", packageRoot);
    const verification = artifact.value.verification;
    const checkers = verification
      ? normalizeVerificationConfiguration(verification).checkers
      : [];
    return {
      valid: true,
      source: "project-config",
      checkers,
      fingerprint: scopedCheckerCapabilitiesFingerprint(checkers),
      error: null,
    };
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") {
      return {
        valid: true,
        source: "project-config",
        checkers: [],
        fingerprint: scopedCheckerCapabilitiesFingerprint([]),
        error: null,
      };
    }
    return {
      valid: false,
      source: "project-config",
      checkers: [],
      fingerprint: null,
      error,
    };
  }
}

function equalArgv(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((item, index) => item === right[index]);
}

export function scopedCheckerArgv(checker, selectedPaths) {
  const descriptor = normalizeScopedCheckerDescriptor(checker, "scoped checker");
  if (!Array.isArray(selectedPaths) || selectedPaths.some((item) => typeof item !== "string" || item.length === 0)) {
    throw capabilityError("Verification scope selectedPaths must be an array of non-empty strings");
  }
  return [...descriptor.argvPrefix, ...selectedPaths];
}

export async function bindVerificationScopeCommand({
  target,
  packageRoot,
  checkId,
  argv,
  scope,
  capabilities = null,
} = {}) {
  if (!scope || scope.resolvedMode === "FULL") {
    return {
      argv: [...argv],
      checker: null,
      capabilityFingerprint: null,
    };
  }
  if (!["CHANGED", "CLAIMED"].includes(scope.resolvedMode)) {
    throw capabilityError("Verification scope has no resolved narrow mode");
  }
  const resolvedCapabilities = capabilities ?? await readScopedCheckerCapabilities(target, packageRoot);
  if (!resolvedCapabilities.valid) {
    throw capabilityError("Trusted scoped-checker capability is invalid", resolvedCapabilities.error);
  }
  const checker = resolvedCapabilities.checkers.find((item) => item.checkId === checkId);
  if (!checker) {
    throw capabilityError(`No trusted scoped checker is registered for check ${checkId}`);
  }
  const expectedArgv = scopedCheckerArgv(checker, scope.selectedPaths);
  if (!equalArgv(argv, expectedArgv)) {
    const error = capabilityError("Scoped checker argv does not match the canonical scope binding");
    error.reason = "ARGV_MISMATCH";
    throw error;
  }
  return {
    argv: expectedArgv,
    checker,
    capabilityFingerprint: resolvedCapabilities.fingerprint,
  };
}

export async function requireTrustedScopedChecker({ target, packageRoot } = {}) {
  const capabilities = await readScopedCheckerCapabilities(target, packageRoot);
  if (!capabilities.valid || capabilities.checkers.length === 0) {
    throw capabilityError("A trusted scoped-checker capability is required for a narrow verification scope", capabilities.error);
  }
  return capabilities;
}
