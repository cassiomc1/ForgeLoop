export const VERIFICATION_ISOLATION_MODES = Object.freeze([
  "NATIVE_PROJECT",
  "PROJECT_ISOLATED",
  "SYSTEM_ISOLATED",
]);

export const VERIFICATION_EXECUTION_POLICY_MODES = Object.freeze([
  "NONE",
  ...VERIFICATION_ISOLATION_MODES,
]);

export const E_VERIFICATION_ISOLATION_UNAVAILABLE = "E_VERIFICATION_ISOLATION_UNAVAILABLE";
export const E_VERIFICATION_EXECUTION_INVALID = "E_VERIFICATION_EXECUTION_INVALID";

const ISOLATION_RANK = Object.freeze({
  NATIVE_PROJECT: 0,
  PROJECT_ISOLATED: 1,
  SYSTEM_ISOLATED: 2,
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function executionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw executionError(E_VERIFICATION_EXECUTION_INVALID, `Verification execution ${field} must be a non-empty string`);
  }
  return value;
}

function nullableString(value, field) {
  if (value !== null && typeof value !== "string") {
    throw executionError(E_VERIFICATION_EXECUTION_INVALID, `Verification execution ${field} must be a string or null`);
  }
  return value;
}

function outputBytes(value, field) {
  if (value === undefined || value === null) return Buffer.alloc(0);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value);
  throw executionError(E_VERIFICATION_EXECUTION_INVALID, `Verification execution ${field} must be text or bytes`);
}

function nonNegativeInteger(value, field, fallback) {
  const resolved = value === undefined ? fallback : value;
  if (!Number.isInteger(resolved) || resolved < 0) {
    throw executionError(E_VERIFICATION_EXECUTION_INVALID, `Verification execution ${field} must be a non-negative integer`);
  }
  return resolved;
}

export function normalizeVerificationExecutionPolicy(policy = {}) {
  if (policy === undefined || policy === null) return Object.freeze({ requiredIsolation: "NONE" });
  if (!isRecord(policy)) {
    throw executionError(E_VERIFICATION_ISOLATION_UNAVAILABLE, "Verification execution isolation policy is invalid");
  }
  const requiredIsolation = policy.requiredIsolation ?? "NONE";
  if (!VERIFICATION_EXECUTION_POLICY_MODES.includes(requiredIsolation)) {
    throw executionError(E_VERIFICATION_ISOLATION_UNAVAILABLE, "Verification execution isolation policy is unsupported");
  }
  return Object.freeze({ requiredIsolation });
}

export function isVerificationExecutionAdapter(value) {
  return isRecord(value) && typeof value.execute === "function";
}

function readAdapter(runtimeContext) {
  const value = isRecord(runtimeContext) ? runtimeContext.verificationExecutionAdapter : undefined;
  if (value === undefined || value === null) return null;
  if (!isVerificationExecutionAdapter(value)) {
    throw executionError(E_VERIFICATION_ISOLATION_UNAVAILABLE, "Verification execution adapter is unavailable or invalid");
  }
  return value;
}

function assertIsolationMetadataConsistency(isolation) {
  if (isolation.mode === "NATIVE_PROJECT") {
    if (
      isolation.isolated !== false
      || isolation.liveProjectWritable !== true
    ) {
      throw executionError(
        E_VERIFICATION_EXECUTION_INVALID,
        "NATIVE_PROJECT must report isolated=false and liveProjectWritable=true",
      );
    }
    return;
  }

  if (
    isolation.isolated !== true
    || isolation.liveProjectWritable !== false
  ) {
    throw executionError(
      E_VERIFICATION_EXECUTION_INVALID,
      `${isolation.mode} must report isolated=true and liveProjectWritable=false`,
    );
  }

  if (
    isolation.mode === "SYSTEM_ISOLATED"
    && isolation.networkPolicy !== "DENIED"
  ) {
    throw executionError(
      E_VERIFICATION_EXECUTION_INVALID,
      "SYSTEM_ISOLATED must report networkPolicy=DENIED",
    );
  }
}

function normalizeIsolation(value) {
  if (!isRecord(value)) {
    throw executionError(E_VERIFICATION_EXECUTION_INVALID, "Verification execution isolation metadata is missing");
  }
  const mode = value.mode;
  if (!VERIFICATION_ISOLATION_MODES.includes(mode)) {
    throw executionError(E_VERIFICATION_EXECUTION_INVALID, "Verification execution isolation mode is unsupported");
  }
  if (typeof value.isolated !== "boolean" || typeof value.liveProjectWritable !== "boolean") {
    throw executionError(E_VERIFICATION_EXECUTION_INVALID, "Verification execution isolation booleans are invalid");
  }
  const isolation = {
    mode,
    isolated: value.isolated,
    liveProjectWritable: value.liveProjectWritable,
    networkPolicy: requiredString(value.networkPolicy, "networkPolicy"),
    environmentPolicy: requiredString(value.environmentPolicy, "environmentPolicy"),
  };
  assertIsolationMetadataConsistency(isolation);
  return isolation;
}

