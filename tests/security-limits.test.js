import assert from "node:assert/strict";
import { test } from "node:test";

import { assertJsonLimits, JSON_LIMITS } from "../src/core/json-safety.js";
import { assertSecretFree, validateReceipt } from "../src/core/receipt.js";
import { getPackageRoot } from "../src/core/templates.js";

const packageRoot = getPackageRoot();
const baseReceipt = {
  schemaVersion: 1,
  protocolVersion: 1,
  taskId: "security-limits",
  contractFingerprint: "a".repeat(64),
  selectedGuides: [],
  changedPaths: [],
  checks: [],
  review: { status: "not-run", independent: false },
  limitations: [],
  publication: { committed: false, pushed: false, pullRequest: null, deployed: false },
};

test("untrusted JSON has bounded depth, arrays, strings, and bytes", () => {
  assert.throws(
    () => assertJsonLimits("x".repeat(JSON_LIMITS.maxStringLength + 1)),
    /string length/i,
  );
  assert.throws(
    () => assertJsonLimits(Array.from({ length: JSON_LIMITS.maxArrayLength + 1 }, () => null)),
    /array length/i,
  );
  let nested = null;
  for (let index = 0; index < JSON_LIMITS.maxDepth + 2; index += 1) nested = { nested };
  assert.throws(() => assertJsonLimits(nested), /depth/i);
});

test("assertJsonLimits accepts non-circular DAGs and rejects genuine circular references", () => {
  const sharedChild = { name: "shared-node", values: [1, 2, 3] };
  const dag = {
    branchA: { child: sharedChild },
    branchB: { child: sharedChild },
    list: [sharedChild, sharedChild],
  };
  assert.doesNotThrow(() => assertJsonLimits(dag));

  const circular = { name: "root" };
  circular.self = circular;
  assert.throws(() => assertJsonLimits(circular), /circular reference/i);

  const nestedCircular = { a: { b: {} } };
  nestedCircular.a.b.link = nestedCircular.a;
  assert.throws(() => assertJsonLimits(nestedCircular), /circular reference/i);
});

test("receipt validation applies resource limits before semantic scanning", async () => {
  await assert.rejects(
    () => validateReceipt({ ...baseReceipt, limitations: ["x".repeat(JSON_LIMITS.maxStringLength + 1)] }, packageRoot),
    /length|limit/i,
  );
});

test("secret scanning covers nested mixed-case fields and common token values", () => {
  assert.throws(() => assertSecretFree({ nested: [{ GitHubToken: ["ghp_", "12345678"].join("") }] }), /secret/i);
  assert.throws(() => assertSecretFree({ nested: [{ awsAccessKeyId: ["AKIA", "123456789012345678"].join("") }] }), /secret/i);
  assert.throws(() => assertSecretFree({ nested: [{ slackToken: ["xoxb-", "12345678"].join("") }] }), /secret/i);
  assert.throws(() => assertSecretFree({ nested: [{ privateKey: ["-----BEGIN RSA ", "PRIVATE KEY-----"].join("") }] }), /secret/i);
  assert.doesNotThrow(() => assertSecretFree({ nested: [{ tokenization: "safe", secretary: "safe" }] }));
  assert.doesNotThrow(() => assertSecretFree({ "credential-policy.md": "documentation" }));
});
