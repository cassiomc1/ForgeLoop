import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolveForgeLoopProjectRoot } from "../src/core/project-root.js";
import { removeTempTree } from "./helpers/rm-safe.js";

test("resolveForgeLoopProjectRoot mirrors CLI target semantics", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "forgeloop-root-helper-"));
  try {
    // Real directory -> accepted as absolute realpath.
    const realDir = path.join(base, "project");
    await mkdir(realDir);
    const resolved = await resolveForgeLoopProjectRoot(realDir);
    const expected = path.resolve(await (await import("node:fs/promises")).realpath(realDir));
    assert.equal(resolved, expected);

    // Nested directory -> accepted.
    const nested = path.join(realDir, "nested");
    await mkdir(nested);
    assert.equal(
      await resolveForgeLoopProjectRoot(nested),
      path.resolve(await (await import("node:fs/promises")).realpath(nested)),
    );

    // Relative real path -> accepted.
    assert.ok(path.isAbsolute(await resolveForgeLoopProjectRoot(".")));

    // Missing -> rejected.
    await assert.rejects(() => resolveForgeLoopProjectRoot(path.join(base, "absent")));

    // Regular file -> rejected.
    const filePath = path.join(base, "file.txt");
    await writeFile(filePath, "content");
    await assert.rejects(() => resolveForgeLoopProjectRoot(filePath), /not a directory/);

    // Symlink to a directory -> rejected exactly like the CLI resolver.
    const linkPath = path.join(base, "link");
    let symlinkSupported = true;
    try {
      await symlink(realDir, linkPath, "dir");
    } catch {
      symlinkSupported = false;
    }
    if (symlinkSupported) {
      await assert.rejects(() => resolveForgeLoopProjectRoot(linkPath), /not a directory/);
    }
  } finally {
    await removeTempTree(base);
  }
});
