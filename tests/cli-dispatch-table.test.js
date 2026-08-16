import assert from "node:assert/strict";
import { test } from "node:test";

import { COMMANDS, COMMAND_HANDLERS, COMMAND_TABLE } from "../src/cli.js";

test("the CLI exposes one declarative dispatch entry for every command", () => {
  assert.deepEqual(
    COMMAND_TABLE.map((entry) => entry.name),
    COMMANDS,
  );
  assert.equal(new Set(COMMAND_TABLE.map((entry) => entry.name)).size, COMMANDS.length);

  for (const entry of COMMAND_TABLE) {
    assert.equal(typeof entry.handler, "function", `${entry.name} needs a handler`);
    assert.equal(COMMAND_HANDLERS[entry.name], entry.handler);
    assert.match(entry.usage, new RegExp(`Usage: forgeloop <${entry.name}>`));
  }
});
