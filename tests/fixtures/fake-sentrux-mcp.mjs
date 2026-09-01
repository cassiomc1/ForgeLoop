#!/usr/bin/env node

const mode = process.env.SENTRUX_FAKE_MODE ?? "valid";
const version = process.env.SENTRUX_FAKE_VERSION ?? "0.5.7";
const serverName = process.env.SENTRUX_FAKE_SERVER_NAME ?? (mode === "wrong-server-name" ? "other-analyzer" : "sentrux");

const defaultSnapshot = {
  quality_signal: 9000,
  root_causes: {
    modularity: { score: 9000, raw: 0.9 },
    acyclicity: { score: 9000, raw: 0.9 },
    depth: { score: 9000, raw: 0.9 },
    equality: { score: 9000, raw: 0.9 },
    redundancy: { score: 9000, raw: 0.9 },
  },
  files: 3,
  lines: 120,
  import_edges: 4,
};

function snapshot() {
  try {
    const parsed = JSON.parse(process.env.SENTRUX_FAKE_SNAPSHOT ?? JSON.stringify(defaultSnapshot));
    const selected = Array.isArray(parsed)
      ? parsed[Number(process.env.SENTRUX_FAKE_INDEX ?? 0)] ?? parsed.at(-1)
      : parsed;
    if (mode === "secret-field") {
      return { ...selected, diagnostics: { apiKey: "must-not-persist" } };
    }
    if (mode === "outside-path") {
      return { ...selected, diagnostics: { file: "/var/private/outside-project.js" } };
    }
    return selected;
  } catch {
    return defaultSnapshot;
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function toolResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

if (mode === "early-exit") process.exit(17);
if (mode === "hang") {
  setInterval(() => {}, 1000);
} else if (mode === "oversized-output") {
  process.stdout.write("x".repeat(2 * 1024 * 1024 + 64));
} else if (mode === "stderr-flood") {
  process.stderr.write("x".repeat(2 * 1024 * 1024 + 64));
} else {
  let initialized = false;
  process.stdin.setEncoding("utf8");
  let buffer = "";
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    while (true) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) break;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      let request;
      try { request = JSON.parse(line); } catch {
        if (mode === "malformed-jsonrpc") process.stdout.write("not-json\n");
        continue;
      }
      if (request.id === undefined) continue;
      if (mode === "malformed-jsonrpc") {
        process.stdout.write("not-json\n");
        continue;
      }
      if (request.method === "initialize") {
        initialized = true;
        send({ jsonrpc: "2.0", id: request.id, result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: serverName, version },
        } });
      } else if (request.method === "tools/list") {
        send({ jsonrpc: "2.0", id: request.id, result: {
          tools: mode === "missing-health"
            ? [{ name: "scan" }]
            : [{ name: "scan" }, { name: "health" }],
        } });
      } else if (request.method === "tools/call") {
        if (!initialized) {
          send({ jsonrpc: "2.0", id: request.id, error: { code: -32000, message: "not initialized" } });
        } else if (mode === "provider-error") {
          send({ jsonrpc: "2.0", id: request.id, error: { code: -32001, message: "fake provider failure" } });
        } else if (request.params?.name === "scan") {
          send({ jsonrpc: "2.0", id: request.id, result: toolResult(snapshot()) });
        } else if (request.params?.name === "health") {
          if (mode === "malformed-health-json") {
            send({ jsonrpc: "2.0", id: request.id, result: { content: [{ type: "text", text: "{not-json" }] } });
          } else {
            send({ jsonrpc: "2.0", id: request.id, result: toolResult({
              cross_module_edges: snapshot().cross_module_edges ?? 2,
              diagnostics: mode === "secret-health"
                ? { accessToken: "must-not-persist" }
                : null,
            }) });
          }
        } else {
          send({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "unknown tool" } });
        }
      } else {
        send({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "unknown method" } });
      }
    }
  });
}
