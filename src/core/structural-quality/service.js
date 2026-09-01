import { canonicalFingerprint, readJsonArtifact } from "../artifacts.js";
import { assertSafePath, ensureWithin, fileExists, readBytes } from "../filesystem.js";
import { readConfig } from "../config.js";
import { readContract } from "../contract.js";
import { readPersistedRoute } from "../route-artifact.js";
import { readWorkState } from "../work-state.js";
import { evaluatePreflight, validatePersistedPreflight } from "../preflight.js";
import { taskArtifactPath } from "../task-paths.js";
import { sha256 } from "../manifest.js";
import {
  E_STRUCTURAL_QUALITY_BASELINE_BINDING_MISMATCH,
  E_STRUCTURAL_QUALITY_BASELINE_MISSING,
  E_STRUCTURAL_QUALITY_EVALUATION_INCOMPARABLE,
  E_STRUCTURAL_QUALITY_EVIDENCE_STALE,
  E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE,
} from "../error-codes.js";
import {
  STRUCTURAL_QUALITY_CHECK_ID,
  STRUCTURAL_QUALITY_DEFAULT_TIMEOUT_MS,
  STRUCTURAL_QUALITY_REQUIREMENT,
  structuralQualityError,
} from "./constants.js";
import { normalizeStructuralQualityConfig, compareStructuralQuality, structuralQualityPolicyFingerprint } from "./policy.js";
import { normalizeStructuralQualityDetection, normalizeStructuralQualitySnapshot, providerInputFor, resolveStructuralQualityProvider } from "./provider.js";
import {
  assertStructuralQualityBindings,
  listStructuralQualityEvaluations,
  readStructuralQualityBaseline,
  validateStructuralQualityArtifact,
  writeStructuralQualityBaseline,
  writeStructuralQualityEvaluation,
} from "./artifacts.js";
import { appendProtocolEvent } from "../events.js";
import { getPackageRoot } from "../templates.js";
import { withTaskMutation } from "../task-command.js";
import { findTaskById } from "../task-discovery.js";
import { currentChangedPaths } from "../repository.js";
import { assertClaimsCoverChangedPaths } from "../task-scope.js";

const SENTRUX_RULES_PATH = ".sentrux/rules.toml";

