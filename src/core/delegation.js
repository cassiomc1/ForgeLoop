import path from "node:path";

import { GUIDE_IDS, PROTOCOL_VERSION } from "./protocol.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { assertSecretFree } from "./receipt.js";

const DELEGATION_SCHEMA_VERSION = 1;

function normalizePath(value, label) {
  if (typeof value !== "string" || !value) throw new Error(`${label} must contain non-empty paths`);
  const portable = value.replaceAll("\\", "/");
  if (portable.startsWith("/") || /^[A-Za-z]:\//.test(portable)) {
    throw new Error(`${label} must remain relative: ${value}`);
  }
  const normalized = path.posix.normalize(portable);
  if (normalized === ".." || normalized.startsWith("../")) {
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
  return assertSchema(result, schema, "delegated result");
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
      const overlap = leftPaths.some((leftPath) => rightPaths.some((rightPath) => pathsOverlap(leftPath, rightPath)));
      if (overlap) conflicts.push({ taskIds: [left.taskId, right.taskId] });
    }
  }
  return { conflicts };
}

export function findDependencyCycles(briefs) {
  const graph = new Map(briefs.map((brief) => [brief.taskId, [...(brief.dependencies ?? [])].sort()]));
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
    openFindings: [...(result.openFindings ?? [])],
    limitations: [...(result.limitations ?? [])],
  };
}
