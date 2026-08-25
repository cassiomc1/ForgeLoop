import { GUIDE_IDS, PROTOCOL_VERSION } from "./protocol.js";
import { assertSchema, readSchema } from "./schema-validation.js";
import { assertEvidenceList, evidenceMatches } from "./evidence.js";
import { assertJsonLimits } from "./json-safety.js";
import { assertCheck } from "./checks.js";
import { assertCoverageList } from "./coverage.js";

const RECEIPT_SCHEMA_VERSION = 1;
const SECRET_WORDS = new Set(["token", "password", "secret", "credential"]);
const SECRET_VALUE_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /(?:^|\s)(?:sk|ghp|glpat|xox[baprs])-[-_a-z0-9]{8,}/i,
  /(?:AKIA|ASIA)[A-Z0-9]{12,}/,
];

function findSecretLikeValues(value, location, violations) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findSecretLikeValues(item, `${location}[${index}]`, violations));
    return;
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
      violations.push(`${location}: secret-like value is not allowed`);
    }
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;
    const pathLikeDocumentation = /\.(?:md|txt|json)$/i.test(key);
    const words = key.split(/(?=[A-Z])|[_\-\s]+/).filter(Boolean).map((word) => word.toLowerCase());
    const compact = key.replaceAll(/[^a-z0-9]/gi, "").toLowerCase();
    const containsSensitiveWord = !pathLikeDocumentation && (
      words.some((word) => SECRET_WORDS.has(word))
      || ["apikey", "privatekey", "accesskey", "secretkey"].some((term) => compact.includes(term))
      || words.some((word, index) => ["api", "private", "access", "secret"].includes(word)
        && ["key", "token"].includes(words[index + 1]))
    );
    if (containsSensitiveWord) {
      violations.push(`${childLocation}: secret-like field is not allowed`);
    }
    findSecretLikeValues(child, childLocation, violations);
  }
}

export function assertSecretFree(value) {
  assertJsonLimits(value, "secret-free artifact");
  const violations = [];
  findSecretLikeValues(value, "$", violations);
  if (violations.length > 0) throw new Error(violations.join("; "));
}

function assertKnownGuides(guides) {
  const unknown = guides.filter((guide) => !GUIDE_IDS.includes(guide));
  if (unknown.length > 0) throw new Error(`Receipt contains unknown guide: ${unknown[0]}`);
  if (new Set(guides).size !== guides.length) throw new Error("Receipt selectedGuides must not contain duplicates");
}

