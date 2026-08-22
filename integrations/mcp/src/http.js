import { createServer as createNodeHttpServer } from "node:http";

import {
  createMcpHandler,
  hostHeaderValidationResponse,
  originValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
} from "@modelcontextprotocol/server";

import { buildForgeLoopMcpServer } from "./server.js";
import { resolveProjectContext } from "./project-context.js";
import { resolveLaunchPolicy, SERVER_MODES } from "./capability-policy.js";
import { FORGELOOP_INTEGRATION_API_VERSION } from "@cassiomc1/forgeloop/integration";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/**
 * Plan §77/§PR12: stateless modern HTTP transport.
 *
 * - The project root stays server-pinned; never a request input.
 * - Loopback binding is the default; any non-loopback bind requires the
 *   explicit process-level --allow-remote opt-in.
 * - DNS-rebinding protection validates Host and Origin on every request.
 * - No session identity exists: each request carries its own stateless
 *   exchange, so MCP transport metadata is never ForgeLoop authority.
 */
export function validateHttpBind({ host = "127.0.0.1", allowRemote = false }) {
  if (LOOPBACK_HOSTS.has(host)) return host;
  if (allowRemote !== true) {
    throw new Error(`E_MCP_REMOTE_BIND_REQUIRES_OPT_IN: binding to non-loopback host "${host}" requires explicit --allow-remote`);
  }
  return host;
}

export async function createForgeLoopHttpHandler({
  projectPath,
  mode = SERVER_MODES.SAFE,
  allowExternalExecution = false,
  allowMaintenance = false,
  allowRecovery = false,
  allowLegacyRepair = false,
  allowForceRecovery = false,
  maxExecutionTimeMs = 600000,
  packageRoot = undefined,
  allowedHosts = undefined,
  allowedOrigins = undefined,
} = {}) {
  if (FORGELOOP_INTEGRATION_API_VERSION !== 1) {
    throw new Error(`E_MCP_FORGELOOP_INTEGRATION_UNSUPPORTED: ForgeLoop integration API ${FORGELOOP_INTEGRATION_API_VERSION} is not supported (required: 1)`);
  }
  const projectContext = resolveProjectContext(projectPath);
  const policy = resolveLaunchPolicy({
    mode,
    allowExternalExecution,
    allowMaintenance,
    allowRecovery,
    allowLegacyRepair,
    allowForceRecovery,
    maxExecutionTimeMs,
  });

  // Stateless: a fresh product per request keeps no session authority.
  const mcp = createMcpHandler(
    () => buildForgeLoopMcpServer({ projectContext, policy, packageRoot }),
    { responseMode: "json" },
  );

  const hosts = allowedHosts ?? localhostAllowedHostnames();
  const origins = allowedOrigins ?? localhostAllowedOrigins();

  const handle = async function handleMcpHttpRequest(request) {
    const hostRejection = hostHeaderValidationResponse(request, hosts);
    if (hostRejection) return hostRejection;
    const originRejection = originValidationResponse(request, origins);
    if (originRejection) return originRejection;
    // Content negotiation follows the MCP specification: clients that offer
    // text/event-stream receive the protocol-native stream encoding, which
    // this bounded stateless endpoint closes after each single exchange.
    return mcp.fetch(request);
  };

  return Object.freeze({
    handle,
    close: async () => {
      await mcp.close();
    },
  });
}

const MAX_HTTP_BODY_BYTES = 4 * 1024 * 1024;

function readBodyBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_HTTP_BODY_BYTES) {
        const error = new Error("HTTP request body exceeds the MCP size bound");
        error.code = "E_MCP_HTTP_BODY_TOO_LARGE";
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function nodeRequestToWebRequest(req) {
  const hostHeader = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${hostHeader}`).toString();
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  if (req.method === "GET" || req.method === "HEAD") {
    return new Request(url, { method: req.method, headers });
  }
  // Buffer the body with a hard size bound: stateless JSON-RPC exchanges are
  // small, and buffering avoids unbounded stream lifetimes (plan §77).
  const body = await readBodyBuffer(req);
  return new Request(url, {
    method: req.method,
    headers,
    body: new Uint8Array(body),
  });
}

async function writeWebResponseToNode(webResponse, res) {
  const headers = {};
  webResponse.headers.forEach((value, name) => {
    headers[name] = value;
  });
  res.writeHead(webResponse.status, headers);
  const body = await webResponse.arrayBuffer();
  res.end(Buffer.from(body));
}

export async function startForgeLoopHttpServer({
  projectPath,
  host = "127.0.0.1",
  port = 0,
  allowRemote = false,
  ...serverOptions
} = {}) {
  const boundHost = validateHttpBind({ host, allowRemote });
  const { handle, close: closeHandler } = await createForgeLoopHttpHandler({ projectPath, ...serverOptions });

  const httpServer = createNodeHttpServer(async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.writeHead(405, { "content-type": "application/json", allow: "POST" });
        res.end(JSON.stringify({
          ok: false,
          error: { code: "E_MCP_HTTP_METHOD_NOT_ALLOWED", message: "Only POST is supported on the stateless MCP HTTP endpoint" },
        }));
        return;
      }
      const request = await nodeRequestToWebRequest(req);
      const response = await handle(request);
      await writeWebResponseToNode(response, res);
    } catch (error) {
      const status = error?.code === "E_MCP_HTTP_BODY_TOO_LARGE" ? 413 : 500;
      if (!res.headersSent) {
        res.writeHead(status, { "content-type": "application/json" });
      }
      res.end(JSON.stringify({
        ok: false,
        error: { code: error?.code ?? "E_MCP_HTTP_INTERNAL", message: status === 413 ? error.message : "Internal MCP HTTP error" },
      }));
    }
  });

  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, boundHost, resolve);
  });
  const address = httpServer.address();

  return Object.freeze({
    host: boundHost,
    port: typeof address === "object" ? address.port : port,
    close: async () => {
      httpServer.closeAllConnections?.();
      await new Promise((resolve) => httpServer.close(resolve));
      await closeHandler();
    },
  });
}
