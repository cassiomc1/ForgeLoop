import { recordDiagnosis } from "../core/diagnosis.js";
import { withTaskMutation } from "../core/task-command.js";

export { recordDiagnosis };

export async function runRecordDiagnosis({
  target,
  packageRoot,
  hypothesis,
  failureClass,
  evidenceRefs = [],
  evidenceRef = null,
  settledBy,
  nextSafeAction,
  taskId,
  task,
}) {
  const refs = Array.isArray(evidenceRefs) && evidenceRefs.length > 0
    ? evidenceRefs
    : (evidenceRef ? [evidenceRef] : []);

  return withTaskMutation(target, { taskId: taskId ?? task, packageRoot }, "record-diagnosis", async (ctx) => {
    return recordDiagnosis({
      target,
      packageRoot,
      hypothesis,
      failureClass,
      evidenceRefs: refs,
      settledBy,
      nextSafeAction,
      taskId: ctx?.taskId ?? null,
    });
  });
}

export function formatRecordDiagnosisResult(result) {
  const d = result.diagnosis ?? result.event?.details ?? {};
  return [
    `FORGELOOP DIAGNOSIS RECORDED`,
    `CYCLE: ${d.verificationCycle}`,
    `FAILURE CLASS: ${d.failureClass}`,
    `HYPOTHESIS: ${d.hypothesis}`,
    `INFORMATION GAIN: ${d.informationGain}`,
    `EVIDENCE: ${(d.evidenceRefs ?? []).join(", ")}`,
    `SETTLED BY: ${d.settledBy}`,
    `NEXT SAFE ACTION: ${d.nextSafeAction}`,
    `FINGERPRINT: ${d.diagnosisFingerprint}`,
  ].join("\n") + "\n";
}
