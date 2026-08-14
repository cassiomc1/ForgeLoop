import { fileExists, ensureWithin, readBytes } from "./filesystem.js";
import { DISCOVERY_SURFACES } from "./discovery-surfaces.js";
import { readManifest } from "./manifest.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { inspectSchemaHealth } from "./schema-validation.js";
import { readAndClassifyWorkState, WORK_STATE_PATH } from "./work-state.js";
import { createEvidence } from "./evidence.js";
import { runDoctor } from "../commands/doctor.js";
import { findProfilePath } from "./profile.js";
import { FORGELOOP_KIT_DIR } from "./target-layout.js";

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

  const profileRelativePath = await findProfilePath(target);
  const profilePath = profileRelativePath ? ensureWithin(target, profileRelativePath) : null;
  const profile = (profilePath && await fileExists(profilePath))
    ? { ...profileMetadata(await readBytes(profilePath)), path: profileRelativePath }
    : { mode: null, status: null };
  const statePath = ensureWithin(target, WORK_STATE_PATH);
  const statePresent = await fileExists(statePath);
  const state = await readAndClassifyWorkState({ target, packageRoot, contractFile });
  const schemaRoot = manifest?.layoutVersion >= 2
    ? ensureWithin(target, FORGELOOP_KIT_DIR)
    : target;
  const schemaHealth = await inspectSchemaHealth(schemaRoot);
  const schemaPathPrefix = manifest?.layoutVersion >= 2
    ? `${FORGELOOP_KIT_DIR}/schemas`
    : "schemas";
  const doctor = await runDoctor({ target, packageRoot });
  const surfaces = await Promise.all(DISCOVERY_SURFACES.map(async (surface) => ({
    id: surface.id,
    path: surface.path,
    kind: surface.kind,
    available: await fileExists(ensureWithin(target, surface.path)),
  })));
  const availableSurfaces = surfaces.filter((surface) => surface.available);
  const protocolActivated = availableSurfaces.length > 0;

  const findings = [...doctor.findings];
  for (const schema of schemaHealth.schemas) {
    if (schema.status !== "valid") {
      findings.push({
        code: `schema-${schema.status}`,
        severity: "error",
        path: `${schemaPathPrefix}/${schema.name}.schema.json`,
        message: schema.error ?? `Schema is ${schema.status}.`,
        remediation: "Restore the shipped schema and rerun inspect.",
        evidence: createEvidence({
          kind: schema.status === "missing" ? "NOT_VERIFIED" : "OBSERVED",
          source: `${schemaPathPrefix}/${schema.name}.schema.json`,
          result: schema.status,
        }),
      });
    }
  }
  if (state.status === "INVALID") {
    findings.push({
      code: "state-invalid",
      severity: "error",
      path: WORK_STATE_PATH,
      message: state.error ?? "Work state is invalid.",
      remediation: "Repair or clear the checkpoint after reviewing the parse error.",
      evidence: createEvidence({ kind: "BLOCKED", source: WORK_STATE_PATH, result: "invalid" }),
    });
  }

  const protocolEvidence = schemaHealth.evidence ?? [createEvidence({
    kind: schemaHealth.status === "valid" ? "OBSERVED" : "NOT_VERIFIED",
    source: "ForgeLoop schema health",
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
      layoutVersion: manifest?.layoutVersion ?? 1,
      error: manifestError,
    },
    profile,
    integration: {
      protocolActivated,
      protocolMarker: "FORGELOOP_PROJECT_PROTOCOL=REQUIRED",
      discovery: {
        status: protocolActivated ? "INSTRUCTION_DISCOVERED" : "INSTRUCTION_ABSENT",
        surfaces,
      },
      capability: {
        status: "NOT_VERIFIED",
      },
    },
    adapters: {
      detected: availableSurfaces.map((s) => s.path),
      surfaces,
    },
    protocol: {
      version: PROTOCOL_VERSION,
      schemaStatus: schemaHealth.status,
      schemas: schemaHealth.schemas,
      evidence: protocolEvidence,
    },
    state: { ...state, path: WORK_STATE_PATH, present: statePresent },
    compatibility: {
      deprecated: true,
      agents: [],
    },
    findings,
    evidence,
    ok: doctor.ok
      && !manifestError
      && schemaHealth.status === "valid"
      && !["INVALID", "REVALIDATION_REQUIRED"].includes(state.status),
  };
}
