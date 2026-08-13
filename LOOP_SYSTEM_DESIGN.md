# Universal Engineering Loop — System Design

**Status:** Implemented; repository checks validate the system contract.

## Objective

Turn this collection into a portable instruction kit for future projects. After the kit is copied into a repository, requests handled by a compatible agent enter a cycle of discovery, guide selection, execution, verification, and correction.

The system should use every guide that materially helps the task without loading irrelevant documents or replacing project-specific instructions with generic defaults.

## Primary decisions

- The package supports Codex, Claude Code, Cursor, GitHub Copilot, Antigravity,
  OpenCode, Hermes, Pi, Command Code, and Freebuff.
- Codex, Claude Code, Cursor, and GitHub Copilot use native entry files; the
  other six agents consume the shared `AGENTS.md` entry point.
- The portable instruction layer uses Markdown and each agent's native instruction mechanism; the optional local Node CLI validates and installs the kit without an agent runtime or third-party dependency.
- English is the only language used by repository content and guide metadata.
- The agent uses all applicable guides, not every file indiscriminately.
- Design, planning, test-first, and review process gates live in the canonical loop and scale with task risk instead of becoming unconditional boilerplate in every adapter or architecture note.
- The persistent project profile stores only verifiable facts and never secrets, tokens, or credentials.
- The loop continues while safe progress is possible. Repetition without new evidence triggers hypothesis reassessment or a blocked result, not infinite retries.
- Third-party provenance and reuse boundaries remain part of every portable copy.
- Qwen-MM-Plugins is an optional, task-scoped capability extension: the agent checks native support first, installs the smallest missing capability when needed, and verifies it before use; it is not a package or runtime dependency.
- Canonical documents are installed under `.forgeloop/kit/`; root native adapters remain small shims and mutable protocol artifacts remain directly under `.forgeloop/`.
- `PREFLIGHT_READY` is a resumable protocol checkpoint reconciled with work state, activation events, fingerprints, and the append-only hash chain.

## Alternatives considered

### One large file

Combining the loop, routing rules, and technical content would simplify copying but increase context use, duplicate guide material, and make maintenance harder. This option was rejected.

### Thin adapters with canonical modules

Small entry points for each agent, one central loop, one router, and specialized guides preserve modularity and allow the agent to load only relevant context. This is the selected architecture.

### Generated configuration

A tool could detect the stack and generate instructions automatically, but that would add installation, compatibility, and maintenance costs before the need is proven. It may become a later enhancement but is outside the first version.

## Architecture

The ForgeLoop system is organized around three observable control surfaces:
deterministic routing, checkpointed state, and evidence that can be inspected by
the compatible harness.

```text
                            FORGELOOP
                                │
                   ┌──────────────┼──────────────┐
                   │              │              │
                CONTRACT        ROUTE         EVIDENCE
                   │              │              │
                   └──────┬───────┴──────┬───────┘
                          │              │
                       required       current
                        gates         fingerprints
                          │              │
                          ▼              │
                      PREFLIGHT_READY   │
                          │              │
                   ┌──────┴──────┐       │
                   │             │       │
                work-state   event ledger │
                   │             │       │
                   └──────┬──────┘       │
                          │              │
                  plan → execute → verify → review
                          │              │
                          └──────┬───────┘
                                 ▼
                   AUDIT / COMPLETE / VALIDATE-PROTOCOL
                                 │
                                 ▼
              VALID / INCOMPLETE / STALE / INCONSISTENT / INVALID
                                 │
                                 ▼
                         compatible harness
```

```text
User request
    |
    v
Nearest agent adapter
    |
    +--> root native shim
             |
             +--> .forgeloop/kit/LOOP_ENGINEERING.md
             |        |
             |        +--> .forgeloop/kit/PROJECT_PROFILE.md
             |        +--> .forgeloop/kit/GUIDE_ROUTER.md
             |                  |
             |                  +--> .forgeloop/kit/ENG/*.md
    |
    +--> repository-specific instructions
    |
    v
Discovery -> contract -> route
                              |
                              v
          proportional design -> plan -> change -> targeted check -> regression -> review
                              ^                                                   |
                              +--------------- diagnosis and correction ----------+
    |
    v
Final result with evidence and limitations
```

