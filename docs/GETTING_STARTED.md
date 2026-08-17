# Getting Started with ForgeLoop

This guide walks through your first complete task with ForgeLoop from initialization to validator-backed completion.

---

## 1. What is ForgeLoop?

ForgeLoop is a portable, vendor-neutral engineering protocol for AI-assisted coding and automated workflows. It turns a task outcome into:

- **A structured contract** (`.forgeloop/current-contract.json`);
- **Deterministic guide routing** based on declared work type, surfaces, and risks;
- **Resumable work state** across different tools, IDEs, and AI harnesses;
- **Observed verification evidence** linked to ForgeLoop-attested command execution;
- **Diagnostic recovery loops** when tests or checks fail;
- **Validator-backed completion** validated by protocol algorithms rather than agent claims.

ForgeLoop is **not** an LLM runtime, agent framework, or graph orchestrator. It is a deterministic protocol and CLI that guides execution environments safely.

Core mental model:

- `work-state = lifecycle truth`
- `continuity = operational handoff context`
- `checkout = implementation truth`
- `execution artifacts = process provenance`
- `checks = verification truth`
- `receipt = completion/publication record`

---

## 2. Prerequisites

- **Node.js**: version 20 or higher (`node -v`)
- **npm**: standard npm toolchain

---

## 3. Installation & Initialization

In your project repository:

```bash
# Initialize ForgeLoop kit and discovery shims
npx @cassiomc1/forgeloop init

# Check target project health
npx @cassiomc1/forgeloop doctor
```

What `init` does:

- Installs the canonical instruction kit under `.forgeloop/kit/`;
- Places native discovery shims at the project root (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `.github/copilot-instructions.md`);
- Creates `.forgeloop/` for mutable contract, route, state, and execution artifacts.

---

## 4. End-to-End Walkthrough

Here is a typical end-to-end task: *"Implement a contact form with input validation and tests."*

```text
User Request
     │
     ▼
Discovery & Contract
     │
     ▼
Route Guides
     │
     ▼
Preflight & Gate Validation
     │
     ▼
Plan & Implement
     │
     ▼
Execute & Verify Checks ─── failure ───► Diagnose & Correct
     │                                         │
     ▼                                         ▼
Review Evidence ◄──────────────────────────────┘
     │
     ▼
Complete Validation (VALID)
```

---

### Step 1 — Define the Contract

Create `.forgeloop/current-contract.json` describing your task objective, deliverables, and completion criteria:

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "taskId": "task-contact-form-001",
  "objective": "Add a validated contact form with unit and visual tests",
  "assumptions": [
    {
      "value": "Form submits via fetch POST to /api/contact",
      "reason": "Backend endpoint already supports JSON payload",
      "scope": "contact-form",
      "reversible": true,
      "source": "agent-default"
    }
  ],
  "deliverables": [
    "src/components/ContactForm.jsx",
    "tests/contact-form.test.js"
  ],
  "constraints": [
    "No external form libraries",
    "WCAG AA contrast compliant"
  ],
  "risks": [
    "untrusted-input"
  ],
  "verification": [
    { "id": "unit-tests", "text": "npm test passes for contact form", "type": "VERIFICATION" },
    { "id": "lint", "text": "npm run lint passes", "type": "VERIFICATION" }
  ],
  "successCriteria": [
    "Form validates required fields client-side",
    "All unit tests pass"
  ],
  "stopConditions": [
    "Unresolved API specification change required"
  ],
  "unresolvedDecisions": [],
  "sourceRefs": []
}
```

---

### Step 2 — Route Guides Deterministically

Ask ForgeLoop which engineering guides apply to your work:

```bash
forgeloop route --work complete-website --surface ui --surface forms --risk untrusted-input --json
```

This generates `.forgeloop/routing-result.json` referencing selected guides (e.g. `clean`, `test`, `security`, `design`, `accessibility`).

---

### Step 3 — Run Preflight

Before writing code, validate readiness and establish the canonical resumable work state:

```bash
forgeloop preflight --json
```

Output:

```json
{
  "status": "READY",
  "taskId": "task-contact-form-001",
  "errors": []
}
```

When preflight returns `READY`, ForgeLoop synchronizes resumable work state (`.forgeloop/work-state.json`) and preflight status (`.forgeloop/preflight.json`). If preflight reports `BLOCKED`, inspect the required gates in the output and satisfy them first.

---

### Step 4 — Activate Session and Plan

Create a session activation marker and transition to `PLANNED`:

```bash
forgeloop activate
forgeloop advance --to PLANNED
```

---

### Step 5 — Implement

Advance to `EXECUTING` and make your code changes:

```bash
forgeloop advance --to EXECUTING
```

Implement your components, styles, and test files according to the activated guides.

---

### Step 6 — Verify with Observed Evidence

Advance to `VERIFYING` and prepare completion receipt:

```bash
forgeloop advance --to VERIFYING
forgeloop prepare-completion --json
```

Execute your verification checks through ForgeLoop so provenance is recorded:

```bash
# Run unit tests and record evidence
forgeloop run-check --id unit-tests --requirement "npm test passes for contact form" -- npm test

