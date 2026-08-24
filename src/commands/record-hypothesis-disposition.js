import { recordHypothesisDisposition } from "../core/diagnostic-record.js";
import { withTaskMutation } from "../core/task-command.js";

export { recordHypothesisDisposition };

export async function runRecordHypothesisDisposition({
  target,
  packageRoot,
  hypothesis,
  hypothesisRef = null,
  status,
  evidenceRefs = [],
  evidenceRef = null,
  reason,
  taskId,
  task,
}) {
  const refs = Array.isArray(evidenceRefs) && evidenceRefs.length > 0
    ? evidenceRefs
    : (evidenceRef ? [evidenceRef] : []);

  return withTaskMutation(target, { taskId: taskId ?? task, packageRoot }, "record-hypothesis-disposition", async (ctx) => {
    return recordHypothesisDisposition({
      target,
      packageRoot,
      hypothesisRef: hypothesis ?? hypothesisRef,
      status,
      evidenceRefs: refs,
      reason,
      taskId: ctx?.taskId ?? null,
    });
  });
}

export function formatRecordHypothesisDispositionResult(result) {
  const disposition = result.disposition ?? {};
  return [
    "FORGELOOP HYPOTHESIS DISPOSITION RECORDED",
    `CYCLE: ${disposition.verificationCycle}`,
    `HYPOTHESIS: ${disposition.hypothesisRef}`,
    `STATUS: ${disposition.status}`,
    `EVIDENCE: ${(disposition.evidenceRefs ?? []).join(", ")}`,
    `REASON: ${disposition.reason}`,
  ].join("\n") + "\n";
}
