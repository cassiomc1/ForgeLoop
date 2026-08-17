import path from "node:path";
import {
  E_TASK_CHANGE_OUTSIDE_SCOPE,
  E_TASK_DESCRIPTOR_INVALID,
  E_TASK_SCOPE_CONFLICT,
  E_TASK_SCOPE_DIRTY,
  E_TASK_SCOPE_FROZEN,
} from "./error-codes.js";
import { currentChangedPaths } from "./repository.js";

const FROZEN_PHASES = new Set([
  "EXECUTING",
  "VERIFYING",
  "DIAGNOSING",
  "CORRECTING",
  "REVIEWING",
  "COMPLETE",
]);

export function normalizeWriteClaim(claim) {
  if (typeof claim !== "string" || claim.trim() === "") {
    const error = new Error("Write claim must be a non-empty string");
    error.code = E_TASK_DESCRIPTOR_INVALID;
    throw error;
  }

  const portable = claim.trim().replaceAll("\\", "/");
  if (portable.startsWith("/") || /^[A-Za-z]:\//.test(portable)) {
    const error = new Error(`Write claim must remain relative: ${claim}`);
    error.code = E_TASK_DESCRIPTOR_INVALID;
    throw error;
  }

  const normalized = path.posix.normalize(portable);
  if (normalized === ".." || normalized.startsWith("../")) {
    const error = new Error(`Write claim escapes project directory: ${claim}`);
    error.code = E_TASK_DESCRIPTOR_INVALID;
    throw error;
  }

  if (normalized === "." || normalized === "./") {
    return ".";
  }

  return normalized.replace(/^\.\//, "").replace(/\/+$/, "");
}

export function normalizeWriteClaims(claims) {
  if (claims === undefined || claims === null) {
    return [];
  }
  if (!Array.isArray(claims)) {
    const error = new Error("writeClaims must be an array of string prefixes");
    error.code = E_TASK_DESCRIPTOR_INVALID;
    throw error;
  }

  const normalized = claims.map((c) => normalizeWriteClaim(c));
  const unique = [...new Set(normalized)];
  return unique.sort((a, b) => a.localeCompare(b));
}

export function claimsOverlap(claimA, claimB) {
  const normA = normalizeWriteClaim(claimA).toLowerCase();
  const normB = normalizeWriteClaim(claimB).toLowerCase();

  if (normA === "." || normB === ".") {
    return true;
  }

  if (normA === normB) {
    return true;
  }

  if (normA.startsWith(`${normB}/`)) {
    return true;
  }

  if (normB.startsWith(`${normA}/`)) {
    return true;
  }

  return false;
}

export function checkScopeConflicts(newClaims, existingTasks = [], currentTaskId = null) {
  const normalizedNew = normalizeWriteClaims(newClaims);
  if (normalizedNew.length === 0) return [];

  const conflicts = [];
  for (const task of existingTasks) {
    if (task.taskId === currentTaskId) continue;
    // Only non-COMPLETE tasks hold active write claims
    if (task.phase === "COMPLETE") continue;

    const taskClaims = normalizeWriteClaims(task.writeClaims ?? task.descriptor?.writeClaims ?? []);
    for (const newClaim of normalizedNew) {
      for (const existingClaim of taskClaims) {
        if (claimsOverlap(newClaim, existingClaim)) {
          conflicts.push({
            taskId: task.taskId,
            phase: task.phase,
            conflictingClaim: existingClaim,
            requestedClaim: newClaim,
          });
        }
      }
    }
  }

  return conflicts;
}

export function assertNoScopeConflicts(newClaims, existingTasks = [], currentTaskId = null) {
  const conflicts = checkScopeConflicts(newClaims, existingTasks, currentTaskId);
  if (conflicts.length > 0) {
    const first = conflicts[0];
    const error = new Error(
      `Task write claim "${first.requestedClaim}" conflicts with active task "${first.taskId}" (claim "${first.conflictingClaim}", phase: ${first.phase ?? "PLANNED"})`,
    );
    error.code = E_TASK_SCOPE_CONFLICT;
    error.conflicts = conflicts;
    throw error;
  }
}

export async function assertScopeClean(target, claims) {
  const normalized = normalizeWriteClaims(claims);
  if (normalized.length === 0) return;

  const changed = await currentChangedPaths(target, { paths: normalized });
  if (changed !== null && changed.length > 0) {
    const error = new Error(
      `Claimed scope contains pre-existing uncommitted changes: ${changed.slice(0, 5).join(", ")}${changed.length > 5 ? "..." : ""}`,
    );
    error.code = E_TASK_SCOPE_DIRTY;
    error.changedPaths = changed;
    throw error;
  }
}

export function assertScopeNotFrozen(phase) {
  if (phase && FROZEN_PHASES.has(phase)) {
    const error = new Error(
      `Task scope cannot be modified once execution lifecycle has started (current phase: ${phase})`,
    );
    error.code = E_TASK_SCOPE_FROZEN;
    throw error;
  }
}

export function assertClaimsCoverChangedPaths(claims, changedPaths) {
  const normalizedClaims = normalizeWriteClaims(claims);
  if (normalizedClaims.length === 0) return;

  // Root claim covers everything
  if (normalizedClaims.includes(".")) return;

  const outOfScope = [];
  for (const changedPath of changedPaths ?? []) {
    const normPath = changedPath.replaceAll("\\", "/").replace(/^\.\//, "").toLowerCase();
    const covered = normalizedClaims.some((claim) => {
      const normClaim = claim.toLowerCase();
      return normPath === normClaim || normPath.startsWith(`${normClaim}/`);
    });
    if (!covered) {
      outOfScope.push(changedPath);
    }
  }

  if (outOfScope.length > 0) {
    const error = new Error(
      `Observed repository changes exceed task write claims: ${outOfScope.slice(0, 5).join(", ")}${outOfScope.length > 5 ? "..." : ""}`,
    );
    error.code = E_TASK_CHANGE_OUTSIDE_SCOPE;
    error.outOfScopePaths = outOfScope;
    throw error;
  }
}
