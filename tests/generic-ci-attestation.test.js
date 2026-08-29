import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("generic CI integration delegates to the provider-neutral complete-coverage command", async () => {
  const script = await readFile(path.resolve("integrations/generic-ci/verify.sh"), "utf8");
  assert.match(script, /FORGELOOP_REVISION_PROVIDER/);
  assert.match(script, /FORGELOOP_BASE_REVISION/);
  assert.match(script, /FORGELOOP_HEAD_REVISION/);
  assert.match(script, /attestation-verify-range/);
  assert.match(script, /--require-complete-coverage/);
  assert.match(script, /--json/);
  assert.doesNotMatch(script, /github|gitlab|circleci/iu);
});