function qualityError(code, message, artifacts = []) {
  return structuralQualityError(code, message, artifacts);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function loadOptionalConfig(target, packageRoot) {
  try {
    return await readConfig(target, packageRoot);
  } catch (error) {
    if (error.code === "ARTIFACT_MISSING") return null;
    throw error;
  }
}

function configuredPolicy(config) {
  if (!config?.structuralQuality) return null;
  return normalizeStructuralQualityConfig(config.structuralQuality);
}

async function scopeIdentity(target, providerId = null) {
  let rulesFingerprint = null;
  await assertSafePath(target, SENTRUX_RULES_PATH);
  const rulesAbsolute = ensureWithin(target, SENTRUX_RULES_PATH);
  if (await fileExists(rulesAbsolute)) rulesFingerprint = sha256(await readBytes(rulesAbsolute));
  const scope = { kind: "PROJECT", projectRoot: ".", rulesFingerprint };
  return {
    scope,
    // Include provider identity in the scope binding so a baseline cannot be
    // silently reused for a different analyzer with the same project rules.
    scopeFingerprint: canonicalFingerprint({ providerId, ...scope }),
  };
}

function providerMetadata(provider, detection) {
  const metadata = provider?.metadata ?? provider;
  const id = metadata?.id ?? detection.providerId;
  const version = metadata?.version ?? detection.providerVersion ?? null;
  return {
    id,
    version,
    transport: metadata?.transport ?? detection.transport ?? "runtime",
    executionMode: metadata?.executionMode ?? "runtime-context",
  };
}

function providerDetection(value, providerId) {
  return normalizeStructuralQualityDetection(value, { providerId, id: providerId, transport: "runtime" });
}

function normalizeScanResult(result, provider, detection, projectPath) {
  const source = isRecord(result) ? result : { snapshot: result };
  const snapshot = normalizeStructuralQualitySnapshot(source.snapshot ?? source, { projectPath });
  const metadata = providerMetadata(source.provider, detection);
  if (metadata.id !== provider.id) {
    throw qualityError(E_STRUCTURAL_QUALITY_BASELINE_BINDING_MISMATCH, "Structural-quality scan returned a different provider identity");
  }
  return {
    snapshot,
    provider: metadata,
    detection: providerDetection(source.detection ?? detection, provider.id),
  };
}

async function taskInputs(target, packageRoot, taskId) {
  if (typeof taskId !== "string" || taskId.trim() === "") {
    throw qualityError(E_STRUCTURAL_QUALITY_BASELINE_BINDING_MISMATCH, "Structural-quality operations require a task ID");
  }
  const state = await readWorkState(target, { packageRoot, taskId });
  if (!state) throw qualityError(E_STRUCTURAL_QUALITY_BASELINE_MISSING, "Structural-quality operations require task work-state", [taskArtifactPath(taskId, "state")]);
  const contract = await readContract(target, packageRoot, { taskId });
  const route = await readPersistedRoute(target, packageRoot, { taskId });
  const config = await loadOptionalConfig(target, packageRoot);
  const policy = configuredPolicy(config);
  const scopeData = await scopeIdentity(target, policy?.provider ?? null);
  return {
    state,
    contract,
    route,
    config,
    policy,
    scope: scopeData.scope,
    scopeFingerprint: scopeData.scopeFingerprint,
  };
}

function baseBindings(inputs, policyFingerprint, baselineFingerprint = null) {
  return {
    contractFingerprint: inputs.contract.fingerprint,
    routeFingerprint: inputs.route.fingerprint,
    policyFingerprint,
    scopeFingerprint: inputs.scopeFingerprint,
    baselineFingerprint,
    stateRevision: inputs.state.revision ?? 0,
  };
}

function statusForComparison(policy, comparison) {
  if (comparison.status === "PASS") return "PASS";
  if (comparison.status === "FAIL") return "FAIL";
  return policy.mode === "gate" ? "BLOCKED" : "NOT_OBSERVED";
}

function checkProjection(policy, evaluation) {
  if (evaluation.status === "PASS") return { status: "passed", evidenceKind: "OBSERVED" };
  if (evaluation.status === "FAIL") return { status: "failed", evidenceKind: "OBSERVED" };
  if (policy.mode === "gate" && evaluation.status === "BLOCKED") return { status: "blocked", evidenceKind: "BLOCKED" };
  return { status: "not-run", evidenceKind: "NOT_VERIFIED" };
}

function evaluationDetails(evaluation) {
  const comparison = evaluation.comparison ?? {};
  return {
    verificationCycle: evaluation.verificationCycle,
    attempt: evaluation.attempt,
    artifactRef: evaluation.artifactRef,
    artifactFingerprint: evaluation.artifactFingerprint,
    baselineSignal: evaluation.baselineSignal ?? null,
    currentSignal: evaluation.currentSignal ?? null,
    delta: comparison.qualityDelta ?? null,
    bottleneck: evaluation.snapshot?.bottleneck ?? null,
    rootCauseDeltas: comparison.rootCauseDeltas ?? {},
    reasonCodes: [...(evaluation.reasonCodes ?? [])],
    failedConditions: [...(comparison.failedConditions ?? [])],
  };
}

async function assertReadyPreflight(target, packageRoot, taskId) {
  const preflightPath = taskArtifactPath(taskId, "preflight");
  const persisted = await readJsonArtifact(target, preflightPath, "preflight", packageRoot);
  const current = await evaluatePreflight({ target, packageRoot, taskId });
  const errors = validatePersistedPreflight(persisted.value, current);
  if (current.status !== "READY" || errors.length > 0) {
    const first = errors[0] ?? current.errors?.[0];
    throw qualityError(first?.code ?? "E_PREFLIGHT_NOT_READY", first?.message ?? "A READY preflight is required before structural-quality baseline capture", [preflightPath]);
  }
}

async function invokeProvider({ target, taskId, policy, runtimeContext, timeoutMs, maxOutputBytes }) {
  const provider = await resolveStructuralQualityProvider({
    providerName: policy.provider,
    target,
    taskId,
    timeoutMs,
    maxOutputBytes,
    runtimeContext,
  });
  const input = providerInputFor({
    projectPath: target,
    taskId,
    timeoutMs: timeoutMs ?? STRUCTURAL_QUALITY_DEFAULT_TIMEOUT_MS,
    maxOutputBytes: maxOutputBytes ?? 2 * 1024 * 1024,
  });
  let detection;
  try {
    detection = providerDetection(await provider.detect(input), provider.id);
  } catch (error) {
    detection = providerDetection({ available: false, providerId: provider.id, providerVersion: null, transport: "runtime", reasonCode: error.code ?? E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE }, provider.id);
  }
  if (!detection.available) {
    throw qualityError(detection.reasonCode ?? E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE, `Structural-quality provider ${provider.id} is unavailable`);
  }
  const result = await provider.scan(input);
  return normalizeScanResult(result, provider, detection, target);
}

function emptyProjection(policy, reasonCodes = []) {
  return {
    mode: policy?.mode ?? "off",
    provider: policy?.mode && policy.mode !== "off" ? policy.provider : null,
    baseline: { status: policy ? "MISSING" : "NOT_REQUESTED", qualitySignal: null, artifactRef: null, fingerprint: null },
    current: { status: "NOT_OBSERVED", verificationCycle: null, attempt: null, qualitySignal: null, delta: null, bottleneck: null, artifactRef: null },
    comparable: null,
    completionRequired: policy?.mode === "gate",
    reasonCodes: [...new Set(reasonCodes)].sort(),
    next: policy?.mode === "gate" ? "CAPTURE_STRUCTURAL_QUALITY_BASELINE" : null,
    optimization: policy ? optimizationProjection(policy, [], null) : null,
  };
}

export async function captureStructuralQualityBaseline({ target, packageRoot = getPackageRoot(), taskId, replace = false, timeoutMs, maxOutputBytes, runtimeContext } = {}) {
  const inputs = await taskInputs(target, packageRoot, taskId);
  const policy = inputs.policy;
  if (!policy || policy.mode === "off") return { status: "NOT_REQUESTED", mode: "off", provider: null, artifactRef: null };
  if (inputs.state.phase !== "PLANNED") {
    throw qualityError("E_STRUCTURAL_QUALITY_BASELINE_PHASE_INVALID", `Structural-quality baseline capture requires PLANNED; found ${inputs.state.phase}`, [taskArtifactPath(taskId, "state")]);
  }
  await assertReadyPreflight(target, packageRoot, taskId);
  const existing = await readStructuralQualityBaseline(target, taskId, packageRoot);
  if (existing && !replace) {
    return {
      status: "EXISTING",
      mode: policy.mode,
      provider: existing.value.provider,
      artifactRef: existing.path,
      artifactFingerprint: existing.fingerprint,
      baseline: existing.value,
      existing: true,
      identical: true,
    };
  }
  const policyFingerprint = structuralQualityPolicyFingerprint(policy);
  let scan;
  try {
    scan = await invokeProvider({ target, taskId, policy, runtimeContext, timeoutMs, maxOutputBytes });
  } catch (error) {
    if (policy.mode === "observe") {
      return {
        status: "NOT_OBSERVED",
        mode: policy.mode,
        provider: {
          id: policy.provider,
          version: null,
          transport: "runtime",
          executionMode: "runtime-context",
        },
        artifactRef: null,
        artifactFingerprint: null,
        reasonCodes: [error.code ?? E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE],
        errorCode: error.code ?? E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE,
        existing: false,
        identical: false,
      };
    }
    throw error;
  }
  const value = {
    schemaVersion: 1,
    protocolVersion: 1,
    role: "BASELINE",
    taskId,
    capturedAt: new Date().toISOString(),
    verificationCycle: null,
    attempt: 1,
    status: "PASS",
    reasonCodes: [],
    bindings: baseBindings(inputs, policyFingerprint, null),
    provider: scan.provider,
    detection: scan.detection,
    scope: inputs.scope,
    snapshot: scan.snapshot,
  };
  const written = await writeStructuralQualityBaseline(target, taskId, value, packageRoot, { phase: inputs.state.phase, replace, taskId });
  if (!written.identical) {
    await appendProtocolEvent(target, {
      taskId,
      event: "STRUCTURAL_QUALITY_BASELINE_RECORDED",
      details: {
        artifactRef: written.path,
        artifactFingerprint: written.fingerprint,
        providerId: scan.provider.id,
        providerVersion: scan.provider.version,
        replaced: Boolean(existing),
        supersededFingerprint: existing?.fingerprint ?? null,
      },
    }, packageRoot, { taskId });
  }
  return {
    status: written.existing ? "REPLACED" : "CAPTURED",
    mode: policy.mode,
    provider: scan.provider,
    artifactRef: written.path,
    artifactFingerprint: written.fingerprint,
    baseline: written.value,
    existing: written.existing,
    identical: written.identical,
  };
}

async function persistEvaluationAndCheck({ target, packageRoot, taskId, inputs, persisted, authorityContext, runtimeContext }) {
  // The immutable sensor artifact has already been committed in a separate
  // transaction. This projection transaction can therefore fail safely
  // without erasing the provider evidence.
  const { prepareCompletion, recordCheck } = await import("../completion-artifacts.js");
  const record = (context, evaluation) => recordCheck({
    target,
    packageRoot,
    id: STRUCTURAL_QUALITY_CHECK_ID,
    kind: "structural-quality",
    requirement: STRUCTURAL_QUALITY_REQUIREMENT,
    status: checkProjection(inputs.policy, evaluation).status,
    evidenceKind: checkProjection(inputs.policy, evaluation).evidenceKind,
    result: `structural quality ${evaluation.status}`,
    details: evaluationDetails(evaluation),
    authorityContext,
    runtimeContext,
    taskId: context?.taskId ?? taskId,
  });
  const recorded = await withTaskMutation(target, { taskId, packageRoot }, "quality-verify-check", async (context) => {
    const effectiveTaskId = context?.taskId ?? taskId;
    const evaluations = await listStructuralQualityEvaluations(target, effectiveTaskId, packageRoot);
    const latest = evaluations
      .filter((item) => item.value.verificationCycle === persisted.verificationCycle)
      .at(-1);
    const evaluation = latest && latest.value.attempt > persisted.attempt
      ? { ...latest.value, artifactRef: latest.path, artifactFingerprint: latest.fingerprint }
      : persisted;
    const publish = () => record(context, evaluation);
    try {
      return await publish();
    } catch (error) {
      // record-check normally expects the canonical receipt prepared by the
      // completion pipeline. quality-verify is itself that pipeline's typed
      // quality entry point, so bootstrap the receipt only when it is absent;
      // all other failures remain visible and cannot promote the evaluation.
      if (error.code !== "E_RECEIPT_MISSING") throw error;
      await prepareCompletion({
        target,
        packageRoot,
        authorityContext,
        runtimeContext,
        taskId: effectiveTaskId,
      });
      return publish();
    }
  });
  return { evaluation: persisted, check: recorded.check, receipt: recorded };
}

function nonPassEvaluation({ taskId, inputs, cycle, attempt, policy, reasonCode, providerId = policy.provider, providerVersion = null, detection = null, baseline = null }) {
  const status = policy.mode === "gate" ? "BLOCKED" : "NOT_OBSERVED";
  const detectionValue = detection ?? {
    available: false,
    providerId,
    providerVersion,
    transport: "runtime",
    reasonCode,
  };
  const policyFingerprint = structuralQualityPolicyFingerprint(policy);
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    role: "EVALUATION",
    taskId,
    capturedAt: new Date().toISOString(),
    verificationCycle: cycle,
    attempt,
    status,
    reasonCodes: [reasonCode],
    errorCode: reasonCode,
    bindings: baseBindings(inputs, policyFingerprint, baseline?.fingerprint ?? null),
    provider: { id: providerId, version: providerVersion, transport: detectionValue.transport, executionMode: "runtime-context" },
    detection: detectionValue,
    scope: inputs.scope,
    ...(baseline?.value?.snapshot ? { baselineSignal: baseline.value.snapshot.qualitySignal } : {}),
    comparison: {
      comparable: false,
      qualityDelta: null,
      rootCauseDeltas: Object.fromEntries(["modularity", "acyclicity", "depth", "equality", "redundancy"].map((key) => [key, null])),
      failedConditions: [],
      status: "NOT_OBSERVED",
      reasonCodes: [reasonCode],
    },
  };
}

