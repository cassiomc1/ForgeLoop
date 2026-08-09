# English-Only Repository Migration Design

**Date:** 2026-08-08
**Status:** Approved for implementation planning

## Objective

Convert the current repository tree from a bilingual documentation kit into an
English-only kit while preserving Git history. Remove all Portuguese guides and
Portuguese operational text, strengthen secret detection, align local lint
instructions with the approval policy, and make third-party notices part of the
required portable distribution.

The existing Gatling link-check failure is explicitly outside this change.

## Scope

### Included

- Delete the complete `PT-BR/` directory from the current tree.
- Keep the eight English guides under `ENG/` with their existing filenames.
- Convert all remaining repository-maintained prose, comments, examples,
  validation messages, and stable identifiers to English.
- Remove bilingual counterpart metadata and all assumptions that guides exist in
  language pairs.
- Update the guide-structure checks and loop validator for exactly eight English
  guides.
- Add a dedicated local secret scanner with regression tests and invoke it from
  CI.
- Document lint execution without automatic installation and require explicit
  approval before downloading the Markdown linter.
- Make `THIRD_PARTY_NOTICES.md` a required part of the portable kit and the
  documented copy set.
- Add structural checks that reject reintroduction of the Portuguese guide tree,
  `pt-BR` metadata, counterpart fields, and known Portuguese operational text.

### Excluded

- Rewriting Git history or changing existing commit hashes.
- Renaming `ENG/` or removing `-eng` from established guide filenames.
- Fixing, suppressing, or otherwise changing the Gatling link-check failure.
- Changing the technical guidance of the English guides except where a stale
  bilingual reference must be removed.
- Publishing, pushing, or opening a pull request without a separate request.

## Repository Structure

The portable English-only kit will contain:

```text
AGENTS.md
CLAUDE.md
LOOP_ENGINEERING.md
GUIDE_ROUTER.md
PROJECT_PROFILE.md
LOOP_SYSTEM_DESIGN.md
THIRD_PARTY_NOTICES.md
.github/copilot-instructions.md
.cursor/rules/project-loop.mdc
ENG/
```

Maintenance-only files such as `scripts/`, `.github/workflows/`,
`.markdownlint-cli2.jsonc`, and `.lychee.toml` remain in the source repository.
They are optional for a consumer that only copies the kit, but required to
validate and maintain this repository.

## English Guide Contract

The canonical catalog contains exactly these eight guide IDs and paths:

| ID | Path |
| --- | --- |
| `premium` | `ENG/premium-sites-studio-eng.md` |
| `clean` | `ENG/clean-code-eng.md` |
| `test` | `ENG/test-code-eng.md` |
| `security` | `ENG/sec-code-eng.md` |
| `design` | `ENG/design-code-eng.md` |
| `performance` | `ENG/perf-code-eng.md` |
| `accessibility` | `ENG/accessibility-eng.md` |
| `games` | `ENG/games-code-design-web-eng.md` |

Each guide frontmatter contains exactly:

```yaml
name: <filename stem>
language: en
description: <quoted English string>
version: "2026.08"
last-reviewed: "2026-08-08"
```

The `counterpart` field is removed. The validators reject any `PT-BR/` guide,
`language: pt-BR`, or `counterpart` field.

## Root Documentation and Adapters

`README.md`, `AGENTS.md`, `CLAUDE.md`, `GUIDE_ROUTER.md`,
`LOOP_ENGINEERING.md`, `LOOP_SYSTEM_DESIGN.md`, `PROJECT_PROFILE.md`, and
`THIRD_PARTY_NOTICES.md` become English-only. The Copilot and Cursor adapters,
configuration comments, workflow labels and embedded validation messages also
use English only.

Stable Portuguese routing identifiers are renamed:

- `bug-sem-interface` becomes `bug-without-ui`.
- `documentacao` becomes `documentation`.

The project profile accepts only `language: en`. Template values such as
`unknown` and `not identified` are standardized in English.

## Secret Detection

A focused `scripts/scan_secrets.py` scanner will be independent from the loop
structure validator. It scans repository-maintained text files while excluding
`.git/`, `.worktrees/`, generated caches, and scanner fixtures that construct
test values from fragments.

The scanner detects:

- private-key headers;
- AWS access-key IDs;
- GitHub classic and fine-grained token prefixes;
- GitLab personal access tokens;
- Slack tokens;
- Google API keys;
- OpenAI-style secret key prefixes;
- JWT-like bearer values;
- assignments whose key contains `password`, `passwd`, `token`, `secret`,
  `api_key`, `api-key`, `credential`, or `private_key`;
- Markdown table cells where a sensitive label is followed by a non-placeholder
  value.

Safe template values include `unknown`, `not identified`, `example`, `redacted`,
`masked`, environment-variable references, angle-bracket placeholders, and
obvious repeated-mask characters. Detection reports the relative path, line
number, and rule name but never echoes the full candidate secret.

Self-tests must prove rejection of each supported token family and Markdown
table assignments, plus acceptance of documented placeholder forms.

## Tool Approval Policy

The default local lint command assumes `markdownlint-cli2` is already installed:

```bash
markdownlint-cli2
```

The README first instructs the operator to check availability. If it is missing,
the operator must request approval before running the pinned one-off download:

```bash
npx --yes markdownlint-cli2@0.23.2
```

The automatic-download command is never presented as an unconditional lint
step. CI continues using its commit-pinned Markdown lint action.

## Third-Party Notices

`THIRD_PARTY_NOTICES.md` is converted to English and added to
`REQUIRED_FILES`. The README installation list includes it. The loop validator
fails if the file is absent, and a self-test covers this contract.

The repository continues to declare no global license. Removing the Portuguese
translation does not alter upstream licenses, attribution, or reuse boundaries.

## Validation Strategy

Implementation follows test-first changes to the Python validators:

1. Add failing fixtures for an English-only eight-guide catalog.
2. Add failing fixtures proving Portuguese guides, metadata, identifiers, and
   counterpart fields are rejected.
3. Add failing secret-scanner tests for token-shaped values and Markdown table
   assignments.
4. Add a failing required-file fixture for `THIRD_PARTY_NOTICES.md`.
5. Implement the minimum validator and scanner changes to make those tests pass.
6. Remove `PT-BR/` and convert repository-maintained text to English.
7. Run Markdown lint, structure validation, loop self-tests, secret-scanner
   self-tests, the repository secret scan, relative-link checks, Python syntax
   checks, `git diff --check`, and an English-only content scan.

The external link checker may continue to report the pre-existing Gatling `403`.
That result must be reported accurately and must not be changed by this work.

## Acceptance Criteria

- The current tree contains no `PT-BR/` directory.
- The eight English guides retain their established `ENG/` paths.
- All maintained current-tree prose and comments are English.
- No guide contains `counterpart` or `language: pt-BR` metadata.
- The router and validators operate on eight single-language guides.
- Secret-scanner regression tests demonstrate the previously missed Markdown
  table cases now fail validation.
- Local lint documentation does not silently authorize a download.
- `THIRD_PARTY_NOTICES.md` is English-only, documented, and required.
- All local checks pass except the explicitly ignored external Gatling link
  failure.
- Git history remains unchanged before the migration commit.
