#!/usr/bin/env node
// Optional stateless HTTP entrypoint (plan §PR12). Loopback by default;
// non-loopback binds require explicit --allow-remote. No session authority.
import { parseArgs } from "node:util";

import { startForgeLoopHttpServer } from "../src/http.js";
import { SERVER_MODES } from "../src/capability-policy.js";
import { logEvent, logStartup } from "../src/logging.js";

const parsed = parseArgs({
  options: {
    project: { type: "string", default: "." },
    mode: { type: "string", default: SERVER_MODES.SAFE },
    host: { type: "string", default: "127.0.0.1" },
    port: { type: "string", default: "3333" },
    "allow-remote": { type: "boolean", default: false },
    "allow-external-execution": { type: "boolean", default: false },
    "allow-maintenance": { type: "boolean", default: false },
    "allow-recovery": { type: "boolean", default: false },
    "allow-legacy-repair": { type: "boolean", default: false },
    "allow-force-recovery": { type: "boolean", default: false },
    "max-execution-time-ms": { type: "string", default: "600000" },
  },
});

try {
  const listener = await startForgeLoopHttpServer({
    projectPath: parsed.values.project,
    mode: parsed.values.mode,
    host: parsed.values.host,
    port: Number(parsed.values.port),
    allowRemote: parsed.values["allow-remote"],
    allowExternalExecution: parsed.values["allow-external-execution"],
    allowMaintenance: parsed.values["allow-maintenance"],
    allowRecovery: parsed.values["allow-recovery"],
    allowLegacyRepair: parsed.values["allow-legacy-repair"],
    allowForceRecovery: parsed.values["allow-force-recovery"],
    maxExecutionTimeMs: Number(parsed.values["max-execution-time-ms"]),
  });
  logStartup({ transport: "http", mode: parsed.values.mode, host: listener.host, port: listener.port });
} catch (error) {
  logEvent("error", "http_server_start_failed", { message: error.message });
  process.exitCode = 1;
}