export async function evaluateStructuralQuality({ target, packageRoot = getPackageRoot(), taskId, timeoutMs, maxOutputBytes, authorityContext, runtimeContext } = {}) {
  const configuredInputs = await taskInputs(target, packageRoot, taskId);
  const policy = configuredInputs.policy;
  if (!policy || policy.mode === "off") return { status: "NOT_REQUESTED", mode: "off", check: null };
  const captured = await withTaskMutation(target, { taskId, packageRoot }, "quality-verify-evaluation", async (context) => {
    const lockedTaskId = context?.taskId ?? taskId;
    const inputs = await taskInputs(target, packageRoot, lockedTaskId);
    if (inputs.state.phase !== "VERIFYING") {
      throw qualityError(E_STRUCTURAL_QUALITY_EVIDENCE_STALE, `Structural-quality verification requires VERIFYING; found ${inputs.state.phase}`, [taskArtifactPath(lockedTaskId, "state")]);
    }
    const cycle = inputs.state.verificationCycle ?? 1;
    const prior = await listStructuralQualityEvaluations(target, lockedTaskId, packageRoot);
    const attemptsInCycle = prior.filter((item) => item.value.verificationCycle === cycle);
    const maxAttempts = 1 + (inputs.policy.optimization.mode === "bounded" ? inputs.policy.optimization.maxExtraEvaluations : 0);
    if (attemptsInCycle.length >= maxAttempts) {
      const last = attemptsInCycle.at(-1);
      return { converged: true, inputs, evaluation: last?.value ?? null, attempts: attemptsInCycle.length };
    }
    const attempt = attemptsInCycle.length + 1;
    const baseline = await readStructuralQualityBaseline(target, lockedTaskId, packageRoot);
    let evaluation;
    if (!baseline) {
      evaluation = nonPassEvaluation({ taskId: lockedTaskId, inputs, cycle, attempt, policy: inputs.policy, reasonCode: E_STRUCTURAL_QUALITY_BASELINE_MISSING });
    } else {
      try {
        assertStructuralQualityBindings(baseline.value, {
          taskId: lockedTaskId,
          contractFingerprint: inputs.contract.fingerprint,
          routeFingerprint: inputs.route.fingerprint,
          policyFingerprint: structuralQualityPolicyFingerprint(inputs.policy),
          scopeFingerprint: inputs.scopeFingerprint,
        });
        const scan = await invokeProvider({ target, taskId: lockedTaskId, policy: inputs.policy, runtimeContext, timeoutMs, maxOutputBytes });
        const comparison = compareStructuralQuality({ baseline: baseline.value, current: { ...scan, bindings: baseBindings(inputs, structuralQualityPolicyFingerprint(inputs.policy), baseline.fingerprint), scope: inputs.scope }, policy: inputs.policy });
        const status = statusForComparison(inputs.policy, comparison);
        evaluation = {
          schemaVersion: 1,
          protocolVersion: 1,
          role: "EVALUATION",
          taskId: lockedTaskId,
          capturedAt: new Date().toISOString(),
          verificationCycle: cycle,
          attempt,
          status,
          reasonCodes: comparison.reasonCodes,
          errorCode: null,
          bindings: baseBindings(inputs, structuralQualityPolicyFingerprint(inputs.policy), baseline.fingerprint),
          provider: scan.provider,
          detection: scan.detection,
          scope: inputs.scope,
          baselineSignal: baseline.value.snapshot.qualitySignal,
          currentSignal: scan.snapshot.qualitySignal,
          snapshot: scan.snapshot,
          comparison,
        };
      } catch (error) {
        const code = error.code ?? E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE;
        evaluation = nonPassEvaluation({
          taskId: lockedTaskId,
          inputs,
          cycle,
          attempt,
          policy: inputs.policy,
          reasonCode: code,
          providerId: inputs.policy.provider,
          baseline,
        });
      }
    }
    const written = await writeStructuralQualityEvaluation(
      target,
      lockedTaskId,
      evaluation.verificationCycle,
      evaluation.attempt,
      evaluation,
      packageRoot,
      { transactionTaskId: lockedTaskId },
    );
    return {
      converged: false,
      inputs,
      evaluation: { ...evaluation, artifactRef: written.path, artifactFingerprint: written.fingerprint },
      attempts: attemptsInCycle.length + 1,
    };
  });
  if (captured.converged) {
    const evaluationStatus = captured.evaluation?.status ?? (policy.mode === "gate" ? "BLOCKED" : "NOT_OBSERVED");
    return {
      status: evaluationStatus === "PASS" ? "CONVERGED" : evaluationStatus,
      mode: policy.mode,
      evaluation: captured.evaluation,
      check: null,
      attempts: captured.attempts,
    };
  }
  return persistEvaluationAndCheck({
    target,
    packageRoot,
    taskId: captured.inputs.state.taskId,
    inputs: captured.inputs,
    persisted: captured.evaluation,
    authorityContext,
    runtimeContext,
  });
}

