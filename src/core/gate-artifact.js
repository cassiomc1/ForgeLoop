import { assertSafePath, ensureWithin, fileExists, readBytes } from "./filesystem.js";
import { ARTIFACT_PATHS, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { sha256 } from "./manifest.js";
import { taskGatePath } from "./task-paths.js";

function gateName(value) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    const error = new Error(`Invalid gate name: ${value}`);
    error.code = "E_GATE_INVALID";
    throw error;
  }
  return value;
}

export function gatePath(gate, options = {}) {
  const name = gateName(gate);
  if (options?.taskId) {
    return taskGatePath(options.taskId, name);
  }
  return `${ARTIFACT_PATHS.gates ?? ".forgeloop/gates"}/${name}.json`;
}

export async function persistGate(target, gate, packageRoot, options = {}) {
  const relativePath = options?.gatePath ?? (options?.taskId ? taskGatePath(options.taskId, gate.gate) : gatePath(gate.gate, options));
  return writeJsonArtifact(target, relativePath, gate, "gate", packageRoot, options);
}

export async function readGate(target, gate, packageRoot, options = {}) {
  const relativePath = options?.gatePath ?? (options?.taskId ? taskGatePath(options.taskId, gate) : gatePath(gate, options));
  return readJsonArtifact(target, relativePath, "gate", packageRoot);
}

export async function readGateIfPresent(target, gate, packageRoot, options = {}) {
  const relativePath = options?.gatePath ?? (options?.taskId ? taskGatePath(options.taskId, gate) : gatePath(gate, options));
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
