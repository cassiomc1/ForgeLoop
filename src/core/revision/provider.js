import path from "node:path";

/**
 * Transport- and SCM-neutral revision provider contract.
 *
 * Providers expose opaque revision identifiers and normalized changed entries.
 * The attestation core deliberately knows nothing about Git command syntax.
 */
export function assertRevisionProvider(provider) {
  const required = [
    "detect",
    "getCurrentRevision",
    "getChangedEntries",
    "readContent",
    "getContentIdentity",
    "getRepositoryIdentity",
  ];
  if (!provider || typeof provider !== "object"
    || required.some((method) => typeof provider[method] !== "function")) {
    const error = new Error(`Revision provider must implement ${required.join(", ")}`);
    error.code = "E_REVISION_PROVIDER_INVALID";
    throw error;
  }
  return provider;
}

export function normalizeRevisionEntry(entry) {
  if (!entry || typeof entry !== "object" || typeof entry.path !== "string" || !entry.path) {
    const error = new Error("Revision entry requires a path");
    error.code = "E_REVISION_PROVIDER_INVALID";
    throw error;
  }
  const pathValue = entry.path.replaceAll("\\", "/");
  const sourcePath = entry.sourcePath ? entry.sourcePath.replaceAll("\\", "/") : null;
  const isSafe = (value) => typeof value === "string"
    && value.length > 0
    && !/[\u0000-\u001f\u007f]/u.test(value)
    && !value.startsWith("/")
    && path.posix.normalize(value) === value
    && value !== "."
    && value !== ".."
    && !value.startsWith("../")
    && !value.startsWith(".forgeloop/");
  if (!isSafe(pathValue) || (sourcePath !== null && !isSafe(sourcePath))) {
    const error = new Error(`Revision entry path is unsafe or reserved: ${pathValue}`);
    error.code = "E_REVISION_PROVIDER_INVALID";
    throw error;
  }
  return {
    path: pathValue,
    sourcePath,
    operation: entry.operation,
    kind: entry.kind,
    bytes: entry.bytes ?? null,
    providerContentId: entry.providerContentId ?? null,
    providerMetadata: entry.providerMetadata ?? {},
  };
}

export async function resolveRevisionProvider({ target, providerName = null, registry } = {}) {
  const providers = registry ?? {};
  if (providerName) {
    const factory = providers[providerName];
    if (typeof factory !== "function") {
      const error = new Error(`Revision provider is unavailable: ${providerName}`);
      error.code = "E_REVISION_PROVIDER_UNAVAILABLE";
      throw error;
    }
    return assertRevisionProvider(await factory({ target }));
  }

  const available = [];
  for (const [name, factory] of Object.entries(providers)) {
    try {
      const provider = assertRevisionProvider(await factory({ target }));
      if (await provider.detect(target)) available.push({ name, provider });
    } catch {
      // Auto-detection ignores providers that cannot inspect this target.
    }
  }
  if (available.length === 1) return available[0].provider;
  if (available.length === 0) {
    const error = new Error("No revision provider can resolve the target repository");
    error.code = "E_REVISION_PROVIDER_UNAVAILABLE";
    throw error;
  }
  const error = new Error(`Multiple revision providers match the target: ${available.map(({ name }) => name).join(", ")}`);
  error.code = "E_REVISION_PROVIDER_AMBIGUOUS";
  throw error;
}
