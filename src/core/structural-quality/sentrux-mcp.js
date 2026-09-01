import { spawn as nodeSpawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { assertSafePath, ensureWithin, fileExists, readBytes } from "../filesystem.js";
import { sha256 } from "../manifest.js";
import {
  E_STRUCTURAL_QUALITY_OUTPUT_LIMIT,
  E_STRUCTURAL_QUALITY_PROVIDER_INVALID,
  E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID,
  E_STRUCTURAL_QUALITY_PROVIDER_TOOL_CONTRACT_INVALID,
  E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE,
  E_STRUCTURAL_QUALITY_PROVIDER_VERSION_UNSUPPORTED,
  E_STRUCTURAL_QUALITY_SCAN_FAILED,
  E_STRUCTURAL_QUALITY_TIMEOUT,
} from "../error-codes.js";
import {
  STRUCTURAL_QUALITY_DEFAULT_TIMEOUT_MS,
  STRUCTURAL_QUALITY_MAX_OUTPUT_BYTES,
  STRUCTURAL_QUALITY_MAX_TIMEOUT_MS,
  STRUCTURAL_QUALITY_MEASUREMENT_MODEL,
  STRUCTURAL_QUALITY_SENTRUX_COMPATIBILITY_KEY,
  STRUCTURAL_QUALITY_SENTRUX_MIN_VERSION,
  structuralQualityError,
} from "./constants.js";
import { assertStructuralQualityProvider, normalizeStructuralQualityDetection, normalizeStructuralQualitySnapshot } from "./provider.js";

const DEFAULT_EXECUTABLE = "sentrux";
const DEFAULT_ARGS = Object.freeze(["--mcp"]);
const MCP_PROTOCOL_VERSION = "2024-11-05";
const SENTRUX_RULES_PATH = ".sentrux/rules.toml";

function mcpError(code, message) {
  return structuralQualityError(code, message);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function versionParts(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u.exec(String(value ?? ""));
  return match ? match.slice(1).map(Number) : null;
}

function versionAtLeast(actual, minimum) {
  const left = versionParts(actual);
  const right = versionParts(minimum);
  if (!left || !right) return false;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}

function parseJsonLine(line) {
  try {
    const value = JSON.parse(line);
    if (!isRecord(value)) throw new Error("JSON-RPC message must be an object");
    if (value.jsonrpc !== "2.0") throw new Error("JSON-RPC message must declare jsonrpc 2.0");
    return value;
  } catch (error) {
    throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID, `Sentrux emitted malformed JSON-RPC: ${error.message}`);
  }
}

function responseResult(message, requestId) {
  if (message.id !== requestId) {
    throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID, "Sentrux JSON-RPC response ID does not match the request");
  }
  if (Object.prototype.hasOwnProperty.call(message, "result") && Object.prototype.hasOwnProperty.call(message, "error")) {
    throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID, "Sentrux JSON-RPC response contains both result and error");
  }
  if (Object.prototype.hasOwnProperty.call(message, "error")) {
    const detail = isRecord(message.error) ? message.error.message ?? "provider returned an error" : "provider returned an invalid error";
    const error = mcpError(E_STRUCTURAL_QUALITY_SCAN_FAILED, `Sentrux request failed: ${detail}`);
    error.providerError = message.error;
    throw error;
  }
  if (!Object.prototype.hasOwnProperty.call(message, "result")) {
    throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID, "Sentrux JSON-RPC response has no result");
  }
  return message.result;
}

class McpStdioSession {
  constructor({ projectPath, timeoutMs, maxOutputBytes, executable, args, spawnImpl, env }) {
    this.projectPath = projectPath;
    this.timeoutMs = Math.min(timeoutMs ?? STRUCTURAL_QUALITY_DEFAULT_TIMEOUT_MS, STRUCTURAL_QUALITY_MAX_TIMEOUT_MS);
    this.maxOutputBytes = maxOutputBytes ?? STRUCTURAL_QUALITY_MAX_OUTPUT_BYTES;
    this.executable = executable ?? DEFAULT_EXECUTABLE;
    this.args = [...(args ?? DEFAULT_ARGS)];
    this.spawnImpl = spawnImpl ?? nodeSpawn;
    this.env = env;
    this.child = null;
    this.buffer = "";
    this.nextId = 1;
    this.pending = new Map();
    this.outputBytes = 0;
    this.stderrText = "";
    this.stdoutEnded = false;
    this.closed = false;
    this.timeout = null;
    this.protocolError = null;
  }

