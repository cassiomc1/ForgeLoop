export const PHASES_REQUIRING_EXECUTION_CHRONOLOGY = new Set([
  "EXECUTING",
  "VERIFYING",
  "DIAGNOSING",
  "CORRECTING",
  "REVIEWING",
  "COMPLETE",
]);

export function phaseRequiresExecutionChronology(phase) {
  return PHASES_REQUIRING_EXECUTION_CHRONOLOGY.has(phase);
}
