import { createHash } from "node:crypto";

import { assertSafePath, ensureWithin, fileExists, readBytes, writeFileAtomic } from "./filesystem.js";
import { assertSecretFree } from "./receipt.js";
import { assertJsonBytes, assertJsonLimits } from "./json-safety.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { getPackageRoot } from "./templates.js";
import { getActiveTaskTransaction, withTaskTransaction } from "./transaction.js";

export const ARTIFACT_PATHS = Object.freeze({
  contract: ".forgeloop/current-contract.json",
  route: ".forgeloop/routing-result.json",
  preflight: ".forgeloop/preflight.json",
  sources: ".forgeloop/sources.json",
  events: ".forgeloop/events.ndjson",
  session: ".forgeloop/session.json",
  config: ".forgeloop/config.json",
  gates: ".forgeloop/gates",
  state: ".forgeloop/work-state.json",
  continuity: ".forgeloop/continuity.json",
  receipt: ".forgeloop/execution-receipt.json",
  executionDirectory: ".forgeloop/executions",
});

export function executionArtifactPath(executionId) {
  if (typeof executionId !== "string" || !/^exec-[A-Za-z0-9_-]+$/.test(executionId)) {
    throw new ArtifactError("E_EXECUTION_REF_INVALID", "Execution reference must be a simple execution ID");
  }
  return `${ARTIFACT_PATHS.executionDirectory}/${executionId}.json`;
}

export class ArtifactError extends Error {
  constructor(code, message, artifacts = []) {
    super(message);
    this.name = "ArtifactError";
    this.code = code;
    this.artifacts = artifacts;
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalFingerprint(value) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function artifactError(code, relativePath, error) {
  if (error instanceof ArtifactError) return error;
  return new ArtifactError(
    code,
    `${relativePath}: ${error.message}`,
    [relativePath],
  );
}

export async function readJsonArtifact(
  target,
  relativePath,
  schemaName,
  packageRoot = getPackageRoot(),
) {
  try {
    await assertSafePath(target, relativePath);
  } catch (error) {
    throw artifactError("ARTIFACT_PATH_INVALID", relativePath, error);
  }

  const artifactPath = ensureWithin(target, relativePath);
  if (!(await fileExists(artifactPath))) {
    throw new ArtifactError(
      "ARTIFACT_MISSING",
      `Artifact is missing: ${relativePath}`,
      [relativePath],
    );
  }

  let value;
  try {
    const bytes = await readBytes(artifactPath);
    assertJsonBytes(bytes, relativePath);
    value = JSON.parse(bytes.toString("utf8"));
    assertJsonLimits(value, relativePath);
    const schema = await readSchema(schemaName, packageRoot);
    assertSchema(value, schema, relativePath);
  } catch (error) {
    throw artifactError(
      ["JSON_LIMIT_EXCEEDED", "ARTIFACT_PATH_INVALID"].includes(error.code)
        ? error.code
        : "ARTIFACT_INVALID",
      relativePath,
      error,
    );
  }

  return {
    value,
    path: relativePath,
    fingerprint: canonicalFingerprint(value),
  };
}

export async function writeJsonArtifact(
  target,
  relativePath,
  value,
  schemaName,
  packageRoot = getPackageRoot(),
  { dryRun = false, taskId = null, operation = "write-artifact" } = {},
) {
  try {
    await assertSafePath(target, relativePath);
  } catch (error) {
    throw artifactError("ARTIFACT_PATH_INVALID", relativePath, error);
  }
  const activeTransaction = getActiveTaskTransaction();
  if (!activeTransaction && taskId && !dryRun) {
    return withTaskTransaction({ target, taskId, operation, packageRoot }, async () => (
      writeJsonArtifact(target, relativePath, value, schemaName, packageRoot, { dryRun, taskId, operation })
    ));
  }
  try {
    const artifactPath = ensureWithin(target, relativePath);
    assertSecretFree(value);
    const schema = await readSchema(schemaName, packageRoot);
    assertSchema(value, schema, relativePath);
    assertJsonLimits(value, relativePath);
    const serialized = `${JSON.stringify(value, null, 2)}\n`;
    assertJsonBytes(serialized, relativePath);
    if (activeTransaction && !dryRun) {
      await activeTransaction.stageText(relativePath, serialized);
    } else {
      await writeFileAtomic(artifactPath, serialized, { dryRun });
    }
    return { path: relativePath, fingerprint: canonicalFingerprint(value), value };
  } catch (error) {
    throw artifactError(
      error.code === "JSON_LIMIT_EXCEEDED" ? error.code : "ARTIFACT_INVALID",
      relativePath,
      error,
    );
  }
}
