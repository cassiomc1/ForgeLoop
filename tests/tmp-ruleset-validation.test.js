import assert from "node:assert/strict";
import { test } from "node:test";

test("temporary ruleset validation gate must block merge", () => {
	assert.equal(process.env.RULESET_VALIDATION_EXPECTED_FAILURE, "1");
});
