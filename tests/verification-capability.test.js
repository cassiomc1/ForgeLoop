import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  classifyVerificationCapability,
  classifyCommandResolution,
  validateVerificationAuthority,
  E_VERIFICATION_TOOL_UNAVAILABLE,
  E_INSTALLATION_AUTHORITY_REQUIRED,
} from "../src/core/verification-capability.js";
import { evaluateRequiredEvidence } from "../src/core/evidence-readiness.js";

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

test("classifyCommandResolution classifies resolution modes deterministically", () => {
  // Install-capable commands
  assert.deepEqual(classifyCommandResolution("npx @liustack/modlens --spec=foo"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npx",
  });
  assert.deepEqual(classifyCommandResolution("npx -y @liustack/modlens"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npx",
  });
  assert.deepEqual(classifyCommandResolution("pnpm dlx @liustack/modlens"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "pnpm dlx",
  });
  assert.deepEqual(classifyCommandResolution("yarn dlx jest"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "yarn dlx",
  });
  assert.deepEqual(classifyCommandResolution("bunx vitest"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "bunx",
  });
  assert.deepEqual(classifyCommandResolution("bun x vitest"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "bun x",
  });
  assert.deepEqual(classifyCommandResolution("uvx ruff check ."), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "uvx",
  });
  assert.deepEqual(classifyCommandResolution("uv tool run ruff"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "uv tool run",
  });
  assert.deepEqual(classifyCommandResolution("pipx run flake8"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "pipx run",
  });

  // Non-installing resolution
  assert.deepEqual(classifyCommandResolution("npx --no-install @liustack/modlens"), {
    resolutionMode: "NON_INSTALLING_RESOLUTION",
    mayInstall: false,
    installer: "npx",
  });
  assert.deepEqual(classifyCommandResolution("npx --no @liustack/modlens"), {
    resolutionMode: "NON_INSTALLING_RESOLUTION",
    mayInstall: false,
    installer: "npx",
  });

  // Explicit installation
  assert.deepEqual(classifyCommandResolution("npm install @liustack/modlens"), {
    resolutionMode: "EXPLICIT_INSTALLATION",
    mayInstall: true,
    installer: "npm",
  });
  assert.deepEqual(classifyCommandResolution("pnpm add -D jest"), {
    resolutionMode: "EXPLICIT_INSTALLATION",
    mayInstall: true,
    installer: "pnpm",
  });
  assert.deepEqual(classifyCommandResolution("pip install pytest"), {
    resolutionMode: "EXPLICIT_INSTALLATION",
    mayInstall: true,
    installer: "pip",
  });

  // Local package binary / local executable
  assert.deepEqual(classifyCommandResolution("./node_modules/.bin/modlens --spec=foo"), {
    resolutionMode: "LOCAL_PACKAGE_BINARY",
    mayInstall: false,
    installer: null,
  });
  assert.deepEqual(classifyCommandResolution("npm test"), {
    resolutionMode: "LOCAL_PACKAGE_BINARY",
    mayInstall: false,
    installer: null,
  });
  assert.deepEqual(classifyCommandResolution("npm run check"), {
    resolutionMode: "LOCAL_PACKAGE_BINARY",
    mayInstall: false,
    installer: null,
  });
  assert.deepEqual(classifyCommandResolution("node scripts/verify.js"), {
    resolutionMode: "LOCAL_EXECUTABLE",
    mayInstall: false,
    installer: null,
  });
  assert.deepEqual(classifyCommandResolution("command -v modlens"), {
    resolutionMode: "LOCAL_EXECUTABLE",
    mayInstall: false,
    installer: null,
  });
});

test("validateVerificationAuthority rejects unauthorized install-capable verification checks", () => {
  const unauthorizedCheck = {
    id: "visual-check",
    kind: "command",
    requirement: "visual-verification",
    status: "passed",
    source: "npx @liustack/modlens --spec=visual.json",
    details: {
      command: "npx @liustack/modlens --spec=visual.json",
      installationAuthorized: false,
    },
  };

  const validation = validateVerificationAuthority(unauthorizedCheck);
  assert.equal(validation.valid, false);
  assert.equal(validation.error.code, E_INSTALLATION_AUTHORITY_REQUIRED);

  const authorizedCheck = {
    id: "visual-check",
    kind: "command",
    requirement: "visual-verification",
    status: "passed",
    source: "npx @liustack/modlens --spec=visual.json",
    details: {
      command: "npx @liustack/modlens --spec=visual.json",
      installationAuthorized: true,
    },
  };

  const authValidation = validateVerificationAuthority(authorizedCheck);
  assert.equal(authValidation.valid, true);
  assert.equal(authValidation.error, null);
});

test("evaluateRequiredEvidence rejects unauthorized install-capable verification from passing readiness", () => {
  const requirements = ["visual-verification"];
  const unauthorizedCheck = {
    schemaVersion: 1,
    protocolVersion: 1,
    id: "check-1",
    kind: "command",
    requirement: "visual-verification",
    status: "passed",
    evidenceKind: "OBSERVED",
    source: "npx @liustack/modlens",
    details: {
      command: "npx @liustack/modlens",
      installationAuthorized: false,
    },
  };

  const readiness = evaluateRequiredEvidence({
    requirements,
    checks: [unauthorizedCheck],
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.covered.length, 0);
  assert.equal(readiness.invalid.length, 1);
  assert.equal(readiness.invalid[0].reasonCode, E_INSTALLATION_AUTHORITY_REQUIRED);
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
