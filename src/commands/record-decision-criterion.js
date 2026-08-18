import { recordDecisionCriterion } from "../core/settlement.js";
import { withTaskMutation } from "../core/task-command.js";

export { recordDecisionCriterion };

export async function runRecordDecisionCriterion({
  target,
  packageRoot,
  decision,
  settledBy,
  taskId,
  task,
}) {
  return withTaskMutation(target, { taskId: taskId ?? task, packageRoot }, "record-decision-criterion", async (ctx) => {
    return recordDecisionCriterion({
      target,
      packageRoot,
      decision,
      settledBy,
      taskId: ctx?.taskId ?? null,
    });
  });
}

export function formatRecordDecisionCriterionResult(result) {
  const c = result.criterion ?? result.event?.details ?? {};
  return [
    `FORGELOOP DECISION CRITERION RECORDED`,
    `DECISION: ${c.decision}`,
    `DECISION ID: ${c.decisionId}`,
    `SETTLED BY: ${c.settledBy}`,
    `CONTRACT FINGERPRINT: ${c.contractFingerprint}`,
  ].join("\n") + "\n";
}
