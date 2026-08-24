import { readEvents, validateEventLedger } from "./events.js";
import { readWorkState } from "./work-state.js";
import { canonicalFingerprint } from "./artifacts.js";

function ledgerTail(events) {
  const last = events.at(-1) ?? null;
  return {
    sequence: last?.seq ?? 0,
    hash: last?.hash ?? null,
  };
}

export async function buildTaskSnapshot({
  target,
  packageRoot,
  taskId = null,
  eventsPath = null,
  stateFile = null,
} = {}) {
  const options = { packageRoot, taskId, ...(eventsPath ? { eventsPath } : {}) };
  const state = await readWorkState(target, { ...options, ...(stateFile ? { statePath: stateFile } : {}) });
  const events = await readEvents(target, packageRoot, options);
  const before = {
    stateRevision: state?.revision ?? null,
    ...ledgerTail(events),
  };

  const validation = await validateEventLedger(target, packageRoot, options);

  const rereadState = await readWorkState(target, { ...options, ...(stateFile ? { statePath: stateFile } : {}) });
  const rereadEvents = await readEvents(target, packageRoot, options);
  const after = {
    stateRevision: rereadState?.revision ?? null,
    ...ledgerTail(rereadEvents),
  };

  const consistent = JSON.stringify(before) === JSON.stringify(after);

  return {
    consistent,
    taskId: taskId ?? state?.taskId ?? rereadState?.taskId ?? null,
    anchors: before,
    capturedAt: new Date().toISOString(),
    integrity: {
      valid: validation.valid,
      errors: validation.errors,
      eventCount: validation.events.length,
      fingerprint: canonicalFingerprint(validation.events.map(({ seq, event, at }) => ({ seq, event, at }))),
    },
    state: rereadState,
    events: validation.events,
  };
}
