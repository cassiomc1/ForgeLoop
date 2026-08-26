/**
 * Deterministic Risk Evaluator
 *
 * Core risk evaluation engine for change requests. Computes an integer risk score (0-100),
 * risk tier (LOW, MEDIUM, HIGH, CRITICAL), and policy decision (APPROVE, REQUIRE_APPROVAL, REJECT).
 */

import { RISK_RULES } from "./rules.js";
import { validateChangeRequest } from "./schemas.js";

export const RISK_TIERS = Object.freeze({
  LOW: Object.freeze({ name: "LOW", minScore: 0, maxScore: 29, decision: "APPROVE" }),
  MEDIUM: Object.freeze({ name: "MEDIUM", minScore: 30, maxScore: 59, decision: "REQUIRE_APPROVAL" }),
  HIGH: Object.freeze({ name: "HIGH", minScore: 60, maxScore: 84, decision: "REQUIRE_APPROVAL" }),
  CRITICAL: Object.freeze({ name: "CRITICAL", minScore: 85, maxScore: 100, decision: "REJECT" }),
});

export function getRiskTier(score) {
  if (score <= 29) return RISK_TIERS.LOW;
  if (score <= 59) return RISK_TIERS.MEDIUM;
  if (score <= 84) return RISK_TIERS.HIGH;
  return RISK_TIERS.CRITICAL;
}

export function evaluateRisk(input, options = {}) {
  const validation = validateChangeRequest(input);
  if (!validation.valid) {
    const error = new Error("Invalid change request payload");
    error.code = "E_INVALID_PAYLOAD";
    error.validationErrors = validation.errors;
    throw error;
  }

  // Base score depends on change type
  let baseScore = 0;
  const changeType = input.changeType.toLowerCase();
  if (changeType === "emergency") baseScore = 20;
  else if (changeType === "experimental") baseScore = 15;
  else if (changeType === "standard") baseScore = 5;
  else if (changeType === "routine") baseScore = 0;

  const triggeredRules = [];
  const mitigationsApplied = [];
  let scoreDelta = 0;

  // Rules are evaluated in deterministic sorted order
  for (const rule of RISK_RULES) {
    const isTriggered = rule.evaluate(input);
    if (isTriggered) {
      const summary = {
        ruleId: rule.id,
        name: rule.name,
        category: rule.category,
        weight: rule.weight,
        description: rule.description,
      };

      if (rule.isMitigation) {
        mitigationsApplied.push(summary);
      } else {
        triggeredRules.push(summary);
      }

      scoreDelta += rule.weight;
    }
  }

  // Calculate final score clamped between 0 and 100
  const unroundedScore = baseScore + scoreDelta;
  const finalScore = Math.max(0, Math.min(100, Math.round(unroundedScore)));
  const tierInfo = getRiskTier(finalScore);

  const timestamp = options.evaluatedAt ?? new Date().toISOString();

  return {
    valid: true,
    serviceName: input.serviceName,
    environment: input.environment.toLowerCase(),
    changeType: input.changeType.toLowerCase(),
    baseScore,
    scoreDelta,
    score: finalScore,
    tier: tierInfo.name,
    decision: tierInfo.decision,
    rulesEvaluatedCount: RISK_RULES.length,
    triggeredRulesCount: triggeredRules.length,
    mitigationsCount: mitigationsApplied.length,
    triggeredRules,
    mitigationsApplied,
    explanation: generateExplanation(input.serviceName, finalScore, tierInfo, triggeredRules, mitigationsApplied),
    evaluatedAt: timestamp,
  };
}

function generateExplanation(serviceName, score, tierInfo, rules, mitigations) {
  const parts = [
    `Change for service '${serviceName}' evaluated with composite risk score of ${score}/100 (${tierInfo.name}).`,
    `Policy decision: ${tierInfo.decision}.`,
  ];

  if (rules.length > 0) {
    parts.push(`Triggered risk rules: ${rules.map((r) => r.name).join("; ")}.`);
  } else {
    parts.push("No elevated risk factors detected.");
  }

  if (mitigations.length > 0) {
    parts.push(`Active mitigations: ${mitigations.map((m) => m.name).join("; ")}.`);
  }

  return parts.join(" ");
}