# Run linter and record evidence
forgeloop run-check --id lint --requirement "npm run lint passes" -- npm run lint
```

If a check fails:

1. Do not repeat the failed check blindly.
2. Formulate a diagnostic hypothesis.
3. Apply the correction.
4. Re-run `forgeloop run-check`.

---

### Step 7 — Review Evidence

Advance to `REVIEWING` and perform a read-only audit:

```bash
forgeloop advance --to REVIEWING
forgeloop audit --json
```

Output checks contract coverage, ledger integrity, and fingerprint freshness.

---

### Step 8 — Validate Completion

Run `forgeloop complete` to validate completion:

```bash
forgeloop complete --json
```

Output:

```json
{
  "status": "VALID",
  "taskStatus": "COMPLETE",
  "verificationStatus": "valid"
}
```

Finally, query ForgeLoop for the next action:

```bash
forgeloop next --json
```

When `terminal: true` and `nextAction: "NONE"` are returned, your task is protocol-verified as complete.

---

## 5. Multi-Task Concurrency

ForgeLoop supports multiple parallel tasks in the same project without collision:

```bash
# Create an isolated task with explicit write claims
forgeloop task-create --task auth-feature --claim src/auth --claim tests/auth --json

# Run all commands against that specific task
forgeloop route --task auth-feature --work clean-code --surface backend
forgeloop preflight --task auth-feature --json
forgeloop advance --task auth-feature --to EXECUTING
forgeloop complete --task auth-feature --json

# Inspect active tasks
forgeloop task-list --json
```

---

## 6. What ForgeLoop Creates

Under `.forgeloop/task-state/<taskKey>/`:

- `task.json`: task descriptor and write claims;
- `contract.json`: task intent, deliverables, and success criteria;
- `routing-result.json`: deterministic guide selections;
- `preflight.json`: pre-implementation authorization checkpoint;
- `work-state.json`: lifecycle phase and resumption checkpoint;
- `events.ndjson`: hash-chained append-only event ledger;
- `executions/*.json`: provenance records for executed verification commands;
- `execution-receipt.json`: completion evidence and coverage mapping.

Shared repository artifacts (`sources.json`, `config.json`) remain at `.forgeloop/`.

---

## 7. Next Steps

- Continue a task across different AI harnesses: [`docs/CROSS_HARNESS_CONTINUITY.md`](./CROSS_HARNESS_CONTINUITY.md)
- Complete command reference: [`docs/CLI_REFERENCE.md`](./CLI_REFERENCE.md)
- Artifact and schema reference: [`docs/ARTIFACT_REFERENCE.md`](./ARTIFACT_REFERENCE.md)
- Common symptoms and recovery: [`docs/TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)
- Real-world operational recipes: [`docs/RECIPES.md`](./RECIPES.md)