export function assertReceiptSemantics(receipt, options = {}) {
  const evidence = receipt.evidence ?? [];
  if (receipt.verificationCycle !== undefined
    && (!Number.isInteger(receipt.verificationCycle) || receipt.verificationCycle < 1)) {
    throw new Error("receipt.verificationCycle must be a positive integer");
  }
  assertEvidenceList(evidence, "receipt.evidence");

  for (const [index, check] of receipt.checks.entries()) {
    if (check?.schemaVersion !== undefined || check?.id !== undefined || check?.evidenceKind !== undefined) {
      assertCheck(check, `receipt.checks[${index}]`, options);
      continue;
    }
    if (check?.status === "passed") {
      const hasCommandOrResult = [check.command, check.result, check.name]
        .some((value) => typeof value === "string" && value.trim().length > 0);
      if (!hasCommandOrResult) {
        throw new Error(`receipt.checks[${index}] passed check requires a command or result`);
      }
    }
  }

  if (receipt.evidenceCoverage !== undefined) {
    assertCoverageList(receipt.evidenceCoverage, "receipt.evidenceCoverage");
  }

  if (receipt.status === "complete") {
    const verificationEvidence = evidence.filter((item) => ["OBSERVED", "INFERRED"].includes(item.kind));
    if (verificationEvidence.length === 0) {
      throw new Error("COMPLETE receipt requires verification evidence");
    }
  }

  const publicationEvidence = [
    [receipt.publication.committed, ["commit", "committed"], "committed", "commit"],
    [receipt.publication.pushed, ["git push", "pushed"], "pushed", "push"],
    [receipt.publication.deployed, ["deploy", "deployed", "deployment"], "deployed", "deployment"],
  ];
  for (const [claimed, terms, field, label] of publicationEvidence) {
    if (claimed && !evidenceMatches(evidence, terms)) {
      const error = new Error(`publication.${field} requires ${label} evidence`);
      error.code = "E_PUBLICATION_CLAIM_UNVERIFIED";
      throw error;
    }
  }

  if (["committed", "pushed", "published", "deployed"].includes(receipt.publicationStatus)) {
    const requiredTerms = receipt.publicationStatus === "committed"
      ? ["commit", "committed"]
      : receipt.publicationStatus === "pushed"
        ? ["git push", "pushed"]
        : receipt.publicationStatus === "deployed"
          ? ["deploy", "deployed", "deployment"]
          : ["publish", "published", "release"];
    if (!evidenceMatches(evidence, requiredTerms)) {
      const error = new Error(`publicationStatus ${receipt.publicationStatus} requires publication evidence`);
      error.code = "E_PUBLICATION_CLAIM_UNVERIFIED";
      throw error;
    }
  }
  if (receipt.productionReadiness === "ready" && !evidenceMatches(evidence, ["production readiness", "production validation", "deployment"])) {
    const error = new Error("productionReadiness ready requires production evidence");
    error.code = "E_PRODUCTION_READINESS_UNVERIFIED";
    throw error;
  }

  if (receipt.review.independent === true) {
    const implementer = receipt.review.implementerId;
    const reviewer = receipt.review.reviewerId;
    if (typeof implementer !== "string" || typeof reviewer !== "string" || implementer === reviewer) {
      throw new Error("independent review requires distinct implementer and reviewer identities");
    }
  }
  return receipt;
}

export async function validateReceipt(receipt, packageRoot, options = {}) {
  assertSecretFree(receipt);
  const schema = await readSchema("execution-receipt", packageRoot);
  assertSchema(receipt, schema, "execution receipt");
  assertKnownGuides(receipt.selectedGuides);
  return assertReceiptSemantics(receipt, options);
}

export async function createReceipt(input, packageRoot, options = {}) {
  assertSecretFree(input);
  const receipt = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    taskId: input.taskId,
    contractFingerprint: input.contractFingerprint,
    ...(input.routeFingerprint !== undefined ? { routeFingerprint: input.routeFingerprint } : {}),
    ...(input.stateFingerprint !== undefined ? { stateFingerprint: input.stateFingerprint } : {}),
    ...(input.verificationCycle !== undefined ? { verificationCycle: input.verificationCycle } : {}),
    status: input.status ?? "in-progress",
    ...(input.taskStatus !== undefined ? { taskStatus: input.taskStatus } : {}),
    ...(input.verificationStatus !== undefined ? { verificationStatus: input.verificationStatus } : {}),
    ...(input.publicationStatus !== undefined ? { publicationStatus: input.publicationStatus } : {}),
    ...(input.productionReadiness !== undefined ? { productionReadiness: input.productionReadiness } : {}),
    selectedGuides: [...(input.selectedGuides ?? [])],
    changedPaths: [...(input.changedPaths ?? [])],
    checks: [...(input.checks ?? [])],
    ...(input.actions !== undefined ? { actions: structuredClone(input.actions) } : {}),
    evidence: [...(input.evidence ?? [])],
    ...(input.evidenceCoverage !== undefined ? { evidenceCoverage: [...input.evidenceCoverage] } : {}),
    review: input.review ?? { status: "not-run", independent: false },
    limitations: [...(input.limitations ?? [])],
    publication: input.publication ?? {
      committed: false,
      pushed: false,
      pullRequest: null,
      deployed: false,
    },
  };
  return validateReceipt(receipt, packageRoot, options);
}
