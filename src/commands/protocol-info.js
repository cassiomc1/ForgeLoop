import { protocolInfo } from "../core/protocol-info.js";

export async function runProtocolInfo() {
  return protocolInfo();
}

export function formatProtocolInfoResult(result) {
  return [
    `Protocol version: ${result.protocolVersion}`,
    `Schema version: ${result.compatibility.schemaVersion}`,
    `Commands: ${result.commands.length}`,
    `Guides: ${result.guides.length}`,
    `Documented errors: ${result.errors.length}`,
  ].join("\n") + "\n";
}
