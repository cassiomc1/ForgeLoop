import { evaluateRoute } from "../../src/core/router.js";

export async function runBenchmark({ mode, scenario }) {
  const totalTokens = mode === "direct" ? 120 : mode === "forgeloopBalanced" ? 110 : 95;
  const resolvedProfile = mode === "direct"
    ? null
    : evaluateRoute(scenario.input, {
      requestedProfile: mode === "forgeloopBalanced" ? "balanced" : "auto",
    }).executionProfile.resolved;
  return {
    usage: {
      inputTokens: Math.floor(totalTokens / 2),
      outputTokens: totalTokens - Math.floor(totalTokens / 2),
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens,
      costUsd: 0,
      model: "fixture-model",
      provider: "fixture-provider",
      source: "HOST_REPORTED",
    },
    promptSpecFingerprint: "fixture-prompt-spec-v1",
    verification: "PASS",
    verificationCycles: 1,
    comparableSteps: 4,
    contextUsage: {
      source: "UNKNOWN",
      profile: resolvedProfile,
      items: {
        taskContext: null,
        guides: null,
        history: null,
        protocolInstructions: null,
        repositoryContext: null,
        other: null,
      },
    },
  };
}

export async function finalizeBenchmark({ records }) {
  const qualityByRunId = {};
  for (const record of records) {
    if (!record.scenario.input.surfaces.includes("ui")) continue;
    qualityByRunId[record.runId] = {
      source: "EXTERNAL_REPORTED",
      scores: {
        visualQuality: 4,
        responsiveQuality: 4,
        accessibility: 4,
        interactionPolish: 4,
        requirementsCompleteness: 4,
      },
    };
  }
  return {
    qualityByRunId,
    summary: { status: "MEASURED", recordCount: records.length },
  };
}
