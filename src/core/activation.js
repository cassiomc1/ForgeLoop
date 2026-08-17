import { randomUUID } from "node:crypto";

import { ARTIFACT_PATHS, writeJsonArtifact } from "./artifacts.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { sessionArtifactPath } from "./task-paths.js";

export async function activateSession(target, packageRoot, options = {}) {
  const sessionId = options.sessionId ?? randomUUID();
  const value = {
    schemaVersion: 1,
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    activationMarker: options.activationMarker ?? `forgeloop-${randomUUID()}`,
    createdAt: options.createdAt ?? new Date().toISOString(),
  };
  const relativePath = sessionArtifactPath(sessionId);
  const written = await writeJsonArtifact(target, relativePath, value, "activation", packageRoot, options);
  await writeJsonArtifact(target, ARTIFACT_PATHS.session, value, "activation", packageRoot, options).catch(() => {});
  return { ...written.value, path: relativePath };
}
