import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertRouteInvariants,
  evaluateRoute,
  PLATFORM_SEMANTICS,
  ROUTING_SIGNALS,
} from "../src/core/router.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function fixture(name) {
  return JSON.parse(
    await readFile(path.join(repositoryRoot, "tests", "fixtures", "routes", `${name}.json`), "utf8"),
  );
}

test("every supported work type has a canonical executable fixture", async () => {
  for (const workType of ROUTING_SIGNALS.workTypes) {
    const expected = await fixture(workType);
    assert.deepEqual(Object.keys(expected).sort(), [
      "expectedReasons",
      "forbidden",
      "guides",
      "input",
      "primary",
    ]);
    assert.equal(expected.input.workType, workType);
    const result = evaluateRoute(expected.input);
    assert.deepEqual(result.guides, expected.guides, workType);
    assert.equal(result.primary, expected.primary, workType);
    assert.deepEqual(result.reasons, expected.expectedReasons, workType);
    for (const guide of expected.forbidden) {
      assert.equal(result.guides.includes(guide), false, `${workType} selected ${guide}`);
    }
  }
});

test("platform semantics strengthen only an already relevant context", () => {
  const mobile = evaluateRoute({ workType: "documentation", surfaces: ["ui"], platforms: ["mobile"] });
  assert.deepEqual(mobile.guides, ["design", "accessibility", "performance"]);
  assert.ok(mobile.reasons.performance.includes("PLATFORM_MOBILE"));
  assert.ok(mobile.reasons.design.includes("PLATFORM_MOBILE"));
  assert.ok(mobile.reasons.accessibility.includes("PLATFORM_MOBILE"));

  const desktop = evaluateRoute({ workType: "documentation", surfaces: ["ui"], platforms: ["desktop"] });
  assert.deepEqual(desktop.guides, ["design", "accessibility"]);
  assert.ok(desktop.reasons.design.includes("PLATFORM_DESKTOP"));
  assert.ok(desktop.reasons.accessibility.includes("PLATFORM_DESKTOP"));
  assert.equal(desktop.guides.includes("performance"), false);

  const serverAuth = evaluateRoute({ workType: "documentation", surfaces: ["auth"], platforms: ["server"] });
  assert.deepEqual(serverAuth.guides, ["security", "test"]);
  assert.deepEqual(serverAuth.reasons.test, ["PLATFORM_SERVER"]);

  const ciExecutable = evaluateRoute({ workType: "documentation", platforms: ["ci"], executableChange: true });
  assert.deepEqual(ciExecutable.guides, ["clean", "test", "security"]);
  assert.deepEqual(ciExecutable.reasons.security, ["PLATFORM_CI"]);

  const platformOnly = evaluateRoute({ workType: "documentation", platforms: ["mobile", "desktop", "server", "ci"] });
  assert.deepEqual(platformOnly.guides, []);
  assert.deepEqual(platformOnly.excluded.documentation, ["DOCUMENTATION_DOMAIN_GUIDE_REQUIRED"]);
});

test("web and cross-platform are explicitly informational-only", () => {
  assert.equal(PLATFORM_SEMANTICS.web.mode, "informational-only");
  assert.equal(PLATFORM_SEMANTICS["cross-platform"].mode, "informational-only");
  const web = evaluateRoute({ workType: "documentation", platforms: ["web"] });
  const crossPlatform = evaluateRoute({ workType: "documentation", platforms: ["cross-platform"] });
  assert.deepEqual(web.guides, []);
  assert.deepEqual(crossPlatform.guides, []);
});

test("routing invariants reject selected and excluded guide overlap", () => {
  const result = evaluateRoute({ workType: "api", surfaces: ["api"] });
  assert.doesNotThrow(() => assertRouteInvariants(result));
  assert.throws(
    () => assertRouteInvariants({ ...result, excluded: { ...result.excluded, clean: ["BAD"] } }),
    /selected and excluded|exclusion reason/i,
  );
});

test("routing invariants expose every exclusion reason", () => {
  const documentation = evaluateRoute({ workType: "documentation" });
  assert.ok(Object.values(documentation.excluded).flat().includes("DOCUMENTATION_DOMAIN_GUIDE_REQUIRED"));
  assert.ok(Object.values(evaluateRoute({ workType: "documentation", surfaces: ["ui"] }).excluded).flat().includes("NO_BEHAVIOR_OR_EXECUTABLE_CHANGE"));
  assert.ok(Object.values(evaluateRoute({ workType: "documentation" }).excluded).flat().includes("NO_TRUST_BOUNDARY"));
  assert.ok(Object.values(evaluateRoute({ workType: "documentation" }).excluded).flat().includes("NO_MEASURABLE_PERFORMANCE_RISK"));
  assert.ok(Object.values(evaluateRoute({ workType: "documentation" }).excluded).flat().includes("NO_UI_SURFACE"));
  assert.ok(Object.values(evaluateRoute({ workType: "documentation" }).excluded).flat().includes("NO_PRIMARY_WORK_TYPE"));
});

test("equivalent normalized route inputs have identical JSON", () => {
  const left = evaluateRoute({
    workType: "documentation",
    surfaces: ["forms", "ui"],
    risks: ["performance", "untrusted-input"],
    platforms: ["mobile", "server"],
    behaviorChange: true,
  });
  const right = evaluateRoute({
    workType: "documentation",
    surfaces: ["ui", "forms"],
    risks: ["untrusted-input", "performance"],
    platforms: ["server", "mobile"],
    behaviorChange: true,
  });
  assert.equal(JSON.stringify(left), JSON.stringify(right));
});
