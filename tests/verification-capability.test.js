import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  classifyVerificationCapability,
  classifyCommandResolution,
  resolveExecutionResolution,
  getNpmScriptName,
  validateVerificationAuthority,
  E_VERIFICATION_TOOL_UNAVAILABLE,
  E_INSTALLATION_AUTHORITY_REQUIRED,
  E_AUTHORITY_UNTRUSTED_SOURCE,
} from "../src/core/verification-capability.js";
import { evaluateRequiredEvidence } from "../src/core/evidence-readiness.js";
import { assertCheck } from "../src/core/checks.js";

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
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution("npx -y @liustack/modlens"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npx",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution("pnpm dlx @liustack/modlens"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "pnpm dlx",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution("yarn dlx jest"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "yarn dlx",
    tool: "jest",
  });
  assert.deepEqual(classifyCommandResolution("bunx vitest"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "bunx",
    tool: "vitest",
  });
  assert.deepEqual(classifyCommandResolution("bun x vitest"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "bun x",
    tool: "vitest",
  });
  assert.deepEqual(classifyCommandResolution("uvx ruff check ."), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "uvx",
    tool: "ruff",
  });
  assert.deepEqual(classifyCommandResolution("uv tool run ruff"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "uv tool run",
    tool: "ruff",
  });
  assert.deepEqual(classifyCommandResolution("pipx run flake8"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "pipx run",
    tool: "flake8",
  });

  // npm exec and npm x variants (P0)
  assert.deepEqual(classifyCommandResolution(["npm", "exec", "--", "@liustack/modlens", "image.png"]), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm exec",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution("npm exec package"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm exec",
    tool: "package",
  });
  assert.deepEqual(classifyCommandResolution("npm exec -- package"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm exec",
    tool: "package",
  });
  assert.deepEqual(classifyCommandResolution("npm exec --package=@liustack/modlens -- modlens"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm exec",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution("npm exec --package @liustack/modlens -- modlens"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm exec",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution("npm exec -p @liustack/modlens -- modlens"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm exec",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution("npm x @liustack/modlens"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm x",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution("npm exec --yes @liustack/modlens"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm exec",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution("npm exec --no @liustack/modlens"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm exec",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution(["npm.cmd", "exec", "@liustack/modlens"]), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm exec",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution(["npm.cmd", "x", "@liustack/modlens"]), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm x",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution(["npx.cmd", "@liustack/modlens"]), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npx",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution("npm exec"), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm exec",
    tool: null,
  });

  // Non-installing resolution
  assert.deepEqual(classifyCommandResolution("npx --no-install @liustack/modlens"), {
    resolutionMode: "NON_INSTALLING_RESOLUTION",
    mayInstall: false,
    installer: "npx",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution("npx --no @liustack/modlens"), {
    resolutionMode: "NON_INSTALLING_RESOLUTION",
    mayInstall: false,
    installer: "npx",
    tool: "@liustack/modlens",
  });

  // Explicit installation
  assert.deepEqual(classifyCommandResolution("npm install @liustack/modlens"), {
    resolutionMode: "EXPLICIT_INSTALLATION",
    mayInstall: true,
    installer: "npm",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution("pnpm add -D jest"), {
    resolutionMode: "EXPLICIT_INSTALLATION",
    mayInstall: true,
    installer: "pnpm",
    tool: "jest",
  });
  assert.deepEqual(classifyCommandResolution("pip install pytest"), {
    resolutionMode: "EXPLICIT_INSTALLATION",
    mayInstall: true,
    installer: "pip",
    tool: "pytest",
  });

  // Local package binary / local executable
  assert.deepEqual(classifyCommandResolution("./node_modules/.bin/modlens --spec=foo"), {
    resolutionMode: "LOCAL_PACKAGE_BINARY",
    mayInstall: false,
    installer: null,
    tool: "modlens",
  });
  assert.deepEqual(classifyCommandResolution("npm test"), {
    resolutionMode: "LOCAL_PACKAGE_BINARY",
    mayInstall: false,
    installer: null,
    tool: null,
  });
  assert.deepEqual(classifyCommandResolution("npm run check"), {
    resolutionMode: "LOCAL_PACKAGE_BINARY",
    mayInstall: false,
    installer: null,
    tool: null,
  });
  assert.deepEqual(classifyCommandResolution("node scripts/verify.js"), {
    resolutionMode: "LOCAL_EXECUTABLE",
    mayInstall: false,
    installer: null,
    tool: null,
  });
  assert.deepEqual(classifyCommandResolution("command -v modlens"), {
    resolutionMode: "LOCAL_EXECUTABLE",
    mayInstall: false,
    installer: null,
    tool: null,
  });
});

test("classifyCommandResolution preserves string behavior while accepting argv", () => {
  assert.deepEqual(
    classifyCommandResolution(["node", "scripts/verify.js"]),
    classifyCommandResolution("node scripts/verify.js"),
  );
});

test("classifyCommandResolution inspects explicit Windows cmd wrappers and shell strings", () => {
  assert.deepEqual(classifyCommandResolution([
    "cmd.exe",
    "/d",
    "/c",
    'call "C:\\tmp\\npx.cmd" @liustack/modlens --spec=foo',
  ]), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npx",
    tool: "@liustack/modlens",
  });
  assert.deepEqual(classifyCommandResolution(["sh", "-lc", "npx package"]), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npx",
    tool: "package",
  });
  assert.deepEqual(classifyCommandResolution(["bash", "-c", "npm exec -- package"]), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm exec",
    tool: "package",
  });
  assert.deepEqual(classifyCommandResolution(["cmd", "/c", "npm x package"]), {
    resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
    mayInstall: true,
    installer: "npm x",
    tool: "package",
  });
});

