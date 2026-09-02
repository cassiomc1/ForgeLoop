import assert from "node:assert/strict";
import test from "node:test";

import { createForgeLoopContext } from "../src/core/runtime-context.js";
import { recallAdvisoryContext } from "../src/core/advisory-context/service.js";
import {
  E_ADVISORY_CONTEXT_PROVIDER_UNAVAILABLE,
  E_ADVISORY_CONTEXT_QUERY_INVALID,
  E_ADVISORY_CONTEXT_TIMEOUT,
  E_ADVISORY_CONTEXT_OUTPUT_LIMIT,
  E_PORTABLE_CONTEXT_INVALID,
} from "../src/core/error-codes.js";

test("throws E_ADVISORY_CONTEXT_PROVIDER_UNAVAILABLE when provider is not configured", async () => {
  const runtimeContext = createForgeLoopContext();

  await assert.rejects(
    () => recallAdvisoryContext({
      target: ".",
      taskId: "task-1",
      providerName: "unconfigured-memory",
      query: "auth design",
      runtimeContext,
    }),
    (err) => err.code === E_ADVISORY_CONTEXT_PROVIDER_UNAVAILABLE,
  );
});

test("unsafe query is rejected before provider invocation", async () => {
  let calls = 0;

  const runtimeContext = createForgeLoopContext({
    advisoryContextProviders: {
      "test-memory": {
        id: "test-memory",
        async recall() {
          calls += 1;
          return { items: [] };
        },
      },
    },
  });

  await assert.rejects(
    recallAdvisoryContext({
      target: ".",
      taskId: "task-1",
      providerName: "test-memory",
      query: "authorization: Bearer secret-token",
      runtimeContext,
    }),
    (error) => error.code === E_ADVISORY_CONTEXT_QUERY_INVALID
      || error.code === E_PORTABLE_CONTEXT_INVALID,
  );

  assert.equal(calls, 0);
});

test("control characters in query are rejected before provider invocation", async () => {
  let calls = 0;

  const runtimeContext = createForgeLoopContext({
    advisoryContextProviders: {
      "test-memory": {
        id: "test-memory",
        async recall() {
          calls += 1;
          return { items: [] };
        },
      },
    },
  });

  await assert.rejects(
    recallAdvisoryContext({
      target: ".",
      taskId: "task-1",
      providerName: "test-memory",
      query: "bad\u0000query",
      runtimeContext,
    }),
    (error) => error.code === E_ADVISORY_CONTEXT_QUERY_INVALID
      || error.code === E_PORTABLE_CONTEXT_INVALID,
  );

  assert.equal(calls, 0);
});

test("slow provider recall times out", async () => {
  const runtimeContext = createForgeLoopContext({
    advisoryContextProviders: {
      "slow-memory": {
        id: "slow-memory",
        recall() {
          return new Promise((resolve) => setTimeout(resolve, 500));
        },
      },
    },
  });

  await assert.rejects(
    () => recallAdvisoryContext({
      target: ".",
      taskId: "task-1",
      providerName: "slow-memory",
      query: "timeout test",
      timeoutMs: 50,
      runtimeContext,
    }),
    (err) => err.code === E_ADVISORY_CONTEXT_TIMEOUT,
  );
});

test("successful recall returns normalized advisory result", async () => {
  const runtimeContext = createForgeLoopContext({
    advisoryContextProviders: {
      "ai-memory": {
        id: "ai-memory",
        version: "1.2.0",
        async recall(input) {
          assert.equal(input.query, "refresh tokens");
          assert.equal(input.taskId, "task-1");
          return {
            items: [
              {
                title: "Auth Design",
                summary: "Decided to use rotating refresh tokens.",
                sourceRef: "docs/auth.md",
                confidence: 0.95,
              },
            ],
          };
        },
      },
    },
  });

  const result = await recallAdvisoryContext({
    target: ".",
    taskId: "task-1",
    providerName: "ai-memory",
    query: "refresh tokens",
    runtimeContext,
  });

  assert.equal(result.authority, "ADVISORY");
  assert.equal(result.evidenceAuthority, "NONE");
  assert.equal(result.actionability, "NON_EXECUTABLE");
  assert.equal(result.trustRole, "NON_EVIDENCE_ADVISORY_CONTEXT");
  assert.equal(result.persisted, false);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, "Auth Design");
  assert.match(result.items[0].itemFingerprint, /^[a-f0-9]{64}$/);
});

test("oversized provider output throws E_ADVISORY_CONTEXT_OUTPUT_LIMIT", async () => {
  const runtimeContext = createForgeLoopContext({
    advisoryContextProviders: {
      "verbose-memory": {
        id: "verbose-memory",
        async recall() {
          return {
            items: Array.from({ length: 15 }, (_, i) => ({
              summary: "x".repeat(1000),
            })),
          };
        },
      },
    },
  });

  await assert.rejects(
    () => recallAdvisoryContext({
      target: ".",
      taskId: "task-1",
      providerName: "verbose-memory",
      query: "verbose query",
      limit: 20,
      maxTotalChars: 5000,
      runtimeContext,
    }),
    (err) => err.code === E_ADVISORY_CONTEXT_OUTPUT_LIMIT,
  );
});
