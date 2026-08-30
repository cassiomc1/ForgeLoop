import { readWorkState } from "../core/work-state.js";
import { normalizeUsage, writeTaskUsage } from "../core/usage.js";
import { appendProtocolEvent } from "../core/events.js";
import { withTaskMutation } from "../core/task-command.js";

export async function runUsageRecord({
  target,
  packageRoot,
  taskId,
  provider = null,
  model = null,
  inputTokens = null,
  outputTokens = null,
  cacheReadTokens = null,
  cacheWriteTokens = null,
  totalTokens = null,
  costUsd = null,
  source = "ACTOR_REPORTED",
} = {}) {
  if (source !== "ACTOR_REPORTED") {
    const error = new Error("usage-record accepts only ACTOR_REPORTED; provider and host reports must cross the trusted integration boundary");
    error.code = "E_USAGE_SOURCE_INVALID";
    throw error;
  }
  return withTaskMutation(target, { taskId, packageRoot }, "usage-record", async (ctx) => {
    const effectiveTaskId = ctx.taskId;
    const usage = normalizeUsage({
      provider,
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      totalTokens,
      costUsd,
      source,
    }, { allowedSources: ["ACTOR_REPORTED"] });
    const state = await readWorkState(target, { packageRoot, taskId: effectiveTaskId });
    const artifact = await writeTaskUsage(target, packageRoot, {
      taskId: effectiveTaskId,
      usage,
      recordedAt: new Date().toISOString(),
    });
    await appendProtocolEvent(target, {
      taskId: effectiveTaskId,
      event: "USAGE_RECORDED",
      details: {
        source: usage.source,
        fields: Object.keys(usage).filter((key) => usage[key] !== null && key !== "source").sort(),
        verificationCycle: state?.verificationCycle ?? null,
        usageArtifact: artifact.path,
      },
    }, packageRoot, { taskId: effectiveTaskId });
    return { taskId: effectiveTaskId, path: artifact.path, usage: artifact.value.usage, recordedAt: artifact.value.recordedAt };
  });
}

export function formatUsageRecordResult(result) {
  return `Usage recorded: ${result.path}\nSource: ${result.usage.source}\nTotal tokens: ${result.usage.totalTokens ?? "unknown"}\n`;
}