The canonical loop keeps proportional design, planning, implementation,
testing, and review visible between routing and delivery. Architecture names
the order of those stages without duplicating the detailed operating rules that
belong in `LOOP_ENGINEERING.md`.

## Components and responsibilities

### `AGENTS.md`

Primary entry point for Codex and agents that recognize repository instructions. It stays short and requires the loop, profile, and router to be read before execution.

### `CLAUDE.md`

Adapter for Claude Code. It points to the same canonical source and does not repeat loop rules.

### `.github/copilot-instructions.md`

GitHub Copilot adapter. It activates the same operational contract while preserving more specific instructions in the destination project.

### `.cursor/rules/project-loop.mdc`

Always-applicable Cursor adapter. It delegates decisions to the loop and router.

### `AGENT_COMPATIBILITY.md`

Human-readable support matrix for all ten agents. It explains each native entry
file, the shared `AGENTS.md` compatibility contract, official documentation,
precedence caveats, and the deterministic verification boundary.

### `LOOP_ENGINEERING.md`

Canonical operational cycle. It defines:

- discovery of repository state and nearby instructions;
- capability discovery and task-scoped Qwen-MM-Plugins installation;
- conversion of the request into an execution contract;
- risk assessment and authority boundaries;
- guide selection;
- proportional design, planning, test-first, and review gates for behavior,
  architecture, and instruction changes;
- small coherent changes;
- delivery-specific verification;
- evidence-driven diagnosis and root-cause correction;
- final regression checks;
- success and stop conditions;
- handling of destructive actions and external authority.

The loop is also the only place that defines harness-conditional behavior such
as native isolation, independent review, and capability fallback rules. The
system design references those boundaries but does not restate their detailed
criteria.

### Capability extensions

The capability protocol is a narrow extension of the canonical loop. It asks
the agent to inspect native model and harness support, reuse an existing
callable tool, install only the smallest missing Qwen-MM-Plugins capability
when the task requires it, check API and system prerequisites, verify
registration, and then use the tool. Keyless multimodal reading is the default;
API-backed operations remain disabled until their documented credentials or
service endpoints are configured. The kit links to the upstream project but
does not bundle its source, MCP server, model, or dependencies.

### `GUIDE_ROUTER.md`

Canonical map between request or project signals and applicable guides. Each route records:

- activation signals;
- exclusions;
- normal guide combinations;
- useful search targets;
- expected verification evidence.

### `PROJECT_PROFILE.md`

Durable context for a destination project. The template captures:

- confirmed stack and versions;
- package manager and official commands;
- architecture and relevant directories;
- external services and risk surfaces;
- test, lint, build, and release commands;
- documentation and UI conventions;
- constraints, decisions, and unverified items;
- a source for every durable fact.

The profile changes only when discovery reveals a real project change; it is not a task diary. In this source repository, `profile-mode: template` keeps it as a reusable template. After `forgeloop init` installs it under `.forgeloop/kit/` in a target, the first cycle may change the mode to `project` and fill only confirmed facts.

### `DELEGATION_PROTOCOL.md`

The delegation document defines serializable task briefs, write ownership,
dependencies, normalized results, reviewer independence, and inline fallback.
It does not add agent personas, a scheduler, or a provider runtime.

### `ORCHESTRATOR_INTEGRATION.md`

The integration contract is the graph-readiness boundary. It names the
serializable phases, transitions, invariants, artifact schemas, host
responsibilities, and inline fallback in one canonical document. It does not
implement a graph runtime or duplicate the detailed operational rules in
`LOOP_ENGINEERING.md`.

