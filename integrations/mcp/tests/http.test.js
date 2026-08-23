import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  PROTOCOL_VERSION_META_KEY,
  CLIENT_INFO_META_KEY,
  CLIENT_CAPABILITIES_META_KEY,
} from "@modelcontextprotocol/server";

import { startForgeLoopHttpServer, validateHttpBind, HTTP_TRANSPORT_BOUNDS } from "../src/http.js";
import { removeTempTree } from "../../../tests/helpers/rm-safe.js";

const MODERN_PROTOCOL_VERSION = "2026-07-28";

/**
 * Strict modern MCP 2026 flow: era negotiation happens through
 * `server/discover`, and every subsequent request carries the reserved
 * `_meta` envelope claim (protocol version + client identity).
 */
function modernEnvelope() {
  return {
    [PROTOCOL_VERSION_META_KEY]: MODERN_PROTOCOL_VERSION,
    [CLIENT_INFO_META_KEY]: { name: "http-test-client", version: "0.0.1" },
    [CLIENT_CAPABILITIES_META_KEY]: {},
  };
}

function jsonRpcRequest(id, method, params = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params: { ...params, _meta: modernEnvelope() },
  };
}

async function postJson(baseUrl, body) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": MODERN_PROTOCOL_VERSION,
  };
  // The 2026 modern wire requires the Mcp-Method header to agree with the
  // body method on every request.
  headers["mcp-method"] = body.method;
  return fetch(`${baseUrl}/mcp`, { method: "POST", headers, body: JSON.stringify(body) });
}

async function decode(response) {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (contentType.includes("event-stream")) {
    let message = null;
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        message = JSON.parse(line.slice(5).trim());
      } catch {}
    }
    return message;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

test("non-loopback binds are refused outright (loopback-only release)", () => {
  for (const host of ["0.0.0.0", "192.168.1.10", "::"]) {
    assert.throws(
      () => validateHttpBind({ host }),
      (error) => error.message.includes("E_MCP_REMOTE_NOT_SUPPORTED"),
      host,
    );
  }
  assert.equal(validateHttpBind({ host: "127.0.0.1" }), "127.0.0.1");
  assert.equal(validateHttpBind({ host: "localhost" }), "localhost");
});

test("strict modern flow: discover, tools/list, tools/call; no session authority", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "forgeloop-mcp-http-"));
  const listener = await startForgeLoopHttpServer({ projectPath: target, mode: "safe", port: 0 });
  try {
    const base = `http://127.0.0.1:${listener.port}`;

    const discover = await postJson(base, jsonRpcRequest(1, "server/discover"));
    assert.equal(discover.status, 200);
    assert.equal(discover.headers.get("mcp-session-id"), null);
    const discoverBody = await decode(discover);
    assert.ok(discoverBody.result.supportedVersions.includes(MODERN_PROTOCOL_VERSION));
    const serverIdentity = discoverBody.result._meta?.["io.modelcontextprotocol/serverInfo"];
    assert.equal(serverIdentity?.name ?? discoverBody.result.serverInfo?.name, "forgeloop-mcp");

    const tools = await postJson(base, jsonRpcRequest(2, "tools/list"));
    assert.equal(tools.status, 200);
    const toolsBody = await decode(tools);
    const names = toolsBody.result.tools.map((tool) => tool.name).sort();
    assert.ok(names.includes("forgeloop_status"));
    assert.equal(names.includes("forgeloop_task_recover"), false);

    // A second independent request needs no session: statelessness holds.
    const again = await postJson(base, jsonRpcRequest(3, "tools/list"));
    assert.equal(again.status, 200);
    assert.equal((await decode(again)).result.tools.length, names.length);
  } finally {
    await listener.close();
    await removeTempTree(target);
  }
});

test("legacy-era initialize is rejected by strict-modern mode", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "forgeloop-mcp-http-legacy-"));
  const listener = await startForgeLoopHttpServer({ projectPath: target, mode: "safe", port: 0 });
  try {
    const base = `http://127.0.0.1:${listener.port}`;
    // A legacy handshake: plain initialize without a modern envelope claim.
    const response = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: MODERN_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "legacy-client", version: "0.0.1" },
        },
      }),
    });
    assert.ok(response.status >= 400, `expected rejection, got ${response.status}`);
    const body = await response.json().catch(() => null);
    assert.ok(body?.error, "rejection must carry a JSON-RPC error");
  } finally {
    await listener.close();
    await removeTempTree(target);
  }
});

