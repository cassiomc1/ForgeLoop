import { GUIDE_IDS, PROTOCOL_VERSION } from "./protocol.js";
import { assertSchema, readSchema } from "./schema-validation.js";

const RECEIPT_SCHEMA_VERSION = 1;
const SECRET_KEY_PATTERN = /(api[_-]?key|token|password|secret|credential|private[_-]?key)/i;
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
    if (SECRET_KEY_PATTERN.test(key)) {
      violations.push(`${childLocation}: secret-like field is not allowed`);
    }
    findSecretLikeValues(child, childLocation, violations);
  }
}

function assertSecretFree(value) {
  const violations = [];
  findSecretLikeValues(value, "$", violations);
  if (violations.length > 0) throw new Error(violations.join("; "));
}

function assertKnownGuides(guides) {
  const unknown = guides.filter((guide) => !GUIDE_IDS.includes(guide));
  if (unknown.length > 0) throw new Error(`Receipt contains unknown guide: ${unknown[0]}`);
  if (new Set(guides).size !== guides.length) throw new Error("Receipt selectedGuides must not contain duplicates");
}

export async function validateReceipt(receipt, packageRoot) {
  assertSecretFree(receipt);
  const schema = await readSchema("execution-receipt", packageRoot);
  assertSchema(receipt, schema, "execution receipt");
  assertKnownGuides(receipt.selectedGuides);
  return receipt;
}

export async function createReceipt(input, packageRoot) {
  assertSecretFree(input);
  const receipt = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    taskId: input.taskId,
    contractFingerprint: input.contractFingerprint,
    selectedGuides: [...(input.selectedGuides ?? [])],
    changedPaths: [...(input.changedPaths ?? [])],
    checks: [...(input.checks ?? [])],
    review: input.review ?? { status: "not-run", independent: false },
    limitations: [...(input.limitations ?? [])],
    publication: input.publication ?? {
      committed: false,
      pushed: false,
      pullRequest: null,
      deployed: false,
    },
  };
  return validateReceipt(receipt, packageRoot);
}
