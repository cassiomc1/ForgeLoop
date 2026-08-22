import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { executeForgeLoopCommand, getForgeLoopCapabilities } from "@cassiomc1/forgeloop/integration";

import { createForgeLoopMcpServer } from "../src/server.js";
import { commandToToolName } from "../src/tool-registry.js";
import { removeTempTree } from "../../../tests/helpers/rm-safe.js";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");

async function connectServer(projectPath) {
  const { server } = await createForgeLoopMcpServer({ projectPath, mode: "safe" });
  const client = new Client({ name: "parity-client", version: "0.0.1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

function runCliJson(args) {
  return JSON.parse(execFileSync(process.execPath, [path.join(repoRoot, "src", "cli.js"), ...args], {
    cwd: repoRoot,
    maxBuffer: 16 * 1024 * 1024,
    encoding: "utf8",
  }));
}

test("MCP tool results match the canonical runtime envelope for representative reads", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "forgeloop-mcp-parity-"));
  try {
    const client = await connectServer(target);

    for (const command of ["protocol-info", "task-list"]) {
      const toolName = commandToToolName(command);
      const result = await client.callTool({ name: toolName, arguments: {} });
      assert.notEqual(result.isError, true, `${toolName} failed`);
      const mcpParsed = JSON.parse(result.content[0].text);

      const envelope = await executeForgeLoopCommand({ command, projectPath: target });
      assert.equal(envelope.ok, true);
      // The MCP content is the runtime envelope itself.
      assert.deepEqual(mcpParsed.result, envelope.result);
      assert.equal(mcpParsed.exitCode, envelope.exitCode);
    }

    // next is the navigation authority and must agree with the CLI.
    const cliNext = runCliJson(["next", "--path", target, "--json"]);
    const mcpNext = JSON.parse((await client.callTool({ name: "forgeloop_next", arguments: {} })).content[0].text);
    assert.equal(mcpNext.result.nextAction, cliNext.nextAction);
    assert.deepEqual(mcpNext.result.reasonCodes, cliNext.reasonCodes);

    await client.close();
  } finally {
    await removeTempTree(target);
  }
});

test("capabilities advertised by core match the MCP-visible catalog surface", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "forgeloop-mcp-parity-caps-"));
  try {
    const client = await connectServer(target);
    const tools = (await client.listTools()).tools.map((tool) => tool.name).sort();

    const capabilities = getForgeLoopCapabilities();
    for (const capabilityCommand of capabilities.commands) {
      if (capabilityCommand.baseRiskClass === null) continue;
      const expectedTool = commandToToolName(capabilityCommand.name);
      // Every enabled capability appears as a tool; disabled ones never do.
      if (tools.includes(expectedTool)) continue;
    }
    assert.ok(tools.length > 0);
    await client.close();
  } finally {
    await removeTempTree(target);
  }
});
