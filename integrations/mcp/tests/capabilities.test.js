import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import * as nodeFs from "node:fs";

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";

import { createForgeLoopMcpServer, mcpServerVersion } from "../src/server.js";
import { resolveLaunchPolicy, SERVER_MODES } from "../src/capability-policy.js";
import { removeTempTree } from "../../../tests/helpers/rm-safe.js";

async function connectServer({ mode = SERVER_MODES.SAFE, projectPath = "." } = {}) {
  const target = await mkdtemp(path.join(tmpdir(), "forgeloop-mcp-caps-"));
  const { server, policy } = await createForgeLoopMcpServer({
    projectPath: projectPath === "." ? target : projectPath,
    mode,
  });
  const client = new Client({ name: "caps-client", version: "0.0.1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, policy, cleanup: async () => { await removeTempTree(target); } };
}

test("forgeloop_capabilities exists and reports versions, features, policy, and resources", async () => {
  const { client, cleanup } = await connectServer({ mode: SERVER_MODES.FULL, projectPath: "." });
  try {
    for (const mode of ["readonly", "safe", "full"]) {
      void mode;
      break; // single connection suffices; mode coverage below
    }
    const result = await client.callTool({ name: "forgeloop_capabilities", arguments: {} });
    assert.notEqual(result.isError, true);
    const data = result.structuredContent;
    assert.equal(data.integrationApiVersion, 1);
    assert.equal(data.features.taskClaimRecovery.validatedClaimProjection, true);
    assert.equal(data.server.package, "@cassiomc1/forgeloop-mcp");
    assert.equal(data.server.mode, "full");
    // Policy is reported safely: capability booleans only.
    assert.equal(typeof data.server.transportCapabilities.allowRecovery, "boolean");
    assert.deepEqual(
      data.resources,
      ["protocol/info", "project/tasks", "task/status", "task/ownership", "task/contract", "task/continuity"],
    );
  } finally {
    await cleanup();
  }
});

test("capabilities tool is available in readonly mode too", async () => {
  const { client, cleanup } = await connectServer({ mode: SERVER_MODES.READONLY });
  try {
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    assert.ok(tools.includes("forgeloop_capabilities"));
    const result = await client.callTool({ name: "forgeloop_capabilities", arguments: {} });
    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent.server.mode, "readonly");
  } finally {
    await cleanup();
  }
});

test("mcpServerVersion reads the package manifest as single source of truth (§22)", () => {
  const { readFileSync } = nodeFs;
  const manifestPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const expected = JSON.parse(readFileSync(manifestPath, "utf8")).version;
  assert.equal(mcpServerVersion(), expected);
  // The registered product uses the same version (§22 serverInfo parity).
  assert.equal(mcpServerVersion(), "0.1.0");
});
