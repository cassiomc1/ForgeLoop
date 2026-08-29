import assert from "node:assert/strict";
import { test } from "node:test";

import { validateResponsibilityScope } from "../src/core/responsibility.js";

test("active responsibility scope rejects unsafe and out-of-scope changes", () => {
  const responsibility = { allowedPaths: ["src"], readOnlyPaths: ["src/generated"] };
  assert.equal(validateResponsibilityScope(responsibility, ["src/auth.js"]).length, 0);
  assert.equal(validateResponsibilityScope(responsibility, ["src/generated/schema.js"])[0].code, "E_RESPONSIBILITY_SCOPE_VIOLATION");
  assert.equal(validateResponsibilityScope({ allowedPaths: ["."], readOnlyPaths: [] }, ["../outside"])[0].code, "E_RESPONSIBILITY_SCOPE_VIOLATION");
  assert.equal(validateResponsibilityScope(responsibility, null)[0].code, "E_RESPONSIBILITY_SCOPE_VIOLATION");
});