async function optimizationScopeStatus(target, packageRoot, taskId) {
  try {
    const task = await findTaskById(target, taskId, packageRoot);
    const claims = task?.effectiveWriteClaims ?? task?.writeClaims ?? [];
    if (!Array.isArray(claims) || claims.length === 0) return { status: "UNAVAILABLE", reasonCodes: ["SCOPE_UNAVAILABLE"] };
    const changed = await currentChangedPaths(target);
    if (changed === null) return { status: "UNAVAILABLE", reasonCodes: ["REPOSITORY_STATUS_UNAVAILABLE"] };
    try {
      assertClaimsCoverChangedPaths(claims, changed);
      return { status: "SAFE", reasonCodes: [] };
    } catch {
      return { status: "UNSAFE", reasonCodes: ["SCOPE_DRIFT"] };
    }
  } catch {
    return { status: "UNAVAILABLE", reasonCodes: ["SCOPE_UNAVAILABLE"] };
  }
}

function optimizationProjection(policy, evaluations, current, scopeStatus = { status: "UNAVAILABLE", reasonCodes: ["SCOPE_UNAVAILABLE"] }) {
  const optimization = {
    mode: policy.optimization.mode,
    maxExtraEvaluations: policy.optimization.maxExtraEvaluations,
    minGainPoints: policy.optimization.minGainPoints,
    attempts: 0,
    gain: null,
    converged: false,
    scope: scopeStatus.status,
    reasonCodes: [...(scopeStatus.reasonCodes ?? [])],
    next: null,
  };
  if (policy.optimization.mode !== "bounded") return optimization;
  const currentValue = current?.value ?? current;
  const cycle = currentValue?.verificationCycle;
  const sameCycle = (evaluations ?? []).filter((item) => item.value.verificationCycle === cycle);
  optimization.attempts = sameCycle.length;
  if (sameCycle.length < 2) {
    if (currentValue?.status === "PASS" && sameCycle.length < 1 + policy.optimization.maxExtraEvaluations && scopeStatus.status === "SAFE") {
      optimization.next = "OPTIONAL_STRUCTURAL_QUALITY_EVALUATION";
    }
    return optimization;
  }
  const previous = sameCycle.at(-2)?.value;
  const latest = sameCycle.at(-1)?.value;
  if (previous?.comparison?.comparable !== true || latest?.comparison?.comparable !== true
    || !Number.isInteger(previous.currentSignal) || !Number.isInteger(latest.currentSignal)) {
    optimization.reasonCodes = [...new Set([...optimization.reasonCodes, "COMPARISON_UNAVAILABLE"])].sort();
    return optimization;
  }
  optimization.gain = latest.currentSignal - previous.currentSignal;
  optimization.converged = optimization.gain < policy.optimization.minGainPoints;
  if (!optimization.converged
    && sameCycle.length < 1 + policy.optimization.maxExtraEvaluations
    && scopeStatus.status === "SAFE"
    && latest.status === "PASS") {
    optimization.next = "OPTIONAL_STRUCTURAL_QUALITY_EVALUATION";
  }
  return optimization;
}

