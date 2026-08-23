import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  resolveForgeLoopProjectRoot,
  INTEGRATION_LIMITS,
} from "@cassiomc1/forgeloop/integration";
import {
  sanitizeClientMessage,
  sanitizeErrorPayload,
} from "../src/error-sanitization.js";
import { enforceOutputBound, envelopeToToolResult } from "../src/error-mapping.js";
import { removeTempTree } from "../../../tests/helpers/rm-safe.js";

test("project-root matrix matches canonical CLI semantics", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "forgeloop-root-matrix-"));
  try {
    // real directory -> accept
    const realDir = path.join(base, "real-project");
    await mkdir(realDir);
    const accepted = await resolveForgeLoopProjectRoot(realDir);
    assert.equal(accepted, path.resolve(await (await import("node:fs/promises")).realpath(realDir)));

    // nested real directory -> accept
    const nested = path.join(realDir, "nested", "deep");
    await mkdir(nested, { recursive: true });
    assert.ok(await resolveForgeLoopProjectRoot(nested));

    // relative real path -> accept (resolved against cwd)
    const relative = await resolveForgeLoopProjectRoot(".");
    assert.ok(path.isAbsolute(relative));

    // missing -> reject
    await assert.rejects(
      () => resolveForgeLoopProjectRoot(path.join(base, "does-not-exist")),
      /does not exist|not a directory/,
    );

    // regular file -> reject
    const filePath = path.join(base, "a-file.txt");
    await writeFile(filePath, "x");
    await assert.rejects(
      () => resolveForgeLoopProjectRoot(filePath),
      /not a directory/,
    );

    // symlink to a directory -> reject (canonical CLI behavior)
    const linkPath = path.join(base, "symlinked-project");
    let symlinkSupported = true;
    try {
      await symlink(realDir, linkPath, "dir");
    } catch {
      symlinkSupported = false; // Windows without privileges
    }
    if (symlinkSupported) {
      await assert.rejects(
        () => resolveForgeLoopProjectRoot(linkPath),
        /not a directory/,
      );
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("secret-shaped error messages are redacted with the canonical code preserved", () => {
  // Token-shaped literals are assembled at runtime so the repository secret
  // scanner does not flag the test fixtures themselves; the sanitizer still
  // receives and must redact the fully-formed shapes.
  const githubToken = ["ghp_", "A".repeat(26)].join("");
  const npmToken = ["npm_", "A".repeat(24)].join("");
  const cases = [
    "OPENAI_API_KEY=sk-proj-abc123def456",
    "Authorization: Bearer abc.def.ghi",
    `token ${githubToken} in message`,
    `${npmToken} token`,
    "failed to reach https://user:secretpass@internal.host/api",
  ];
  for (const injected of cases) {
    const sanitized = sanitizeClientMessage(`request failed: ${injected}`);
    assert.equal(sanitized.includes("[REDACTED]"), true, injected);
  }
  const payload = sanitizeErrorPayload({
    code: "E_TASK_SCOPE_CONFLICT",
    message: `conflict while using Authorization: Bearer ${"super".repeat(4)}secret`,
  });
  assert.equal(payload.code, "E_TASK_SCOPE_CONFLICT");
  assert.equal(payload.message.includes("super"), false);
});

test("stack frames are stripped and long messages bounded", () => {
  const stackish = "E_X: failed\n    at Object.handler (/src/x.js:1:1)\n    at process.process";
  const sanitized = sanitizeClientMessage(stackish);
  assert.equal(sanitized.includes("/src/x.js"), false);

  const huge = "E_LONG: " + "x".repeat(10000);
  assert.ok(sanitizeClientMessage(huge).length <= 2100);
});

test("oversized tool output becomes E_MCP_RESULT_TOO_LARGE without truncation", () => {
  const oversized = envelopeToToolResult({
    ok: true,
    command: "task-list",
    exitCode: 0,
    result: { blob: "x".repeat(5 * 1024 * 1024) },
    error: null,
    metadata: {},
  });
  void oversized;
  const bounded = enforceOutputBound({
    isError: false,
    content: [{ type: "text", text: JSON.stringify({ blob: "y".repeat(5 * 1024 * 1024) }) }],
    structuredContent: { blob: "y".repeat(5 * 1024 * 1024) },
  });
  assert.equal(bounded.isError, true);
  const parsed = JSON.parse(bounded.content[0].text);
  assert.equal(parsed.error.code, "E_MCP_RESULT_TOO_LARGE");
  assert.equal(parsed.blob === undefined || typeof parsed.blob !== "string" || parsed.blob.length < 1024, true);
});
