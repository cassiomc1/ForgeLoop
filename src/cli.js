#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runDoctor } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { runUpdate } from "./commands/update.js";
import { resolveTarget } from "./core/filesystem.js";
import { getPackageRoot } from "./core/templates.js";

function usage(command = null) {
  const options = [
    "  --path <directory>  target project directory (default: current directory)",
  ];
  if (!command || command === "init" || command === "update") {
    options.push("  --dry-run           show planned writes without changing files");
  }
  if (!command || command === "doctor") {
    options.push("  --json              emit doctor findings as JSON");
    options.push("  --strict            treat warnings as unhealthy");
    options.push("  --adopt <path>      preserve an existing adapter in the manifest");
  }
  options.push("  --version           show the installed package version");
  options.push("  --help              show this help");

  return `Usage: mdfiles <init|doctor|update> [options]\n\nOptions:\n${options.join("\n")}\n`;
}

export function parseArgs(argv) {
  const options = {
    path: ".",
    dryRun: false,
    json: false,
    strict: false,
    adopt: [],
    help: false,
    version: false,
  };
  let command = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["init", "doctor", "update"].includes(argument)) {
      if (command) throw new Error(`Multiple commands are not supported: ${argument}`);
      command = argument;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument === "--strict") {
      options.strict = true;
    } else if (argument === "--adopt") {
      const relativePath = argv[index + 1];
      if (!relativePath || relativePath.startsWith("-")) throw new Error("--adopt requires a path");
      options.adopt.push(relativePath);
      index += 1;
    } else if (argument === "--path") {
      options.path = argv[index + 1];
      if (!options.path || options.path.startsWith("-")) throw new Error("--path requires a directory");
      index += 1;
    } else if (argument.startsWith("--path=")) {
      options.path = argument.slice("--path=".length);
      if (!options.path || options.path.startsWith("-")) throw new Error("--path requires a directory");
    } else if (argument === "--version" || argument === "-v") {
      options.version = true;
    } else if (!argument.startsWith("-") && !command) {
      command = argument;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (!command) return { command: null, options };

  if (command === "init" && options.json) {
    throw new Error("Option --json is not valid for init");
  }
  if (command === "update" && options.json) {
    throw new Error("Option --json is not valid for update");
  }
  if (command === "doctor" && options.dryRun) {
    throw new Error("Option --dry-run is not valid for doctor");
  }
  if (command !== "doctor" && options.strict) {
    throw new Error(`Option --strict is not valid for ${command}`);
  }
  if (command !== "doctor" && options.adopt.length > 0) {
    throw new Error(`Option --adopt is not valid for ${command}`);
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
    if (options.version) {
      console.log(await packageVersion(getPackageRoot()));
      return 0;
    }
    if (!command || options.help) {
      console.log(usage(command));
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
      const result = await runDoctor({
        target,
        packageRoot,
        adoptPaths: options.adopt,
        strict: options.strict,
      });
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

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const exitCode = await main();
  process.exitCode = exitCode;
}
