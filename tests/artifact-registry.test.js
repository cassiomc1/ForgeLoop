import test from "node:test";
import assert from "node:assert/strict";

import { ARTIFACT_REGISTRY } from "../src/core/artifact-registry.js";
import { SHIPPED_SCHEMA_NAMES, readSchema, validateSchema } from "../src/core/schema-validation.js";

test("registry declares durable action artifacts with protocol ownership", () => {
  const expected = {
    actions: {
      scope: "TASK",
      owner: "PROTOCOL_MANAGED",
      mutability: "STATE_MACHINE_TRANSITIONS",
      trustRole: "EXTERNAL_ACTION_PROVENANCE",
      schema: "action",
    },
    approvals: {
      scope: "TASK",
      owner: "PROTOCOL_MANAGED",
      mutability: "APPEND_DECISION_ONCE",
      trustRole: "ACTION_APPROVAL_ATTESTATION",
      schema: "approval",
    },
    capabilityPolicy: {
      scope: "PROJECT",
      owner: "OPERATOR_OR_AGENT",
      mutability: "MUTABLE_CONFIGURATION",
      trustRole: "CAPABILITY_POLICY_SPECIFICATION",
      schema: "capability-policy",
    },
    evaluations: {
      scope: "TASK",
      owner: "PROTOCOL_COMPILED",
      mutability: "IMMUTABLE_ONCE_WRITTEN",
      trustRole: "TRAJECTORY_EVALUATION",
      schema: "trajectory-evaluation",
    },
  };

  for (const [key, meta] of Object.entries(expected)) {
    assert.ok(ARTIFACT_REGISTRY[key], `${key} registered`);
    for (const [field, value] of Object.entries(meta)) {
      assert.equal(ARTIFACT_REGISTRY[key][field], value, `${key}.${field}`);
    }
    assert.equal(ARTIFACT_REGISTRY[key].isPublic, true);
    assert.equal(ARTIFACT_REGISTRY[key].isPersisted, true);
  }
});

test("capability policy is classified as policy specification, not host authority", () => {
  const entry = ARTIFACT_REGISTRY.capabilityPolicy;
  assert.notEqual(entry.trustRole, "HOST_AUTHORITY");
  assert.match(entry.description ?? "", /.*/);
});

test("new schemas ship in the shipped-schema registry and validate fixtures", async () => {
  for (const name of [
    "action",
    "approval",
    "capability-policy",
    "trajectory-evaluation",
    "trajectory-scenario",
  ]) {
    assert.ok(SHIPPED_SCHEMA_NAMES.includes(name), `${name} in SHIPPED_SCHEMA_NAMES`);
    const schema = await readSchema(name);
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  }

  const actionSchema = await readSchema("action");
  assert.deepEqual(
    validateSchema({ schemaVersion: 2 }, actionSchema).length > 0,
    true,
    "schema rejects wrong schemaVersion",
  );
});
