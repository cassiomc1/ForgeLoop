# Public documentation review

## Status

Recommended approach approved by the repository owner; implementation is
pending review of this specification.

## Objective

Review the repository's public documentation against the latest published
state on `origin/main` and make the smallest coherent set of evidence-backed
corrections. The review covers the root README, all eight English guides, and
the third-party notices. It should improve accuracy, discoverability,
consistency, and reuse safety without turning into a broad editorial rewrite.

## Baseline and isolation

- Use `origin/main` as the content baseline because it contains the latest
  merged design-reference integration.
- Work in an isolated worktree based on `origin/main`.
- Leave the existing local `agent/add-gradient-studio-reference` branch and
  its internal planning files untouched.
- Do not push, open a pull request, or merge unless separately requested.

## Scope

### Included

- `README.md`
- Every guide in `ENG/*.md`
- `THIRD_PARTY_NOTICES.md`

### Excluded

- `AGENTS.md`, `CLAUDE.md`, adapters, and `GUIDE_ROUTER.md` unless a checked
  documentation link or catalog contract proves that a public-documentation
  correction requires an aligned change.
- `PROJECT_PROFILE.md`, `LOOP_ENGINEERING.md`, scripts, tests, package files,
  workflows, assets, and source code.
- `docs/superpowers/` from the final public-documentation change.

## Review dimensions

1. **Cross-document consistency** — ensure the README catalog, guide names,
   front matter, loop/router references, eight-guide count, and maintenance
   instructions describe the same repository state.
2. **Commands and paths** — compare every documented command, file path,
   package claim, installation path, and fallback with the actual manifests,
   CLI behavior, tests, and workflows.
3. **Guide quality** — correct unclear, duplicated, contradictory, stale, or
   overly absolute guidance while preserving each guide's purpose, English-only
   convention, measurable defaults, and existing safety boundaries.
4. **References and provenance** — verify that external standards, products,
   design sites, fonts, software, and examples are described as references
   rather than blanket permissions; preserve exact-resource license and
   attribution boundaries.
5. **Readability and navigation** — improve headings, link labels, local
   references, and concise orientation where the change materially helps a
   reader find or apply the correct guide.

## Editing policy

- Edit only when a finding is supported by repository evidence or an
  authoritative source.
- Prefer a local sentence or link correction over restructuring a guide.
- Keep all root and `ENG/` prose in English.
- Preserve valid examples, numbers, exceptions, and domain-specific contracts.
- Do not add dependencies, generated assets, dynamic claims, endorsements, or
  unverified licensing statements.
- Update guide `version` and `last-reviewed` metadata only if normative guide
  content changes, and then preserve the repository's synchronized metadata
  contract.
- Keep the final implementation diff limited to the requested public-document
  files, with any required contract alignment explicitly justified.

## Verification and acceptance criteria

The review is complete when:

1. The README, eight guides, and notices agree on the current repository
   structure, supported workflow, and provenance boundaries.
2. Documented commands and paths are supported by actual repository sources or
   are clearly labeled as conditional, optional, or unavailable.
3. Relevant external references are linked and described without implying
   ownership, endorsement, license transfer, or redistribution permission.
4. Markdown formatting, relative links, front matter, guide routing, and secret
   scanning pass the repository validators.
5. `git diff --check` passes and no unrelated implementation files change.
6. The final report states the exact files changed, checks run, unavailable
   tools or external link limitations, and publication state.

## Planned checks

Run the repository's available checks proportionally after implementation:

```bash
python3 scripts/validate_markdown.py --self-test
python3 scripts/validate_markdown.py
python3 scripts/validate_loop_system.py --self-test
python3 scripts/validate_loop_system.py
python3 scripts/scan_secrets.py
npm test
npm run pack:check
git diff --check
```

Run local Markdown and link tools only when already available. Do not install
missing tools without explicit authorization, and report external rate limits
or unavailable services instead of weakening validation silently.
