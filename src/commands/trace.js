import { buildTaskTrace } from "../core/trace.js";
import { resolveTaskContext, TASK_SELECTION_MODES } from "../core/task-context.js";

export { buildTaskTrace };

export function formatTraceResult(result) {
  return [
    `FORGELOOP TRACE: ${result.task.id ?? "unknown"}`,
    `PHASE: ${result.task.phase ?? "UNKNOWN"}`,
    `SNAPSHOT: ${result.snapshot.consistent ? "CONSISTENT" : "INCONSISTENT"} (ledger seq ${result.snapshot.ledgerTailSequence})`,
    `INTEGRITY: ${result.integrity.valid ? "VALID" : "INCONSISTENT"}`,
    `HISTORY QUALITY: ${result.historyQuality.level}`,
    `EVENTS: ${result.events.length}`,
    `CHECKS: ${result.checks.map((check) => `${check.id}=${check.currentResult} (${check.attemptCount} attempts)`).join(", ") || "none"}`,
    `DIAGNOSTIC CASES: ${result.diagnostics.cases.length}`,
    `INTERVENTIONS: ${result.diagnostics.interventions.length}`,
    `DISPOSITIONS: ${result.diagnostics.dispositions.length}`,
    "",
    "Use --json for the full structured trace.",
  ].join("\n") + "\n";
}

export async function runTrace({ target, packageRoot, taskId, task }) {
  const resolved = await resolveTaskContext(target, {
    packageRoot,
    taskId: taskId ?? task,
    selectionMode: TASK_SELECTION_MODES.READ,
  });
  return buildTaskTrace({
    target,
    packageRoot,
    taskId: resolved?.taskId ?? null,
  });
}
