import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdtemp } from "node:fs/promises";
import { removeTempTree } from "./helpers/rm-safe.js";
import { getPackageRoot } from "../src/core/templates.js";
import {
  assertDecisionCriterionDetails,
  criterionForDecision,
  decisionId,
  normalizeDecisionText,
} from "../src/core/settlement-model.js";
import { recordDecisionCriterion } from "../src/core/settlement.js";
import { createContract, contractFingerprint, writeContract } from "../src/core/contract.js";
import { appendProtocolEvent, readEvents, validateEventLedger } from "../src/core/events.js";

const packageRoot = getPackageRoot();

test("settlement pure model - decisionId & normalization", () => {
  assert.equal(normalizeDecisionText("  Which   Provider?  "), "which provider?");
  const id1 = decisionId("Which Auth Provider?");
  const id2 = decisionId("  which   auth provider?  ");
  assert.equal(id1, id2);
  assert.match(id1, /^decision-[a-f0-9]{16}$/);
});

test("settlement pure model - assertDecisionCriterionDetails", () => {
  const dec = "Which database to use?";
  const valid = {
    decision: dec,
    decisionId: decisionId(dec),
    settledBy: "Use SQLite for local tests",
    contractFingerprint: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };
  assert.doesNotThrow(() => assertDecisionCriterionDetails(valid));

  // Mismatched decisionId
  assert.throws(() => assertDecisionCriterionDetails({ ...valid, decisionId: "decision-wrongid123456" }), { code: "E_DECISION_CRITERION_INVALID" });
  // Empty settledBy
  assert.throws(() => assertDecisionCriterionDetails({ ...valid, settledBy: "  " }), { code: "E_DECISION_CRITERION_INVALID" });
  // Invalid contractFingerprint
  assert.throws(() => assertDecisionCriterionDetails({ ...valid, contractFingerprint: "short" }), { code: "E_DECISION_CRITERION_INVALID" });
});

test("recordDecisionCriterion persists in event ledger and respects contract binding", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-settlement-test-"));
  try {
    const taskId = "task-settlement-1";
    const decisionText = "Which authentication provider should be used?";

    const contract = createContract({
      taskId,
      objective: "Test decision criteria",
      deliverables: ["src/auth.js"],
      constraints: [],
      risks: [],
      verification: ["tests"],
      successCriteria: ["tests pass"],
      stopConditions: [],
      unresolvedDecisions: [decisionText],
      sourceRefs: [],
    });
    const contractHash = contractFingerprint(contract);
    await writeContract(target, contract, packageRoot, { taskId });

    await appendProtocolEvent(target, { taskId, event: "TASK_RECEIVED" }, packageRoot, { taskId });
    await appendProtocolEvent(target, { taskId, event: "CONTRACT_VALIDATED" }, packageRoot, { taskId });

    // Valid record
    const res = await recordDecisionCriterion({
      target,
      packageRoot,
      decision: decisionText,
      settledBy: "Choose provider supporting existing session middleware",
      taskId,
    });

    assert.equal(res.event.event, "DECISION_CRITERION_RECORDED");
    assert.equal(res.criterion.decision, decisionText);
    assert.equal(res.criterion.decisionId, decisionId(decisionText));
    assert.equal(res.criterion.contractFingerprint, contractHash);

    const ledger = await validateEventLedger(target, packageRoot, { taskId });
    assert.equal(ledger.valid, true);

    // Reject if decision is not in contract unresolvedDecisions
    await assert.rejects(
      () => recordDecisionCriterion({
        target,
        packageRoot,
        decision: "Non-existent decision?",
        settledBy: "Some criterion",
        taskId,
      }),
      { code: "E_DECISION_NOT_UNRESOLVED" }
    );

    // Reject if settledBy is empty
    await assert.rejects(
      () => recordDecisionCriterion({
        target,
        packageRoot,
        decision: decisionText,
        settledBy: "   ",
        taskId,
      }),
      { code: "E_DECISION_CRITERION_INVALID" }
    );

    // Record newer criterion for same decision
    const res2 = await recordDecisionCriterion({
      target,
      packageRoot,
      decision: decisionText,
      settledBy: "Updated settlement criterion",
      taskId,
    });
    assert.equal(res2.criterion.settledBy, "Updated settlement criterion");

    const events = await readEvents(target, packageRoot, { taskId });
    const criterion = criterionForDecision(events, taskId, decisionText, contractHash);
    assert.equal(criterion.settledBy, "Updated settlement criterion");

    // Stale contract fingerprint lookup returns null
    const staleLookup = criterionForDecision(events, taskId, decisionText, "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    assert.equal(staleLookup, null);

  } finally {
    await removeTempTree(target);
  }
});
