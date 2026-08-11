import path from "node:path";

import { assertSafePath, ensureWithin, fileExists, readBytes } from "./filesystem.js";
import { ARTIFACT_PATHS, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { sha256 } from "./manifest.js";

function gateName(value) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    const error = new Error(`Invalid gate name: ${value}`);
    error.code = "E_GATE_INVALID";
    throw error;
  }
  return value;
}

export function gatePath(gate) {
  return `${ARTIFACT_PATHS.gates ?? ".forgeloop/gates"}/${gateName(gate)}.json`;
}

export async function persistGate(target, gate, packageRoot, options = {}) {
  const relativePath = gatePath(gate.gate);
  return writeJsonArtifact(target, relativePath, gate, "gate", packageRoot, options);
}

export async function readGate(target, gate, packageRoot) {
  const relativePath = gatePath(gate);
  return readJsonArtifact(target, relativePath, "gate", packageRoot);
}

export async function readGateIfPresent(target, gate, packageRoot) {
  const relativePath = gatePath(gate);
  await assertSafePath(target, relativePath);
  const filePath = ensureWithin(target, relativePath);
  if (!(await fileExists(filePath))) return null;
  return readJsonArtifact(target, relativePath, "gate", packageRoot);
}

export async function validateGateArtifacts(target, gateValue, packageRoot) {
  const schema = await readSchema("gate", packageRoot);
  assertSchema(gateValue, schema, "gate");
  const stale = [];
  for (const artifact of gateValue.artifacts ?? []) {
    await assertSafePath(target, artifact.path);
    const artifactPath = ensureWithin(target, artifact.path);
    if (!(await fileExists(artifactPath))) {
      stale.push({ path: artifact.path, status: "missing" });
      continue;
    }
    const digest = sha256(await readBytes(artifactPath));
    if (digest !== artifact.sha256) stale.push({ path: artifact.path, status: "changed" });
  }
  return stale;
}
