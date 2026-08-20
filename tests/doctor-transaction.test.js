import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runDoctor } from "../src/commands/doctor.js";
import { getPackageRoot } from "../src/core/templates.js";

test("doctor detects and fixes a recoverable interrupted transaction", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-doctor-transaction-"));
  try {
    const root = path.join(target, ".forgeloop/.txn/txn-doctor");
    await mkdir(path.join(root, "backup"), { recursive: true });
    await writeFile(path.join(root, "manifest.json"), `${JSON.stringify({ transactionId: "txn-doctor", status: "COMMITTING", writes: [] })}\n`);
    const detected = await runDoctor({ target, packageRoot: getPackageRoot() });
    assert.ok(detected.findings.some((finding) => finding.code === "E_TRANSACTION_INCOMPLETE"));
    const fixed = await runDoctor({ target, packageRoot: getPackageRoot(), fix: true });
    assert.ok(fixed.findings.some((finding) => finding.code === "TRANSACTION_RECOVERED"));
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
