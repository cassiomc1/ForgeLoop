import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { startForgeLoopHttpServer, validateHttpBind } from "../src/http.js";
import { removeTempTree } from "../../../tests/helpers/rm-safe.js";

const PROTOCOL_VERSION = "2026-07-28";

// The stateless endpoint answers either application/json or a single-exchange
// text/event-stream (protocol-native encoding). This helper returns the
// decoded JSON-RPC message for both encodings.
async function postMcp(baseUrl, body, { protocolVersionHeader = true } = {}) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  let message = null;
  if (contentType.includes("event-stream")) {
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        message = JSON.parse(line.slice(5).trim());
      } catch {}
    }
  } else {
    try {
      message = JSON.parse(text);
    } catch {}
  }
  return { response, message };
}

function jsonRpcRequest(id, method, params = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    ...(Object.keys(params).length > 0 ? { params } : {}),
  };
}

async function postJson(baseUrl, body, { protocolVersionHeader = true } = {}) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  // Per the 2026 model, initialize performs the version handshake itself;
  // the MCP-Protocol-Version header applies to subsequent requests.
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

test("non-loopback bind requires explicit --allow-remote", () => {
  assert.throws(
    () => validateHttpBind({ host: "0.0.0.0" }),
    /E_MCP_REMOTE_BIND_REQUIRES_OPT_IN/,
  );
  assert.throws(
    () => validateHttpBind({ host: "192.168.1.10", allowRemote: false }),
    /E_MCP_REMOTE_BIND_REQUIRES_OPT_IN/,
  );
  assert.equal(validateHttpBind({ host: "127.0.0.1" }), "127.0.0.1");
  assert.equal(validateHttpBind({ host: "0.0.0.0", allowRemote: true }), "0.0.0.0");
});

test("stateless HTTP transport serves initialize and tools/list without session authority", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "forgeloop-mcp-http-"));
  const listener = await startForgeLoopHttpServer({ projectPath: target, mode: "safe", port: 0 });
  try {
    const base = `http://127.0.0.1:${listener.port}`;

    const init = await postMcp(base, jsonRpcRequest(1, "initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "http-test-client", version: "0.0.1" },
    }));
    assert.equal(init.response.status, 200);
    // Stateless model: no session identity is minted or required.
    assert.equal(init.response.headers.get("mcp-session-id"), null);
    assert.equal(init.message.result.serverInfo.name, "forgeloop-mcp");

    const tools = await postMcp(base, jsonRpcRequest(2, "tools/list"));
    assert.equal(tools.response.status, 200);
    const names = tools.message.result.tools.map((tool) => tool.name).sort();
    assert.ok(names.includes("forgeloop_status"));
    assert.equal(names.includes("forgeloop_task_recover"), false);

    // A second independent request needs no session: statelessness holds.
    const again = await postMcp(base, jsonRpcRequest(3, "tools/list"));
    assert.equal(again.response.status, 200);
    assert.equal(again.message.result.tools.length, tools.message.result.tools.length);
  } finally {
    await listener.close();
    await removeTempTree(target);
  }
});

test("HTTP mutation respects safe-mode capability gates", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "forgeloop-mcp-http-safe-"));
  const listener = await startForgeLoopHttpServer({ projectPath: target, mode: "safe", port: 0 });
  try {
    const base = `http://127.0.0.1:${listener.port}`;
    await postMcp(base, jsonRpcRequest(1, "initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "http-test-client", version: "0.0.1" },
    }));

    // task-recover is not in the safe-mode catalog: the tool call is refused
    // before any ForgeLoop execution happens.
    const recoverCall = await postMcp(base, jsonRpcRequest(2, "tools/call", {
      name: "forgeloop_task_recover",
      arguments: { taskId: "x", acknowledgeRecovery: true },
    }));
    assert.equal(recoverCall.response.status, 200);
    // The safe-mode catalog never registers task-recover, so the call fails
    // at the protocol level (unknown tool) or at the adapter gate.
    if (recoverCall.message.error) {
      assert.equal(recoverCall.message.error.code, -32602);
    } else {
      const payload = JSON.parse(recoverCall.message.result.content[0].text);
      assert.match(payload.error.code ?? "", /E_MCP_CAPABILITY_DISABLED/);
    }

    // task-resume (CLAIM_REACQUISITION) IS exposed in safe mode.
    const listResult = await postMcp(base, jsonRpcRequest(3, "tools/list"));
    const listBody = listResult.message;
    assert.ok(listBody.result.tools.some((tool) => tool.name === "forgeloop_task_resume"));
  } finally {
    await listener.close();
    await removeTempTree(target);
  }
});
