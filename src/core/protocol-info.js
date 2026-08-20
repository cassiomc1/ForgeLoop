import { CLI_COMMAND_DEFINITIONS } from "./cli-command-definitions.js";
import { PUBLIC_ERROR_REGISTRY } from "./error-codes.js";
import { GUIDE_REGISTRY } from "./guide-registry.js";
import { PROTOCOL_VERSION, WORK_PHASES, WORK_TRANSITIONS } from "./protocol.js";

export const SCHEMA_COMPATIBILITY_POLICY = Object.freeze({
  protocolVersion: PROTOCOL_VERSION,
  schemaVersion: 1,
  read: "Readers reject unknown protocol or schema versions; compatibility changes require a new published version.",
  write: "Writers emit only the current schema and protocol versions.",
  migration: "Legacy singleton artifacts remain readable and are migrated explicitly with task-migrate.",
});

export function protocolInfo() {
  const errors = Object.values(PUBLIC_ERROR_REGISTRY);
  return {
    protocolVersion: PROTOCOL_VERSION,
    compatibility: SCHEMA_COMPATIBILITY_POLICY,
    lifecycle: { phases: WORK_PHASES, transitions: WORK_TRANSITIONS },
    guides: Object.values(GUIDE_REGISTRY),
    commands: Object.values(CLI_COMMAND_DEFINITIONS).map(({ name, category, mutation, description }) => ({ name, category, mutation, description })),
    errors,
  };
}
