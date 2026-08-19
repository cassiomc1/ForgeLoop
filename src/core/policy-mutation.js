import { sha256 } from "./manifest.js";
import { canonicalFingerprint } from "./artifacts.js";
import { getPolicyAdapter } from "./policy-adapters.js";

// Synthetic secret-shaped values are assembled at runtime so committed source
// contains no paste-ready secret literals; mutation fixtures still receive the
// full value through content overrides.
const FAKE_AWS_ACCESS_KEY = ["AKIA", "1234567890", "ABCDEF"].join("");

const MUTATION_FIXTURES = Object.freeze({
  ["secret-detection"]: {
    mutationName: "hardcoded-secret",
    files: ["src/config/credentials.js"],
    contentOverrides: {
      "src/config/credentials.js": `const awsKey = '${FAKE_AWS_ACCESS_KEY}';\nmodule.exports = { awsKey };\n`,
    },
    expected: "FAIL",
  },
  "grain-complexity": {
    mutationName: "deep-nesting",
    files: ["src/utils/complex.js"],
    contentOverrides: {
      "src/utils/complex.js": "function deep() {\n" + "  if (true) {\n".repeat(20) + "    console.log('deep');\n" + "  }\n".repeat(20) + "}\n",
    },
    expected: "FAIL",
  },
  "architecture-layers": {
    mutationName: "layer-inversion",
    files: ["src/domain/user.js"],
    contentOverrides: {
      "src/domain/user.js": "import { db } from '../infrastructure/db.js';\nexport function getUser() { return db.query(); }\n",
    },
    expected: "FAIL",
  },
  "repo-structure": {
    mutationName: "missing-manifest",
    files: [],
    contentOverrides: {},
    expected: "FAIL",
  },
});

export function getMutationFixture(adapterId) {
  return MUTATION_FIXTURES[adapterId] ?? null;
}

export async function verifyRuleMutation({
  target = process.cwd(),
  rule,
  adapter = null,
  fixture = null,
  overrideChecker = null,
} = {}) {
  const adapterId = rule?.check?.adapter ?? (typeof rule?.check === "string" ? rule.check : null);
  const activeAdapter = overrideChecker ?? adapter ?? getPolicyAdapter(adapterId);

  if (!activeAdapter) {
    return {
      ruleId: rule?.id ?? "UNKNOWN",
      status: "UNSUPPORTED",
      why: `No policy adapter found for ${adapterId}`,
      fix: "Configure an existing adapter or provide a custom check handler.",
    };
  }

  const activeFixture = fixture ?? getMutationFixture(adapterId);
  if (!activeFixture) {
    return {
      ruleId: rule?.id ?? "UNKNOWN",
      status: "UNSUPPORTED",
      observed: "UNKNOWN",
      proofDigest: null,
      why: `No mutation fixture available for adapter ${adapterId}`,
      fix: "Provide a mutation fixture to verify this rule.",
    };
  }

  // Execute check on mutation fixture (in-memory content overrides, non-mutating)
  let checkResult;
  let executionError = null;
  try {
    checkResult = await activeAdapter.check({
      target,
      rule,
      files: activeFixture.files,
      contentOverrides: activeFixture.contentOverrides,
    });
  } catch (error) {
    executionError = error;
  }

  if (executionError) {
    return {
      ruleId: rule?.id ?? "UNKNOWN",
      mutation: activeFixture.mutationName,
      expected: activeFixture.expected,
      observed: "ERROR",
      status: "UNPROVEN",
      errorCode: "CHECK_MUTATION_EXECUTION_ERROR",
      proofDigest: null,
      why: `The policy checker failed while evaluating its mutation fixture: ${executionError.message}`,
      fix: "Repair checker execution path and rerun rule verification.",
    };
  }

  const observed = checkResult?.passed ? "PASS" : "FAIL";
  const expected = activeFixture.expected;
  const detected = observed === expected;

  const proofDigest = sha256(
    `${canonicalFingerprint(rule)}:${canonicalFingerprint(activeFixture)}:${expected}:${observed}`,
  );

  if (detected) {
    return {
      ruleId: rule.id,
      mutation: activeFixture.mutationName,
      expected,
      observed,
      status: "PROVEN",
      proofDigest: `sha256:${proofDigest}`,
      scannedFiles: checkResult?.scannedFiles ?? 1,
      why: "Mutation fixture was successfully detected by checker.",
      fix: "Rule is proven and active.",
    };
  }

  return {
    ruleId: rule.id,
    mutation: activeFixture.mutationName,
    expected,
    observed,
    status: "UNPROVEN",
    errorCode: "CHECK_MUTATION_NOT_DETECTED",
    proofDigest: null,
    why: `Checker failed to detect mutation fixture: expected ${expected} but observed ${observed}.`,
    fix: "Inspect checker logic to ensure it catches invalid states.",
  };
}
