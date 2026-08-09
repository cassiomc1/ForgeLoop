# Universal Engineering Loop — System Design

**Status:** Implemented and validated on 2026-08-08.

## Objective

Turn this collection into a portable instruction kit for future projects. After the kit is copied into a repository, requests handled by a compatible agent enter a cycle of discovery, guide selection, execution, verification, and correction.

The system should use every guide that materially helps the task without loading irrelevant documents or replacing project-specific instructions with generic defaults.

## Primary decisions

- The package supports Codex, Claude Code, Cursor, GitHub Copilot, Antigravity,
  OpenCode, Hermes, Pi, Command Code, and Freebuff.
- Codex, Claude Code, Cursor, and GitHub Copilot use native entry files; the
  other six agents consume the shared `AGENTS.md` entry point.
- The initial implementation uses Markdown and each agent's native instruction mechanism; it requires no runtime or dependency.
- English is the only language used by repository content and guide metadata.
- The agent uses all applicable guides, not every file indiscriminately.
- The persistent project profile stores only verifiable facts and never secrets, tokens, or credentials.
- The loop continues while safe progress is possible. Repetition without new evidence triggers hypothesis reassessment or a blocked result, not infinite retries.
- Third-party provenance and reuse boundaries remain part of every portable copy.

## Alternatives considered

### One large file

Combining the loop, routing rules, and technical content would simplify copying but increase context use, duplicate guide material, and make maintenance harder. This option was rejected.

### Thin adapters with canonical modules

Small entry points for each agent, one central loop, one router, and specialized guides preserve modularity and allow the agent to load only relevant context. This is the selected architecture.

### Generated configuration

A tool could detect the stack and generate instructions automatically, but that would add installation, compatibility, and maintenance costs before the need is proven. It may become a later enhancement but is outside the first version.

## Architecture

```text
User request
    |
    v
Nearest agent adapter
    |
    +--> LOOP_ENGINEERING.md
    |        |
    |        +--> PROJECT_PROFILE.md
    |        +--> GUIDE_ROUTER.md
    |                  |
    |                  +--> ENG/*.md
    |
    +--> repository-specific instructions
    |
    v
Discovery -> contract -> route -> change -> targeted check -> regression
    ^                                                        |
    +---------------- diagnosis and correction --------------+
    |
    v
Final result with evidence and limitations
```

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
- conversion of the request into an execution contract;
- risk assessment and authority boundaries;
- guide selection;
- small coherent changes;
- delivery-specific verification;
- evidence-driven diagnosis and root-cause correction;
- final regression checks;
- success and stop conditions;
- handling of destructive actions and external authority.

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

The profile changes only when discovery reveals a real project change; it is not a task diary. In this source repository, `profile-mode: template` keeps it as a reusable template. After copying it into a code repository, the first cycle may change the mode to `project` and fill only confirmed facts.

### `ENG/*.md`

Eight canonical guides cover:

- clean code;
- testing;
- security;
- performance;
- design;
- accessibility;
- premium website production;
- web games.

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
7. Establish a baseline and reproduce the problem when applicable.
8. Make the smallest coherent change that satisfies the objective.
9. Run the targeted check first, then proportional regression checks.
10. On failure, collect evidence, identify the root cause, and repeat with a targeted correction.
11. Finish only with current evidence, explicit limitations, and no unrelated changes.

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
- exactly eight canonical English guides exist;
- guide IDs, filenames, frontmatter keys, and `language: en` match the catalog;
- no legacy language tree or bilingual metadata remains;
- all route contracts contain valid guide IDs;
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

The public npm CLI installs the kit into the current directory or an existing
directory selected with `--path`. A user may also download the repository or a
release archive and copy these items while preserving their relative structure:

- the four native agent adapters plus `AGENT_COMPATIBILITY.md`;
- the shared `AGENTS.md` entry point for the six compatible agents;
- `LOOP_ENGINEERING.md`;
- `GUIDE_ROUTER.md`;
- `PROJECT_PROFILE.md`;
- `THIRD_PARTY_NOTICES.md`;
- the `ENG/` guide directory.

The README explains the file set, activation behavior, current/relative/absolute
target installation, first-run profile flow, local validation commands, and safe
update practice.

## Out of scope

- remote prompt services or databases;
- mandatory orchestration frameworks;
- infinite or unattended execution beyond agent limits;
- automatic tool installation;
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
