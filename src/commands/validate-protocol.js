import { assertSafePath, ensureWithin, fileExists, readBytes } from "../core/filesystem.js";
import { assertJsonBytes, assertJsonLimits } from "../core/json-safety.js";
import { validateTaskArtifactSet } from "../core/conformance.js";
import { assertSchema, readSchema } from "../core/schema-validation.js";
import { assertRouteInvariants } from "../core/router.js";
import { assertWorkStateSemantics } from "../core/work-state.js";
import { validateReceipt } from "../core/receipt.js";
import { validateTaskBrief, validateDelegatedResult } from "../core/delegation.js";

async function readArtifact(target, relativePath, label) {
  if (!relativePath) return null;
  await assertSafePath(target, relativePath);
  const artifactPath = ensureWithin(target, relativePath);
  if (!(await fileExists(artifactPath))) {
    return {
      error: {
        code: "ARTIFACT_MISSING",
        message: `${label} is missing: ${relativePath}`,
        artifacts: [relativePath],
      },
    };
  }
  const bytes = await readBytes(artifactPath);
  try {
    assertJsonBytes(bytes, label);
    const value = JSON.parse(bytes.toString("utf8"));
    assertJsonLimits(value, label);
    return { value };
  } catch (error) {
    return {
      error: {
        code: error.code === "JSON_LIMIT_EXCEEDED" ? error.code : "ARTIFACT_INVALID_JSON",
        message: `${label} is invalid: ${error.message}`,
        artifacts: [relativePath],
      },
    };
  }
}

export async function runValidateProtocol({
  target,
  packageRoot,
  routeFile = null,
  stateFile = null,
  receiptFile = null,
  taskBriefFiles = [],
  delegatedResultFiles = [],
}) {
  const descriptors = [
    ["route", routeFile],
    ["state", stateFile],
    ["receipt", receiptFile],
    ...taskBriefFiles.map((file) => [`task brief:${file}`, file]),
    ...delegatedResultFiles.map((file) => [`delegated result:${file}`, file]),
  ];
  const loaded = [];
  for (const [label, relativePath] of descriptors) {
    const artifact = await readArtifact(target, relativePath, label);
    loaded.push({ label, relativePath, ...artifact });
  }

  const readErrors = loaded.filter((item) => item.error).map((item) => item.error);
  const route = loaded.find((item) => item.label === "route")?.value ?? null;
  const state = loaded.find((item) => item.label === "state")?.value ?? null;
  const receipt = loaded.find((item) => item.label === "receipt")?.value ?? null;
  const taskBriefs = loaded.filter((item) => item.label.startsWith("task brief:") && item.value).map((item) => item.value);
  const delegatedResults = loaded.filter((item) => item.label.startsWith("delegated result:") && item.value).map((item) => item.value);
  const schemaErrors = [];
  const validateLoaded = async (item, schemaName, semanticValidator = null) => {
    if (!item.value) return;
    try {
      const schema = await readSchema(schemaName, packageRoot);
      assertSchema(item.value, schema, item.label);
      if (semanticValidator) await semanticValidator(item.value);
    } catch (error) {
      schemaErrors.push({
        code: "ARTIFACT_SCHEMA_INVALID",
        message: `${item.label} failed schema or semantic validation: ${error.message}`,
        artifacts: [item.relativePath],
      });
    }
  };
  await validateLoaded(loaded.find((item) => item.label === "route"), "routing-result", async (value) => assertRouteInvariants(value));
  await validateLoaded(loaded.find((item) => item.label === "state"), "work-state", async (value) => assertWorkStateSemantics(value));
  await validateLoaded(loaded.find((item) => item.label === "receipt"), "execution-receipt", async (value) => validateReceipt(value, packageRoot));
  for (const item of loaded.filter((candidate) => candidate.label.startsWith("task brief:"))) {
    await validateLoaded(item, "task-brief", async (value) => validateTaskBrief(value, packageRoot));
  }
  for (const item of loaded.filter((candidate) => candidate.label.startsWith("delegated result:"))) {
    await validateLoaded(item, "delegated-result", async (value) => validateDelegatedResult(value, packageRoot));
  }
  const result = validateTaskArtifactSet({ route, state, receipt, taskBriefs, delegatedResults });
  if (readErrors.length > 0 || schemaErrors.length > 0) {
    return {
      ...result,
      status: "INVALID",
      errors: [...result.errors, ...readErrors, ...schemaErrors].sort((left, right) => left.code.localeCompare(right.code) || left.message.localeCompare(right.message)),
    };
  }
  return result;
}

export function formatValidateProtocolResult(result) {
  const lines = [`Protocol: ${result.status}`];
  for (const item of result.errors) lines.push(`- ${item.code}: ${item.message}`);
  for (const item of result.incomplete) lines.push(`- INCOMPLETE: ${item}`);
  return `${lines.join("\n")}\n`;
}
