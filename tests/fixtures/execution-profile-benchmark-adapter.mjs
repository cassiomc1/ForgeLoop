export async function runBenchmark({ mode }) {
  const totalTokens = mode === "direct" ? 120 : mode === "forgeloopBalanced" ? 110 : 95;
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
  };
}