test("resolveExecutionResolution handles npm script lifecycle and nested dispatchers", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-npm-script-"));
  try {
    // 1. Safe script
    await writeFile(path.join(target, "package.json"), JSON.stringify({
      scripts: {
        test: "node tests/run.js",
      },
    }), "utf8");

    const safeResult = await resolveExecutionResolution({
      argv: ["npm", "test"],
      cwd: target,
    });
    assert.equal(safeResult.mayInstall, false);

    // 2. Nested npx inside test
    await writeFile(path.join(target, "package.json"), JSON.stringify({
      scripts: {
        test: "npx @liustack/modlens image.png",
      },
    }), "utf8");

    const nestedNpxResult = await resolveExecutionResolution({
      argv: ["npm", "test"],
      cwd: target,
    });
    assert.equal(nestedNpxResult.mayInstall, true);
    assert.equal(nestedNpxResult.resolutionMode, "INSTALL_CAPABLE_RESOLUTION");
    assert.equal(nestedNpxResult.tool, "@liustack/modlens");
    assert.deepEqual(nestedNpxResult.dispatch, {
      kind: "npm-script",
      scriptName: "test",
    });

    // 3. pretest install-capable elevates top-level
    await writeFile(path.join(target, "package.json"), JSON.stringify({
      scripts: {
        pretest: "npx package-x",
        test: "node tests.js",
      },
    }), "utf8");

    const pretestResult = await resolveExecutionResolution({
      argv: ["npm", "test"],
      cwd: target,
    });
    assert.equal(pretestResult.mayInstall, true);
    assert.equal(pretestResult.tool, "package-x");
    assert.deepEqual(pretestResult.dispatch, {
      kind: "npm-script",
      scriptName: "pretest",
    });

    // 4. posttest install-capable elevates top-level
    await writeFile(path.join(target, "package.json"), JSON.stringify({
      scripts: {
        test: "node tests.js",
        posttest: "npm exec -- package-y",
      },
    }), "utf8");

    const posttestResult = await resolveExecutionResolution({
      argv: ["npm", "test"],
      cwd: target,
    });
    assert.equal(posttestResult.mayInstall, true);
    assert.equal(posttestResult.tool, "package-y");
    assert.deepEqual(posttestResult.dispatch, {
      kind: "npm-script",
      scriptName: "posttest",
    });

    // 5. npm run / npm run-script
    await writeFile(path.join(target, "package.json"), JSON.stringify({
      scripts: {
        verify: "pnpm dlx package-z",
      },
    }), "utf8");

    const runVerifyResult = await resolveExecutionResolution({
      argv: ["npm", "run", "verify"],
      cwd: target,
    });
    assert.equal(runVerifyResult.mayInstall, true);
    assert.equal(runVerifyResult.tool, "package-z");
    assert.deepEqual(runVerifyResult.dispatch, {
      kind: "npm-script",
      scriptName: "verify",
    });

    const runScriptVerifyResult = await resolveExecutionResolution({
      argv: ["npm", "run-script", "verify"],
      cwd: target,
    });
    assert.equal(runScriptVerifyResult.mayInstall, true);
    assert.equal(runScriptVerifyResult.tool, "package-z");

    // 6. Missing package.json or missing script does not crash
    const missingPkgResult = await resolveExecutionResolution({
      argv: ["npm", "test"],
      cwd: path.join(target, "nonexistent"),
    });
    assert.equal(missingPkgResult.mayInstall, false);

    const missingScriptResult = await resolveExecutionResolution({
      argv: ["npm", "run", "missing-script"],
      cwd: target,
    });
    assert.equal(missingScriptResult.mayInstall, false);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("observed command checks require ForgeLoop execution provenance", () => {
  assert.throws(
    () => assertCheck({
      schemaVersion: 1,
      protocolVersion: 1,
      id: "tests",
      kind: "command",
      requirement: "tests",
      status: "passed",
      evidenceKind: "OBSERVED",
      source: "npm test",
      provenance: "ACTOR_REPORTED",
    }, "check", { requireCommandProvenance: true }),
    (error) => error.code === "E_COMMAND_PROVENANCE_UNATTESTED",
  );
});

test("validateVerificationAuthority rejects self-asserted booleans and requires canonical authority grants", () => {
  // Self-asserted boolean without authorityRef
  const selfAssertedCheck = {
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
  const val1 = validateVerificationAuthority(selfAssertedCheck);
  assert.equal(val1.valid, false);
  assert.equal(val1.error.code, E_INSTALLATION_AUTHORITY_REQUIRED);

  // Nested self-asserted authority without authorityRef
  const nestedSelfAsserted = {
    id: "visual-check",
    kind: "command",
    requirement: "visual-verification",
    status: "passed",
    source: "npx @liustack/modlens",
    details: {
      command: "npx @liustack/modlens",
      authority: { softwareInstallation: "AUTHORIZED" },
    },
  };
  const val2 = validateVerificationAuthority(nestedSelfAsserted);
  assert.equal(val2.valid, false);
  assert.equal(val2.error.code, E_INSTALLATION_AUTHORITY_REQUIRED);

  // Execution self-asserted boolean
  const execSelfAsserted = {
    id: "visual-check",
    kind: "command",
    requirement: "visual-verification",
    status: "passed",
    source: "npx @liustack/modlens",
    details: {
      command: "npx @liustack/modlens",
      execution: { installationAuthorized: true },
    },
  };
  const val3 = validateVerificationAuthority(execSelfAsserted);
  assert.equal(val3.valid, false);
  assert.equal(val3.error.code, E_INSTALLATION_AUTHORITY_REQUIRED);

  // Unresolvable authorityRef
  const unresolvableCheck = {
    id: "visual-check",
    kind: "command",
    requirement: "visual-verification",
    status: "passed",
    source: "npx @liustack/modlens",
    details: {
      command: "npx @liustack/modlens",
      installationAuthorityRef: "auth-missing",
    },
  };
  const val4 = validateVerificationAuthority(unresolvableCheck);
  assert.equal(val4.valid, false);
  assert.equal(val4.error.code, E_INSTALLATION_AUTHORITY_REQUIRED);

  // Valid authority grant
  const validAuthority = {
    schemaVersion: 1,
    protocolVersion: 1,
    authorityId: "auth-modlens",
    taskId: "task-1",
    type: "SOFTWARE_INSTALLATION",
    status: "AUTHORIZED",
    scope: { tool: "@liustack/modlens" },
    source: "operator",
  };
  const checkWithValidAuth = {
    id: "visual-check",
    kind: "command",
    requirement: "visual-verification",
    status: "passed",
    source: "npx @liustack/modlens --spec=visual.json",
    details: {
      command: "npx @liustack/modlens --spec=visual.json",
      installationAuthorityRef: "auth-modlens",
    },
  };
  const val5 = validateVerificationAuthority(checkWithValidAuth, {
    taskId: "task-1",
    authorityContext: {
      trustMode: "HOST_ATTESTED",
      authorities: { "auth-modlens": validAuthority },
    },
  });
  assert.equal(val5.valid, true);
  assert.equal(val5.error, null);

  // A loose trustMode or a source outside authorityContext cannot self-attest.
  const directSelfAttested = validateVerificationAuthority(checkWithValidAuth, {
    taskId: "task-1",
    trustMode: "HOST_ATTESTED",
    authorities: { "auth-modlens": validAuthority },
  });
  assert.equal(directSelfAttested.valid, false);
  assert.equal(directSelfAttested.error.code, E_AUTHORITY_UNTRUSTED_SOURCE);
  const splitContext = validateVerificationAuthority(checkWithValidAuth, {
    taskId: "task-1",
    authorityContext: { trustMode: "HOST_ATTESTED" },
    authorities: { "auth-modlens": validAuthority },
  });
  assert.equal(splitContext.valid, false);
  assert.equal(splitContext.error.code, E_INSTALLATION_AUTHORITY_REQUIRED);

  // Wrong task authority grant
  const valWrongTask = validateVerificationAuthority(checkWithValidAuth, {
    taskId: "task-2",
    authorityContext: {
      trustMode: "HOST_ATTESTED",
      authorities: { "auth-modlens": validAuthority },
    },
  });
  assert.equal(valWrongTask.valid, false);
  assert.equal(valWrongTask.error.code, "E_AUTHORITY_INVALID");

  // Wrong tool scope authority grant
  const wrongScopeAuth = {
    ...validAuthority,
    scope: { tool: "playwright" },
  };
  const valWrongScope = validateVerificationAuthority(checkWithValidAuth, {
    taskId: "task-1",
    authorityContext: {
      trustMode: "HOST_ATTESTED",
      authorities: { "auth-modlens": wrongScopeAuth },
    },
  });
  assert.equal(valWrongScope.valid, false);
  assert.equal(valWrongScope.error.code, "E_AUTHORITY_SCOPE_MISMATCH");

  // Revoked authority grant
  const revokedAuth = {
    ...validAuthority,
    status: "REVOKED",
  };
  const valRevoked = validateVerificationAuthority(checkWithValidAuth, {
    taskId: "task-1",
    authorityContext: {
      trustMode: "HOST_ATTESTED",
      authorities: { "auth-modlens": revokedAuth },
    },
  });
  assert.equal(valRevoked.valid, false);
  assert.equal(valRevoked.error.code, "E_AUTHORITY_INVALID");

  // Self-issued agent-self authority grant
  const agentSelfAuth = {
    ...validAuthority,
    source: "agent-self",
  };
  const valAgentSelf = validateVerificationAuthority(checkWithValidAuth, {
    taskId: "task-1",
    authorityContext: {
      trustMode: "HOST_ATTESTED",
      authorities: { "auth-modlens": agentSelfAuth },
    },
  });
  assert.equal(valAgentSelf.valid, false);
  assert.equal(valAgentSelf.error.code, "E_AUTHORITY_INVALID");

  // Non-installing command needs no authority
  const nonInstallingCheck = {
    id: "visual-check",
    kind: "command",
    requirement: "visual-verification",
    status: "passed",
    source: "npx --no-install @liustack/modlens",
    details: {
      command: "npx --no-install @liustack/modlens",
    },
  };
  const valNonInstall = validateVerificationAuthority(nonInstallingCheck);
  assert.equal(valNonInstall.valid, true);
  assert.equal(valNonInstall.error, null);
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
    executionRef: "exec-test",
    provenance: "FORGELOOP_EXECUTED",
    details: {
      command: "npx @liustack/modlens",
      installationAuthorized: true, // self-asserted boolean must NOT pass
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

function authorityCheck() {
  return {
    id: "visual-check",
    kind: "command",
    requirement: "visual-verification",
    status: "passed",
    source: "npx @liustack/modlens",
    details: {
      command: "npx @liustack/modlens",
      installationAuthorityRef: "auth-modlens",
    },
    executionRef: "exec-test",
    provenance: "FORGELOOP_EXECUTED",
  };
}

function authorityGrant(taskId = "task-1") {
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    authorityId: "auth-modlens",
    taskId,
    type: "SOFTWARE_INSTALLATION",
    status: "AUTHORIZED",
    scope: { tool: "@liustack/modlens" },
    source: "operator",
  };
}

test("project-local authority claims are rejected as an untrusted source", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-local-authority-"));
  try {
    const localAuthorityPath = path.join(target, ".forgeloop", "authorities", "auth-modlens.json");
    await mkdir(path.dirname(localAuthorityPath), { recursive: true });
    await writeFile(localAuthorityPath, JSON.stringify(authorityGrant()), "utf8");

    const result = validateVerificationAuthority(authorityCheck(), {
      target,
      taskId: "task-1",
    });

    assert.equal(result.valid, false);
    assert.equal(result.error.code, E_AUTHORITY_UNTRUSTED_SOURCE);

    const readiness = evaluateRequiredEvidence({
      requirements: ["visual-verification"],
      checks: [{
        ...authorityCheck(),
        schemaVersion: 1,
        protocolVersion: 1,
        evidenceKind: "OBSERVED",
      }],
      target,
      taskId: "task-1",
    });
    assert.equal(readiness.ready, false);
    assert.equal(readiness.covered.length, 0);
    assert.equal(readiness.invalid[0].reasonCode, E_AUTHORITY_UNTRUSTED_SOURCE);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("host-supplied external authority file and directory are trusted", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-external-target-"));
  const authorityRoot = await mkdtemp(path.join(os.tmpdir(), "forgeloop-host-authority-"));
  try {
    const authorityFile = path.join(authorityRoot, "authorities.json");
    await writeFile(authorityFile, JSON.stringify({
      schemaVersion: 1,
      protocolVersion: 1,
      authorities: [authorityGrant()],
    }), "utf8");

    const fromFile = validateVerificationAuthority(authorityCheck(), {
      target,
      taskId: "task-1",
      authorityContext: {
        trustMode: "HOST_ATTESTED",
        trustedAuthorityFile: authorityFile,
      },
    });
    assert.equal(fromFile.valid, true);

    const authorityDir = path.join(authorityRoot, "authorities");
    await mkdir(authorityDir);
    await writeFile(path.join(authorityDir, "auth-modlens.json"), JSON.stringify(authorityGrant()), "utf8");
    const fromDirectory = validateVerificationAuthority(authorityCheck(), {
      target,
      taskId: "task-1",
      authorityContext: {
        trustMode: "HOST_ATTESTED",
        trustedAuthorityDir: authorityDir,
      },
    });
    assert.equal(fromDirectory.valid, true);
  } finally {
    await rm(target, { recursive: true, force: true });
    await rm(authorityRoot, { recursive: true, force: true });
  }
});

test("standalone environment-selected authority remains untrusted", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-env-authority-target-"));
  const authorityRoot = await mkdtemp(path.join(os.tmpdir(), "forgeloop-env-authority-root-"));
  const authorityFile = path.join(authorityRoot, "actor-selected.json");
  const previousFile = process.env.FORGELOOP_AUTHORITY_FILE;
  const previousDir = process.env.FORGELOOP_AUTHORITY_DIR;
  try {
    await writeFile(authorityFile, JSON.stringify({
      schemaVersion: 1,
      protocolVersion: 1,
      authorities: [authorityGrant()],
    }), "utf8");
    process.env.FORGELOOP_AUTHORITY_FILE = authorityFile;
    delete process.env.FORGELOOP_AUTHORITY_DIR;

    const result = validateVerificationAuthority(authorityCheck(), {
      target,
      taskId: "task-1",
    });

    assert.equal(result.valid, false);
    assert.equal(result.error.code, E_AUTHORITY_UNTRUSTED_SOURCE);
  } finally {
    if (previousFile === undefined) delete process.env.FORGELOOP_AUTHORITY_FILE;
    else process.env.FORGELOOP_AUTHORITY_FILE = previousFile;
    if (previousDir === undefined) delete process.env.FORGELOOP_AUTHORITY_DIR;
    else process.env.FORGELOOP_AUTHORITY_DIR = previousDir;
    await rm(target, { recursive: true, force: true });
    await rm(authorityRoot, { recursive: true, force: true });
  }
});

test("standalone environment-selected authority directory remains untrusted", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-env-authority-dir-target-"));
  const authorityRoot = await mkdtemp(path.join(os.tmpdir(), "forgeloop-env-authority-dir-"));
  const previousFile = process.env.FORGELOOP_AUTHORITY_FILE;
  const previousDir = process.env.FORGELOOP_AUTHORITY_DIR;
  try {
    await writeFile(path.join(authorityRoot, "auth-modlens.json"), JSON.stringify(authorityGrant()), "utf8");
    delete process.env.FORGELOOP_AUTHORITY_FILE;
    process.env.FORGELOOP_AUTHORITY_DIR = authorityRoot;

    const result = validateVerificationAuthority(authorityCheck(), {
      target,
      taskId: "task-1",
    });

    assert.equal(result.valid, false);
    assert.equal(result.error.code, E_AUTHORITY_UNTRUSTED_SOURCE);
  } finally {
    if (previousFile === undefined) delete process.env.FORGELOOP_AUTHORITY_FILE;
    else process.env.FORGELOOP_AUTHORITY_FILE = previousFile;
    if (previousDir === undefined) delete process.env.FORGELOOP_AUTHORITY_DIR;
    else process.env.FORGELOOP_AUTHORITY_DIR = previousDir;
    await rm(target, { recursive: true, force: true });
    await rm(authorityRoot, { recursive: true, force: true });
  }
});

test("a configured authority file inside the target is rejected", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "forgeloop-contained-authority-"));
  try {
    const authorityFile = path.join(target, ".forgeloop", "authorities.json");
    await mkdir(path.dirname(authorityFile), { recursive: true });
    await writeFile(authorityFile, JSON.stringify({
      schemaVersion: 1,
      protocolVersion: 1,
      authorities: [authorityGrant()],
    }), "utf8");

    const result = validateVerificationAuthority(authorityCheck(), {
      target,
      taskId: "task-1",
      trustedAuthorityFile: authorityFile,
    });

    assert.equal(result.valid, false);
    assert.equal(result.error.code, E_AUTHORITY_UNTRUSTED_SOURCE);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
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
