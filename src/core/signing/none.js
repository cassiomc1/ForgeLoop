export function createNoneSigningProvider() {
  return {
    name: "none",
    async detect() { return true; },
    async sign() {
      return {
        status: "UNAVAILABLE",
        code: "E_ATTESTATION_SIGNER_UNAVAILABLE",
        message: "The none signing provider cannot create an external signature",
      };
    },
    async verify({ bundlePath } = {}) {
      if (bundlePath) {
        return {
          status: "INVALID",
          code: "E_ATTESTATION_SIGNER_UNAVAILABLE",
          message: "The none signing provider cannot verify an external signature bundle",
        };
      }
      return { status: "UNSIGNED", signer: null };
    },
  };
}
