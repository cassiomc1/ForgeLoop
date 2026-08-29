import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { validateAttestationPredicate, validateAttestationStatement, writeAttestationStatement } from "../src/core/attestation.js";
import { getPackageRoot } from "../src/core/templates.js";
import { taskAttestationStatementHistoryPath } from "../src/core/task-paths.js";

const packageRoot = getPackageRoot();
const zero = "0".repeat(64);

function predicate(taskId = "attestation-001", cycle = 1) {
  return {
    schemaVersion: 1,
    protocol: { name: "ForgeLoop", protocolVersion: 1 },
    task: { taskId, verificationCycle: cycle },
    content: { manifestFingerprint: zero, contentDigest: zero, coveredPaths: [] },
    evidence: {
      contractFingerprint: zero,
      routeFingerprint: null,
      stateFingerprint: zero,
      receiptFingerprint: zero,
      ledgerSeq: 1,
      ledgerHash: zero,
    },
    verification: { completion: "VALID", audit: "VALID" },
  };
}

function statement(cycle = 1) {
  const value = predicate("attestation-001", cycle);
  return {
    schemaVersion: 1,
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name: "forgeloop-task:attestation-001", digest: { sha256: zero } }],
    predicateType: "https://forgeloop.dev/attestation/v1",
    predicate: value,
  };
}

test("ForgeLoop attestation statements validate subject, predicate, and evidence shape", async () => {
  const value = statement();
  assert.equal((await validateAttestationPredicate(value.predicate, packageRoot)).task.taskId, "attestation-001");
  assert.equal((await validateAttestationStatement(value, packageRoot)).predicate.task.verificationCycle, 1);
  await assert.rejects(
    () => validateAttestationPredicate({ ...value.predicate, secret: "ghp_" + "A".repeat(30) }, packageRoot),
    /secret/i,
  );
});

test("attestation statements are versioned by verification cycle without overwriting history", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-attestation-"));
  try {
    await writeAttestationStatement({ target, packageRoot, taskId: "attestation-001", statement: statement(1) });
    await writeAttestationStatement({ target, packageRoot, taskId: "attestation-001", statement: statement(2) });
    await access(path.join(target, taskAttestationStatementHistoryPath("attestation-001", 1)));
    const history = JSON.parse(await readFile(path.join(target, taskAttestationStatementHistoryPath("attestation-001", 1)), "utf8"));
    assert.equal(history.predicate.task.verificationCycle, 1);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