function projectionFromArtifacts(policy, baseline, current, state, evaluations = [], optimizationScope = null) {
  if (!policy || policy.mode === "off") return emptyProjection(null);
  const projection = emptyProjection(policy);
  if (baseline) {
    projection.baseline = {
      status: baseline.value.status === "PASS" ? "OBSERVED" : baseline.value.status,
      qualitySignal: baseline.value.snapshot?.qualitySignal ?? null,
      artifactRef: baseline.path,
      fingerprint: baseline.fingerprint,
    };
  }
  if (current) {
    projection.current = {
      status: current.value.status,
      verificationCycle: current.value.verificationCycle,
      attempt: current.value.attempt,
      qualitySignal: current.value.snapshot?.qualitySignal ?? null,
      delta: current.value.comparison?.qualityDelta ?? null,
      bottleneck: current.value.snapshot?.bottleneck ?? null,
      artifactRef: current.path,
    };
    projection.comparable = current.value.comparison?.comparable ?? null;
    projection.reasonCodes = [...new Set(current.value.reasonCodes ?? [])].sort();
  } else if (!baseline) {
    projection.reasonCodes = [E_STRUCTURAL_QUALITY_BASELINE_MISSING];
  }
  projection.optimization = optimizationProjection(policy, evaluations, current, optimizationScope ?? undefined);
  if (!baseline) projection.next = policy.mode === "gate" ? "CAPTURE_STRUCTURAL_QUALITY_BASELINE" : null;
  else if (!current || current.value.verificationCycle !== (state?.verificationCycle ?? 1)) projection.next = "VERIFY_STRUCTURAL_QUALITY";
  else if (current.value.status === "FAIL") projection.next = "DIAGNOSE_STRUCTURAL_QUALITY_REGRESSION";
  else if (current.value.status === "BLOCKED") projection.next = "RESOLVE_STRUCTURAL_QUALITY_BLOCKER";
  else projection.next = null;
  return projection;
}

