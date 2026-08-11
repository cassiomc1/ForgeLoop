import { GUIDE_IDS, PROTOCOL_VERSION } from "./protocol.js";

export const ROUTING_SCHEMA_VERSION = 1;

const WORK_TYPES = new Set([
  "documentation",
  "code",
  "bug",
  "refactor",
  "backend",
  "api",
  "api-auth",
  "complete-website",
  "mobile-ui",
  "web-game",
  "html-video",
  "infrastructure",
  "security-review",
  "performance",
  "accessibility",
  "test-only",
  "dependency-update",
  "release",
]);

const SIGNALS = Object.freeze({
  surfaces: new Set([
    "ui",
    "forms",
    "api",
    "auth",
    "data",
    "database",
    "mobile",
    "desktop",
    "game",
    "video",
    "ci",
    "config",
    "critical-path",
  ]),
  risks: new Set([
    "untrusted-input",
    "personal-data",
    "secrets",
    "external-service",
    "publication",
    "critical-path",
    "performance",
    "accessibility",
  ]),
  platforms: new Set(["web", "mobile", "desktop", "server", "ci", "cross-platform"]),
});

const WORK_GUIDES = Object.freeze({
  "complete-website": ["premium", "design", "accessibility", "clean", "test", "security", "performance"],
  "api-auth": ["clean", "test", "security", "performance"],
  api: ["clean", "test"],
  backend: ["clean", "test"],
  code: ["clean", "test"],
  bug: ["clean", "test"],
  refactor: ["clean", "test"],
  "dependency-update": ["clean", "test"],
  release: ["clean", "test"],
  "mobile-ui": ["clean", "test", "design", "accessibility", "security", "performance"],
  "web-game": ["games", "clean", "test", "security", "performance", "accessibility"],
  "html-video": ["design", "accessibility", "performance", "test", "security"],
  infrastructure: ["security", "test"],
  "security-review": ["security"],
  performance: ["performance", "test"],
  accessibility: ["accessibility", "test"],
  "test-only": ["test"],
  documentation: [],
});

const PRIMARY_GUIDES = Object.freeze({
  "complete-website": "premium",
  "web-game": "games",
  documentation: null,
});

export class RouteInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "RouteInputError";
    this.code = "ROUTING_FAILURE";
  }
}

function reasonForWorkType(workType) {
  return `WORK_${workType.toUpperCase().replaceAll("-", "_")}`;
}

function reasonForSignal(prefix, signal) {
  return `${prefix}_${signal.toUpperCase().replaceAll("-", "_")}`;
}

function normalizeArray(value, name, allowed) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new RouteInputError(`${name} must be an array`);
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string" || !allowed.has(item)) {
      throw new RouteInputError(`Unknown ${name.slice(0, -1)}: ${item}`);
    }
    if (seen.has(item)) throw new RouteInputError(`Duplicate ${name.slice(0, -1)}: ${item}`);
    seen.add(item);
  }
  return [...seen].sort();
}

export function normalizeRouteInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RouteInputError("Route input must be an object");
  }
  if (typeof input.workType !== "string" || !WORK_TYPES.has(input.workType)) {
    throw new RouteInputError(`Unknown work type: ${input.workType}`);
  }
  for (const key of ["behaviorChange", "executableChange"]) {
    if (input[key] !== undefined && typeof input[key] !== "boolean") {
      throw new RouteInputError(`${key} must be boolean`);
    }
  }
  return {
    schemaVersion: ROUTING_SCHEMA_VERSION,
    workType: input.workType,
    surfaces: normalizeArray(input.surfaces, "surfaces", SIGNALS.surfaces),
    risks: normalizeArray(input.risks, "risks", SIGNALS.risks),
    platforms: normalizeArray(input.platforms, "platforms", SIGNALS.platforms),
    behaviorChange: input.behaviorChange ?? false,
    executableChange: input.executableChange ?? false,
  };
}

export function evaluateRoute(input = {}) {
  const normalized = normalizeRouteInput(input);
  const selected = new Map();
  const excluded = {};

  function add(guide, reason) {
    if (!GUIDE_IDS.includes(guide)) throw new RouteInputError(`Unknown guide: ${guide}`);
    const reasons = selected.get(guide) ?? [];
    if (!reasons.includes(reason)) reasons.push(reason);
    selected.set(guide, reasons);
  }

  const workReason = reasonForWorkType(normalized.workType);
  for (const guide of WORK_GUIDES[normalized.workType]) add(guide, workReason);

  if (normalized.surfaces.includes("ui") || normalized.surfaces.includes("forms")) {
    add("design", "SURFACE_UI");
    add("accessibility", normalized.surfaces.includes("forms") ? "SURFACE_FORMS" : "SURFACE_UI");
  }
  if (normalized.surfaces.includes("mobile") || normalized.surfaces.includes("desktop")) {
    add("design", "SURFACE_PLATFORM_UI");
    add("accessibility", "SURFACE_PLATFORM_UI");
  }
  if (normalized.surfaces.includes("game")) add("games", "SURFACE_GAME");
  if (normalized.surfaces.includes("video")) {
    add("design", "SURFACE_VIDEO");
    add("accessibility", "SURFACE_VIDEO");
  }
  if (normalized.surfaces.includes("auth")) add("security", "SURFACE_AUTH");

  for (const risk of normalized.risks) {
    if (["untrusted-input", "personal-data", "secrets", "external-service", "publication"].includes(risk)) {
      add("security", reasonForSignal("RISK", risk));
    }
    if (["critical-path", "performance"].includes(risk)) {
      add("performance", reasonForSignal("RISK", risk));
    }
    if (risk === "accessibility") add("accessibility", "RISK_ACCESSIBILITY");
  }

  if (normalized.behaviorChange) {
    add("clean", "CHANGE_BEHAVIOR");
    add("test", "CHANGE_BEHAVIOR");
  }
  if (normalized.executableChange) {
    add("clean", "CHANGE_EXECUTABLE_CONFIG");
    add("test", "CHANGE_EXECUTABLE_CONFIG");
  }

  if (normalized.workType === "documentation" && selected.size === 0) {
    excluded.documentation = ["DOCUMENTATION_DOMAIN_GUIDE_REQUIRED"];
  }

  for (const guide of GUIDE_IDS) {
    if (selected.has(guide)) continue;
    if (guide === "security") excluded[guide] = ["NO_TRUST_BOUNDARY"];
    else if (guide === "performance") excluded[guide] = ["NO_MEASURABLE_PERFORMANCE_RISK"];
    else if (guide === "design" || guide === "accessibility") excluded[guide] = ["NO_UI_SURFACE"];
    else if (guide === "premium" || guide === "games") excluded[guide] = ["NO_PRIMARY_WORK_TYPE"];
    else excluded[guide] = ["NO_BEHAVIOR_OR_EXECUTABLE_CHANGE"];
  }

  const guides = [...selected.keys()];
  return {
    schemaVersion: ROUTING_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    input: normalized,
    primary: Object.prototype.hasOwnProperty.call(PRIMARY_GUIDES, normalized.workType)
      ? PRIMARY_GUIDES[normalized.workType]
      : guides[0] ?? null,
    guides,
    reasons: Object.fromEntries(guides.map((guide) => [guide, selected.get(guide)])),
    excluded,
  };
}

export const ROUTING_SIGNALS = Object.freeze({
  workTypes: Object.freeze([...WORK_TYPES].sort()),
  surfaces: Object.freeze([...SIGNALS.surfaces].sort()),
  risks: Object.freeze([...SIGNALS.risks].sort()),
  platforms: Object.freeze([...SIGNALS.platforms].sort()),
});
