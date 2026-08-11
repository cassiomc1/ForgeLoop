import assert from "node:assert/strict";
import { test } from "node:test";

import {
  WORK_PHASES,
  WORK_TRANSITIONS,
  isValidTransition,
} from "../src/core/protocol.js";

test("the canonical transition matrix accepts every legal edge", () => {
  for (const [from, destinations] of Object.entries(WORK_TRANSITIONS)) {
    for (const to of destinations) assert.equal(isValidTransition(from, to), true, `${from} -> ${to}`);
    if (from !== "COMPLETE" && from !== "BLOCKED") assert.equal(isValidTransition(from, "BLOCKED"), true, `${from} -> BLOCKED`);
  }
});

test("the canonical transition matrix rejects every illegal edge and same-phase retry", () => {
  for (const from of WORK_PHASES) {
    assert.equal(isValidTransition(from, from), false, `${from} -> ${from}`);
    for (const to of WORK_PHASES) {
      if (WORK_TRANSITIONS[from].includes(to) || (to === "BLOCKED" && from !== "COMPLETE")) continue;
      assert.equal(isValidTransition(from, to), false, `${from} -> ${to}`);
    }
  }
});
