import { validateEventLedger } from "./events.js";
import { readPersistedRoute } from "./route-artifact.js";
import { directCommandSpec } from "./next-action-model.js";

/** Offer checkpoint removal only before execution, with valid blocked chronology. */
export async function preExecutionRefreshGuidance({ target, packageRoot, state, contract }) {
  if (!["ROUTED", "DESIGNING", "PLANNED"].includes(state.phase)) return {};
  const ledger = await validateEventLedger(target, packageRoot, { taskId: state.taskId });
  if (!ledger.valid || ledger.events.some((entry) => entry.event === "EXECUTION_STARTED")) return {};
  const lastPreflight = ledger.events.filter((entry) => ["PREFLIGHT_READY", "PREFLIGHT_BLOCKED"].includes(entry.event)).at(-1);
  if (lastPreflight?.event !== "PREFLIGHT_BLOCKED") return {};
  let route;
  try { route = await readPersistedRoute(target, packageRoot, { taskId: state.taskId }); }
  catch { return {}; }
  if (route.value.contractFingerprint !== contract.fingerprint) return {};
  return {
    commands: [`forgeloop clear-state --task ${state.taskId}`, `forgeloop preflight --task ${state.taskId}`],
    commandSpecs: [directCommandSpec("clear-state", state.taskId), directCommandSpec("preflight", state.taskId)],
  };
}
