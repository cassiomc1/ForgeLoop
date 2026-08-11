import { randomUUID } from "node:crypto";

import { ARTIFACT_PATHS, writeJsonArtifact } from "./artifacts.js";
import { PROTOCOL_VERSION } from "./protocol.js";

export async function activateSession(target, packageRoot, options = {}) {
  const value = {
    schemaVersion: 1,
    protocolVersion: PROTOCOL_VERSION,
    sessionId: randomUUID(),
    activationMarker: `forgeloop-${randomUUID()}`,
    createdAt: options.createdAt ?? new Date().toISOString(),
  };
  const written = await writeJsonArtifact(target, ARTIFACT_PATHS.session, value, "activation", packageRoot, options);
  return written.value;
}
