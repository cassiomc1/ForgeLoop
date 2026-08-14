import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  classifyVerificationCapability,
  E_VERIFICATION_TOOL_UNAVAILABLE,
  E_INSTALLATION_AUTHORITY_REQUIRED,
} from "../src/core/verification-capability.js";

test("classifyVerificationCapability prefers locally available verifiers", () => {
  const result = classifyVerificationCapability({ available: true });
  assert.equal(result.action, "USE_AVAILABLE");
  assert.equal(result.reasonCode, null);
});

test("classifyVerificationCapability uses local equivalent when primary is absent", () => {
  const result = classifyVerificationCapability({
    available: false,
    equivalentAvailable: true,
  });
  assert.equal(result.action, "USE_EQUIVALENT");
  assert.equal(result.reasonCode, null);
});

test("classifyVerificationCapability allows installation only when explicitly authorized", () => {
  const result = classifyVerificationCapability({
    available: false,
    equivalentAvailable: false,
    installationAuthorized: true,
  });
  assert.equal(result.action, "INSTALL_AUTHORIZED");
  assert.equal(result.reasonCode, null);
});

test("classifyVerificationCapability requests authority when verifier is mandatory but unauthorized", () => {
  const result = classifyVerificationCapability({
    available: false,
    equivalentAvailable: false,
    installationAuthorized: false,
    installationRequired: true,
  });
  assert.equal(result.action, "REQUEST_AUTHORITY");
  assert.equal(result.reasonCode, E_INSTALLATION_AUTHORITY_REQUIRED);
});

test("exact blind-run regression: missing modlens without authority records NOT_VERIFIED", () => {
  const modlensScenario = {
    tool: "@liustack/modlens",
    purpose: "visual-verification",
    available: false,
    equivalentAvailable: false,
    installationAuthorized: false,
    installationRequired: false,
  };
  const result = classifyVerificationCapability(modlensScenario);
  assert.equal(result.action, "RECORD_NOT_VERIFIED");
  assert.equal(result.reasonCode, E_VERIFICATION_TOOL_UNAVAILABLE);
});

test("canonical loop engineering documentation defines missing verification tool policy", async () => {
  const text = await readFile("LOOP_ENGINEERING.md", "utf8");
  assert.match(text, /### Missing verification tool policy/);
  assert.match(text, /A missing verification tool does not grant authority to install it/);
  assert.match(text, /npx --no-install TOOL → missing/);
  assert.match(text, /npx TOOL\s+→ implicit install/);
  assert.match(text, /E_VERIFICATION_TOOL_UNAVAILABLE/);
});

test("protocol integration guide defines missing tool capability policy", async () => {
  const text = await readFile("PROTOCOL_INTEGRATION.md", "utf8");
  assert.match(text, /## Missing tool capability/);
  assert.match(text, /A missing tool is a capability gap, not installation authority/);
  assert.match(text, /Never convert `PROTOCOL_LIMITED` into environmental mutation/);
});
