import { canonicalFingerprint } from "./artifacts.js";
import { readContract } from "./contract.js";
import { readPersistedRoute } from "./route-artifact.js";
import { readWorkState } from "./work-state.js";
import { readCanonicalHandoff } from "./handoff.js";
import { appendProtocolEvent, validateEventLedger } from "./events.js";
import { currentChangedPaths } from "./repository.js";
import { withTaskTransaction } from "./transaction.js";
import { getPackageRoot } from "./templates.js";
import {
  normalizePortableText,
  assertPortableContextSafe,
} from "./portable-context.js";
import {
  E_HANDOFF_ACCEPTANCE_UNBOUND,
  E_HANDOFF_STALE,
  E_HANDOFF_ALREADY_ACCEPTED,
  E_HANDOFF_ACCEPTANCE_INCONSISTENT,
} from "./error-codes.js";

function acceptanceError(code, message) {
  const error = new Error(message);
  error.name = "HandoffAcceptanceError";
  error.code = code;
  return error;
}

export function resolveHandoffAcceptance(events, handoff) {
  if (!handoff?.state?.workStateFingerprint) {
    return { status: "UNBOUND" };
  }

  const acceptedEvents = (events ?? []).filter(
    (e) => e.event === "HANDOFF_ACCEPTED" && e.details?.handoffId === handoff.handoffId,
  );

  if (acceptedEvents.length === 0) {
    return { status: "OPEN" };
  }

  if (acceptedEvents.length > 1) {
    return { status: "INCONSISTENT" };
  }

  const accepted = acceptedEvents[0];
  if (accepted.details?.handoffDigest !== handoff.artifactDigest) {
    return { status: "INCONSISTENT" };
  }

  return {
    status: "ACCEPTED",
    consumerId: accepted.details?.consumerId,
    ...(accepted.details?.harness ? { harness: accepted.details.harness } : {}),
    acceptedAt: accepted.at,
  };
}

export async function acceptCanonicalHandoff(target, {
  taskId,
  handoffId,
  consumerId,
  harness,
  packageRoot = getPackageRoot(),
} = {}) {
  if (!target || typeof target !== "string") {
    throw acceptanceError("E_TARGET_REQUIRED", "target path is required");
  }
  if (!taskId || typeof taskId !== "string") {
    throw acceptanceError("E_TASK_REQUIRED", "taskId is required");
  }
  if (!handoffId || typeof handoffId !== "string") {
    throw acceptanceError("E_HANDOFF_INVALID", "handoffId is required");
  }

  const normalizedConsumerId = normalizePortableText(consumerId, {
    label: "consumerId",
    maxLength: 128,
  });
  assertPortableContextSafe(normalizedConsumerId, { label: "consumerId" });

  const normalizedHarness = harness !== undefined
    ? normalizePortableText(harness, {
      label: "harness",
      maxLength: 64,
      optional: true,
    })
    : null;
  if (normalizedHarness) {
    assertPortableContextSafe(normalizedHarness, { label: "harness" });
  }

  return withTaskTransaction(
    {
      target,
      taskId,
      packageRoot,
      operation: "handoff-accept",
      recordCommitEvent: true,
    },
    async () => {
      const { value: handoff } = await readCanonicalHandoff(target, {
        taskId,
        handoffId,
        packageRoot,
      });

      if (!handoff.state?.workStateFingerprint) {
        throw acceptanceError(
          E_HANDOFF_ACCEPTANCE_UNBOUND,
          "Handoff snapshot is unbound (lacks state.workStateFingerprint); create a fresh handoff",
        );
      }

      const currentState = await readWorkState(target, { packageRoot, taskId });
      if (!currentState) {
        throw acceptanceError(
          E_HANDOFF_STALE,
          "Canonical work state is unavailable for handoff acceptance",
        );
      }

      const currentWorkStateFingerprint = canonicalFingerprint(currentState);
      if (currentWorkStateFingerprint !== handoff.state.workStateFingerprint) {
        throw acceptanceError(
          E_HANDOFF_STALE,
          "Current work state has drifted from handoff workStateFingerprint",
        );
      }

      const contract = await readContract(target, packageRoot, { taskId });
      if (contract.fingerprint !== handoff.state.contractFingerprint) {
        throw acceptanceError(
          E_HANDOFF_STALE,
          "Current contract fingerprint has drifted from handoff contractFingerprint",
        );
      }

      const route = await readPersistedRoute(target, packageRoot, { taskId });
      if ((route.fingerprint ?? null) !== (handoff.state.routeFingerprint ?? null)) {
        throw acceptanceError(
          E_HANDOFF_STALE,
          "Current route fingerprint has drifted from handoff routeFingerprint",
        );
      }

      if (
        currentState.repositoryFingerprint?.head
        && handoff.state.repositoryFingerprint?.head
        && currentState.repositoryFingerprint.head !== handoff.state.repositoryFingerprint.head
      ) {
        throw acceptanceError(
          E_HANDOFF_STALE,
          "Current repository HEAD has drifted from handoff snapshot",
        );
      }

      const changedPaths = await currentChangedPaths(target);
      const currentList = [...new Set((changedPaths ?? []).map((p) => p.replaceAll("\\", "/")))].sort();
      const handoffList = [...new Set((handoff.state.changedPaths ?? []).map((p) => p.replaceAll("\\", "/")))].sort();
      if (JSON.stringify(currentList) !== JSON.stringify(handoffList)) {
        throw acceptanceError(
          E_HANDOFF_STALE,
          "Current changed paths have drifted from handoff snapshot",
        );
      }

      const ledgerResult = await validateEventLedger(target, packageRoot, { taskId });
      if (!ledgerResult.valid) {
        throw acceptanceError(
          E_HANDOFF_ACCEPTANCE_INCONSISTENT,
          "Task event ledger is invalid",
        );
      }

      const events = ledgerResult.events;
      const createdEvent = events.find(
        (e) => e.event === "HANDOFF_CREATED" && e.details?.handoffId === handoffId,
      );
      if (!createdEvent || createdEvent.details?.digest !== handoff.artifactDigest) {
        throw acceptanceError(
          E_HANDOFF_ACCEPTANCE_INCONSISTENT,
          "No matching HANDOFF_CREATED event with matching digest found in ledger",
        );
      }

      const existingAccepted = events.filter(
        (e) => e.event === "HANDOFF_ACCEPTED" && e.details?.handoffId === handoffId,
      );

      if (existingAccepted.length > 0) {
        const prev = existingAccepted[0];
        if (prev.details?.consumerId === normalizedConsumerId) {
          return {
            accepted: true,
            idempotent: true,
            handoffId,
            consumerId: normalizedConsumerId,
            harness: prev.details?.harness ?? null,
            acceptedAt: prev.at,
          };
        }
        throw acceptanceError(
          E_HANDOFF_ALREADY_ACCEPTED,
          `Handoff ${handoffId} has already been accepted by consumer "${prev.details?.consumerId}"`,
        );
      }

      const eventDetails = {
        handoffId,
        handoffDigest: handoff.artifactDigest,
        consumerId: normalizedConsumerId,
        ...(normalizedHarness ? { harness: normalizedHarness } : {}),
      };

      const appended = await appendProtocolEvent(
        target,
        {
          taskId,
          event: "HANDOFF_ACCEPTED",
          details: eventDetails,
        },
        packageRoot,
        { taskId },
      );

      return {
        accepted: true,
        idempotent: false,
        handoffId,
        consumerId: normalizedConsumerId,
        harness: normalizedHarness ?? null,
        acceptedAt: appended.at,
      };
    },
  );
}
