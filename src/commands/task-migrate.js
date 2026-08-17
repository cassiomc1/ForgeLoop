import { migrateLegacyLayout } from "../core/task-migration.js";

export async function runTaskMigrate({ target, packageRoot, dryRun = false } = {}) {
  const result = await migrateLegacyLayout(target, { packageRoot, dryRun });
  return result;
}

export function formatTaskMigrateResult(result) {
  if (!result.migrated && result.actions.length === 0) {
    return "no legacy layout detected; nothing to migrate\n";
  }
  const prefix = result.dryRun ? "[dry-run] " : "";
  const lines = [
    `${prefix}migrated task: ${result.taskId} (key: ${result.taskKey})`,
    `destination: ${result.destinationDirectory}`,
    "actions:",
  ];
  for (const action of result.actions) {
    lines.push(`  - ${action.type}: ${action.from} -> ${action.to}`);
  }
  return `${lines.join("\n")}\n`;
}
