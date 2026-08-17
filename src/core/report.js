import { readFile } from "node:fs/promises";

import { evaluateAudit } from "./audit.js";
import { fileExists, ensureWithin } from "./filesystem.js";
import { findProfilePath } from "./profile.js";

async function profileStatus(target) {
  const relativePath = await findProfilePath(target);
  if (!relativePath) return "NOT_VERIFIED";
  const profilePath = ensureWithin(target, relativePath);
  if (!(await fileExists(profilePath))) return "NOT_VERIFIED";
  const text = await readFile(profilePath, "utf8");
  return /^profile-status:\s*verified\s*$/m.test(text) ? "PASS" : "NOT_VERIFIED";
}

function section(id, label, status, details = null) {
  return { id, label, status, ...(details ? { details } : {}) };
}

export async function evaluateReport({ target, packageRoot, strict = false, ...options } = {}) {
  const audit = await evaluateAudit({ target, packageRoot, strict, ...options });
  const completion = audit.completion;
  const preflight = completion.preflight;
  const errorCodes = new Set(audit.errors.map((error) => error.code));
  const coverage = completion.coverage ?? [];
  const coverageStatus = coverage.length === 0
    ? "NOT_VERIFIED"
    : coverage.every((item) => item.status === "COVERED") ? "PASS" : "PARTIAL";
  const sections = [
    section("installation", "Installation", audit.installation.status === "ready" ? "PASS" : "NOT_VERIFIED"),
    section("profile", "Profile", await profileStatus(target)),
    section("contract", "Contract", preflight.contract.status === "valid" ? "PASS" : "NOT_VERIFIED"),
    section("routing", "Routing", preflight.routing.status === "valid" ? "PASS" : "NOT_VERIFIED"),
    section("required-gates", "Required gates", preflight.requiredGates.length === preflight.satisfiedGates.length ? "PASS" : "BLOCKED"),
    section("phase-chronology", "Phase chronology", completion.ledger.status === "valid" ? "PASS" : "INVALID"),
    section("evidence-coverage", "Evidence coverage", coverageStatus),
    section("receipt", "Receipt", errorCodes.has("E_RECEIPT_MISSING") || errorCodes.has("E_RECEIPT_INVALID") ? "NOT_VERIFIED" : "PASS"),
    section("publication", "Publication state", audit.publicationStatus.toUpperCase().replaceAll("-", "_")),
    section("production-readiness", "Production readiness", audit.productionReadiness.toUpperCase().replaceAll("-", "_")),
  ];
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    status: audit.status,
    verdict: audit.status === "VALID" ? "VALID" : "INCOMPLETE",
    sections,
    publicationStatus: audit.publicationStatus,
    productionReadiness: audit.productionReadiness,
    errors: audit.errors,
    warnings: audit.warnings,
  };
}
