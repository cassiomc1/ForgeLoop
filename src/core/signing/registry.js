import { createNoneSigningProvider } from "./none.js";
import { createSigstoreSigningProvider } from "./sigstore.js";

export const SIGNING_PROVIDERS = Object.freeze({
  none: createNoneSigningProvider,
  sigstore: createSigstoreSigningProvider,
});
