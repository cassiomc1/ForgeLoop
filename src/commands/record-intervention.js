import { recordIntervention } from "../core/diagnostic-record.js";
import { withTaskMutation } from "../core/task-command.js";

export { recordIntervention };

export async function runRecordIntervention({
  target,
  packageRoot,
  file = null,
  taskId,
  task,
}) {
  return withTaskMutation(target, { taskId: taskId ?? task, packageRoot }, "record-intervention", async (ctx) => {
    return recordIntervention({
      target,
      packageRoot,
      interventionFile: file,
      interventionInput: null,
      taskId: ctx?.taskId ?? null,
    });
  });
}

export function formatRecordInterventionResult(result) {
  const intervention = result.intervention?.intervention ?? {};
  return [
    "FORGELOOP INTERVENTION RECORDED",
    `CYCLE: ${result.intervention?.verificationCycle}`,
    `ID: ${intervention.id}`,
    `KIND: ${intervention.kind}`,
    `STATEMENT: ${intervention.statement}`,
    `HYPOTHESES: ${(intervention.hypothesisRefs ?? []).join(", ")}`,
    result.repeatedSemanticIntervention ? "WARNING: this semantic intervention has been recorded before" : null,
  ].filter((line) => line !== null).join("\n") + "\n";
}
