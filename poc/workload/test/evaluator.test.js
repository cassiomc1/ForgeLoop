/**
 * Risk Evaluator Unit Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateRisk, getRiskTier, RISK_TIERS } from "../src/evaluator.js";
import { validateChangeRequest } from "../src/schemas.js";
import { RISK_RULES } from "../src/rules.js";

describe("Schema Validation", () => {
  it("rejects non-object inputs", () => {
    assert.equal(validateChangeRequest(null).valid, false);
    assert.equal(validateChangeRequest("string").valid, false);
    assert.equal(validateChangeRequest(123).valid, false);
    assert.equal(validateChangeRequest([]).valid, false);
  });

  it("requires serviceName, environment, and changeType", () => {
    const res = validateChangeRequest({});
    assert.equal(res.valid, false);
    assert.equal(res.errors.length, 3);
    assert.ok(res.errors.some((e) => e.includes("serviceName")));
    assert.ok(res.errors.some((e) => e.includes("environment")));
    assert.ok(res.errors.some((e) => e.includes("changeType")));
  });

  it("validates allowed environments and change types", () => {
    const invalid = validateChangeRequest({
      serviceName: "my-svc",
      environment: "invalid-env",
      changeType: "invalid-type",
    });
    assert.equal(invalid.valid, false);
    assert.equal(invalid.errors.length, 2);

    const valid = validateChangeRequest({
      serviceName: "my-svc",
      environment: "production",
      changeType: "standard",
    });
    assert.equal(valid.valid, true);
    assert.equal(valid.errors.length, 0);
  });

  it("validates targetRegions format", () => {
    const bad = validateChangeRequest({
      serviceName: "my-svc",
      environment: "staging",
      changeType: "routine",
      targetRegions: "not-an-array",
    });
    assert.equal(bad.valid, false);

    const good = validateChangeRequest({
      serviceName: "my-svc",
      environment: "staging",
      changeType: "routine",
      targetRegions: ["us-east-1", "eu-west-1"],
    });
    assert.equal(good.valid, true);
  });

  it("validates boolean flags and numeric bounds", () => {
    const badBool = validateChangeRequest({
      serviceName: "my-svc",
      environment: "prod",
      changeType: "standard",
      hasBreakingChange: "yes",
      canaryPercentage: 150,
    });
    assert.equal(badBool.valid, false);
    assert.equal(badBool.errors.length, 2);

    const good = validateChangeRequest({
      serviceName: "my-svc",
      environment: "prod",
      changeType: "standard",
      hasBreakingChange: true,
      canaryPercentage: 10,
    });
    assert.equal(good.valid, true);
  });
});

describe("Deterministic Risk Scoring Engine", () => {
  it("calculates low risk for minimal routine changes in dev", () => {
    const result = evaluateRisk({
      serviceName: "billing-ui",
      environment: "development",
      changeType: "routine",
      securityReviewCompleted: true,
      maintenanceWindow: true,
    });

    assert.equal(result.valid, true);
    assert.equal(result.score, 0);
    assert.equal(result.tier, "LOW");
    assert.equal(result.decision, "APPROVE");
    assert.equal(result.triggeredRulesCount, 0);
  });

  it("evaluates emergency change base score correctly", () => {
    const result = evaluateRisk({
      serviceName: "auth-service",
      environment: "development",
      changeType: "emergency",
      securityReviewCompleted: true,
    });

    assert.equal(result.baseScore, 20);
    assert.equal(result.score, 20);
    assert.equal(result.tier, "LOW");
    assert.equal(result.decision, "APPROVE");
  });

  it("triggers breaking change and migration rules", () => {
    const result = evaluateRisk({
      serviceName: "order-db",
      environment: "staging",
      changeType: "standard", // base 5
      hasBreakingChange: true, // +30
      dataMigration: true,
      rollbackPlan: false, // +35
      securityReviewCompleted: true,
    });

    // Score = 5 + 30 + 35 = 70
    assert.equal(result.score, 70);
    assert.equal(result.tier, "HIGH");
    assert.equal(result.decision, "REQUIRE_APPROVAL");
    assert.equal(result.triggeredRulesCount, 2);
    assert.ok(result.triggeredRules.some((r) => r.ruleId === "R002_BREAKING_CHANGE"));
    assert.ok(result.triggeredRules.some((r) => r.ruleId === "R003_DATA_MIGRATION_NO_ROLLBACK"));
  });

  it("applies canary and automated rollback mitigations", () => {
    const unmitigated = evaluateRisk({
      serviceName: "checkout-api",
      environment: "production",
      changeType: "standard", // base 5
      targetRegions: ["us-east-1", "us-west-2"], // +20
      hasBreakingChange: true, // +30
      securityReviewCompleted: true,
      maintenanceWindow: true,
    });
    // 5 + 20 + 30 = 55 (MEDIUM)
    assert.equal(unmitigated.score, 55);
    assert.equal(unmitigated.tier, "MEDIUM");

    const mitigated = evaluateRisk({
      serviceName: "checkout-api",
      environment: "production",
      changeType: "standard", // base 5
      targetRegions: ["us-east-1", "us-west-2"], // +20
      hasBreakingChange: true, // +30
      securityReviewCompleted: true,
      maintenanceWindow: true,
      canaryPercentage: 10, // -15
      automatedRollback: true, // -15
    });
    // 55 - 15 - 15 = 25 (LOW)
    assert.equal(mitigated.score, 25);
    assert.equal(mitigated.tier, "LOW");
    assert.equal(mitigated.decision, "APPROVE");
    assert.equal(mitigated.mitigationsCount, 2);
  });

  it("triggers critical risk tier and reject decision on extreme cumulative risk", () => {
    const result = evaluateRisk({
      serviceName: "payment-gateway",
      serviceCategory: "payments", // +25
      environment: "production",
      changeType: "emergency", // base 20
      targetRegions: ["us-east-1", "eu-central-1", "ap-northeast-1"], // +20
      hasBreakingChange: true, // +30
      dataMigration: true,
      rollbackPlan: false, // +35
      securityReviewCompleted: false, // +25
      maintenanceWindow: false, // +15
    });

    // Sum: 20 + 25 + 20 + 30 + 35 + 25 + 15 = 170 -> Clamped to 100
    assert.equal(result.score, 100);
    assert.equal(result.tier, "CRITICAL");
    assert.equal(result.decision, "REJECT");
  });

  it("clamps negative composite scores to 0", () => {
    const result = evaluateRisk({
      serviceName: "static-assets",
      environment: "development",
      changeType: "routine", // base 0
      securityReviewCompleted: true,
      canaryPercentage: 5, // -15
      automatedRollback: true, // -15
    });

    assert.equal(result.score, 0);
    assert.equal(result.tier, "LOW");
    assert.equal(result.decision, "APPROVE");
  });

  it("is strictly deterministic across multiple runs", () => {
    const input = {
      serviceName: "user-profile",
      environment: "production",
      changeType: "standard",
      targetRegions: ["us-east-1", "eu-west-1"],
      securityReviewCompleted: false,
      canaryPercentage: 10,
    };

    const fixedTime = "2026-08-26T15:00:00.000Z";
    const run1 = evaluateRisk(input, { evaluatedAt: fixedTime });
    const run2 = evaluateRisk(input, { evaluatedAt: fixedTime });

    assert.deepEqual(run1, run2);
    assert.equal(JSON.stringify(run1), JSON.stringify(run2));
  });

  it("throws E_INVALID_PAYLOAD on invalid request", () => {
    assert.throws(
      () => evaluateRisk({ invalid: "data" }),
      (err) => {
        assert.equal(err.code, "E_INVALID_PAYLOAD");
        assert.ok(Array.isArray(err.validationErrors));
        return true;
      },
    );
  });
});

describe("Risk Tier Boundary Mapping", () => {
  it("maps boundary values to correct tiers and decisions", () => {
    assert.equal(getRiskTier(0).name, "LOW");
    assert.equal(getRiskTier(0).decision, "APPROVE");
    assert.equal(getRiskTier(29).name, "LOW");
    assert.equal(getRiskTier(29).decision, "APPROVE");

    assert.equal(getRiskTier(30).name, "MEDIUM");
    assert.equal(getRiskTier(30).decision, "REQUIRE_APPROVAL");
    assert.equal(getRiskTier(59).name, "MEDIUM");
    assert.equal(getRiskTier(59).decision, "REQUIRE_APPROVAL");

    assert.equal(getRiskTier(60).name, "HIGH");
    assert.equal(getRiskTier(60).decision, "REQUIRE_APPROVAL");
    assert.equal(getRiskTier(84).name, "HIGH");
    assert.equal(getRiskTier(84).decision, "REQUIRE_APPROVAL");

    assert.equal(getRiskTier(85).name, "CRITICAL");
    assert.equal(getRiskTier(85).decision, "REJECT");
    assert.equal(getRiskTier(100).name, "CRITICAL");
    assert.equal(getRiskTier(100).decision, "REJECT");
  });
});
