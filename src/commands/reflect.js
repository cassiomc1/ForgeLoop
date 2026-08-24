import { buildTaskReflection } from "../core/reflection.js";
import { resolveTaskContext, TASK_SELECTION_MODES } from "../core/task-context.js";

export { buildTaskReflection };

export function formatReflectResult(result) {
  const lines = [
    "ForgeLoop Reflection",
    "─".repeat(56),
    "",
    `Task:       ${result.taskId ?? "unknown"}`,
    `Phase:      ${result.taskPhase ?? "UNKNOWN"}`,
    `Status:     ${result.status}`,
    `Cycles:     ${result.verificationCycles}`,
    `Integrity:  ${result.integrityValid ? "VALID" : "INCONSISTENT"}`,
    "",
    `Hypotheses: ${result.hypotheses.created} created, ${result.hypotheses.open} open, ${result.hypotheses.supported} supported, ${result.hypotheses.weakened} weakened, ${result.hypotheses.falsified} falsified`,
    `Interventions: ${result.interventions.count} (${result.interventions.informative} informative, ${result.interventions.nonInformative} non-informative)`,
    `Oscillation: ${result.oscillation.detected ? "DETECTED" : "none"}`,
    result.signals.length > 0 ? `Signals: ${result.signals.join(", ")}` : "Signals: none",
    "",
    `Recommended protocol action: ${result.recommendedProtocolAction}`,
  ];
  return lines.join("\n") + "\n";
}

export async function runReflect({ target, packageRoot, taskId, task }) {
  const resolved = await resolveTaskContext(target, {
    packageRoot,
    taskId: taskId ?? task,
    selectionMode: TASK_SELECTION_MODES.READ,
  });
  return buildTaskReflection({
    target,
    packageRoot,
    taskId: resolved?.taskId ?? null,
  });
}
