#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

import { runDoctor } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { runUpdate } from "./commands/update.js";
import { resolveTarget } from "./core/filesystem.js";
import { getPackageRoot } from "./core/templates.js";

function usage() {
  return `Usage: mdfiles <init|doctor|update> [options]

Options:
  --path <directory>  target project directory (default: current directory)
  --dry-run           show planned writes without changing files
  --json              emit doctor findings as JSON
  --help              show this help
`;
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { path: ".", dryRun: false, json: false, help: false };

  if (command === "--help" || command === "-h") {
    return { command: null, options: { ...options, help: true } };
  }
  if (!command) return { command: null, options };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument === "--path") {
      options.path = rest[index + 1];
      if (!options.path || options.path.startsWith("-")) throw new Error("--path requires a directory");
      index += 1;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (command === "init" && options.json) {
    throw new Error("Option --json is not valid for init");
  }
  if (command === "update" && options.json) {
    throw new Error("Option --json is not valid for update");
  }
  if (command === "doctor" && options.dryRun) {
    throw new Error("Option --dry-run is not valid for doctor");
  }
  return { command, options };
}

async function packageVersion(packageRoot) {
  const packageJson = JSON.parse(
    await readFile(path.join(packageRoot, "package.json"), "utf8"),
  );
  return packageJson.version;
}

function printActions(actions) {
  for (const item of actions) {
    const reason = item.reason ? ` (${item.reason})` : "";
    console.log(`${item.action.replaceAll("-", " ")}: ${item.path}${reason}`);
  }
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const { command, options } = parseArgs(argv);
    if (!command || options.help) {
      console.log(usage());
      return options.help ? 0 : 1;
    }
    if (!["init", "doctor", "update"].includes(command)) {
      throw new Error(`Unknown command: ${command}`);
    }

    const target = await resolveTarget(process.cwd(), options.path);
    const packageRoot = getPackageRoot();
    const version = await packageVersion(packageRoot);

    if (command === "init") {
      const result = await runInit({ target, dryRun: options.dryRun, packageRoot, packageVersion: version });
      printActions(result.actions);
      return 0;
    }

    if (command === "doctor") {
      const result = await runDoctor({ target, packageRoot });
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        for (const item of result.findings) {
          console.log(`${item.severity}: ${item.code}: ${item.path} - ${item.message}`);
        }
        console.log(result.ok ? "healthy: mdfiles target is ready" : "unhealthy: mdfiles target needs attention");
      }
      return result.ok ? 0 : 1;
    }

    const result = await runUpdate({ target, dryRun: options.dryRun, packageRoot, packageVersion: version });
    printActions(result.actions);
    for (const conflict of result.conflicts) {
      console.log(`conflict: ${conflict.path} - ${conflict.message}`);
    }
    return result.conflicts.length === 0 ? 0 : 1;
  } catch (error) {
    console.error(`error: ${error.message}`);
    return 1;
  }
}

const exitCode = await main();
process.exitCode = exitCode;
