#!/usr/bin/env node

/**
 * Deterministic Risk Evaluation CLI
 *
 * Command-line tool to evaluate change risk for automated release pipelines.
 *
 * Usage:
 *   node poc/workload/src/cli.js --eval '{"serviceName": "auth-svc", "environment": "production", "changeType": "standard"}'
 *   node poc/workload/src/cli.js --input change-request.json
 *   cat change-request.json | node poc/workload/src/cli.js
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { evaluateRisk } from "./evaluator.js";

const VERSION = "1.0.0";

function printUsage() {
  console.log(`Deterministic Risk Evaluator CLI v${VERSION}

Usage:
  risk-eval [options] [file]

Options:
  --input <path>      Path to JSON file containing change request
  --eval <json>       Inline JSON string to evaluate
  --fail-on-reject    Exit with code 2 if policy decision is REJECT
  --compact           Output minified JSON
  --version, -v       Show version
  --help, -h          Show this help message

Exit Codes:
  0: Evaluation succeeded
  1: Input or validation error
  2: Policy decision REJECT (when --fail-on-reject is specified)
`);
}

async function readAllStdin() {
  return new Promise((resolvePromise, rejectPromise) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolvePromise(data.trim());
    });
    process.stdin.on("error", (err) => {
      rejectPromise(err);
    });
  });
}

export async function runCli(argv = process.argv.slice(2)) {
  let inputJson = null;
  let failOnReject = false;
  let compact = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      return 0;
    }

    if (arg === "--version" || arg === "-v") {
      console.log(`risk-eval v${VERSION}`);
      return 0;
    }

    if (arg === "--fail-on-reject") {
      failOnReject = true;
      continue;
    }

    if (arg === "--compact") {
      compact = true;
      continue;
    }

    if (arg === "--eval") {
      inputJson = argv[++i];
      if (!inputJson) {
        console.error(JSON.stringify({ error: "E_MISSING_ARGUMENT", message: "--eval requires a JSON string" }, null, 2));
        return 1;
      }
      continue;
    }

    if (arg.startsWith("--eval=")) {
      inputJson = arg.slice("--eval=".length);
      continue;
    }

    if (arg === "--input") {
      const filePath = argv[++i];
      if (!filePath) {
        console.error(JSON.stringify({ error: "E_MISSING_ARGUMENT", message: "--input requires a file path" }, null, 2));
        return 1;
      }
      try {
        inputJson = readFileSync(resolve(process.cwd(), filePath), "utf8");
      } catch (err) {
        console.error(JSON.stringify({ error: "E_FILE_READ_ERROR", message: `Failed to read file '${filePath}': ${err.message}` }, null, 2));
        return 1;
      }
      continue;
    }

    if (arg.startsWith("--input=")) {
      const filePath = arg.slice("--input=".length);
      try {
        inputJson = readFileSync(resolve(process.cwd(), filePath), "utf8");
      } catch (err) {
        console.error(JSON.stringify({ error: "E_FILE_READ_ERROR", message: `Failed to read file '${filePath}': ${err.message}` }, null, 2));
        return 1;
      }
      continue;
    }

    // Positional file argument
    if (!arg.startsWith("-")) {
      try {
        inputJson = readFileSync(resolve(process.cwd(), arg), "utf8");
      } catch (err) {
        console.error(JSON.stringify({ error: "E_FILE_READ_ERROR", message: `Failed to read file '${arg}': ${err.message}` }, null, 2));
        return 1;
      }
      continue;
    }

    console.error(JSON.stringify({ error: "E_UNKNOWN_OPTION", message: `Unknown option: ${arg}` }, null, 2));
    return 1;
  }

  // If no input was provided via flags or positional, read stdin if not a TTY
  if (inputJson === null) {
    if (!process.stdin.isTTY) {
      try {
        inputJson = await readAllStdin();
      } catch (err) {
        console.error(JSON.stringify({ error: "E_STDIN_ERROR", message: `Failed to read stdin: ${err.message}` }, null, 2));
        return 1;
      }
    }
  }

  if (!inputJson || inputJson.trim().length === 0) {
    console.error(JSON.stringify({ error: "E_EMPTY_INPUT", message: "No input provided. Supply JSON via --input, --eval, or stdin." }, null, 2));
    return 1;
  }

  let parsedPayload;
  try {
    parsedPayload = JSON.parse(inputJson);
  } catch (err) {
    console.error(JSON.stringify({ error: "E_JSON_PARSE_ERROR", message: `Invalid JSON: ${err.message}` }, null, 2));
    return 1;
  }

  try {
    const result = evaluateRisk(parsedPayload);
    const output = compact ? JSON.stringify(result) : JSON.stringify(result, null, 2);
    console.log(output);

    if (failOnReject && result.decision === "REJECT") {
      return 2;
    }

    return 0;
  } catch (err) {
    if (err.code === "E_INVALID_PAYLOAD") {
      console.error(JSON.stringify({
        error: "E_INVALID_PAYLOAD",
        message: err.message,
        validationErrors: err.validationErrors,
      }, null, 2));
      return 1;
    }

    console.error(JSON.stringify({ error: "E_EVALUATION_ERROR", message: err.message }, null, 2));
    return 1;
  }
}

// Execute directly if launched as main script
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename ?? process.argv[1]);
if (isMain) {
  runCli().then((code) => {
    process.exit(code);
  });
}
