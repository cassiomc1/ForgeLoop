import { runDoctor } from "../commands/doctor.js";
import { runStatus } from "../commands/status.js";
import { runValidateState } from "../commands/validate-state.js";
import { runClearState } from "../commands/clear-state.js";
import { inspectTarget } from "../commands/inspect.js";
import { runInit } from "../commands/init.js";
import { runRoute } from "../commands/route.js";
import { runValidateReceipt } from "../commands/validate-receipt.js";
import { runValidateProtocol } from "../commands/validate-protocol.js";
import { runUpdate } from "../commands/update.js";
import { runActivate } from "../commands/activate.js";
import { runAdvance } from "../commands/advance.js";
import { runPreflight } from "../commands/preflight.js";
import { runComplete } from "../commands/complete.js";
import { runAudit } from "../commands/audit.js";
import { runReport } from "../commands/report.js";
import { runPolicy } from "../commands/policy.js";
import { runPolicyDiscover } from "../commands/policy-discover.js";
import { runPolicyStatus } from "../commands/policy-status.js";
import { runPolicyDiff } from "../commands/policy-diff.js";
import { runRuleVerify } from "../commands/rule-verify.js";
import { runBaseline } from "../commands/baseline.js";
import { runProfileInterview } from "../commands/profile-interview.js";
import { runBundle } from "../commands/bundle.js";
import { runPrepareCompletion } from "../commands/prepare-completion.js";
import { runRecordCheck } from "../commands/record-check.js";
import { runCheck } from "../commands/run-check.js";
import { runAction } from "../commands/run-action.js";
import { reconcileClosure } from "../commands/reconcile-closure.js";
import { runRecordTerminalResult } from "../commands/record-terminal-result.js";
import { runRecordDiagnosis } from "../commands/record-diagnosis.js";
import { runRecordIntervention } from "../commands/record-intervention.js";
import { runRecordHypothesisDisposition } from "../commands/record-hypothesis-disposition.js";
import { runHistory } from "../commands/history.js";
import { runTrace } from "../commands/trace.js";
import { runReflect } from "../commands/reflect.js";
import { runProgress } from "../commands/progress.js";
import { runRecordDecisionCriterion } from "../commands/record-decision-criterion.js";
import { runNext } from "../commands/next.js";
import { runContinuity } from "../commands/continuity.js";
import { runRecordContinuity } from "../commands/record-continuity.js";
import { runReconcileContinuity } from "../commands/reconcile-continuity.js";
import { runClearContinuity } from "../commands/clear-continuity.js";
import { runTaskCreate } from "../commands/task-create.js";
import { runTaskList } from "../commands/task-list.js";
import { runTaskShow } from "../commands/task-show.js";
import { runTaskScope } from "../commands/task-scope.js";
import { runTaskMigrate } from "../commands/task-migrate.js";
import { runMigrateProtocol } from "../commands/migrate-protocol.js";
import { runTaskUnlock } from "../commands/task-unlock.js";
import { runTaskRecover } from "../commands/task-recover.js";
import { runTaskResume } from "../commands/task-resume.js";
import { runTaskRepairLegacyRecovery } from "../commands/task-repair-legacy-recovery.js";
import { runTaskLockStatus } from "../commands/task-lock-status.js";
import { runProtocolInfo } from "../commands/protocol-info.js";

/**
 * Canonical transport-neutral command executors.
 *
 * Every entry executes exactly one ForgeLoop command and returns a
 * structured `{ result, exitCode }` envelope without any terminal output.
 * Exit codes preserve CLI-equivalent semantics: a non-zero exit code is a
 * deterministic protocol/domain outcome, not an invocation failure.
 *
 * The CLI renders these results; MCP and other integrations consume them
 * directly. No ownership, recovery, or lifecycle logic may live here.
 */
