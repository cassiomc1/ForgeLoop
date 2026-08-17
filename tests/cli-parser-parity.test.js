import assert from "node:assert/strict";
import { test } from "node:test";

import { COMMANDS, parseArgs } from "../src/cli.js";
import { CLI_COMMAND_DEFINITIONS } from "../src/core/cli-command-definitions.js";
import { generateCliOptionsForCommand } from "../scripts/generate_documentation_reference.mjs";

test("CLI parser parity: every declared option is recognized for each command", () => {
  for (const [cmdName, def] of Object.entries(CLI_COMMAND_DEFINITIONS)) {
    for (const [optName, optDef] of Object.entries(def.options)) {
      if (optName.startsWith("<")) continue; // Positional argument

      let testArgv;
      if (optName === "--") {
        testArgv = [cmdName, "--id", "chk-1", "--requirement", "req-1", "--", "node", "--version"];
      } else if (optDef.takesValue) {
        testArgv = [cmdName, optName, "sample-value"];
      } else {
        testArgv = [cmdName, optName];
      }

      // Syntax parsing must recognize the option without throwing "not valid for <command>"
      try {
        parseArgs(testArgv);
      } catch (err) {
        // Semantic validation errors (e.g. "record-check requires --id") are allowed,
        // but option ownership errors ("Option --foo is not valid for bar") are NOT allowed.
        assert.doesNotMatch(
          err.message,
          new RegExp(`Option ${optName} is not valid for ${cmdName}`, "i"),
          `Command "${cmdName}" must accept its declared option "${optName}"`,
        );
      }
    }
  }
});

test("CLI parser parity: foreign options are rejected for each command", () => {
  const allKnownFlags = new Set(
    Object.values(CLI_COMMAND_DEFINITIONS).flatMap((def) =>
      Object.keys(def.options).filter((k) => k.startsWith("-") && k !== "--path" && k !== "--help" && k !== "--version"),
    ),
  );

  for (const [cmdName, def] of Object.entries(CLI_COMMAND_DEFINITIONS)) {
    const supportedFlags = new Set(Object.keys(def.options));

    for (const foreignFlag of allKnownFlags) {
      if (supportedFlags.has(foreignFlag)) continue;

      const foreignDef = Object.values(CLI_COMMAND_DEFINITIONS)
        .flatMap((d) => Object.entries(d.options))
        .find(([k]) => k === foreignFlag)?.[1];

      let sampleVal = "sample-val";
      if (foreignFlag === "--details") sampleVal = "{}";
      if (foreignFlag === "--exit-code") sampleVal = "0";

      const testArgv = foreignDef?.takesValue
        ? [cmdName, foreignFlag, sampleVal]
        : [cmdName, foreignFlag];

      assert.throws(
        () => parseArgs(testArgv),
        (err) => {
          return err.message.includes(`Option ${foreignFlag} is not valid for ${cmdName}`) ||
            err.message.includes(`${foreignFlag} is not valid for ${cmdName}`) ||
            err.message.includes(`Unknown option: ${foreignFlag}`);
        },
        `Command "${cmdName}" must reject foreign option "${foreignFlag}"`,
      );
    }
  }
});

test("CLI option formatting: all command options render at single list level without nested indentation", () => {
  for (const cmdName of COMMANDS) {
    const generated = generateCliOptionsForCommand(cmdName);
    for (const line of generated.split("\n")) {
      if (!line.trim()) continue;
      assert.match(
        line,
        /^- `/,
        `Command "${cmdName}" option line must start with "- \`": "${line}"`,
      );
      assert.doesNotMatch(
        line,
        /^\s{2,}- `/,
        `Command "${cmdName}" option line must not have nested indentation: "${line}"`,
      );
    }
  }
});

test("CLI run-check formatting: renders -- <argv...> with single angle brackets", () => {
  const generated = generateCliOptionsForCommand("run-check");
  assert.match(generated, /- `-- <argv\.\.\.>`:/);
  assert.doesNotMatch(generated, /<<argv\.\.\.>>/);
});
