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
  const lines = [
    `Target: ${report.target.path}`,
    `Manifest: ${report.manifest.status}`,
    `Profile: ${report.profile.mode ?? "unknown"}/${report.profile.status ?? "unknown"}`,
    `Protocol: v${report.protocol.version}`,
    `Authority source: ${report.authority.sourceType ?? "none configured"} / ${report.authority.trusted ? "TRUSTED" : report.authority.trustMode === "NONE" ? "UNATTESTED" : "UNTRUSTED"}`,
    `Authority trust: ${report.authority.trustMode}`,
    `State: ${report.state.status}`,
    `Adapters: ${report.adapters.detected.length} detected`,
    `Findings: ${report.findings.length}`,
    report.ok ? "healthy: ForgeLoop target is ready" : "unhealthy: ForgeLoop target needs attention",
  ];
  return `${lines.join("\n")}\n`;
}
