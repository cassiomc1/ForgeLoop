# Deterministic Risk Evaluator Workload

The Deterministic Risk Evaluator is a lightweight, zero-dependency Node.js CLI tool designed to evaluate change risk for software release pipelines, microservice deployments, and automated promotion gates.

This application serves as the production workload within the **ForgeLoop Real Execution Proof of Concept (PoC)**.

---

## 1. Features

- **Strict Input Validation**: Validates change requests against a structured schema (required service identity, environment enum, change type enum, boolean flags, numeric bounds).
- **Deterministic Rule Engine**: Evaluates an ordered catalog of risk factors and mitigations with constant integer weights.
- **Risk Tier Classification**:
  - `LOW` (0–29): Automatic approval (`APPROVE`)
  - `MEDIUM` (30–59): Human sign-off required (`REQUIRE_APPROVAL`)
  - `HIGH` (60–84): Senior architectural / security sign-off required (`REQUIRE_APPROVAL`)
  - `CRITICAL` (85–100): Blocked / rejected change (`REJECT`)
- **Mitigation Offsets**: Credits active safety mechanisms such as canary rollouts (1–20%) and automated metric-driven rollbacks.
- **Structured JSON Output**: Emits detailed evaluation summaries with explanations, triggered rules, applied mitigations, and ISO timestamps.
- **Zero Runtime Dependencies**: Relies exclusively on Node.js built-in modules (`node:fs`, `node:path`, `node:process`, `node:test`, `node:assert`).

---

## 2. CLI Usage

### 2.1 Inline JSON Evaluation

```bash
node poc/workload/src/cli.js --eval '{
  "serviceName": "auth-service",
  "environment": "production",
  "changeType": "standard",
  "targetRegions": ["us-east-1", "eu-west-1"],
  "hasBreakingChange": false,
  "securityReviewCompleted": true,
  "maintenanceWindow": true,
  "canaryPercentage": 10,
  "automatedRollback": true
}'
```

Output:

```json
{
  "valid": true,
  "serviceName": "auth-service",
  "environment": "production",
  "changeType": "standard",
  "baseScore": 5,
  "scoreDelta": -10,
  "score": 0,
  "tier": "LOW",
  "decision": "APPROVE",
  "rulesEvaluatedCount": 8,
  "triggeredRulesCount": 1,
  "mitigationsCount": 2,
  "triggeredRules": [
    {
      "ruleId": "R001_MULTI_REGION_BLAST_RADIUS",
      "name": "Multi-Region Deployment",
      "category": "blast_radius",
      "weight": 20,
      "description": "Deployment targets multiple regions simultaneously, increasing potential blast radius."
    }
  ],
  "mitigationsApplied": [
    {
      "ruleId": "R007_MITIGATION_CANARY_CONFIGURED",
      "name": "Canary Deployment Configured",
      "category": "mitigation",
      "weight": -15,
      "description": "Canary release strategy configured with traffic percentage between 1% and 20%."
    },
    {
      "ruleId": "R008_MITIGATION_AUTOMATED_ROLLBACK",
      "name": "Automated Rollback Configured",
      "category": "mitigation",
      "weight": -15,
      "description": "Health-metric bound automated rollback is active and verified."
    }
  ],
  "explanation": "Change for service 'auth-service' evaluated with composite risk score of 0/100 (LOW). Policy decision: APPROVE. Triggered risk rules: Multi-Region Deployment. Active mitigations: Canary Deployment Configured; Automated Rollback Configured.",
  "evaluatedAt": "2026-08-26T18:00:00.000Z"
}
```

### 2.2 File Argument Evaluation

```bash
node poc/workload/src/cli.js --input request.json
# Or positional:
node poc/workload/src/cli.js request.json
```

### 2.3 Piped Stdin Evaluation

```bash
cat request.json | node poc/workload/src/cli.js
```

---

## 3. Exit Codes

| Code | Meaning | Condition |
| --- | --- | --- |
| `0` | Success | Evaluation completed successfully |
| `1` | Validation / Input Error | Missing required fields, invalid types, or malformed JSON |
| `2` | Policy Rejection | Change evaluated as `REJECT` and `--fail-on-reject` was passed |

---

## 4. Running Automated Tests

```bash
node --test poc/workload/test/*.test.js
```
