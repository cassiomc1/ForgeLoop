import { evaluateRoute } from "../../src/core/router.js";

export async function runBenchmark({ mode, scenario }) {
  const totalTokens = mode === "direct" ? 120 : mode === "forgeloopBalanced" ? 110 : 95;
  const contextTokens = mode === "direct" ? 100 : mode === "forgeloopBalanced" ? 80 : 60;
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
    diagnostics: {
      executionProfile: resolvedProfile,
      verificationCycles: 1,
      modelTurns: mode === "forgeloopAdaptive" ? 2 : 3,
      toolCalls: 2,
      retries: 0,
      correctionCycles: 0,
      filesRead: 2,
      filesWritten: 1,
      contextRefreshes: 0,
      guideCount: mode === "direct" ? 0 : 1,
      guideIds: mode === "direct" ? [] : ["fixture-guide"],
      hostWarnings: [],
      terminationReason: "COMPLETED",
      flags: [],
    },
    contextUsage: {
      source: "HOST_REPORTED",
      profile: resolvedProfile,
      items: {
        taskContext: contextTokens,
        guides: 0,
        history: 0,
        protocolInstructions: 0,
        repositoryContext: 0,
        other: 0,
      },
    },
  };
}
