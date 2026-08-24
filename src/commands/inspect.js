import { inspectTarget as coreInspectTarget } from "../core/inspect.js";
import { withResolvedTask } from "../core/task-command.js";

export async function inspectTarget(options = {}) {
  const target = options.target;
  const packageRoot = options.packageRoot;
  const taskId = options.taskId ?? options.task ?? null;
  return withResolvedTask(target, { taskId, packageRoot }, async (ctx) => {
    return coreInspectTarget({ ...options, taskId: ctx?.taskId ?? null });
  });
}

export function formatInspectResult(report) {
  const task = report.taskInspection;
  if (task) return formatTaskInspection(report, task);
  const lines = [
    `Target: ${report.target.path}`,
    `Manifest: ${report.manifest.status}`,
    `Profile: ${report.profile.mode ?? "unknown"}/${report.profile.status ?? "unknown"}`,
    `Protocol: v${report.protocol.version}`,
    `Authority source: ${report.authority.sourceType ?? "none configured"} / ${report.authority.trusted ? "TRUSTED" : report.authority.trustMode === "NONE" ? "UNATTESTED" : "UNTRUSTED"}`,
    `Authority trust: ${report.authority.trustMode}`,
    `State: ${report.state.status}`,
    ...(report.recovery
      ? [`Recovery: ${report.recovery.status} (${report.recovery.recoveryId})`]
      : []),
    ...(report.claims
      ? [`Claim state: ${report.claims.state}`, `Mutation allowed: ${report.claims.mutationAllowed ? "yes" : "no"}`]
      : []),
    `Adapters: ${report.adapters.detected.length} detected`,
    `Findings: ${report.findings.length}`,
    report.ok ? "healthy: ForgeLoop target is ready" : "unhealthy: ForgeLoop target needs attention",
  ];
  return `${lines.join("\n")}\n`;
}

function formatTaskInspection(report, task) {
  const rule = "-".repeat(56);
  const lines = [
    "ForgeLoop Task Inspection",
    rule,
    `Task:                ${task.task ?? report.claims?.state ?? "-"}`,
    `Phase:               ${task.lifecycle.phase ?? "-"}`,
    `Verification cycle:  ${task.lifecycle.verificationCycle ?? "-"}`,
    `Ledger:              ${task.integrity.valid ? "VALID" : "INVALID"}`,
    `Snapshot:            ${task.snapshot.consistent ? "CONSISTENT" : "INCONSISTENT"}`,
    `Progress:            ${task.progress.status}`,
    "",
    "Verification",
  ];
  for (const check of task.verification.checks) {
    lines.push(`  ${check.id.padEnd(20)} ${check.currentResult ?? "unknown"}${Number.isInteger(check.attemptCount) ? `   attempts: ${check.attemptCount}` : ""}`);
  }
  if (task.verification.checks.length === 0) lines.push("  (no checks recorded)");
  lines.push(
    "",
    "Diagnostics",
    `  Cases:            ${task.diagnostics.diagnosticCaseCount}`,
    `  Legacy diagnoses: ${task.diagnostics.legacyDiagnosisCount}`,
    `  Interventions:    ${task.diagnostics.interventionCount}`,
    `  Dispositions:     ${task.diagnostics.dispositionCount}`,
  );
  const surfaces = task.failureSurfaces ?? [];
  if (surfaces.length > 0) {
    lines.push("", "Failure surface");
    for (const entry of surfaces) {
      lines.push(`  cycle ${entry.verificationCycle}: ${entry.surface.join(", ")}`);
    }
  }
  if ((task.issues ?? []).length > 0) {
    lines.push("", "Signals");
    for (const issue of task.issues) {
      lines.push(`  ${issue.code}`);
    }
  }
  lines.push(
    "",
    "Recommended next command",
    `  ${task.next.command}`,
  );
  return `${lines.join("\n")}\n`;
}
