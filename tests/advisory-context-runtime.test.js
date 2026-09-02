import assert from "node:assert/strict";
import test from "node:test";

import { createForgeLoopContext } from "../src/core/runtime-context.js";
import { E_ADVISORY_CONTEXT_PROVIDER_INVALID } from "../src/core/error-codes.js";

test("runtime context registration rejects invalid provider configurations", () => {
  assert.throws(
    () => createForgeLoopContext({ advisoryContextProviders: ["not-an-object"] }),
    (err) => err.code === E_ADVISORY_CONTEXT_PROVIDER_INVALID,
  );

  assert.throws(
    () => createForgeLoopContext({ advisoryContextProviders: "invalid" }),
    (err) => err.code === E_ADVISORY_CONTEXT_PROVIDER_INVALID,
  );

  assert.throws(
    () => createForgeLoopContext({ advisoryContextProviders: { "INVALID_ID": {} } }),
    (err) => err.code === E_ADVISORY_CONTEXT_PROVIDER_INVALID,
  );

  assert.throws(
    () => createForgeLoopContext({ advisoryContextProviders: { "valid-id": 123 } }),
    (err) => err.code === E_ADVISORY_CONTEXT_PROVIDER_INVALID,
  );
});

test("runtime context registration does not call advisory provider", () => {
  let calls = 0;

  const context = createForgeLoopContext({
    advisoryContextProviders: {
      "test-memory": {
        id: "test-memory",
        recall() {
          calls += 1;
          return { items: [] };
        },
      },
    },
  });

  assert.ok(context.advisoryContextProviders["test-memory"]);
  assert.equal(calls, 0);
});

test("runtime context rejects direct providers whose identity differs from the registry key", () => {
  assert.throws(
    () => createForgeLoopContext({
      advisoryContextProviders: {
        requested: {
          id: "different-provider",
          recall() {},
        },
      },
    }),
    (err) => err.code === E_ADVISORY_CONTEXT_PROVIDER_INVALID,
  );
});

test("runtime context accepts Map of providers", () => {
  const providersMap = new Map([
    ["mem-1", { id: "mem-1", recall() {} }],
  ]);

  const context = createForgeLoopContext({
    advisoryContextProviders: providersMap,
  });

  assert.ok(context.advisoryContextProviders["mem-1"]);
});
