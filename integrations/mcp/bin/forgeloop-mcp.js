#!/usr/bin/env node
import { parseArgs } from "node:util";

import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { createForgeLoopMcpServer } from "../src/server.js";
import { SERVER_MODES } from "../src/capability-policy.js";
import { logEvent, logStartup } from "../src/logging.js";

const parsed = parseArgs({
  options: {
    project: { type: "string", default: "." },
    mode: { type: "string", default: SERVER_MODES.SAFE },
    "allow-external-execution": { type: "boolean", default: false },
    "allow-maintenance": { type: "boolean", default: false },
    "allow-recovery": { type: "boolean", default: false },
    "allow-legacy-repair": { type: "boolean", default: false },
    "allow-force-recovery": { type: "boolean", default: false },
    "max-execution-time-ms": { type: "string", default: "600000" },
  },
});

try {
  const { server: forgeLoopMcpServer, policy, projectContext } = await createForgeLoopMcpServer({
    projectPath: parsed.values.project,
    mode: parsed.values.mode,
    allowExternalExecution: parsed.values["allow-external-execution"],
    allowMaintenance: parsed.values["allow-maintenance"],
    allowRecovery: parsed.values["allow-recovery"],
    allowLegacyRepair: parsed.values["allow-legacy-repair"],
    allowForceRecovery: parsed.values["allow-force-recovery"],
    maxExecutionTimeMs: Number(parsed.values["max-execution-time-ms"]),
  });

  logStartup({ mode: policy.mode, projectRoot: projectContext.projectRoot });

  await serveStdio(() => forgeLoopMcpServer);
} catch (error) {
  logEvent("error", "server_start_failed", { message: error.message });
  process.exitCode = 1;
}