export async function projectStructuralQualityStatus({ target, packageRoot = getPackageRoot(), taskId } = {}) {
  const config = await loadOptionalConfig(target, packageRoot);
  const policy = configuredPolicy(config);
  if (!policy || policy.mode === "off") return emptyProjection(null);
  let state = null;
  try { state = await readWorkState(target, { packageRoot, taskId }); } catch { /* status remains read-only and structured */ }
  let baseline = null;
  let current = null;
  let evaluations = [];
  try { baseline = await readStructuralQualityBaseline(target, taskId, packageRoot); } catch (error) {
    return { ...emptyProjection(policy, [error.code ?? E_STRUCTURAL_QUALITY_EVIDENCE_STALE]), baseline: { status: "INVALID", qualitySignal: null, artifactRef: null, fingerprint: null } };
  }
  try {
    evaluations = await listStructuralQualityEvaluations(target, taskId, packageRoot);
    current = evaluations.at(-1) ?? null;
  } catch (error) {
    return { ...projectionFromArtifacts(policy, baseline, null, state), reasonCodes: [error.code ?? E_STRUCTURAL_QUALITY_EVIDENCE_STALE] };
  }
  const optimizationScope = policy.optimization.mode === "bounded" && current?.value?.status === "PASS"
    ? await optimizationScopeStatus(target, packageRoot, taskId)
    : null;
  return projectionFromArtifacts(policy, baseline, current, state, evaluations, optimizationScope);
}

