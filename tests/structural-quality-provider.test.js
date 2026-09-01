import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertStructuralQualityProvider,
  createStructuralQualityProviderRegistry,
  normalizeStructuralQualitySnapshot,
} from "../src/core/structural-quality/provider.js";
import { createForgeLoopContext } from "../src/core/runtime-context.js";

function rawSnapshot(overrides = {}) {
  return {
    quality_signal: 9000,
    root_causes: {
      modularity: { score: 9000, raw: 0.9 },
      acyclicity: { score: 8000, raw: 0.8 },
      depth: { score: 9000, raw: 0.9 },
      equality: { score: 9000, raw: 0.9 },
      redundancy: { score: 9000, raw: 0.9 },
    },
    files: 3,
    lines: 120,
    import_edges: 4,
    cross_module_edges: 2,
    ...overrides,
  };
}

test("normalizes provider scores and chooses the canonical bottleneck", () => {
  const snapshot = normalizeStructuralQualitySnapshot(rawSnapshot());
  assert.equal(snapshot.qualitySignal, 9000);
  assert.equal(snapshot.bottleneck, "acyclicity");
  assert.deepEqual(snapshot.rootCauses.acyclicity, { score: 8000, raw: 0.8 });
  assert.deepEqual(snapshot.statistics, {
    files: 3,
    lines: 120,
    importEdges: 4,
    crossModuleEdges: 2,
  });
});

test("bottleneck ties resolve in the documented canonical root-cause order", () => {
  const snapshot = normalizeStructuralQualitySnapshot(rawSnapshot({
    root_causes: {
      modularity: { score: 7000, raw: 0.7 },
      acyclicity: { score: 7000, raw: 0.7 },
      depth: { score: 9000, raw: 0.9 },
      equality: { score: 9000, raw: 0.9 },
      redundancy: { score: 9000, raw: 0.9 },
    },
  }));
  assert.equal(snapshot.bottleneck, "modularity");
});

test("normalization rejects out-of-range, non-finite, and non-canonical values", () => {
  assert.throws(
    () => normalizeStructuralQualitySnapshot(rawSnapshot({ quality_signal: 10_001 })),
    { code: "E_STRUCTURAL_QUALITY_PROVIDER_INVALID" },
  );
  assert.throws(
    () => normalizeStructuralQualitySnapshot(rawSnapshot({ root_causes: {
      modularity: { score: 9000, raw: Number.NaN },
      acyclicity: { score: 8000, raw: 0.8 },
      depth: { score: 9000, raw: 0.9 },
      equality: { score: 9000, raw: 0.9 },
      redundancy: { score: 9000, raw: 0.9 },
    } })),
    { code: "E_STRUCTURAL_QUALITY_PROVIDER_INVALID" },
  );
  assert.throws(
    () => normalizeStructuralQualitySnapshot({ ...rawSnapshot(), bottleneck: "depth" }),
    { code: "E_STRUCTURAL_QUALITY_PROVIDER_INVALID" },
  );
});

test("diagnostics are portable and reject secrets or paths outside the project", () => {
  const normalized = normalizeStructuralQualitySnapshot({
    ...rawSnapshot(),
    diagnostics: { file: "/tmp/project/src/index.js", note: "safe" },
  }, { projectPath: "/tmp/project" });
  assert.deepEqual(normalized.diagnostics, { file: "src/index.js", note: "safe" });
  assert.throws(
    () => normalizeStructuralQualitySnapshot({ ...rawSnapshot(), diagnostics: { apiToken: "secret" } }, { projectPath: "/tmp/project" }),
    { code: "E_STRUCTURAL_QUALITY_PROVIDER_INVALID" },
  );
  assert.throws(
    () => normalizeStructuralQualitySnapshot({ ...rawSnapshot(), diagnostics: { file: "/var/private/outside.js" } }, { projectPath: "/tmp/project" }),
    { code: "E_STRUCTURAL_QUALITY_PROVIDER_INVALID" },
  );
});

test("provider registry freezes inputs and enforces provider identity", async () => {
  let received;
  const provider = {
    id: "fake",
    async detect() { return { available: true, providerId: "fake", providerVersion: "1.0.0", transport: "test" }; },
    async scan() { return rawSnapshot(); },
  };
  const registry = createStructuralQualityProviderRegistry({
    providers: {
      fake: async (input) => {
        received = input;
        return provider;
      },
    },
  });
  const resolved = await registry.resolve("fake", {
    projectPath: "/tmp/project",
    taskId: "provider-task",
    timeoutMs: 1000,
    maxOutputBytes: 2048,
  });
  assert.equal(resolved, provider);
  assert.equal(Object.isFrozen(received), true);
  assert.equal(received.projectPath, "/tmp/project");
  assert.throws(() => { received.taskId = "changed"; }, TypeError);

  await assert.rejects(
    () => createStructuralQualityProviderRegistry({
      providers: { fake: { ...provider, id: "other" } },
    }).resolve("fake", { projectPath: "/tmp/project", taskId: "provider-task" }),
    { code: "E_STRUCTURAL_QUALITY_PROVIDER_INVALID" },
  );
});

test("public runtime context rejects reserved sentrux overrides", () => {
  assert.throws(
    () => createForgeLoopContext({ structuralQualityProviders: { sentrux: {} } }),
    { code: "E_STRUCTURAL_QUALITY_PROVIDER_INVALID" },
  );
  assert.doesNotThrow(() => createForgeLoopContext({ structuralQualityProviders: {
    fake: {
      id: "fake",
      detect: async () => ({}),
      scan: async () => ({}),
    },
  } }));
  assert.doesNotThrow(() => assertStructuralQualityProvider({
    id: "fake",
    detect: async () => ({}),
    scan: async () => ({}),
  }));
});
