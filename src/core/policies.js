import { PROTOCOL_VERSION } from "./protocol.js";
import { assertSchema, readSchema } from "./schema-validation.js";

export const POLICY_SCHEMA_VERSION = 1;

const POLICIES = Object.freeze({
  "web-premium": {
    name: "web-premium",
    description: "Strict completion for premium website delivery.",
    complianceMode: "strict",
    requiredGates: ["design", "quality"],
    requiredEvidence: ["responsive-validation", "accessibility-validation", "build", "visual-validation"],
    allowedCompletionStates: ["COMPLETE"],
    freshnessRequired: true,
  },
  bugfix: {
    name: "bugfix",
    description: "Standard completion with diagnosis and regression evidence.",
    complianceMode: "standard",
    requiredGates: ["diagnosis", "regression"],
    requiredEvidence: ["reproduction", "regression"],
    allowedCompletionStates: ["COMPLETE", "BLOCKED"],
    freshnessRequired: true,
  },
  "security-critical": {
    name: "security-critical",
    description: "Strict completion with a declared trust boundary and observed security evidence.",
    complianceMode: "strict",
    requiredGates: ["threat-boundary", "security-verification"],
    requiredEvidence: ["security-validation", "negative-test"],
    allowedCompletionStates: ["COMPLETE", "BLOCKED"],
    freshnessRequired: true,
  },
  prototype: {
    name: "prototype",
    description: "Advisory local work with explicit non-production semantics.",
    complianceMode: "advisory",
    requiredGates: [],
    requiredEvidence: [],
    allowedCompletionStates: ["COMPLETE", "BLOCKED"],
    freshnessRequired: false,
  },
});

export function getPolicy(name) {
  const value = POLICIES[name];
  if (!value) {
    const error = new Error(`Unknown policy pack: ${name}`);
    error.code = "E_POLICY_UNKNOWN";
    throw error;
  }
  return {
    schemaVersion: POLICY_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    ...value,
    requiredGates: [...value.requiredGates],
    requiredEvidence: [...value.requiredEvidence],
    allowedCompletionStates: [...value.allowedCompletionStates],
  };
}

export function listPolicies() {
  return Object.keys(POLICIES).sort().map(getPolicy);
}

export async function validatePolicy(policy, packageRoot) {
  const schema = await readSchema("policy", packageRoot);
  return assertSchema(policy, schema, "policy");
}
