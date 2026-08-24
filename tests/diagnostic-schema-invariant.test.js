import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertDiagnosticCaseDetails } from "../src/core/diagnostic-model.js";

const schemaPath = path.join(process.cwd(), "schemas", "diagnostic-case.schema.json");

function validCaseWithHypotheses(hypotheses) {
  return {
    schemaVersion: 1,
    verificationCycle: 1,
    diagnosticRevision: 1,
    failureClass: "VERIFICATION_FAILURE",
    observations: [],
    contributors: [],
    hypotheses,
    nextSafeAction: { statement: "fix" },
    diagnosticFingerprint: "0".repeat(64),
  };
}

test("schema enforces hypotheses.minItems = 1", async () => {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const hypothesesSchema = schema.properties?.hypotheses;
  assert.ok(hypothesesSchema, "hypotheses property present");
  assert.equal(hypothesesSchema.minItems, 1);
});

test("runtime validator rejects zero-hypothesis cases", () => {
  assert.throws(
    () => assertDiagnosticCaseDetails(validCaseWithHypotheses([])),
    (error) => error.code === "E_DIAGNOSTIC_CASE_INVALID" || error.code === "E_HYPOTHESIS_INVALID",
  );
});