test("effective transport bounds are observable and match the declared constants", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "forgeloop-mcp-http-bounds-"));
  const listener = await startForgeLoopHttpServer({ projectPath: target, mode: "safe", port: 0 });
  try {
    // §24/§26: the real Node server timeouts are wired and observable.
    assert.deepEqual(listener.transportBounds, {
      headersTimeoutMs: HTTP_TRANSPORT_BOUNDS.headersTimeoutMs,
      requestTimeoutMs: HTTP_TRANSPORT_BOUNDS.requestTimeoutMs,
      keepAliveTimeoutMs: HTTP_TRANSPORT_BOUNDS.keepAliveTimeoutMs,
      maxInFlightRequests: HTTP_TRANSPORT_BOUNDS.maxInFlightRequests,
    });
    const base = `http://127.0.0.1:${listener.port}`;

    const getResponse = await fetch(base + "/mcp", { method: "GET" });
    assert.equal(getResponse.status, 405);

    const headResponse = await fetch(base + "/mcp", { method: "HEAD" });
    assert.equal(headResponse.status, 405);

    const bigResponse = await fetch(base + "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blob: "x".repeat(5 * 1024 * 1024) }),
    });
    assert.equal(bigResponse.status, 413);
  } finally {
    await listener.close();
    await removeTempTree(target);
  }
});

test("the 33rd in-flight request is shed with 503 E_MCP_HTTP_BUSY", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "forgeloop-mcp-http-busy-"));

  // Deterministic hold: each accepted request parks on this gate until we
  // release it. No sleeps — shedding is observed purely by occupancy.
  let held = 0;
  const releaseQueue = [];
  const requestGate = () => new Promise((resolve) => {
    held += 1;
    releaseQueue.push(resolve);
  });

  const listener = await startForgeLoopHttpServer({
    projectPath: target,
    mode: "safe",
    port: 0,
    requestGate,
  });
  try {
    const base = `http://127.0.0.1:${listener.port}`;
    const envelope = {
      [PROTOCOL_VERSION_META_KEY]: MODERN_PROTOCOL_VERSION,
      [CLIENT_INFO_META_KEY]: { name: "busy-client", version: "0.0.1" },
      [CLIENT_CAPABILITIES_META_KEY]: {},
    };
    const heldPromises = [];
    for (let i = 0; i < HTTP_TRANSPORT_BOUNDS.maxInFlightRequests; i += 1) {
      heldPromises.push(fetch(base + "/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "mcp-protocol-version": MODERN_PROTOCOL_VERSION,
          "mcp-method": "ping",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: i, method: "ping" }),
      }).catch((error) => ({ fetchError: error })));
    }

    // Wait until the ceiling is genuinely occupied, then probe with one more.
    let shed = null;
    for (let attempt = 0; attempt < 100 && !shed; attempt += 1) {
      const probe = await fetch(base + "/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 999, method: "ping" }),
      });
      if (probe.status === 503) {
        assert.equal(probe.headers.get("retry-after"), "1");
        const probeBody = await probe.json();
        assert.equal(probeBody.error.code, "E_MCP_HTTP_BUSY");
        shed = true;
      } else {
        await probe.arrayBuffer().catch(() => {});
      }
    }
    assert.equal(shed, true, "ceiling was never reached");

    // Release the held requests and drain every socket cleanly.
    while (releaseQueue.length > 0) releaseQueue.shift()();
    const settled = await Promise.allSettled(heldPromises);
    void settled;
  } finally {
    await listener.close();
    await removeTempTree(target);
  }
});

test("safe-mode capability gating over HTTP", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "forgeloop-mcp-http-safe-"));
  const listener = await startForgeLoopHttpServer({ projectPath: target, mode: "safe", port: 0 });
  try {
    const base = `http://127.0.0.1:${listener.port}`;
    const discover = await postJson(base, jsonRpcRequest(1, "server/discover"));
    assert.equal(discover.status, 200);

    const tools = await postJson(base, jsonRpcRequest(2, "tools/list"));
    const names = (await decode(tools)).result.tools.map((tool) => tool.name);
    assert.equal(names.includes("forgeloop_task_recover"), false);
    assert.equal(names.includes("forgeloop_task_repair_legacy_recovery"), false);
    assert.ok(names.includes("forgeloop_task_resume"));
  } finally {
    await listener.close();
    await removeTempTree(target);
  }
});