export async function validateStructuralQualityCheckProvenance(check, { target, packageRoot = getPackageRoot(), taskId, state, contract, route, config } = {}) {
  if (check?.kind !== "structural-quality") return [];
  const details = check.details ?? {};
  const artifactRef = details.artifactRef;
  if (typeof artifactRef !== "string" || !artifactRef) return [qualityError(E_STRUCTURAL_QUALITY_EVIDENCE_STALE, "Structural-quality check is missing artifactRef")];
  try {
    await assertSafePath(target, artifactRef);
    const artifact = await readJsonArtifact(target, artifactRef, "structural-quality", packageRoot);
    const policy = configuredPolicy(config ?? await loadOptionalConfig(target, packageRoot));
    if (!policy || policy.mode === "off") return [qualityError(E_STRUCTURAL_QUALITY_EVIDENCE_STALE, "Structural-quality check is configured off")];
    const activeContract = contract ?? await readContract(target, packageRoot, { taskId });
    const activeRoute = route ?? await readPersistedRoute(target, packageRoot, { taskId });
    const activeScope = await scopeIdentity(target, policy.provider);
    const baseline = artifact.value.role === "EVALUATION"
      ? await readStructuralQualityBaseline(target, taskId, packageRoot)
      : null;
    const expected = {
      taskId,
      contractFingerprint: activeContract.fingerprint,
      routeFingerprint: activeRoute.fingerprint,
      policyFingerprint: structuralQualityPolicyFingerprint(policy),
      scopeFingerprint: activeScope.scopeFingerprint,
      providerId: policy.provider,
      baselineFingerprint: artifact.value.role === "EVALUATION" ? baseline?.fingerprint : undefined,
      verificationCycle: state?.verificationCycle,
    };
    const errors = [];
    validateStructuralQualityArtifact(artifact.value, artifactRef);
    if (artifact.value.taskId !== taskId) errors.push(qualityError(E_STRUCTURAL_QUALITY_BASELINE_BINDING_MISMATCH, "Structural-quality artifact task ID does not match the active task"));
    errors.push(...validateBindingErrors(artifact.value, expected));
    if (baseline && artifact.value.role === "EVALUATION"
      && baseline.value.provider?.version !== artifact.value.provider?.version) {
      errors.push(qualityError(E_STRUCTURAL_QUALITY_EVALUATION_INCOMPARABLE, "Structural-quality evaluation provider version differs from the captured baseline"));
    }
    const expectedCheckStatus = checkProjection(policy, artifact.value).status;
    if (check.status !== expectedCheckStatus) errors.push(qualityError(E_STRUCTURAL_QUALITY_EVIDENCE_STALE, "Structural-quality check status does not match its persisted evaluation"));
    if (details.artifactFingerprint !== artifact.fingerprint) errors.push(qualityError(E_STRUCTURAL_QUALITY_EVIDENCE_STALE, "Structural-quality check fingerprint does not match its artifact"));
    return errors;
  } catch (error) {
    return [error.code ? error : qualityError(E_STRUCTURAL_QUALITY_EVIDENCE_STALE, error.message)];
  }
}

