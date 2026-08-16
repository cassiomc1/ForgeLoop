# Complete the Recommended Improvements

> **Execution note:** Follow this plan inline in the current feature branch,
> with a test-first checkpoint before each behavior-preserving refactor.

**Goal:** Implement every pending or partial item in
`MELHORIAS_RECOMENDADAS.md`, update the public documentation, and merge the
verified result locally and on GitHub.

**Design:** Preserve public facades and protocol semantics, add focused
internal modules, keep runtime dependencies empty, add development-only
quality/rendering tools, make Mermaid source canonical, and enforce the
boundary through CI and package tests.

**Validation:** Node test suite, ESLint, c8 thresholds, dependency policy,
Mermaid generation/diff, package dry-run, Python validator suite, secret scan,
ForgeLoop preflight/complete, GitHub checks, and local/remote synchronization.

## Task 1: Record the approved scope and ForgeLoop contract

1. Review the design file and this plan for unresolved decisions.
2. Commit only the design and plan files with an explicit documentation commit;
   leave the existing authorized worktree changes unstaged.
3. Inspect route metadata and determine required gates for the clean, test, and
   security guides.
4. Create and persist `.forgeloop/current-contract.json` through the canonical
   ForgeLoop API, recording the user-authorized implementation, documentation,
   verification, and GitHub-merge boundary.
5. Persist the `refactor` route for CI/config/publication-risk work and run
   `node src/cli.js preflight --json` until it returns `READY`.
6. Run the baseline `npm test` and record the result before new changes.

## Task 2: Add verification command corpus tests (RED)

1. Add a JSON fixture corpus covering npm, pnpm, yarn, script aliases,
   workspace selectors, lifecycle commands, and unsafe/ambiguous argv.
2. Add focused tests that import the existing public facade and assert the
   corpus classifications.
3. Add structural assertions for the planned internal module boundaries.
4. Run the focused tests and capture the expected failure for missing modules
   or corpus entries before implementing the split.

## Task 3: Split verification capability (GREEN)

1. Extract constants/options, tokenizer helpers, npm classification, command
   resolution, and installation-authority helpers into focused modules.
2. Keep every existing public export available from
   `src/core/verification-capability.js`.
3. Run the focused corpus tests and the existing verification/authority tests.
4. Run the full Node suite and inspect the diff for accidental behavior
   changes.

## Task 4: Split next-action and preflight internals

1. Add tests that assert the public exports and the new internal module
   boundaries before moving code.
2. Extract next-action model, artifact, and phase helpers while retaining
   `getNextAction` and `NEXT_ACTIONS` from the facade.
3. Extract preflight model, loader, and persistence/consistency helpers while
   retaining `evaluatePreflight`, `validateReadyProtocolConsistency`, and
   `runPreflight` exports.
4. Run focused lifecycle, preflight, resumability, and recovery tests.
5. Run the full Node suite and compare the public export surface.

## Task 5: Finish declarative CLI dispatch

1. Add a regression test for command metadata, usage/parser alignment, and
   representative command execution.
2. Replace the remaining `main()` command if/else dispatch with the shared
   command-handler table, retaining explicit adapters only where argument
   shapes differ.
3. Run CLI portability, parser, completion, and package tests, then run all
   Node tests.

## Task 6: Add local quality and dependency-policy gates

1. Add the dependency-policy test first and make it reject runtime,
   optional, and peer dependencies while allowing only the approved tools.
2. Add development-only ESLint and c8 configuration/scripts, measure baseline
   coverage, and set documented regression thresholds.
3. Install/update the lockfile only for approved development dependencies:
   ESLint, c8, and Mermaid CLI.
4. Run dependency policy, lint, coverage, package dry-run, and the full Node
   suite; fix findings with focused changes.
5. Add `coverage/` and other generated outputs to ignore rules without
   broadening the package contents.

## Task 7: Make documentation and Mermaid source canonical

1. Add documentation-marker tests for the concise README, documentation index,
   CI-only validator policy, and Mermaid source/fallback.
2. Create `DOCS_INDEX.md` with lifecycle, guide, capability, validator,
   release, and package-boundary details.
3. Rewrite `README.md` to keep orientation, compatibility, architecture,
   blind-run constraints, required legacy markers, and links to deep docs.
4. Create `docs/forgeloop-flow.mmd`, replace the manual generator with a thin
   local Mermaid renderer, and regenerate the committed SVG.
5. Run documentation tests, Mermaid rendering twice, `git diff --check`, and
   package dry-run inspection.

## Task 8: Harden CI and update the recommendation ledger

1. Update CI to run `npm ci`, lint, coverage, dependency policy, Mermaid
   generation/diff, tests, and packaging without implicit installs.
2. Add pinned CodeQL and dependency-review workflows.
3. Add a tag-triggered GitHub release-notes workflow that does not publish npm.
4. Document the frozen CI-only Python validators and add policy checks.
5. Update `MELHORIAS_RECOMENDADAS.md` so all nine items are resolved with
   concrete evidence and limitations.
6. Run workflow/policy/documentation tests and all local validation commands.

## Task 9: ForgeLoop closure and publication

1. Re-run preflight after implementation and record each required check with
   `forgeloop run-check` or the canonical equivalent.
2. Advance through `VERIFYING`, structured evidence, `REVIEWING`, and
   validator-backed completion; run `forgeloop next` before final output.
3. Perform a fresh final verification pass and an inline review of the entire
   diff because no subagent is available.
4. Stage only the intended related files, commit the implementation, and push
   `agent/complete-recommended-improvements`.
5. Open a ready GitHub PR, wait for required checks, and merge with the full
   head SHA as a merge guard.
6. Fetch the remote, fast-forward local `main` to `origin/main`, verify the
   merged commit and clean worktree, and report checks, limitations, and
   publication state.