### `THREAT_MODEL.md`

The threat model records path, symlink, artifact, secret, stale-state,
publication, schema, dependency, and resource-limit boundaries with their
mitigations, residual limitations, and executable evidence.

### `ENG/*.md`

Nine canonical guides cover:

- clean code;
- testing;
- security;
- performance;
- design;
- accessibility;
- premium website production;
- web games;
- contextual frontend taste.

Each guide has exact English frontmatter and a stable guide ID.

### `THIRD_PARTY_NOTICES.md`

Records external provenance, trademarks, licenses, and reuse boundaries. It is required in the repository and in every portable copy.

## Initial routing matrix

| Work type | Guide set |
| --- | --- |
| Documentation | Related domain and documentation checks |
| General code or bug fix | `clean`, `test`; add `security` or `performance` when the surface requires it |
| Backend, API, authentication, or data | `clean`, `test`, `security`; add `performance` for critical paths |
| Web, mobile, or desktop interface | `clean`, `test`, `design`, `accessibility`; add `security` and `performance` according to product risk |
| Complete site or landing page | `premium`, `design`, `accessibility`, `clean`, `test`, `security`, `performance` |
| Web game | `games`, `clean`, `test`, `security`, `performance`, `accessibility`; add `design` for UI or visual direction |
| HTML video or motion | `design`, `accessibility`, `performance`, `test`, `security`; use HyperFrames only when requested or already available |
| Infrastructure or CI/CD | `security`, `test`; add `performance` when availability or cost changes |

Routing uses the request and files actually affected. A single word in the repository is not enough to activate a stack or guide.

## Execution flow

1. Read the agent adapter and the nearest instructions for the scoped directory.
2. Inspect manifests, configuration, documentation, tests, CI, and Git state.
3. Confirm or update the project profile with sourced facts.
4. Convert the request into an objective, deliverables, constraints, risks, checks, and a stop condition.
5. Select the guide set in the router.
6. Read only the required sections of each guide.
7. Apply proportional design and plan gates before behavior, architecture, or instruction changes.
8. Establish a baseline and reproduce the problem when applicable.
9. Make the smallest coherent change that satisfies the objective.
10. Run the targeted check first, then proportional regression checks.
11. Use the loop's review gate after regression when the task or harness calls for self-review or independent review.
12. On failure, collect evidence, identify the root cause, and repeat with a targeted correction.
13. Finish only with current evidence, explicit limitations, and no unrelated changes.

## Canonical workflow state model

The protocol represents the engineering loop with serializable conceptual
states rather than an executable graph:

```text
RECEIVED → DISCOVERING → CONTRACT_READY → ROUTED
                                      ├→ DESIGNING → PLANNED
                                      └→ PLANNED
PLANNED → EXECUTING → VERIFYING
VERIFYING ├→ DIAGNOSING → CORRECTING → VERIFYING
          └→ REVIEWING → COMPLETE
Any non-terminal state → BLOCKED when a genuine blocker is evidenced
```

| From | Condition | To |
| --- | --- | --- |
| `RECEIVED` | context is required | `DISCOVERING` |
| `DISCOVERING` | sufficient sourced context | `CONTRACT_READY` |
| `CONTRACT_READY` | route is resolved | `ROUTED` |
| `ROUTED` | design decision is required | `DESIGNING` |
| `ROUTED` | no design gate is required | `PLANNED` |
| `DESIGNING` | design is approved | `PLANNED` |
| `PLANNED` | task work begins | `EXECUTING` |
| `EXECUTING` | targeted check is ready | `VERIFYING` |
| `VERIFYING` | a check fails | `DIAGNOSING` |
| `DIAGNOSING` | a fix hypothesis exists | `CORRECTING` |
| `CORRECTING` | the fix is applied | `VERIFYING` |
| `VERIFYING` | checks pass | `REVIEWING` |
| `REVIEWING` | contract and quality are accepted | `COMPLETE` |
| any non-terminal state | a genuine external blocker is evidenced | `BLOCKED` |

