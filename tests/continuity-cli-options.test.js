import assert from "node:assert/strict";
import { test } from "node:test";

import {
  continuityOptionDefaults,
  consumeContinuityOption,
  validateContinuityOptions,
} from "../src/core/continuity-cli-options.js";

function parse(values) {
  const options = continuityOptionDefaults();
  for (let index = 0; index < values.length; index += 1) {
    const parsed = consumeContinuityOption({ argument: values[index], argv: values, index, options });
    assert.equal(parsed.handled, true, values[index]);
    index = parsed.index;
  }
  return options;
}

test("continuity CLI options parse repeatable operational context", () => {
  const options = parse([
    "--focus-id", "mobile-nav",
    "--focus-summary", "Finish mobile navigation",
    "--remaining", "contact:Finish contact form",
    "--remaining", "responsive:Finish responsive pass",
    "--known-issue", "overflow:Fix mobile overflow",
    "--changed-area", "src/components",
    "--inspect-first", "src/components/Header.jsx",
    "--resume-note", "Inspect the current diff before continuing",
  ]);
  assert.equal(options.continuityFocusId, "mobile-nav");
  assert.equal(options.continuityFocusSummary, "Finish mobile navigation");
  assert.equal(options.continuityRemaining.length, 2);
  assert.equal(options.continuityKnownIssues.length, 1);
  assert.deepEqual(options.continuityChangedAreas, ["src/components"]);
  assert.deepEqual(options.continuityInspectFirst, ["src/components/Header.jsx"]);
  assert.match(options.continuityResumeNote, /current diff/);
  assert.doesNotThrow(() => validateContinuityOptions("record-continuity", options));
});

test("continuity CLI options reject missing values and wrong command", () => {
  const options = continuityOptionDefaults();
  assert.throws(() => consumeContinuityOption({ argument: "--remaining", argv: ["--remaining"], index: 0, options }), /requires a value/);
  options.continuityRemaining.push("x:y");
  assert.throws(() => validateContinuityOptions("status", options), /not valid for status/);
});

test("record-continuity requires focus id and summary together", () => {
  const options = continuityOptionDefaults();
  options.continuityFocusId = "mobile-nav";
  assert.throws(() => validateContinuityOptions("record-continuity", options), /together/);
});
