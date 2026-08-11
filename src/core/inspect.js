import { fileExists, ensureWithin, readBytes } from "./filesystem.js";
import { AGENT_SUPPORT } from "./agent-support.js";
import { readManifest } from "./manifest.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { inspectSchemaHealth } from "./schema-validation.js";
import { readAndClassifyWorkState } from "./work-state.js";
import { createEvidence } from "./evidence.js";
import { runDoctor } from "../commands/doctor.js";

const PROFILE_PATH = "PROJECT_PROFILE.md";
const STATE_PATH = ".mdfiles/work-state.json";
function profileMetadata(bytes) {
  const text = bytes.toString("utf8");
  return {
    mode: text.match(/^profile-mode:\s*([^\s]+)\s*$/m)?.[1] ?? null,
    status: text.match(/^profile-status:\s*([^\s]+)\s*$/m)?.[1] ?? null,
  };
}

export async function inspectTarget({ target, packageRoot, contractFile = null }) {
  let manifest = null;
  let manifestError = null;
  try {
    manifest = await readManifest(target);
  } catch (error) {
    manifestError = error.message;
  }

  const profilePath = ensureWithin(target, PROFILE_PATH);
  const profile = (await fileExists(profilePath))
    ? profileMetadata(await readBytes(profilePath))
    : { mode: null, status: null };
  const statePath = ensureWithin(target, STATE_PATH);
  const statePresent = await fileExists(statePath);
  const state = await readAndClassifyWorkState({ target, packageRoot, contractFile });
  const schemaHealth = await inspectSchemaHealth(target);
  const doctor = await runDoctor({ target, packageRoot });
  const agents = await Promise.all(AGENT_SUPPORT.map(async (record) => ({
    id: record.id,
    name: record.name,
    support: record.support,
    instructionFiles: record.instructionFiles,
    available: (await Promise.all(
      record.instructionFiles.map(async (relativePath) => fileExists(ensureWithin(target, relativePath))),
    )).some(Boolean),
  })));

  const findings = [...doctor.findings];
  for (const schema of schemaHealth.schemas) {
    if (schema.status !== "valid") {
      findings.push({
        code: `schema-${schema.status}`,
        severity: "error",
        path: `schemas/${schema.name}.schema.json`,
        message: schema.error ?? `Schema is ${schema.status}.`,
        remediation: "Restore the shipped schema and rerun inspect.",
        evidence: createEvidence({
          kind: schema.status === "missing" ? "NOT_VERIFIED" : "OBSERVED",
          source: `schemas/${schema.name}.schema.json`,
          result: schema.status,
        }),
      });
    }
  }
  if (state.status === "INVALID") {
    findings.push({
      code: "state-invalid",
      severity: "error",
      path: STATE_PATH,
      message: state.error ?? "Work state is invalid.",
      remediation: "Repair or clear the checkpoint after reviewing the parse error.",
      evidence: createEvidence({ kind: "BLOCKED", source: STATE_PATH, result: "invalid" }),
    });
  }

  const protocolEvidence = schemaHealth.evidence ?? [createEvidence({
    kind: schemaHealth.status === "valid" ? "OBSERVED" : "NOT_VERIFIED",
    source: "mdfiles schema health",
    result: schemaHealth.status,
  })];
  const evidence = [
    ...(doctor.evidence ?? []),
    ...(state.evidence ?? []),
    ...protocolEvidence,
  ];
  return {
    target: { path: target },
    manifest: {
      present: manifest !== null,
      status: manifestError ? "invalid" : manifest ? "ready" : "missing",
      packageVersion: manifest?.packageVersion ?? null,
      error: manifestError,
    },
    profile,
    adapters: {
      detected: agents.filter((agent) => agent.available).map((agent) => agent.id),
      agents,
    },
    protocol: {
      version: PROTOCOL_VERSION,
      schemaStatus: schemaHealth.status,
      schemas: schemaHealth.schemas,
      evidence: protocolEvidence,
    },
    state: { ...state, path: STATE_PATH, present: statePresent },
    compatibility: {
      agents: AGENT_SUPPORT.map((record) => record.id),
    },
    findings,
    evidence,
    ok: doctor.ok
      && !manifestError
      && schemaHealth.status === "valid"
      && !["INVALID", "REVALIDATION_REQUIRED"].includes(state.status),
  };
}
