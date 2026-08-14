export const AUTHORITY_TRUST_MODES = Object.freeze(["NONE", "HOST_ATTESTED"]);

const AUTHORITY_CONTEXT_FIELDS = Object.freeze([
  "trustedAuthorityFile",
  "trustedAuthorityDir",
  "authorities",
  "authority",
]);

function configuredValue(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function providerValue(provider) {
  if (typeof provider === "function") return provider();
  return provider && typeof provider === "object" && !Array.isArray(provider) ? provider : {};
}

function contextInput(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const provider = providerValue(source.trustedAuthorityProvider);
  const explicit = source.authorityContext && typeof source.authorityContext === "object"
    ? source.authorityContext
    : {};
  const { authorityContext: _authorityContext, trustedAuthorityProvider: _trustedAuthorityProvider, ...direct } = source;
  return { ...direct, ...provider, ...explicit };
}

export function hasAuthorityContext(options = {}) {
  if (!options || typeof options !== "object") return false;
  return Boolean(
    options.authorityContext
    || options.runtimeContext?.authorityContext
    || (options.runtimeContext && typeof options.runtimeContext === "object" && options.runtimeContext.trustMode),
  );
}

export function createAuthorityContext(input = {}) {
  const values = contextInput(input);
  const trustMode = values.trustMode ?? values.authorityTrustMode ?? "NONE";
  if (!AUTHORITY_TRUST_MODES.includes(trustMode)) {
    const error = new Error(`Unsupported authority trust mode: ${trustMode}`);
    error.code = "E_AUTHORITY_INVALID";
    throw error;
  }

  const context = { trustMode };
  for (const field of AUTHORITY_CONTEXT_FIELDS) {
    if (field === "trustedAuthorityFile" || field === "trustedAuthorityDir") {
      const value = configuredValue(values[field]);
      if (value !== undefined) context[field] = value;
    } else if (values[field] !== undefined) {
      context[field] = values[field];
    }
  }
  return Object.freeze(context);
}

export function resolveAuthorityContext(options = {}) {
  const source = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  if (source.authorityContext !== undefined) {
    return createAuthorityContext(source.authorityContext);
  }
  if (source.runtimeContext?.authorityContext !== undefined) {
    return createAuthorityContext(source.runtimeContext.authorityContext);
  }
  if (source.runtimeContext && typeof source.runtimeContext === "object" && source.runtimeContext.trustMode) {
    return createAuthorityContext(source.runtimeContext);
  }

  const hasDirectAuthority = AUTHORITY_CONTEXT_FIELDS.some((field) => source[field] !== undefined);
  // Direct resolver options are legacy source selectors, not a host attestation
  // channel. They remain NONE unless wrapped in an explicit runtime context.
  return hasDirectAuthority ? createAuthorityContext({ ...source, trustMode: "NONE" }) : createAuthorityContext();
}

export function createForgeLoopContext(options = {}) {
  const authorityContext = createAuthorityContext(options);
  return Object.freeze({ authorityContext });
}