State invariants are machine-validatable: `COMPLETE` requires verification
evidence, `BLOCKED` requires a blocker category, `CORRECTING` requires a
diagnosed hypothesis, and `REVIEWING` cannot claim independent review from the
same identity as the implementer. Simple documentation tasks may skip design,
delegation, and full regression when the contract records why those states are
not applicable.

## Precedence and conflicts

The system respects this order:

1. platform and safety rules;
2. the user's latest explicit request;
3. more specific and nearer repository or directory instructions;
4. applicable legal, security, and data-preservation requirements;
5. confirmed project profile facts;
6. router decisions;
7. general guide recommendations.

A guide never authorizes installation, publication, deletion, migration, or an external change that the user did not place in scope.

## Failures and stop conditions

- **Missing tool:** use an available equivalent only when it provides compatible evidence; otherwise request approval or report the check as not run.
- **Missing guide or broken link:** continue only with conservative defaults and disclose the limitation.
- **Missing credential:** report the blocked capability without exposing or inventing a credential.
- **Conflicting instructions:** apply precedence, choose the most conservative interpretation, and record any material decision.
- **Repeated failure without new evidence:** stop repeating the same action, reassess the hypothesis, and use another diagnostic method.
- **External or destructive action:** proceed only with explicit authority and an exact validated target.

## Validation of the instruction system

The documentation workflow verifies:

- every file referenced by an adapter exists;
- repository-relative links resolve;
- exactly nine canonical English guides exist;
- guide IDs, filenames, frontmatter keys, and `language: en` match the catalog;
- no legacy language tree or bilingual metadata remains;
- all route contracts contain valid guide IDs;
- the canonical phase list, transition rows, state invariants, reason-code
  language, graph-readiness evidence, and no-runtime boundary are present;
- Markdown and frontmatter are valid;
- secrets and credential-like assignments are absent;
- `THIRD_PARTY_NOTICES.md` is present.

The validator also exercises six routing scenarios:

1. premium landing page;
2. authenticated API;
3. bug fix without UI;
4. mobile app with UI;
5. multiplayer web game;
6. documentation-only change.

## Distribution

The npm CLI installs the kit into the current directory or an existing
directory selected with `--path` when the package is available in the npm
registry. If it is not available yet, the same commands can run as
`node src/cli.js ...` from a repository checkout. The CLI maps canonical
documents into `.forgeloop/kit/`, keeps only native instruction shims at the
target root, and leaves mutable contract, route, gate, state, event, preflight,
and receipt artifacts under `.forgeloop/`. Manual copying must preserve that
target layout; copying package-source root files directly is not equivalent to
`forgeloop init`.

The README explains the file set, activation behavior, current/relative/absolute
target installation, first-run profile flow, local validation commands, and safe
update practice.

## Out of scope

- remote prompt services or databases;
- mandatory orchestration frameworks;
- infinite or unattended execution beyond agent limits;
- automatic installation of unrelated tools or provider runtimes; task-scoped
  Qwen-MM-Plugins capability installation remains governed by the canonical
  capability protocol and host approval controls;
- automatic modification of global computer files;
- duplication of complete guides inside adapters;
- versioned logs for every request.

## Acceptance criteria

- The repository and its maintained content are English-only.
- All ten supported agents have a documented entry into one canonical loop,
  with native adapters distinguished from shared `AGENTS.md` compatibility.
- The router selects every relevant guide and excludes irrelevant guides in the six defined scenarios.
- The profile contains verifiable facts, sources, and real commands without secrets.
- The loop requires evidence before completion claims and exits safely when blocked.
- Structural, Markdown, link, and secret checks pass locally and in CI.
- Portable-copy instructions always include third-party notices.
- The package does not alter destination commands, dependencies, or behavior without need and applicable authority.
