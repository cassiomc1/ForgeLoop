import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertEvidence,
  assertEvidenceList,
  createEvidence,
  EVIDENCE_KINDS,
} from "../src/core/evidence.js";

test("evidence uses one stable vocabulary and serializable fields", () => {
  const evidence = createEvidence({ kind: "OBSERVED", source: "npm test", result: "exit 0" });
  assert.deepEqual(evidence, { kind: "OBSERVED", source: "npm test", result: "exit 0" });
  assert.deepEqual(EVIDENCE_KINDS, ["OBSERVED", "INFERRED", "NOT_VERIFIED", "BLOCKED"]);
  assert.doesNotThrow(() => assertEvidence(evidence));
  assert.doesNotThrow(() => assertEvidenceList([evidence]));
});

test("evidence rejects unknown kinds and incomplete records", () => {
  assert.throws(
    () => createEvidence({ kind: "observed", source: "npm test", result: "exit 0" }),
    /kind|evidence/i,
  );
  assert.throws(
    () => assertEvidence({ kind: "OBSERVED", source: "npm test" }),
    /result|evidence/i,
  );
  assert.throws(
    () => assertEvidenceList({ kind: "OBSERVED", source: "x", result: "y" }),
    /array/i,
  );
});
