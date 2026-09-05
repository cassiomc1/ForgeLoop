import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";

import { createForgeLoopMcpServer } from "../src/server.js";
import { SERVER_MODES } from "../src/capability-policy.js";
import { removeTempTree } from "../../../tests/helpers/rm-safe.js";

async function connectServer({ mode = SERVER_MODES.SAFE, projectPath = "." } = {}) {
  const target = await mkdtemp(path.join(tmpdir(), "forgeloop-mcp-server-"));
  const { server, policy, projectContext } = await createForgeLoopMcpServer({
    projectPath: projectPath === "." ? target : projectPath,
    mode,
  });
  const client = new Client({ name: "test-client", version: "0.0.1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, policy, projectContext, cleanup: async () => { await removeTempTree(target); } };
}

test("deterministic tool catalog over the wire", async () => {
  const { client, cleanup } = await connectServer();
  try {
    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name).sort();
    assert.equal(new Set(names).size, names.length);
    assert.ok(names.includes("forgeloop_status"));
    assert.ok(names.includes("forgeloop_task_resume"));
    assert.equal(names.includes("forgeloop_task_recover"), false);
    assert.equal(names.includes("forgeloop_task_repair_legacy_recovery"), false);

    // Deterministic ordering across calls.
    const again = (await client.listTools()).tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, again);
  } finally {
    await cleanup();
  }
});

test("capabilities tool exposes canonical ownership features", async () => {
  const { client, cleanup } = await connectServer();
  try {
    const result = await client.callTool({ name: "forgeloop_protocol_info", arguments: {} });
    assert.equal(result.isError, undefined || false);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.result.features.taskClaimRecovery.validatedClaimProjection, true);
    assert.equal(parsed.result.features.integrationApi.version, 1);
  } finally {
    await cleanup();
  }
});

test("task-aware mutation requires explicit taskId", async () => {
  const { client, cleanup } = await connectServer();
  try {
    // The generated JSON Schema makes taskId required; the SDK validates
    // before the tool handler runs.
    const result = await client.callTool({ name: "forgeloop_advance", arguments: {} });
    assert.equal(result.isError, true);
    const text = result.content[0].text;
    const parsed = (() => { try { return JSON.parse(text); } catch { return null; } })();
    if (parsed) {
      assert.match(parsed.error.code ?? "", /E_MCP_TASK_ID_REQUIRED|E_TASK_REQUIRED/);
    } else {
      assert.match(text, /Input validation|taskId|required/i);
    }
  } finally {
    await cleanup();
  }
});

test("ownership resource projects the canonical resolver", async () => {
  const { client, cleanup } = await connectServer();
  try {
    const resources = await client.listResources();
    const uris = resources.resources.map((resource) => resource.uri);
    assert.ok(uris.includes("forgeloop://protocol/info"));
    assert.ok(uris.includes("forgeloop://project/tasks"));

    const tasks = await client.readResource({ uri: "forgeloop://project/tasks" });
    assert.ok(JSON.parse(tasks.contents[0].text).count >= 0);
  } finally {
    await cleanup();
  }
});
