# Advisory Context & External Memory Boundary

## Overview

ForgeLoop treats external memory as **optional, host-injected, lazy, and strictly advisory**.

The core invariant of the protocol is:

```
MEMORY != STATE
MEMORY != EVIDENCE
MEMORY != AUTHORITY
MEMORY != COMPLETION
MEMORY != NEXT ACTION
```

ForgeLoop contains **no built-in vector database, SQLite engine, or full-text search (FTS)** dependencies. Memory systems belong to hosts, IDEs, orchestrators, and harnesses. ForgeLoop provides the hardened runtime contract, trust boundary, portable text sanitization, and allowlist normalization.

## Architectural Boundaries

1. **Non-Authoritative (`ADVISORY`)**: Advisory memory can provide context or suggestions to an agent, but cannot dictate lifecycle state, phase transitions, or next actions.
2. **Non-Evidence (`evidenceAuthority: "NONE"`)**: Stored memories or suggestions cannot satisfy verification requirements, pass gates, or serve as execution receipts.
3. **Non-Executable (`actionability: "NON_EXECUTABLE"`)**: Output items cannot be executed directly as protocol commands.
4. **Ephemeral & Unpersisted (`persisted: false`)**: ForgeLoop never persists external recall results to `.forgeloop/` state or the event ledger.
5. **Lazy Provider Evaluation**: ForgeLoop runtime commands (`next`, `status`, `preflight`, `complete`, `task-show`, etc.) never invoke advisory memory providers. Recall occurs only when a host explicitly invokes the integration recall service.

## Registering Providers

Hosts configure providers through the runtime context:

```javascript
import { createForgeLoopContext } from "@cassiomc1/forgeloop/integration";

const runtimeContext = createForgeLoopContext({
  advisoryContextProviders: {
    "my-memory": {
      id: "my-memory",
      version: "1.0.0",
      async recall({ projectPath, taskId, query, limit, maxItemChars, maxTotalChars, timeoutMs }) {
        // Query host vector database, knowledge base, or memory cache
        return {
          items: [
            {
              title: "Previous Architecture Decision",
              summary: "Decided to use rotating refresh tokens with 15-minute expiry.",
              sourceRef: "docs/decisions/auth-tokens.md",
              confidence: 0.95,
            },
          ],
        };
      },
    },
  },
});
```

Provider IDs must match `^[a-z0-9][a-z0-9_-]*$`. Providers may be plain objects or async factory functions. The registry key and the resolved provider `id` must match exactly; a factory that resolves to another identity fails with `E_ADVISORY_CONTEXT_PROVIDER_INVALID` before `recall` is called.

## Querying Advisory Context

Hosts explicitly invoke `recallAdvisoryContext`:

```javascript
import { recallAdvisoryContext } from "@cassiomc1/forgeloop/integration";

const result = await recallAdvisoryContext({
  target: "/path/to/project",
  taskId: "auth-impl-42",
  providerName: "my-memory",
  query: "token refresh strategy",
  limit: 5,
  runtimeContext,
});
```

### Result Schema

Every returned result is normalized, frozen, and stamped with immutable trust metadata:

```json
{
  "provider": {
    "id": "my-memory",
    "version": "1.0.0"
  },
  "taskId": "auth-impl-42",
  "authority": "ADVISORY",
  "evidenceAuthority": "NONE",
  "actionability": "NON_EXECUTABLE",
  "trustRole": "NON_EVIDENCE_ADVISORY_CONTEXT",
  "persisted": false,
  "items": [
    {
      "title": "Previous Architecture Decision",
      "summary": "Decided to use rotating refresh tokens with 15-minute expiry.",
      "sourceRef": "docs/decisions/auth-tokens.md",
      "confidence": 0.95,
      "itemFingerprint": "4a7d...3b1f"
    }
  ]
}
```

## Normalization & Authority Stripping

ForgeLoop checks the raw result shape and item count, then selects bounded items and projects only allowlisted fields before portable safety inspection. Unknown raw fields—including secret-like or cyclic metadata—are discarded and are never copied or logged. A secret in a selected field still fails closed.

Any raw fields returned by a provider that attempt to assert protocol authority are completely stripped during normalization:
- `nextAction`, `command`, `phase`
- `evidence`, `approval`, `authority`
- `writeClaims`, `changedPaths`, `checkIds`

Only allowlisted fields (`title`, `summary`, `sourceRef`, `observedAt`, `confidence`) survive. Each item receives a deterministic SHA-256 `itemFingerprint`.

## Portable Safety Boundary

All text flowing into or out of advisory recall is verified:
- **Control Character Rejection**: ASCII control characters (`\x00-\x08`, `\x0B-\x0C`, `\x0E-\x1F`, `\x7F`) throw `E_PORTABLE_CONTEXT_INVALID`.
- **Secret Scanning**: Inputs and outputs containing secret tokens (e.g., `Bearer <token>`, `ghp_`, AWS keys, private keys) throw `E_PORTABLE_CONTEXT_INVALID`.
- **Budget Enforcements**:
  - Max query characters: 1,000 chars (`E_ADVISORY_CONTEXT_QUERY_INVALID`)
  - Max item summary: 4,000 chars (`E_ADVISORY_CONTEXT_OUTPUT_LIMIT`)
  - Default item limit: 6 items (max 20)
  - Default total characters: 6,000 chars (max 16,000) (`E_ADVISORY_CONTEXT_OUTPUT_LIMIT`)
  - Raw provider result ceiling: 100 items (`E_ADVISORY_CONTEXT_OUTPUT_LIMIT`)
  - Default timeout: 5,000 ms, max 30,000 ms (`E_ADVISORY_CONTEXT_TIMEOUT`)

ForgeLoop normalizes recall limits before provider dispatch. Valid oversized
integer requests are clamped to the canonical maxima, and non-finite,
non-integer, below-minimum, string, boolean, object, or null values fail before
provider lookup with `E_ADVISORY_CONTEXT_REQUEST_INVALID`. Providers therefore
never receive caller-requested budgets above ForgeLoop's supported maxima.