export function normalizeVerificationExecutionResult(value, { defaultCwd = null } = {}) {
  if (!isRecord(value)) {
    throw executionError(E_VERIFICATION_EXECUTION_INVALID, "Verification execution adapter returned an invalid result");
  }
  const cwd = value.cwd ?? defaultCwd;
  requiredString(cwd, "cwd");
  if (value.exitCode !== null && !Number.isInteger(value.exitCode)) {
    throw executionError(E_VERIFICATION_EXECUTION_INVALID, "Verification execution exitCode must be an integer or null");
  }
  const signal = nullableString(value.signal ?? null, "signal");
  if (typeof value.timedOut !== "boolean") {
    throw executionError(E_VERIFICATION_EXECUTION_INVALID, "Verification execution timedOut must be boolean");
  }
  if (typeof value.outputTruncated !== "boolean") {
    throw executionError(E_VERIFICATION_EXECUTION_INVALID, "Verification execution outputTruncated must be boolean");
  }
  const stdout = outputBytes(value.stdout, "stdout");
  const stderr = outputBytes(value.stderr, "stderr");
  return {
    exitCode: value.exitCode,
    signal,
    timedOut: value.timedOut,
    stdout,
    stderr,
    stdoutBytes: nonNegativeInteger(value.stdoutBytes, "stdoutBytes", stdout.length),
    stderrBytes: nonNegativeInteger(value.stderrBytes, "stderrBytes", stderr.length),
    outputTruncated: value.outputTruncated,
    spawnError: Boolean(value.spawnError),
    cwd,
    isolation: normalizeIsolation(value.isolation),
  };
}

function satisfiesIsolationPolicy(isolation, requiredIsolation) {
  if (requiredIsolation === "NONE") return true;
  if (ISOLATION_RANK[isolation.mode] < ISOLATION_RANK[requiredIsolation]) return false;
  if (requiredIsolation === "NATIVE_PROJECT") return true;
  return isolation.isolated === true
    && isolation.liveProjectWritable === false
    && (requiredIsolation !== "SYSTEM_ISOLATED" || isolation.networkPolicy === "DENIED");
}

export function assertVerificationIsolation(result, policy) {
  const requiredIsolation = normalizeVerificationExecutionPolicy(policy).requiredIsolation;
  if (!satisfiesIsolationPolicy(result.isolation, requiredIsolation)) {
    throw executionError(
      E_VERIFICATION_ISOLATION_UNAVAILABLE,
      `Verification execution did not satisfy the required ${requiredIsolation} isolation boundary`,
    );
  }
  return result;
}

export async function executeVerificationProcess({
  argv,
  protocolProjectRoot,
  taskId,
  checkId,
  requirement,
  resolution,
  timeoutMs,
  runtimeContext,
  nativeExecute,
}) {
  const policy = normalizeVerificationExecutionPolicy(runtimeContext?.verificationExecutionPolicy);
  const adapter = readAdapter(runtimeContext);
  let rawResult;
  if (adapter) {
    try {
      rawResult = await adapter.execute(Object.freeze({
        argv: [...argv],
        protocolProjectRoot,
        taskId,
        checkId,
        requirement,
        timeoutMs,
        resolution,
      }));
    } catch (error) {
      if (error?.code === E_VERIFICATION_ISOLATION_UNAVAILABLE) throw error;
      throw executionError(E_VERIFICATION_EXECUTION_INVALID, "Verification execution adapter failed");
    }
  } else {
    if (policy.requiredIsolation !== "NONE") {
      throw executionError(
        E_VERIFICATION_ISOLATION_UNAVAILABLE,
        `Verification execution requires ${policy.requiredIsolation}, but no trusted adapter was supplied`,
      );
    }
    const nativeResult = await nativeExecute(argv, protocolProjectRoot, { timeoutMs });
    rawResult = {
      ...nativeResult,
      cwd: protocolProjectRoot,
      isolation: {
        mode: "NATIVE_PROJECT",
        isolated: false,
        liveProjectWritable: true,
        networkPolicy: "INHERITED",
        environmentPolicy: "INHERITED",
      },
    };
  }

  const normalized = normalizeVerificationExecutionResult(rawResult, { defaultCwd: protocolProjectRoot });
  if (
    policy.requiredIsolation !== "NONE"
    && normalized.isolation.mode !== "NATIVE_PROJECT"
    && normalized.cwd === protocolProjectRoot
  ) {
    throw executionError(
      E_VERIFICATION_EXECUTION_INVALID,
      "Isolated verification execution must use a cwd separate from the protocol project root",
    );
  }
  return assertVerificationIsolation(normalized, policy);
}
