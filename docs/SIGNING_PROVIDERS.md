# Signing Providers

Signing providers are external authorities for ForgeLoop attestation
signatures. They are separate from the provider-neutral attestation predicate
and revision model.

## Contract

```js
{
  detect(),
  sign({ target, statementPath, outputPath, bundlePath }),
  verify({ target, statementPath, bundlePath, policy })
}
```

The `none` provider is always available and yields `VERIFIED` at most. The
optional `sigstore` provider can produce `ATTESTED` after successful Cosign
verification under an exact signer policy.

## Sigstore boundary

ForgeLoop delegates signing and verification to a locally available
Cosign-compatible executable. The provider:

- uses explicit argument arrays and no shell;
- applies a bounded timeout and output limit;
- never logs standard error as a persisted artifact;
- accepts an optional trusted-root path;
- keeps identity and issuer policy outside the signed predicate;
- returns stable unavailable, invalid, identity, and issuer error codes.

Example external signing command:

```bash
cosign attest-blob \
  --statement .forgeloop/task-state/<taskKey>/attestations/statement.json \
  --bundle .forgeloop/task-state/<taskKey>/attestations/statement.sigstore.json \
  --yes
```

ForgeLoop never stores the private key, OIDC token, access token, or signing
credential. A bundle file is not trusted merely because it exists.

## Policy

```json
{
  "provider": "sigstore",
  "required": true,
  "policy": {
    "issuer": "https://token.actions.githubusercontent.com",
    "identities": ["https://github.com/example/project/.github/workflows/attest.yml@refs/heads/main"],
    "requireTransparencyLog": true
  }
}
```

Exact identity and issuer policy is required for `ATTESTED`. Broad regular
expressions and inferred trust are not accepted. Signature verification is
optional in ordinary local audit; a consumer can require it in range
verification with `--require-signature`.

## Extension rules

KMS, HSM, enterprise PKI, and other implementations may be registered without
changing `statement.json`. They must not redefine ForgeLoop evidence binding,
revision coverage, trust levels, or CLI result semantics. Provider conformance
tests must cover unavailable tools, nonzero exits, invalid signatures, policy
mismatches, timeouts, and bounded output.
