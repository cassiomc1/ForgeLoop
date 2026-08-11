import path from "node:path";

import { GUIDE_IDS, PROTOCOL_VERSION } from "./protocol.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { assertSecretFree } from "./receipt.js";
import { assertEvidenceList } from "./evidence.js";

const DELEGATION_SCHEMA_VERSION = 1;

function normalizePath(value, label) {
  if (typeof value !== "string" || !value) throw new Error(`${label} must contain non-empty paths`);
  const portable = value.replaceAll("\\", "/");
  if (portable.startsWith("/") || /^[A-Za-z]:\//.test(portable)) {
    throw new Error(`${label} must remain relative: ${value}`);
  }
  const normalized = path.posix.normalize(portable);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`${label} escapes the task target: ${value}`);
  }
  return normalized === "." ? "" : normalized.replace(/^\.\//, "");
}

function normalizePathList(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const normalized = value.map((item) => normalizePath(item, label));
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must not contain duplicate paths`);
  return normalized.sort();
}

function pathsOverlap(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function overlapPath(left, right) {
  return left.length <= right.length ? left : right;
}

function assertBriefPathBoundaries(brief) {
  for (const allowed of brief.allowedPaths) {
    for (const readOnly of brief.readOnlyPaths) {
      if (pathsOverlap(allowed, readOnly)) {
        throw new Error(`allowed and read-only paths overlap: ${allowed} / ${readOnly}`);
      }
    }
  }
}

export async function validateTaskBrief(brief, packageRoot) {
  assertSecretFree(brief);
  const normalized = {
    ...brief,
    schemaVersion: DELEGATION_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    allowedPaths: normalizePathList(brief.allowedPaths, "allowedPaths"),
    readOnlyPaths: normalizePathList(brief.readOnlyPaths, "readOnlyPaths"),
    dependencies: [...(brief.dependencies ?? [])].sort(),
    constraints: [...(brief.constraints ?? [])],
    requiredGuides: [...(brief.requiredGuides ?? [])].sort(),
    verification: [...(brief.verification ?? [])],
    authority: [...(brief.authority ?? [])],
    deliverables: [...(brief.deliverables ?? [])],
    executionMode: brief.executionMode ?? "inline",
  };
  const schema = await readSchema("task-brief", packageRoot);
  assertSchema(normalized, schema, "delegation task brief");
  for (const guide of normalized.requiredGuides) {
    if (!GUIDE_IDS.includes(guide)) throw new Error(`Task brief contains unknown guide: ${guide}`);
  }
  if (normalized.dependencies.includes(normalized.taskId)) {
    throw new Error("Task brief cannot depend on itself");
  }
  assertBriefPathBoundaries(normalized);
  return normalized;
}

export async function validateDelegatedResult(result, packageRoot) {
  assertSecretFree(result);
  const schema = await readSchema("delegated-result", packageRoot);
  const validated = assertSchema(result, schema, "delegated result");
  assertEvidenceList(validated.evidence ?? [], "delegated-result.evidence");
  if (validated.status === "complete" && !(validated.evidence ?? []).some((item) => ["OBSERVED", "INFERRED"].includes(item.kind))) {
    throw new Error("complete delegated result requires verification evidence");
  }
  return validated;
}

export function findOwnershipConflicts(briefs) {
  const conflicts = [];
  const ordered = [...briefs].sort((left, right) => left.taskId.localeCompare(right.taskId));
  for (let leftIndex = 0; leftIndex < ordered.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < ordered.length; rightIndex += 1) {
      const left = ordered[leftIndex];
      const right = ordered[rightIndex];
      const leftPaths = (left.allowedPaths ?? []).map((value) => normalizePath(value, "allowedPaths"));
      const rightPaths = (right.allowedPaths ?? []).map((value) => normalizePath(value, "allowedPaths"));
      const leftReadOnly = (left.readOnlyPaths ?? []).map((value) => normalizePath(value, "readOnlyPaths"));
      const rightReadOnly = (right.readOnlyPaths ?? []).map((value) => normalizePath(value, "readOnlyPaths"));
      const seen = new Set();
      const addConflict = (type, leftPath, rightPath) => {
        if (!pathsOverlap(leftPath, rightPath)) return;
        const pathValue = overlapPath(leftPath, rightPath);
        const key = `${type}:${pathValue}`;
        if (seen.has(key)) return;
        seen.add(key);
        conflicts.push({ taskIds: [left.taskId, right.taskId], type, path: pathValue });
      };
      for (const leftPath of leftPaths) {
        for (const rightPath of rightPaths) addConflict("WRITE_WRITE", leftPath, rightPath);
        for (const rightPath of rightReadOnly) addConflict("WRITE_READ", leftPath, rightPath);
      }
      for (const rightPath of rightPaths) {
        for (const leftPath of leftReadOnly) addConflict("WRITE_READ", rightPath, leftPath);
      }
    }
  }
  conflicts.sort((left, right) => left.taskIds.join("\0").localeCompare(right.taskIds.join("\0"))
    || left.type.localeCompare(right.type)
    || left.path.localeCompare(right.path));
  return { conflicts };
}

export function findUnknownDependencies(briefs) {
  const known = new Set(briefs.map((brief) => brief.taskId));
  return briefs
    .flatMap((brief) => (Array.isArray(brief.dependencies) ? brief.dependencies : [])
      .filter((dependency) => !known.has(dependency))
      .map((dependency) => ({ taskId: brief.taskId, dependency })))
    .sort((left, right) => left.taskId.localeCompare(right.taskId) || left.dependency.localeCompare(right.dependency));
}

export function findDependencyCycles(briefs) {
  const graph = new Map(briefs.map((brief) => [brief.taskId, [...(Array.isArray(brief.dependencies) ? brief.dependencies : [])].sort()]));
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];
  const seen = new Set();

  function visit(taskId) {
    if (visiting.has(taskId)) {
      const cycle = [...stack.slice(stack.indexOf(taskId)), taskId];
      const key = cycle.join("->");
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push(cycle);
      }
      return;
    }
    if (visited.has(taskId)) return;
    visiting.add(taskId);
    stack.push(taskId);
    for (const dependency of graph.get(taskId) ?? []) {
      if (graph.has(dependency)) visit(dependency);
    }
    stack.pop();
    visiting.delete(taskId);
    visited.add(taskId);
  }

  for (const taskId of [...graph.keys()].sort()) visit(taskId);
  return cycles;
}

function setError(errors, code, message, details = {}) {
  errors.push({ code, message, ...details });
}

export function validateDelegationSet(briefs) {
  const errors = [];
  if (!Array.isArray(briefs)) {
    return {
      status: "INVALID",
      errors: [{ code: "INVALID_SET", message: "Delegation set must be an array" }],
      conflicts: [],
      cycles: [],
      unknownDependencies: [],
      integrationOwner: null,
    };
  }

  const ordered = [...briefs].sort((left, right) => String(left?.taskId).localeCompare(String(right?.taskId)));
  const taskIds = new Set();
  for (const brief of ordered) {
    if (!brief || typeof brief !== "object" || Array.isArray(brief)) {
      setError(errors, "INVALID_TASK_BRIEF", "Each delegation item must be an object");
      continue;
    }
    if (typeof brief.taskId !== "string" || !brief.taskId) {
      setError(errors, "INVALID_TASK_ID", "Each task brief requires a taskId");
    } else if (taskIds.has(brief.taskId)) {
      setError(errors, "DUPLICATE_TASK_ID", `Task ID is duplicated: ${brief.taskId}`, { taskId: brief.taskId });
    } else {
      taskIds.add(brief.taskId);
    }
    if (brief.schemaVersion !== DELEGATION_SCHEMA_VERSION || brief.protocolVersion !== PROTOCOL_VERSION) {
      setError(errors, "UNSUPPORTED_PROTOCOL_VERSION", `Unsupported task brief version: ${brief.taskId}`, { taskId: brief.taskId });
    }
    try {
      assertSecretFree(brief);
      const allowedPaths = normalizePathList(brief.allowedPaths, "allowedPaths");
      const readOnlyPaths = normalizePathList(brief.readOnlyPaths, "readOnlyPaths");
      assertBriefPathBoundaries({ allowedPaths, readOnlyPaths });
      if (!Array.isArray(brief.verification) || brief.verification.length === 0) {
        setError(errors, "MISSING_VERIFICATION", `Task brief requires verification: ${brief.taskId}`, { taskId: brief.taskId });
      }
      if (!Array.isArray(brief.authority) || brief.authority.length === 0) {
        setError(errors, "MISSING_AUTHORITY", `Task brief requires authority: ${brief.taskId}`, { taskId: brief.taskId });
      }
      for (const guide of brief.requiredGuides ?? []) {
        if (!GUIDE_IDS.includes(guide)) {
          setError(errors, "UNKNOWN_GUIDE", `Task brief contains unknown guide: ${guide}`, { taskId: brief.taskId, guide });
        }
      }
    } catch (error) {
      setError(errors, "INVALID_TASK_BRIEF", error.message, { taskId: brief.taskId ?? null });
    }
    if (Array.isArray(brief.dependencies) && brief.dependencies.includes(brief.taskId)) {
      setError(errors, "SELF_DEPENDENCY", `Task brief cannot depend on itself: ${brief.taskId}`, { taskId: brief.taskId });
    }
    if (Array.isArray(brief.dependencies) && new Set(brief.dependencies).size !== brief.dependencies.length) {
      setError(errors, "DUPLICATE_DEPENDENCY", `Task brief dependencies must be unique: ${brief.taskId}`, { taskId: brief.taskId });
    }
  }

  const unknownDependencies = findUnknownDependencies(ordered);
  for (const item of unknownDependencies) {
    setError(errors, "UNKNOWN_DEPENDENCY", `Unknown dependency ${item.dependency} for ${item.taskId}`, item);
  }
  const cycles = findDependencyCycles(ordered);
  for (const cycle of cycles) {
    setError(errors, "DEPENDENCY_CYCLE", `Dependency cycle: ${cycle.join(" -> ")}`, { cycle });
  }

  let conflicts = [];
  if (!errors.some((error) => error.code === "INVALID_TASK_BRIEF")) {
    try {
      conflicts = findOwnershipConflicts(ordered).conflicts;
    } catch (error) {
      setError(errors, "INVALID_TASK_BRIEF", error.message);
    }
  }
  const parentIds = [...new Set(ordered.map((brief) => brief?.parentTaskId).filter(Boolean))].sort();
  if (parentIds.length > 1) {
    setError(errors, "MULTIPLE_INTEGRATION_OWNERS", "All child tasks in a delegation set must share one parent integration owner");
  }
  errors.sort((left, right) => left.code.localeCompare(right.code)
    || String(left.taskId).localeCompare(String(right.taskId))
    || left.message.localeCompare(right.message));

  return {
    status: errors.length > 0 ? "INVALID" : conflicts.length > 0 ? "SERIAL_REQUIRED" : "PARALLEL_SAFE",
    errors,
    conflicts,
    cycles,
    unknownDependencies,
    integrationOwner: parentIds.length === 1 ? parentIds[0] : null,
  };
}

export function isIndependentReview({ implementerId, reviewerId, reviewType }) {
  return reviewType === "independent"
    && typeof implementerId === "string"
    && typeof reviewerId === "string"
    && implementerId !== reviewerId;
}

export function selectExecutionMode({ subagentsAvailable }) {
  return subagentsAvailable ? "delegated" : "inline";
}

export function normalizeDelegatedResult(result) {
  return {
    schemaVersion: DELEGATION_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    taskId: result.taskId,
    status: result.status,
    changes: [...(result.changes ?? [])],
    verification: [...(result.verification ?? [])],
    evidence: [...(result.evidence ?? [])],
    openFindings: [...(result.openFindings ?? [])],
    limitations: [...(result.limitations ?? [])],
  };
}
