import assert from "node:assert/strict";
import { test } from "node:test";

import { formatStatusResult } from "../src/commands/status.js";

test("status formats lifecycle pending separately from implementation continuity", () => {
  const text = formatStatusResult({
    path: ".forgeloop/work-state.json",
    status: "FRESH",
    phase: "EXECUTING",
    completed: ["contract", "route", "planning"],
    pending: ["implementation", "verification"],
    reasons: [], warnings: [], contractComparison: "MATCH", artifactComparison: "MATCH",
    protocol: { status: "valid" },
    continuity: {
      classification: "FRESH",
      continuity: {
        currentFocus: { id: "mobile-nav", summary: "Finish nav" },
        remainingWork: [{ id: "contact", summary: "Finish contact" }],
        knownIssues: [{ id: "overflow", summary: "Fix overflow" }],
      },
      authority: "OPERATIONAL_CONTEXT_ONLY",
    },
  });
  assert.match(text, /Pending: implementation, verification/);
  assert.match(text, /Continuity: FRESH/);
  assert.match(text, /Continuity focus: mobile-nav/);
  assert.match(text, /Continuity remaining: 1/);
  assert.match(text, /Continuity authority: OPERATIONAL_CONTEXT_ONLY/);
  assert.doesNotMatch(text, /Pending: contact/);
});
