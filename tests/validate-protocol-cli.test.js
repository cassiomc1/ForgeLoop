import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { evaluateRoute } from "../src/core/router.js";
import { contractFingerprint, createWorkState } from "../src/core/work-state.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repositoryRoot, "src", "cli.js");

function runCli(target, ...args) {
  return spawnSync(process.execPath, [cliPath, ...args, "--path", target], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

test("validate-protocol validates a read-only coherent artifact set", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "mdfiles-conformance-cli-"));
  try {
    const route = evaluateRoute({ workType: "api", surfaces: ["api"], platforms: [] });
    const contract = { objective: "cli conformance" };
    const state = createWorkState({
      taskId: "parent",
      contractFingerprint: contractFingerprint(contract),
      repositoryFingerprint: { branch: null, head: null },
      phase: "ROUTED",
      selectedGuides: route.guides,
      completedSteps: [],
      pendingSteps: ["implementation"],
      checks: [],
      failures: [],
      blockers: [],
      verificationEvidence: [],
    });
    const receipt = {
      schemaVersion: 1,
      protocolVersion: 1,
      taskId: "parent",
      contractFingerprint: state.contractFingerprint,
      selectedGuides: route.guides,
      changedPaths: [],
      checks: [],
      review: { status: "not-run", independent: false },
      limitations: [],
      publication: { committed: false, pushed: false, pullRequest: null, deployed: false },
    };
    const brief = {
      schemaVersion: 1,
      protocolVersion: 1,
      taskId: "child",
      parentTaskId: "parent",
      objective: "child",
      allowedPaths: ["src/child.js"],
      readOnlyPaths: [],
      dependencies: [],
      constraints: [],
      requiredGuides: ["clean"],
      verification: ["npm test"],
      authority: ["write src/child.js"],
      deliverables: ["src/child.js"],
    };
    const delegated = {
      schemaVersion: 1,
      protocolVersion: 1,
      taskId: "child",
      status: "complete-with-concerns",
      changes: [],
      verification: ["npm test"],
      openFindings: [],
      limitations: [],
    };
    for (const [name, value] of Object.entries({ route, state, receipt, brief, delegated })) {
      await writeFile(path.join(target, `${name}.json`), `${JSON.stringify(value)}\n`);
    }

    const result = runCli(
      target,
      "validate-protocol",
      "--route-file", "route.json",
      "--state-file", "state.json",
      "--receipt-file", "receipt.json",
      "--task-brief-file", "brief.json",
      "--delegated-result-file", "delegated.json",
      "--json",
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "VALID");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("validate-protocol reports inconsistencies and rejects unsafe paths", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "mdfiles-conformance-cli-"));
  try {
    await writeFile(path.join(target, "route.json"), JSON.stringify({ schemaVersion: 1, protocolVersion: 1, guides: [] }));
    await writeFile(path.join(target, "state.json"), JSON.stringify({ schemaVersion: 1, protocolVersion: 1, taskId: "p", selectedGuides: ["clean"] }));
    await writeFile(path.join(target, "receipt.json"), JSON.stringify({ schemaVersion: 1, protocolVersion: 1, taskId: "p", selectedGuides: [] }));

    const inconsistent = runCli(target, "validate-protocol", "--route-file", "route.json", "--state-file", "state.json", "--receipt-file", "receipt.json", "--json");
    assert.equal(inconsistent.status, 1);
    assert.equal(JSON.parse(inconsistent.stdout).status, "INVALID");

    const unsafe = runCli(target, "validate-protocol", "--route-file", "../route.json", "--json");
    assert.equal(unsafe.status, 1);
    assert.match(unsafe.stderr, /inside target|escapes target/i);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
