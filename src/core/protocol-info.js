import { CLI_COMMAND_DEFINITIONS } from "./cli-command-definitions.js";
import { ARTIFACT_REGISTRY } from "./artifact-registry.js";
import { PUBLIC_ERROR_REGISTRY } from "./error-codes.js";
import { GUIDE_REGISTRY } from "./guide-registry.js";
import { PROTOCOL_VERSION, WORK_PHASES, WORK_TRANSITIONS } from "./protocol.js";

export const SCHEMA_COMPATIBILITY_POLICY = Object.freeze({
  protocolVersion: PROTOCOL_VERSION,
  schemaVersion: 1,
  read: "Readers reject unknown protocol or schema versions; compatibility changes require a new published version.",
  write: "Writers emit only the current schema and protocol versions.",
  migration: "Use migrate-protocol --to <version> --dry-run to plan an explicit supported migration. Legacy singleton artifacts are migrated with a receipt-backed task-migrate action.",
});

function publicSchemaVersions() {
  return Object.fromEntries(
    [...new Set(Object.values(ARTIFACT_REGISTRY)
      .filter((artifact) => artifact.isPublic && artifact.isPersisted)
      .map((artifact) => artifact.schema))]
      .sort()
      .map((schema) => [schema, [SCHEMA_COMPATIBILITY_POLICY.schemaVersion]]),
  );
}

export function protocolInfo({ packageVersion = null } = {}) {
  const errors = Object.values(PUBLIC_ERROR_REGISTRY);
  const schemaVersions = publicSchemaVersions();
  return {
    packageVersion,
    protocolVersion: PROTOCOL_VERSION,
    readsProtocol: [PROTOCOL_VERSION],
    writesProtocol: [PROTOCOL_VERSION],
    readsSchemaVersions: schemaVersions,
    writesSchemaVersions: schemaVersions,
    compatibility: SCHEMA_COMPATIBILITY_POLICY,
    features: {
      taskClaimRecovery: {
        version: 1,
        durableRecoveryState: true,
        explicitResume: true,
        validatedClaimProjection: true,
      },
    },
    lifecycle: { phases: WORK_PHASES, transitions: WORK_TRANSITIONS },
    guides: Object.values(GUIDE_REGISTRY),
    commands: Object.values(CLI_COMMAND_DEFINITIONS).map(({ name, category, mutation, description }) => ({ name, category, mutation, description })),
    errors,
  };
}