export const COMMAND_EXECUTORS = {
  "protocol-info": async ({ packageVersion }) => ({
    result: await runProtocolInfo({ packageVersion }),
    exitCode: 0,
  }),
  init: async ({ target, packageRoot, packageVersion, options }) => ({
    result: await runInit({ target, dryRun: options.dryRun, packageRoot, packageVersion }),
    exitCode: 0,
  }),
  doctor: async ({ target, packageRoot, options }) => {
    const result = await runDoctor({
      target,
      packageRoot,
      adoptPaths: options.adopt,
      strict: options.strict,
      fix: options.fix,
    });
    return { result, exitCode: result.ok ? 0 : 1 };
  },
  route: async ({ target, packageRoot, options }) => ({
    result: await runRoute({
      target,
      packageRoot,
      workType: options.workType,
      surfaces: options.surfaces,
      risks: options.risks,
      platforms: options.platforms,
      behaviorChange: options.behaviorChange,
      executableChange: options.executableChange,
      taskId: options.taskId,
    }),
    exitCode: 0,
  }),
  activate: async ({ target, packageRoot }) => ({
    result: await runActivate({ target, packageRoot }),
    exitCode: 0,
  }),
  preflight: async ({ target, packageRoot, options }) => {
    const result = await runPreflight({ target, packageRoot, strict: options.strict, taskId: options.taskId });
    return { result, exitCode: result.status === "READY" ? 0 : 1 };
  },
  advance: async ({ target, packageRoot, options }) => ({
    result: await runAdvance({ target, packageRoot, to: options.to, taskId: options.taskId }),
    exitCode: 0,
  }),
  next: async ({ target, packageRoot, options }) => ({
    result: await runNext({ target, packageRoot, taskId: options.taskId }),
    exitCode: 0,
  }),
  continuity: async ({ target, packageRoot, options }) => ({
    result: await runContinuity({ target, packageRoot, taskId: options.taskId }),
    exitCode: 0,
  }),
  "record-continuity": async ({ target, packageRoot, options }) => ({
    result: await runRecordContinuity({
      target,
      packageRoot,
      focusId: options.continuityFocusId,
      focusSummary: options.continuityFocusSummary,
      remaining: options.continuityRemaining,
      knownIssues: options.continuityKnownIssues,
      changedAreas: options.continuityChangedAreas,
      inspectFirst: options.continuityInspectFirst,
      resumeNote: options.continuityResumeNote,
      taskId: options.taskId,
    }),
    exitCode: 0,
  }),
  "reconcile-continuity": async ({ target, packageRoot, options }) => ({
    result: await runReconcileContinuity({ target, packageRoot, taskId: options.taskId }),
    exitCode: 0,
  }),
  "clear-continuity": async ({ target, options }) => ({
    result: await runClearContinuity({ target, taskId: options.taskId }),
    exitCode: 0,
  }),
  "prepare-completion": async ({ target, packageRoot, options }) => ({
    result: await runPrepareCompletion({ target, packageRoot, taskId: options.taskId }),
    exitCode: 0,
  }),
  "run-check": async ({ target, packageRoot, options }) => {
    const result = await runCheck({
      target,
      packageRoot,
      id: options.checkId,
      requirement: options.checkRequirement,
      argv: options.commandArgv,
      details: options.checkDetails ?? undefined,
      timeoutMs: options.timeoutMs ?? undefined,
      taskId: options.taskId,
    });
    return { result, exitCode: result.check.status === "passed" ? 0 : 1 };
  },
  "run-action": async ({ target, packageRoot, options }) => {
    const result = await runAction({ target, packageRoot, taskId: options.taskId,
      actionId: options.actionId, capability: options.actionCapability,
      effectClass: options.actionEffectClass, actionTarget: options.actionTarget,
      idempotencyKey: options.actionIdempotencyKey, requirement: options.actionRequirement,
      requiredForCompletion: options.actionRequiredForCompletion, argv: options.commandArgv,
      approvalId: options.approvalId, timeoutMs: options.timeoutMs });
    return { result, exitCode: result.action.state === "COMMITTED" ? 0 : 1 };
  },
  "record-check": async ({ target, packageRoot, options }) => ({
    result: await runRecordCheck({
      target,
      packageRoot,
      id: options.checkId,
      kind: options.checkKind ?? "command",
      requirement: options.checkRequirement,
      status: options.checkStatus,
      evidenceKind: options.checkEvidenceKind,
      command: options.checkCommand ?? undefined,
      result: options.checkResult ?? undefined,
      ...(options.checkExitCode === null ? {} : { exitCode: options.checkExitCode }),
      details: options.checkDetails ?? undefined,
      executionRef: options.checkExecutionRef ?? undefined,
      provenance: options.checkProvenance ?? undefined,
      taskId: options.taskId,
    }),
    exitCode: 0,
  }),
  "record-terminal-result": async ({ target, packageRoot, options }) => ({
    result: await runRecordTerminalResult({
      target,
      packageRoot,
      requirement: options.checkRequirement,
      type: options.checkType,
      status: options.checkStatus,
      source: options.checkSource ?? options.checkCommand,
      result: options.checkResult,
      details: options.checkDetails ?? undefined,
      taskId: options.taskId,
    }),
    exitCode: 0,
  }),
  "record-diagnosis": async ({ target, packageRoot, options }) => ({
    result: await runRecordDiagnosis({
      target,
      packageRoot,
      file: options.file ?? null,
      hypothesis: options.hypothesis,
      failureClass: options.failureClass,
      evidenceRefs: options.evidenceRefs,
      settledBy: options.settledBy,
      nextSafeAction: options.nextSafeAction,
      taskId: options.taskId,
    }),
    exitCode: 0,
  }),
  "record-intervention": async ({ target, packageRoot, options }) => ({
    result: await runRecordIntervention({
      target,
      packageRoot,
      file: options.file ?? null,
      taskId: options.taskId,
    }),
    exitCode: 0,
  }),
  "record-hypothesis-disposition": async ({ target, packageRoot, options }) => ({
    result: await runRecordHypothesisDisposition({
      target,
      packageRoot,
      hypothesis: options.hypothesis,
      status: options.dispositionStatus,
      evidenceRefs: options.evidenceRefs,
      reason: options.reason,
      taskId: options.taskId,
    }),
    exitCode: 0,
  }),
  history: async ({ target, packageRoot, options }) => {
    const result = await runHistory({
      target,
      packageRoot,
      taskId: options.taskId,
      filters: {
        type: options.historyType ?? null,
        phase: options.historyPhase ?? null,
        failures: Boolean(options.historyFailures),
        checks: Boolean(options.historyChecks),
        since: options.historySince ?? null,
        until: options.historyUntil ?? null,
        limit: Number.isInteger(options.historyLimit) ? options.historyLimit : null,
      },
    });
    return { result, exitCode: result.integrity.valid ? 0 : 1 };
  },
  trace: async ({ target, packageRoot, options }) => {
    const result = await runTrace({ target, packageRoot, taskId: options.taskId });
    return { result, exitCode: result.integrity.valid ? 0 : 1 };
  },
  reflect: async ({ target, packageRoot, options }) => {
    const result = await runReflect({ target, packageRoot, taskId: options.taskId });
    return { result, exitCode: result.status === "STALLED" ? 1 : 0 };
  },
  progress: async ({ target, packageRoot, options }) => {
    const result = await runProgress({ target, packageRoot, taskId: options.taskId });
    return { result, exitCode: result.status === "STALLED" ? 1 : 0 };
  },
  "record-decision-criterion": async ({ target, packageRoot, options }) => ({
    result: await runRecordDecisionCriterion({
      target,
      packageRoot,
      decision: options.decision,
      settledBy: options.settledBy,
      taskId: options.taskId,
    }),
    exitCode: 0,
  }),
  complete: async ({ target, packageRoot, options }) => {
    const result = await runComplete({ target, packageRoot, strict: options.strict, taskId: options.taskId });
    return { result, exitCode: result.status === "VALID" ? 0 : 1 };
  },
  audit: async ({ target, packageRoot, options }) => {
    const result = await runAudit({ target, packageRoot, strict: options.strict, taskId: options.taskId });
    return { result, exitCode: result.status === "VALID" ? 0 : 1 };
  },
  report: async ({ target, packageRoot, options }) => {
    const result = await runReport({ target, packageRoot, strict: options.strict, taskId: options.taskId });
    return { result, exitCode: result.verdict === "VALID" ? 0 : 1 };
  },
  policy: async ({ target, packageRoot, options }) => ({
    result: await runPolicy({ target, packageRoot, name: options.policy, taskId: options.taskId }),
    exitCode: 0,
  }),
  "policy-discover": async ({ target, packageRoot, options }) => ({
    result: await runPolicyDiscover({ target, packageRoot, write: options.write }),
    exitCode: 0,
  }),
  "policy-status": async ({ target, packageRoot, options }) => {
    const result = await runPolicyStatus({ target, packageRoot, taskId: options.taskId });
    return { result, exitCode: result.status === "VALID" ? 0 : 1 };
  },
  "policy-diff": async ({ target, packageRoot, options }) => ({
    result: await runPolicyDiff({ target, packageRoot, taskId: options.taskId, before: options.before, after: options.after }),
    exitCode: 0,
  }),
  "rule-verify": async ({ target, packageRoot, options }) => {
    const result = await runRuleVerify({ target, packageRoot, rule: options.rule });
    return { result, exitCode: result.status === "VALID" ? 0 : 1 };
  },
  baseline: async ({ target, packageRoot, options }) => ({
    result: await runBaseline({
      target,
      packageRoot,
      record: options.record,
      update: options.update,
      policyResetAuthorized: options.policyResetAuthorized,
    }),
    exitCode: 0,
  }),
  "profile-interview": async ({ target, packageRoot, options }) => ({
    result: await runProfileInterview({ target, packageRoot, dryRun: options.dryRun }),
    exitCode: 0,
  }),
  bundle: async ({ target, packageRoot, options }) => ({
    result: await runBundle({ target, packageRoot, taskId: options.taskId }),
    exitCode: 0,
  }),
  inspect: async ({ target, packageRoot, options }) => {
    const result = await inspectTarget({ target, packageRoot, contractFile: options.contractFile, taskId: options.taskId });
    return { result, exitCode: result.ok ? 0 : 1 };
  },
  "validate-receipt": async ({ target, packageRoot, options }) => ({
    result: await runValidateReceipt({ target, packageRoot, file: options.file, taskId: options.taskId }),
    exitCode: 0,
  }),
  "validate-protocol": async ({ target, packageRoot, options }) => {
    const result = await runValidateProtocol({
      target,
      packageRoot,
      stateFile: options.stateFile,
      receiptFile: options.receiptFile,
      routeFile: options.routeFile,
      contractFile: options.contractFile,
      continuityFile: options.continuityFile,
      taskBriefFiles: options.taskBriefFiles,
      delegatedResultFiles: options.delegatedResultFiles,
      taskId: options.taskId,
    });
    return { result, exitCode: result.status === "VALID" ? 0 : 1 };
  },
  status: async ({ target, packageRoot, options }) => ({
    result: await runStatus({ target, packageRoot, contractFile: options.contractFile, taskId: options.taskId }),
    exitCode: 0,
  }),
  "validate-state": async ({ target, packageRoot, options }) => {
    const result = await runValidateState({ target, packageRoot, taskId: options.taskId });
    return { result, exitCode: result.ok ? 0 : 1 };
  },
  "clear-state": async ({ target, options }) => ({
    result: await runClearState({ target, taskId: options.taskId }),
    exitCode: 0,
  }),
  "task-create": async ({ target, packageRoot, options }) => ({
    result: await runTaskCreate({
      target,
      packageRoot,
      taskId: options.taskId,
      claims: options.claims,
      contractFile: options.contractFile,
    }),
    exitCode: 0,
  }),
  "task-list": async ({ target, packageRoot }) => ({
    result: await runTaskList({ target, packageRoot }),
    exitCode: 0,
  }),
  "task-show": async ({ target, packageRoot, options }) => ({
    result: await runTaskShow({ target, packageRoot, taskId: options.taskId }),
    exitCode: 0,
  }),
  "task-lock-status": async ({ target, packageRoot, options }) => ({
    result: await runTaskLockStatus({ target, packageRoot, taskId: options.taskId }),
    exitCode: 0,
  }),
  "task-scope": async ({ target, packageRoot, options }) => ({
    result: await runTaskScope({
      target,
      packageRoot,
      taskId: options.taskId,
      claims: options.claims,
    }),
    exitCode: 0,
  }),
  "task-migrate": async ({ target, packageRoot, options }) => ({
    result: await runTaskMigrate({ target, packageRoot, dryRun: options.dryRun }),
    exitCode: 0,
  }),
  "migrate-protocol": async ({ target, packageRoot, options }) => ({
    result: await runMigrateProtocol({ target, packageRoot, to: options.to, dryRun: options.dryRun }),
    exitCode: 0,
  }),
  "task-unlock": async ({ target, packageRoot, options }) => ({
    result: await runTaskUnlock({ target, packageRoot, taskId: options.taskId, force: options.force, staleOnly: options.staleOnly }),
    exitCode: 0,
  }),
  "task-recover": async ({ target, packageRoot, options }) => ({
    result: await runTaskRecover({
      target,
      packageRoot,
      taskId: options.taskId,
      acknowledgeRecovery: options.acknowledgeRecovery,
      operatorAuthorized: options.operatorAuthorized,
    }),
    exitCode: 0,
  }),
  "task-resume": async ({ target, packageRoot, options }) => ({
    result: await runTaskResume({ target, packageRoot, taskId: options.taskId, claims: options.claims }),
    exitCode: 0,
  }),
  "task-repair-legacy-recovery": async ({ target, packageRoot, options }) => ({
    result: await runTaskRepairLegacyRecovery({
      target,
      packageRoot,
      taskId: options.taskId,
      acknowledgeRecovery: options.acknowledgeRecovery,
    }),
    exitCode: 0,
  }),
  "reconcile-closure": async ({ target, packageRoot, options }) => ({
    result: await reconcileClosure({
      target,
      packageRoot,
      taskId: options.taskId,
      checkId: options.checkId,
      checkRequirement: options.checkRequirement,
      checkDetails: options.checkDetails,
      commandArgv: options.commandArgv,
    }),
    exitCode: 0,
  }),
  update: async ({ target, packageRoot, packageVersion, options }) => {
    const result = await runUpdate({ target, dryRun: options.dryRun, packageRoot, packageVersion });
    return { result, exitCode: result.conflicts.length === 0 ? 0 : 1 };
  },
};

export const EXECUTOR_EXCEPTIONS = Object.freeze([
  // Bootstrap/presentation-only behaviors intentionally without executors:
  // none currently. Every canonical command definition must have an executor.
]);
