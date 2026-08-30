import { buildTaskTrace } from "./trace.js";
import { buildTaskReflection } from "./reflection.js";
import { readPersistedRoute } from "./route-artifact.js";
import { providerUsage, readTaskUsage, unknownUsage } from "./usage.js";
import { projectExecutionProfile } from "./execution-profile.js";

export const COMPARABLE_WORK_EVENTS = new Set([
  "EXECUTION_STARTED", "VERIFICATION_RECORDED", "DIAGNOSTIC_CASE_RECORDED",
  "INTERVENTION_RECORDED", "ACTION_STARTED", "ACTION_RECONCILED", "REVIEW_STARTED",
]);

export async function buildTrajectoryMetrics({ target, packageRoot, taskId, runtimeContext = null }) {
  const trace = await buildTaskTrace({ target, packageRoot, taskId });
  const reflection = await buildTaskReflection({ target, packageRoot, taskId });
  const events = trace.events;
  const verificationCycles = new Set(events.filter((event) => event.type === "VERIFICATION_STARTED")
    .map((event) => event.data?.verificationCycle).filter(Number.isInteger));
  const diagnosticCycles = new Set(trace.diagnostics.cases.map((item) => item.verificationCycle));
  const firstEventAt = events.find((event) => event.timestampQuality === "authoritative")?.timestamp ?? null;
  const lastEventAt = [...events].reverse().find((event) => event.timestampQuality === "authoritative")?.timestamp ?? null;
  const firstMs = firstEventAt ? Date.parse(firstEventAt) : NaN;
  const lastMs = lastEventAt ? Date.parse(lastEventAt) : NaN;
  const interventions = reflection.interventions ?? { count: 0, informative: 0, nonInformative: 0 };
  let executionProfile = null;
  try {
    const route = await readPersistedRoute(target, packageRoot, { taskId });
    executionProfile = projectExecutionProfile(route.value);
  } catch {
    // Legacy tasks and incomplete task namespaces may not have a route.
  }
  let usage = await readTaskUsage(target, packageRoot, taskId);
  const usageProvider = runtimeContext?.usageProvider;
  if (usageProvider && typeof usageProvider.getTaskUsage === "function") {
    usage = providerUsage(await usageProvider.getTaskUsage({ projectPath: target, taskId }));
  }
  return {
    schemaVersion: 1,
    taskId,
    completion: {
      validated: Boolean(trace.completion.validatedAt),
      phase: trace.task.phase,
    },
    trajectory: {
      events: events.length,
      verificationCycles: verificationCycles.size,
      diagnosticCycles: diagnosticCycles.size,
      strategyChanges: Math.max(0, (reflection.strategies?.length ?? 0) - 1),
      oscillationDetected: Boolean(reflection.oscillation?.detected),
      noEffectiveInformationGainCycles: reflection.informationGain?.cyclesWithoutEffectiveGain?.length ?? 0,
      interventions: {
        total: interventions.count ?? 0,
        informative: interventions.informative ?? 0,
        nonInformative: interventions.nonInformative ?? 0,
      },
    },
    actions: {
      total: trace.actions?.total ?? 0,
      verified: trace.actions?.verified ?? 0,
      // Canonical trust counts come from the action-readiness projection;
      // raw VERIFIED labels are observability only.
      trustedSatisfied: await (async () => {
        try {
          const { evaluateRequiredActionReadiness } = await import("./action-readiness.js");
          const readiness = await evaluateRequiredActionReadiness({ target, packageRoot, taskId });
          return readiness.satisfied;
        } catch {
          return null;
        }
      })(),
      unresolvedRequired: await (async () => {
        try {
          const { evaluateRequiredActionReadiness } = await import("./action-readiness.js");
          const readiness = await evaluateRequiredActionReadiness({ target, packageRoot, taskId });
          return readiness.unresolved;
        } catch {
          return null;
        }
      })(),
      failed: trace.actions?.failed ?? 0,
      ambiguous: trace.actions?.ambiguous ?? 0,
      reconciliations: trace.actions?.reconciliationCount ?? 0,
    },
    executions: {
      observedCommands: trace.executions.length,
      failedCommands: trace.executions.filter((execution) => execution.status === "failed").length,
    },
    timing: {
      firstEventAt,
      lastEventAt,
      wallClockMs: Number.isFinite(firstMs) && Number.isFinite(lastMs) ? Math.max(0, lastMs - firstMs) : null,
    },
    executionProfile,
    usage: usage ?? unknownUsage(),
    comparableSteps: events.filter((event) => COMPARABLE_WORK_EVENTS.has(event.type)).length,
  };
}