  async start() {
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 0 || this.timeoutMs > STRUCTURAL_QUALITY_MAX_TIMEOUT_MS) {
      throw mcpError(E_STRUCTURAL_QUALITY_TIMEOUT, "Sentrux timeout must be a non-negative integer no greater than 300000ms");
    }
    if (!Number.isInteger(this.maxOutputBytes) || this.maxOutputBytes < 1 || this.maxOutputBytes > STRUCTURAL_QUALITY_MAX_OUTPUT_BYTES) {
      throw mcpError(E_STRUCTURAL_QUALITY_OUTPUT_LIMIT, "Sentrux maxOutputBytes must be between 1 and 2097152");
    }
    try {
      this.child = this.spawnImpl(this.executable, this.args, {
        cwd: this.projectPath,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        ...(this.env ? { env: { ...process.env, ...this.env } } : {}),
      });
    } catch (error) {
      throw this.spawnFailure(error);
    }
    if (!this.child || !this.child.stdout || !this.child.stdin || !this.child.stderr) {
      throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID, "Sentrux process did not expose piped stdio");
    }
    this.child.stdout.on("data", (chunk) => this.consumeOutput(chunk, false));
    this.child.stderr.on("data", (chunk) => this.consumeOutput(chunk, true));
    this.child.stdout.on("end", () => {
      this.stdoutEnded = true;
      if (this.buffer.trim()) this.fail(mcpError(E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID, "Sentrux ended with an incomplete JSON-RPC line"));
    });
    this.child.on("error", (error) => this.fail(this.spawnFailure(error)));
    this.child.on("close", (code, signal) => {
      this.closed = true;
      if (this.pending.size > 0 && !this.protocolError) {
        this.fail(mcpError(E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE, `Sentrux exited before completing its JSON-RPC response (${code ?? "null"}/${signal ?? "none"})`));
      }
    });
    this.timeout = setTimeout(() => this.fail(mcpError(E_STRUCTURAL_QUALITY_TIMEOUT, `Sentrux exceeded the ${this.timeoutMs}ms timeout`)), this.timeoutMs);
    return this;
  }

  spawnFailure(error) {
    if (error?.code === "ENOENT") return mcpError(E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE, "Sentrux executable is unavailable on PATH");
    return mcpError(E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE, `Unable to start Sentrux: ${error?.message ?? String(error)}`);
  }

  consumeOutput(chunk, stderr) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    this.outputBytes += bytes.byteLength;
    if (this.outputBytes > this.maxOutputBytes) {
      this.fail(mcpError(E_STRUCTURAL_QUALITY_OUTPUT_LIMIT, `Sentrux combined stdout/stderr exceeded ${this.maxOutputBytes} bytes`));
      return;
    }
    if (stderr) {
      this.stderrText = `${this.stderrText}${bytes.toString("utf8")}`.slice(-4096);
      return;
    }
    this.buffer += bytes.toString("utf8");
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) break;
      const line = this.buffer.slice(0, newline).replace(/\r$/u, "");
      this.buffer = this.buffer.slice(newline + 1);
      if (!line.trim()) continue;
      let message;
      try {
        message = parseJsonLine(line);
      } catch (error) {
        this.fail(error);
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(message, "id")) continue;
      const pending = this.pending.get(message.id);
      if (!pending) {
        this.fail(mcpError(E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID, "Sentrux returned an unexpected or duplicate JSON-RPC response"));
        return;
      }
      this.pending.delete(message.id);
      try {
        pending.resolve(responseResult(message, message.id));
      } catch (error) {
        pending.reject(error);
      }
    }
  }

  fail(error) {
    if (this.protocolError) return;
    this.protocolError = error;
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    this.terminate();
  }

  request(method, params = {}) {
    if (this.protocolError || this.closed) return Promise.reject(this.protocolError ?? mcpError(E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE, "Sentrux process is not running"));
    const id = this.nextId;
    this.nextId += 1;
    const message = `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.child.stdin.write(message);
      } catch (error) {
        this.pending.delete(id);
        reject(mcpError(E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE, `Unable to write to Sentrux stdin: ${error.message}`));
      }
    });
  }

  notify(method, params = {}) {
    if (this.protocolError || this.closed) return;
    try {
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    } catch {
      // The corresponding request will fail through the process close/error
      // event; notifications have no response to reject.
    }
  }

  async stop() {
    if (!this.child) return;
    if (this.timeout) clearTimeout(this.timeout);
    try { this.child.stdin.end(); } catch { /* process may already be gone */ }
    await delay(20).catch(() => {});
    if (!this.closed) {
      try { this.child.kill("SIGTERM"); } catch { /* preserve provider result */ }
      await delay(100).catch(() => {});
    }
    if (!this.closed) {
      try { this.child.kill("SIGKILL"); } catch { /* preserve provider result */ }
    }
  }

  terminate() {
    try { this.child?.kill("SIGTERM"); } catch { /* preserve original error */ }
  }
}

function inspectSentruxToolContract(tools) {
  if (!Array.isArray(tools)) {
    throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID, "Sentrux tools/list response has no tools array");
  }
  const scan = tools.find((t) => t?.name === "scan");
  const health = tools.find((t) => t?.name === "health");
  if (!scan || !health) {
    throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID, "Sentrux must expose both scan and health MCP tools");
  }
  const scanSchema = scan.inputSchema;
  if (!isRecord(scanSchema)
    || scanSchema.type !== "object"
    || !Array.isArray(scanSchema.required)
    || !scanSchema.required.includes("path")
    || !isRecord(scanSchema.properties)
    || scanSchema.properties.path?.type !== "string") {
    throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_TOOL_CONTRACT_INVALID, "Sentrux scan tool contract must be an object schema requiring a string path property");
  }
  const healthSchema = health.inputSchema;
  if (healthSchema !== undefined && healthSchema !== null
    && (!isRecord(healthSchema) || healthSchema.type !== "object")) {
    throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_TOOL_CONTRACT_INVALID, "Sentrux health tool contract must be an object schema");
  }
}

async function openHandshake(options) {
  const session = await new McpStdioSession(options).start();
  try {
    const initialized = await session.request("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "forgeloop", version: "1" },
    });
    const serverInfo = initialized?.serverInfo ?? initialized?.server_info;
    if (!isRecord(serverInfo) || serverInfo.name !== "sentrux" || typeof serverInfo.version !== "string") {
      throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID, "Sentrux initialize response has an invalid serverInfo identity");
    }
    if (!versionAtLeast(serverInfo.version, STRUCTURAL_QUALITY_SENTRUX_MIN_VERSION)) {
      throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_VERSION_UNSUPPORTED, `Sentrux ${serverInfo.version} is older than the supported ${STRUCTURAL_QUALITY_SENTRUX_MIN_VERSION}`);
    }
    session.notify("notifications/initialized");
    const listed = await session.request("tools/list", {});
    inspectSentruxToolContract(listed?.tools);
    return { session, serverInfo };
  } catch (error) {
    await session.stop();
    throw error;
  }
}

async function callTool(session, name, args = {}) {
  const response = await session.request("tools/call", {
    name,
    arguments: args,
  });
  if (!isRecord(response) || response.isError === true || !Array.isArray(response.content)) {
    throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID, `Sentrux ${name} tool returned an invalid MCP result`);
  }
  const textItems = response.content.filter((item) => item?.type === "text");
  if (textItems.length !== 1 || typeof textItems[0].text !== "string") {
    throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID, `Sentrux ${name} tool must return exactly one text content item`);
  }
  try {
    const parsed = JSON.parse(textItems[0].text);
    if (!isRecord(parsed)) throw new Error("tool text must contain a JSON object");
    return parsed;
  } catch (error) {
    throw mcpError(E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID, `Sentrux ${name} tool returned malformed JSON text: ${error.message}`);
  }
}

function mergedSnapshot(scan, health, projectPath) {
  const snapshot = {
    ...scan,
    ...(scan.snapshot && isRecord(scan.snapshot) ? scan.snapshot : {}),
    ...(health.snapshot && isRecord(health.snapshot) ? health.snapshot : {}),
    qualitySignal: scan.qualitySignal ?? scan.quality_signal ?? scan.snapshot?.qualitySignal ?? scan.snapshot?.quality_signal
      ?? health.qualitySignal ?? health.quality_signal ?? health.snapshot?.qualitySignal ?? health.snapshot?.quality_signal,
    rootCauses: scan.rootCauses ?? scan.root_causes ?? scan.snapshot?.rootCauses ?? scan.snapshot?.root_causes
      ?? health.rootCauses ?? health.root_causes ?? health.snapshot?.rootCauses ?? health.snapshot?.root_causes,
    statistics: scan.statistics ?? scan.snapshot?.statistics ?? health.statistics ?? health.snapshot?.statistics,
    diagnostics: health.diagnostics ?? scan.diagnostics ?? scan.snapshot?.diagnostics ?? null,
    scan: scan.scan ?? scan,
  };
  if (health.crossModuleEdges !== undefined || health.cross_module_edges !== undefined) {
    snapshot.statistics = {
      ...(snapshot.statistics ?? {}),
      crossModuleEdges: health.crossModuleEdges ?? health.cross_module_edges,
    };
  }
  return normalizeStructuralQualitySnapshot(snapshot, { projectPath });
}

async function sentruxScopeBinding(projectPath) {
  let rulesFingerprint = null;
  if (projectPath) {
    try {
      await assertSafePath(projectPath, SENTRUX_RULES_PATH);
      const rulesAbsolute = ensureWithin(projectPath, SENTRUX_RULES_PATH);
      if (await fileExists(rulesAbsolute)) rulesFingerprint = sha256(await readBytes(rulesAbsolute));
    } catch {
      // invalid path handled gracefully
    }
  }
  return {
    providerConfigFingerprint: rulesFingerprint,
    measurementCompatibilityKey: STRUCTURAL_QUALITY_SENTRUX_COMPATIBILITY_KEY,
  };
}

export function createSentruxStructuralQualityProvider({
  projectPath,
  timeoutMs = STRUCTURAL_QUALITY_DEFAULT_TIMEOUT_MS,
  maxOutputBytes = STRUCTURAL_QUALITY_MAX_OUTPUT_BYTES,
  executable = DEFAULT_EXECUTABLE,
  args = DEFAULT_ARGS,
  spawnImpl = nodeSpawn,
  env,
} = {}) {
  const provider = {
    id: "sentrux",
    async detect(input = {}) {
      const options = {
        projectPath: input.projectPath ?? projectPath,
        timeoutMs: input.timeoutMs ?? timeoutMs,
        maxOutputBytes: input.maxOutputBytes ?? maxOutputBytes,
        executable,
        args,
        spawnImpl,
        env,
      };
      try {
        const { session, serverInfo } = await openHandshake(options);
        await session.stop();
        return normalizeStructuralQualityDetection({
          available: true,
          providerId: "sentrux",
          providerVersion: serverInfo.version,
          transport: "mcp-stdio",
          measurementModel: STRUCTURAL_QUALITY_MEASUREMENT_MODEL,
          compatibilityKey: STRUCTURAL_QUALITY_SENTRUX_COMPATIBILITY_KEY,
          reasonCode: null,
        });
      } catch (error) {
        return normalizeStructuralQualityDetection({
          available: false,
          providerId: "sentrux",
          providerVersion: error.providerVersion ?? null,
          transport: "mcp-stdio",
          measurementModel: STRUCTURAL_QUALITY_MEASUREMENT_MODEL,
          compatibilityKey: STRUCTURAL_QUALITY_SENTRUX_COMPATIBILITY_KEY,
          reasonCode: error.code ?? E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE,
        });
      }
    },
    async scopeBinding(input = {}) {
      const resolvedProjectPath = input.projectPath ?? projectPath;
      return sentruxScopeBinding(resolvedProjectPath);
    },
    async scan(input = {}) {
      const resolvedProjectPath = input.projectPath ?? projectPath;
      const options = {
        projectPath: resolvedProjectPath,
        timeoutMs: input.timeoutMs ?? timeoutMs,
        maxOutputBytes: input.maxOutputBytes ?? maxOutputBytes,
        executable,
        args,
        spawnImpl,
        env,
      };
      const { session, serverInfo } = await openHandshake(options);
      try {
        const scanResult = await callTool(session, "scan", { path: resolvedProjectPath });
        const healthResult = await callTool(session, "health", {});
        const providerScopeBinding = await sentruxScopeBinding(resolvedProjectPath);
        return {
          snapshot: mergedSnapshot(scanResult, healthResult, resolvedProjectPath),
          provider: {
            id: "sentrux",
            version: serverInfo.version,
            transport: "mcp-stdio",
            executionMode: "trusted-path-mcp-stdio",
            measurementModel: STRUCTURAL_QUALITY_MEASUREMENT_MODEL,
            compatibilityKey: STRUCTURAL_QUALITY_SENTRUX_COMPATIBILITY_KEY,
          },
          detection: normalizeStructuralQualityDetection({
            available: true,
            providerId: "sentrux",
            providerVersion: serverInfo.version,
            transport: "mcp-stdio",
            measurementModel: STRUCTURAL_QUALITY_MEASUREMENT_MODEL,
            compatibilityKey: STRUCTURAL_QUALITY_SENTRUX_COMPATIBILITY_KEY,
            reasonCode: null,
          }),
          providerScopeBinding,
        };
      } catch (error) {
        if (error.code === E_STRUCTURAL_QUALITY_TIMEOUT
          || error.code === E_STRUCTURAL_QUALITY_OUTPUT_LIMIT
          || error.code === E_STRUCTURAL_QUALITY_PROVIDER_PROTOCOL_INVALID
          || error.code === E_STRUCTURAL_QUALITY_PROVIDER_TOOL_CONTRACT_INVALID
          || error.code === E_STRUCTURAL_QUALITY_PROVIDER_INVALID
          || error.code === E_STRUCTURAL_QUALITY_PROVIDER_VERSION_UNSUPPORTED
          || error.code === E_STRUCTURAL_QUALITY_PROVIDER_UNAVAILABLE) throw error;
        throw mcpError(E_STRUCTURAL_QUALITY_SCAN_FAILED, error.message);
      } finally {
        await session.stop();
      }
    },
    async observe(input = {}) {
      return this.scan(input);
    },
  };
  return assertStructuralQualityProvider(provider);
}

export { DEFAULT_EXECUTABLE as SENTRUX_EXECUTABLE, DEFAULT_ARGS as SENTRUX_ARGS, SENTRUX_RULES_PATH };
