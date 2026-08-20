#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DOCUMENTS = Object.freeze([
  "README.md",
  "docs/GETTING_STARTED.md",
  "docs/CROSS_HARNESS_CONTINUITY.md",
  "docs/RECIPES.md",
  "docs/TROUBLESHOOTING.md",
  "docs/CLI_REFERENCE.md",
]);

function documentedExampleError(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

function parseExpectedValue(value) {
  if (/^(?:true|false|null|-?\d+(?:\.\d+)?)$/.test(value)) return JSON.parse(value);
  return value;
}

function readPath(value, dottedPath) {
  return dottedPath.split(".").reduce((current, key) => (
    current !== null && typeof current === "object" ? current[key] : undefined
  ), value);
}

/**
 * Parses explicitly delimited documentation examples. The marker grammar is:
 *   <!-- FORGELOOP EXAMPLE: id | exit=0 | json.path=value -->
 *   ```bash
 *   forgeloop command --json
 *   ```
 *   <!-- END FORGELOOP EXAMPLE -->
 *
 * The command is run from a fresh disposable target. Examples use the
 * canonical `forgeloop` spelling while the validator invokes this checkout's
 * CLI entrypoint, so validation never downloads a package or modifies a doc.
 */
export function parseDocumentedExamples(documentPath, content) {
  const examples = [];
  const pattern = /<!-- FORGELOOP EXAMPLE:([^>]+)-->([\s\S]*?)<!-- END FORGELOOP EXAMPLE -->/g;
  const openings = [...content.matchAll(/<!-- FORGELOOP EXAMPLE:/g)].length;
  const closings = [...content.matchAll(/<!-- END FORGELOOP EXAMPLE -->/g)].length;
  if (openings !== closings) {
    throw documentedExampleError("DOC_EXAMPLE_DELIMITER_MISMATCH", `${documentPath} has ${openings} opening and ${closings} closing example markers`);
  }
  for (const match of content.matchAll(pattern)) {
    const marker = match[1].trim();
    const [id, ...expectations] = marker.split("|").map((part) => part.trim()).filter(Boolean);
    if (!id) throw documentedExampleError("DOC_EXAMPLE_ID_MISSING", `${documentPath} has an unnamed example`);
    if (!expectations.some((expectation) => expectation.startsWith("exit="))) {
      throw documentedExampleError("DOC_EXAMPLE_EXPECTATION_MISSING", `${documentPath}:${id} must declare exit=<code>`);
    }
    const block = match[2].match(/```(?:bash|sh)\s*\n([\s\S]*?)```/);
    if (!block) throw documentedExampleError("DOC_EXAMPLE_BASH_MISSING", `${documentPath}:${id} must contain one bash block`);
    const lines = block[1].split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
    if (lines.length !== 1 || !lines[0].startsWith("forgeloop ")) {
      throw documentedExampleError("DOC_EXAMPLE_COMMAND_INVALID", `${documentPath}:${id} must contain exactly one forgeloop command`);
    }
    const expected = { exitCode: null, fixture: null, json: {} };
    for (const expectation of expectations) {
      const equals = expectation.indexOf("=");
      if (equals === -1) throw documentedExampleError("DOC_EXAMPLE_EXPECTATION_INVALID", `${documentPath}:${id} has invalid expectation ${expectation}`);
      const key = expectation.slice(0, equals);
      const value = parseExpectedValue(expectation.slice(equals + 1));
      if (key === "exit") expected.exitCode = value;
      else if (key === "fixture") {
        if (typeof value !== "string" || !/^task:[A-Za-z0-9_-]+$/.test(value)) {
          throw documentedExampleError("DOC_EXAMPLE_FIXTURE_INVALID", `${documentPath}:${id} has unsupported fixture ${value}`);
        }
        expected.fixture = value;
      }
      else if (key.startsWith("json.")) expected.json[key.slice(5)] = value;
      else throw documentedExampleError("DOC_EXAMPLE_EXPECTATION_INVALID", `${documentPath}:${id} has unsupported expectation ${key}`);
    }
    examples.push({ documentPath, id, command: lines[0], expected });
  }
  return examples;
}

function runProcess(argv, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ exitCode: exitCode ?? 1, stdout, stderr }));
  });
}

export async function runDocumentedExample(example) {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-doc-example-"));
  try {
    if (example.expected.fixture) {
      const [, taskId] = example.expected.fixture.split(":");
      const fixture = await runProcess([
        process.execPath,
        path.join(repositoryRoot, "src/cli.js"),
        "task-create",
        "--task",
        taskId,
        "--claim",
        "src",
        "--json",
        "--path",
        target,
      ], repositoryRoot);
      if (fixture.exitCode !== 0) {
        throw documentedExampleError("DOC_EXAMPLE_FIXTURE_FAILED", `${example.documentPath}:${example.id} could not create ${example.expected.fixture}: ${fixture.stderr}`);
      }
    }
    const commandArgs = example.command.split(/\s+/).slice(1);
    const result = await runProcess([
      process.execPath,
      path.join(repositoryRoot, "src/cli.js"),
      ...commandArgs,
      "--path",
      target,
    ], repositoryRoot);
    if (result.exitCode !== example.expected.exitCode) {
      throw documentedExampleError("DOC_EXAMPLE_EXIT_MISMATCH", `${example.documentPath}:${example.id} expected exit ${example.expected.exitCode}, got ${result.exitCode}: ${result.stderr}`);
    }
    let json = null;
    if (Object.keys(example.expected.json).length > 0) {
      try {
        json = JSON.parse(result.stdout);
      } catch {
        throw documentedExampleError("DOC_EXAMPLE_JSON_INVALID", `${example.documentPath}:${example.id} expected JSON output`);
      }
      for (const [jsonPath, expected] of Object.entries(example.expected.json)) {
        const actual = readPath(json, jsonPath);
        if (actual !== expected) {
          throw documentedExampleError("DOC_EXAMPLE_JSON_MISMATCH", `${example.documentPath}:${example.id} expected json.${jsonPath}=${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
      }
    }
    return { ...result, json };
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

export async function validateDocumentationExamples() {
  const examples = [];
  for (const relativePath of DOCUMENTS) {
    const content = await readFile(path.join(repositoryRoot, relativePath), "utf8");
    examples.push(...parseDocumentedExamples(relativePath, content));
  }
  if (examples.length === 0) throw documentedExampleError("DOC_EXAMPLE_NONE", "No tagged documentation examples were found");
  for (const example of examples) await runDocumentedExample(example);
  return examples;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const examples = await validateDocumentationExamples();
    console.log(`Validated ${examples.length} executable documentation example(s).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
