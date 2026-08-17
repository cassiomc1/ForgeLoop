import assert from "node:assert/strict";
import { test } from "node:test";

import { COMMANDS, parseArgs, parseCliSyntax } from "../src/cli.js";
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
        let val = "sample-value";
        if (optDef.parseType === "json-object") val = "{}";
        if (optDef.parseType === "non-negative-integer") val = "0";
        testArgv = [cmdName, optName, val];
      } else {
        testArgv = [cmdName, optName];
      }

      // Syntax parsing must recognize the option without throwing "not valid for <command>"
      const parsed = parseCliSyntax(testArgv);
      assert.equal(parsed.command, cmdName);
      if (optDef.targetKey) {
        if (optDef.parseType === "boolean") {
          assert.equal(parsed.options[optDef.targetKey], true);
        } else if (optDef.repeatable) {
          assert.ok(Array.isArray(parsed.options[optDef.targetKey]));
          assert.ok(parsed.options[optDef.targetKey].length > 0);
        } else if (optDef.parseType === "non-negative-integer") {
          assert.equal(parsed.options[optDef.targetKey], 0);
        } else if (optDef.parseType === "json-object") {
          assert.deepEqual(parsed.options[optDef.targetKey], {});
        } else if (optDef.parseType === "argv") {
          assert.deepEqual(parsed.options[optDef.targetKey], ["node", "--version"]);
        } else {
          assert.equal(parsed.options[optDef.targetKey], "sample-value");
        }
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

test("CLI parser parity: equals syntax (--opt=val) works for supported options", () => {
  const parsedPath = parseCliSyntax(["status", "--path=/custom/target"]);
  assert.equal(parsedPath.options.path, "/custom/target");

  const parsedId = parseCliSyntax(["record-check", "--id=chk-custom", "--requirement=req-custom", "--status=passed", "--evidence-kind=OBSERVED", "--command=test"]);
  assert.equal(parsedId.options.checkId, "chk-custom");
  assert.equal(parsedId.options.checkRequirement, "req-custom");
  assert.equal(parsedId.options.checkStatus, "passed");

  const parsedExit = parseCliSyntax(["record-check", "--id=chk-1", "--requirement=req-1", "--status=passed", "--evidence-kind=OBSERVED", "--command=test", "--exit-code=42"]);
  assert.equal(parsedExit.options.checkExitCode, 42);
});

test("CLI parser parity: aliases -h and -v are recognized", () => {
  const parsedHelp = parseCliSyntax(["init", "-h"]);
  assert.equal(parsedHelp.options.help, true);

  const parsedVersion = parseCliSyntax(["doctor", "-v"]);
  assert.equal(parsedVersion.options.version, true);
});

test("CLI parser parity: policy positional argument is captured cleanly", () => {
  const parsed = parseCliSyntax(["policy", "enterprise-strict"]);
  assert.equal(parsed.command, "policy");
  assert.equal(parsed.options.policy, "enterprise-strict");
});

test("CLI parser parity: semantic validation remains enforced", () => {
  assert.throws(() => parseArgs(["bundle"]), /bundle requires --task/);
  assert.throws(() => parseArgs(["policy"]), /policy requires a name/);
  assert.throws(() => parseArgs(["record-check"]), /record-check requires --id/);
  assert.throws(() => parseArgs(["run-check", "--id", "chk-1", "--requirement", "req-1"]), /run-check requires -- followed by an exact command argv/);
});

test("generated CLI options never duplicate repeatable marker", () => {
  for (const command of COMMANDS) {
    const generated = generateCliOptionsForCommand(command);
    assert.doesNotMatch(
      generated,
      /\(repeatable\)\s+\(repeatable\)/,
      `${command} contains duplicated repeatable marker`,
    );
  }
});

test("repeatable CLI options keep repeatability out of descriptions", () => {
  for (const [command, definition] of Object.entries(CLI_COMMAND_DEFINITIONS)) {
    for (const [option, optionDef] of Object.entries(definition.options)) {
      if (!optionDef.repeatable) continue;
      assert.doesNotMatch(
        optionDef.description,
        /\brepeatable\b/i,
        `${command} ${option} duplicates repeatability in description`,
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
