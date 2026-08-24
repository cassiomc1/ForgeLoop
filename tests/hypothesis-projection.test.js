import test from "node:test";
import assert from "node:assert/strict";
import { projectHypothesisStates, getOpenHypotheses, getHypothesisState } from "../src/core/hypothesis-projection.js";

function caseEvent(seq, hypotheses) {
  return {
    seq,
    taskId: "t1",
    event: "DIAGNOSTIC_CASE_RECORDED",
    details: { verificationCycle: 1, hypotheses },
  };
}

function dispositionEvent(seq, hypothesisRef, status, extra = {}) {
  return {
    seq,
    taskId: "t1",
    event: "HYPOTHESIS_DISPOSITION_RECORDED",
    details: { verificationCycle: 1, hypothesisRef, status, evidenceRefs: ["check-lint"], reason: "r", ...extra },
  };
}

const H = (id) => ({ id, statement: `s-${id}`, evidenceRefs: ["check-lint"] });

test("OPEN -> SUPPORTED -> WEAKENED -> SUPPORTED -> FALSIFIED chronology projects forward", () => {
  const events = [
    caseEvent(1, [H("h1")]),
    dispositionEvent(2, "h1", "SUPPORTED"),
    dispositionEvent(3, "h1", "WEAKENED"),
    dispositionEvent(4, "h1", "SUPPORTED"),
    dispositionEvent(5, "h1", "FALSIFIED"),
  ];
  const projection = projectHypothesisStates(events, { taskId: "t1" });
  const state = getHypothesisState(projection, "h1");
  assert.equal(state.initialStatus, "OPEN");
  assert.equal(state.currentStatus, "FALSIFIED");
  assert.deepEqual(
    state.dispositionHistory.map((entry) => entry.status),
    ["SUPPORTED", "WEAKENED", "SUPPORTED", "FALSIFIED"],
  );
  assert.deepEqual(state.dispositionHistory.map((entry) => entry.sequence), [2, 3, 4, 5]);
});

test("terminal states reject further transitions", () => {
  for (const [from, to] of [["FALSIFIED", "SUPPORTED"], ["SUPERSEDED", "OPEN"], ["UNRESOLVED", "SUPPORTED"]]) {
    const events = [caseEvent(1, [H("h1")]), dispositionEvent(2, "h1", from), dispositionEvent(3, "h1", to)];
    const projection = projectHypothesisStates(events, { taskId: "t1" });
    assert.equal(projection.invalidTransitions.length, 1, `${from} -> ${to} must be invalid`);
    assert.equal(getHypothesisState(projection, "h1").currentStatus, from);
  }
});

test("self transitions are rejected and OPEN -> SUPERSEDED / UNRESOLVED allowed", () => {
  const selfEvents = [caseEvent(1, [H("h1")]), dispositionEvent(2, "h1", "SUPPORTED"), dispositionEvent(3, "h1", "SUPPORTED")];
  assert.equal(projectHypothesisStates(selfEvents, { taskId: "t1" }).invalidTransitions.length, 1);

  const superseded = [caseEvent(1, [H("h1")]), dispositionEvent(2, "h1", "SUPERSEDED")];
  let projection = projectHypothesisStates(superseded, { taskId: "t1" });
  assert.equal(getHypothesisState(projection, "h1").currentStatus, "SUPERSEDED");
  assert.deepEqual(getOpenHypotheses(projection), []);

  const unresolved = [caseEvent(1, [H("h2")]), dispositionEvent(2, "h2", "UNRESOLVED")];
  projection = projectHypothesisStates(unresolved, { taskId: "t1" });
  assert.equal(getHypothesisState(projection, "h2").currentStatus, "UNRESOLVED");
});

test("open hypotheses reflect projected state, not the source case", () => {
  const events = [caseEvent(1, [H("h1"), H("h2")]), dispositionEvent(2, "h1", "FALSIFIED")];
  const projection = projectHypothesisStates(events, { taskId: "t1" });
  assert.deepEqual(getOpenHypotheses(projection), ["h2"]);
});

test("legacy diagnosis exposes synthetic h-legacy hypothesis", () => {
  const events = [{
    seq: 1,
    taskId: "t1",
    event: "DIAGNOSIS_RECORDED",
    details: { verificationCycle: 2, hypothesis: "legacy", informationGain: "FIRST_DIAGNOSIS" },
  }];
  const projection = projectHypothesisStates(events, { taskId: "t1" });
  const legacy = getHypothesisState(projection, "h-legacy");
  assert.ok(legacy);
  assert.equal(legacy.currentStatus, "OPEN");
  assert.equal(legacy.sourceCycle, 2);
});