function validateBindingErrors(value, expected) {
  const errors = [];
  const bindings = value.bindings ?? {};
  for (const key of ["contractFingerprint", "routeFingerprint", "policyFingerprint", "scopeFingerprint"]) {
    if (expected[key] !== undefined && bindings[key] !== expected[key]) errors.push(qualityError(E_STRUCTURAL_QUALITY_BASELINE_BINDING_MISMATCH, `Structural-quality ${key} is stale`));
  }
  if (expected.providerId && value.provider?.id !== expected.providerId) errors.push(qualityError(E_STRUCTURAL_QUALITY_BASELINE_BINDING_MISMATCH, "Structural-quality provider binding is stale"));
  if (expected.baselineFingerprint !== undefined && value.role === "EVALUATION" && bindings.baselineFingerprint !== expected.baselineFingerprint) errors.push(qualityError(E_STRUCTURAL_QUALITY_BASELINE_BINDING_MISMATCH, "Structural-quality baseline binding is stale"));
  if (expected.verificationCycle !== undefined && value.role === "EVALUATION" && value.verificationCycle !== expected.verificationCycle) errors.push(qualityError(E_STRUCTURAL_QUALITY_EVIDENCE_STALE, "Structural-quality evaluation is from a stale verification cycle"));
  return errors;
}

export async function assertStructuralQualityExecutionReady({ target, packageRoot = getPackageRoot(), taskId } = {}) {
  const config = await loadOptionalConfig(target, packageRoot);
  const policy = configuredPolicy(config);
  if (!policy || policy.mode !== "gate") return { required: false, baseline: null };
  const baseline = await readStructuralQualityBaseline(target, taskId, packageRoot);
  if (!baseline) throw qualityError(E_STRUCTURAL_QUALITY_BASELINE_MISSING, "Gate mode requires a captured structural-quality baseline before EXECUTING", [taskArtifactPath(taskId, "structuralQuality")]);
  const inputs = await taskInputs(target, packageRoot, taskId);
  const errors = validateBindingErrors(baseline.value, {
    contractFingerprint: inputs.contract.fingerprint,
    routeFingerprint: inputs.route.fingerprint,
    policyFingerprint: structuralQualityPolicyFingerprint(policy),
    scopeFingerprint: inputs.scopeFingerprint,
    providerId: policy.provider,
  });
  if (errors.length > 0) throw errors[0];
  return { required: true, baseline };
}

export { SENTRUX_RULES_PATH };
