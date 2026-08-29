export function assertSigningProvider(provider) {
  if (!provider || typeof provider !== "object"
    || typeof provider.detect !== "function"
    || typeof provider.sign !== "function"
    || typeof provider.verify !== "function") {
    const error = new Error("Signing provider must implement detect, sign, and verify");
    error.code = "E_ATTESTATION_SIGNER_UNAVAILABLE";
    throw error;
  }
  return provider;
}

export async function resolveSigningProvider({ providerName = "none", registry = {} } = {}) {
  const factory = registry[providerName];
  if (typeof factory !== "function") {
    const error = new Error(`Signing provider is unavailable: ${providerName}`);
    error.code = "E_ATTESTATION_SIGNER_UNAVAILABLE";
    throw error;
  }
  return assertSigningProvider(await factory());
}
