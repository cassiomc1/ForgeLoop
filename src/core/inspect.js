import { fileExists, ensureWithin, readBytes } from "./filesystem.js";
import { AGENT_SUPPORT } from "./agent-support.js";
import { readManifest } from "./manifest.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { runDoctor } from "../commands/doctor.js";

const PROFILE_PATH = "PROJECT_PROFILE.md";
const STATE_PATH = ".mdfiles/work-state.json";
const SCHEMA_NAMES = [
  "routing-input",
  "routing-result",
  "work-state",
  "execution-receipt",
  "task-brief",
  "delegated-result",
];

function profileMetadata(bytes) {
  const text = bytes.toString("utf8");
  return {
    mode: text.match(/^profile-mode:\s*([^\s]+)\s*$/m)?.[1] ?? null,
    status: text.match(/^profile-status:\s*([^\s]+)\s*$/m)?.[1] ?? null,
  };
}

export async function inspectTarget({ target, packageRoot }) {
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
      schemaStatus: "available",
      schemas: SCHEMA_NAMES,
    },
    state: {
      path: STATE_PATH,
      present: statePresent,
      status: statePresent ? "present" : "absent",
    },
    compatibility: {
      agents: AGENT_SUPPORT.map((record) => record.id),
    },
    findings: doctor.findings,
    ok: doctor.ok && !manifestError,
  };
}
