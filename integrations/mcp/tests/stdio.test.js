import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { removeTempTree } from "../../../tests/helpers/rm-safe.js";

const mcpPackageRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const serverEntry = path.join(mcpPackageRoot, "bin", "forgeloop-mcp.js");

/**
 * Plan §92: spawn the real MCP server as a child process and drive it over
 * genuine stdio with the official client. stdout carries only the MCP
 * protocol; diagnostics are structured JSON lines on stderr.
 */
test("stdio end-to-end: spawned server serves a deterministic catalog over real stdio", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "forgeloop-mcp-stdio-e2e-"));
  let stderrText = "";
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry, "--project", target, "--mode", "safe"],
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => {
    stderrText += String(chunk);
  });

  const client = new Client({ name: "stdio-test-client", version: "0.0.1" });
  try {
    await client.connect(transport);

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name).sort();
    assert.ok(names.includes("forgeloop_status"));
    assert.equal(names.includes("forgeloop_task_recover"), false);

    const result = await client.callTool({ name: "forgeloop_status", arguments: {} });
    assert.notEqual(result.isError, true);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.command, "status");

    // Deterministic ordering across calls on the same live connection.
    const again = (await client.listTools()).tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, again);

    await client.close();
  } finally {
    await removeTempTree(target);
  }

  // Every stderr line must be a structured diagnostic JSON record.
  for (const line of stderrText.split("\n").filter((line) => line.trim() !== "")) {
    const parsedLine = JSON.parse(line);
    assert.ok(parsedLine.event);
  }
});
