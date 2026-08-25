# ForgeLoop Operational Recipes

Concise, copy-paste friendly recipes for common ForgeLoop tasks.

---

## Recipe Index

1. [Start a New Task](#recipe-1--start-a-new-task)
2. [Resume an Active Task in a New Session](#recipe-2--resume-an-active-task-in-a-new-session)
3. [Switch to Another AI Harness or IDE](#recipe-3--switch-to-another-ai-harness-or-ide)
4. [Recover and Continue After a Failed Test](#recipe-4--recover-and-continue-after-a-failed-test)
5. [Record Manual Review Evidence](#recipe-5--record-manual-review-evidence)
6. [Run Automated Checks with Attested Provenance](#recipe-6--run-automated-checks-with-attested-provenance)
7. [Fix Stale State or Stale Receipt](#recipe-7--fix-stale-state-or-stale-receipt)
8. [Inspect Why Completion is Blocked](#recipe-8--inspect-why-completion-is-blocked)
9. [Export a Portable Task Bundle](#recipe-9--export-a-portable-task-bundle)
10. [Final Verification Before Pull Request](#recipe-10--final-verification-before-pull-request)
11. [Run Multi-Task Workflows Concurrently](#recipe-11--run-multi-task-workflows-concurrently)
12. [Migrate Legacy 1.0 Single-Task Layout](#recipe-12--migrate-legacy-10-single-task-layout)
13. [Record Decision Settlement Criteria](#recipe-13--record-decision-settlement-criteria)
14. [Executable Policy, Baseline Ratchet, and Recovery](#recipe-14--executable-policy-baseline-ratchet-and-recovery)
15. [Release and Reacquire Claims for an Abandoned Task](#recipe-15--release-and-reacquire-claims-for-an-abandoned-task)
16. [Execute a Durable External Action Safely](#recipe-16--execute-a-durable-external-action-safely)

---

### Recipe 1 — Start a New Task

<!-- FORGELOOP EXAMPLE: recipes:create-task | exit=0 | json.taskId=task-001 -->
```bash
forgeloop task-create --task task-001 --claim src --claim tests --json
```
<!-- END FORGELOOP EXAMPLE -->

```bash
# 2. Discover task state path and author contract under .forgeloop/task-state/<taskKey>/contract.json

forgeloop task-show --task task-001 --json

# 3. Route engineering guides
forgeloop route --task task-001 --work code --surface api --risk untrusted-input --json

# 4. Verify preflight
forgeloop preflight --task task-001 --json

# 5. Activate session and plan
forgeloop activate
forgeloop advance --task task-001 --to PLANNED
forgeloop advance --task task-001 --to EXECUTING
```

---

### Recipe 2 — Resume an Active Task in a New Session

```bash
export FORGELOOP_TASK="task-001"

# 1. Discover task state
forgeloop status --json

# 2. Reconcile continuity notes
forgeloop reconcile-continuity --json

# 3. Check modified files
forgeloop inspect --json

# 4. Get next action from ForgeLoop
forgeloop next --json
```

---

### Recipe 3 — Switch to Another AI Harness or IDE

In Harness A (before stopping):

```bash
forgeloop record-continuity \
  --task task-001 \
  --focus-id api-endpoints \
  --focus-summary "Finished GET /users, working on POST /users" \
  --remaining "tests:Add validation test for POST /users" \
  --inspect-first src/api/users.js \
  --resume-note "Endpoint logic is in src/api/users.js. Next step is validation."
```

In Harness B (after starting):

```bash
forgeloop status --task task-001 --json
forgeloop continuity --task task-001 --json
forgeloop reconcile-continuity --task task-001 --json
forgeloop next --task task-001 --json
```

---

### Recipe 4 — Recover and Continue After a Failed Test

```bash
export FORGELOOP_TASK="task-001"

# 1. Test failed in run-check
forgeloop run-check --id unit-tests --requirement "All tests pass" -- npm test
# Output: status = failed

# 2. Advance to DIAGNOSING
forgeloop advance --to DIAGNOSING

# 3. Record append-only root-cause diagnosis in ledger
forgeloop record-diagnosis \
  --hypothesis="Edge case comparison operator <= instead of < in validator" \
  --failure-class="VERIFICATION_FAILURE" \
  --evidence-ref="unit-tests" \
  --settled-by="Boundary test passes with status 400" \
  --next-safe-action="Replace <= with < in validator.js"

# 4. Advance to CORRECTING and apply the fix
forgeloop advance --to CORRECTING

# 5. Re-enter VERIFYING (advances verificationCycle monotonically)
forgeloop advance --to VERIFYING

# 6. Re-run verification check
forgeloop run-check --id unit-tests --requirement "All tests pass" -- npm test

# 7. Advance to REVIEWING and complete
forgeloop advance --to REVIEWING
forgeloop complete --json
```

---

### Recipe 5 — Record Manual Review Evidence

```bash
# For non-automated criteria (design review, UX inspection, security review)
forgeloop record-check \
  --task task-001 \
  --id manual-contrast-review \
  --requirement "WCAG AA contrast compliant" \
  --status passed \
  --kind manual-review \
  --evidence-kind OBSERVED \
  --result "Manually tested light and dark modes; text contrast >= 4.5:1."
```

---

### Recipe 6 — Run Automated Checks with Attested Provenance

```bash
export FORGELOOP_TASK="task-001"

# Prepare receipt slots in VERIFYING phase
forgeloop advance --to VERIFYING
forgeloop prepare-completion --json

# Run checks via forgeloop to record cryptographic execution provenance
forgeloop run-check --id unit-tests --requirement "Unit tests" -- npm test
forgeloop run-check --id linter --requirement "Linting" -- npm run lint
forgeloop run-check --id typecheck --requirement "Typecheck" -- npm run typecheck
```

---

### Recipe 7 — Fix Stale State or Stale Receipt

```bash
export FORGELOOP_TASK="task-001"

# If contract or files were modified out of band:
forgeloop route --work clean-code --json
forgeloop preflight --json
forgeloop prepare-completion --json
forgeloop validate-protocol --json
```

---

### Recipe 8 — Inspect Why Completion is Blocked

```bash
# Run read-only audit to inspect unsatisfied coverage
forgeloop audit --task task-001 --json

# Inspect protocol next guidance
forgeloop next --task task-001 --json
```

---

### Recipe 9 — Export a Portable Task Bundle

```bash
# Bundles contract, route, state, receipt, executions, and ledger into a single archive
forgeloop bundle --task task-001 --json
```

---

### Recipe 10 — Final Verification Before Pull Request

```bash
export FORGELOOP_TASK="task-001"

# 1. Ensure all checks passed in VERIFYING
# 2. Advance to REVIEWING
forgeloop advance --to REVIEWING

# 3. Run audit
forgeloop audit --json

# 4. Authorize completion
forgeloop complete --json

# 5. Confirm terminal state
forgeloop next --json
# Expected: "terminal": true, "nextAction": "NONE"
```

---

### Recipe 11 — Run Multi-Task Workflows Concurrently

```bash
# 1. Create task-1 claiming auth directory
forgeloop task-create --task auth-feature --claim src/auth --claim tests/auth --json

# 2. Create task-2 claiming billing directory
forgeloop task-create --task billing-feature --claim src/billing --claim tests/billing --json

# 3. List active tasks
forgeloop task-list --json

# 4. Work on task-1
forgeloop route --task auth-feature --work clean-code --surface backend
forgeloop preflight --task auth-feature --json
forgeloop advance --task auth-feature --to EXECUTING
forgeloop advance --task auth-feature --to VERIFYING
forgeloop run-check --task auth-feature --id auth-tests --requirement tests -- npm test -- tests/auth
forgeloop advance --task auth-feature --to REVIEWING
forgeloop complete --task auth-feature --json

# 5. Release any dead locks if needed
forgeloop task-unlock --task auth-feature --force --json
```

---

### Recipe 12 — Migrate Legacy 1.0 Single-Task Layout

<!-- BEGIN FORGELOOP LEGACY LAYOUT EXAMPLE -->

Legacy ForgeLoop 1.0 projects stored mutable artifacts directly under `.forgeloop/` (e.g. `.forgeloop/current-contract.json`, `.forgeloop/work-state.json`, `.forgeloop/gates/`, `.forgeloop/executions/`).

<!-- END FORGELOOP LEGACY LAYOUT EXAMPLE -->

```bash
# 1. Perform dry-run migration check
forgeloop task-migrate --dry-run --json

# 2. Execute migration to .forgeloop/task-state/<taskKey>/
forgeloop task-migrate --json

# 3. Verify migrated task state
forgeloop task-list --json
forgeloop status --json
```

---

### Recipe 13 — Record Decision Settlement Criteria

```bash
# 1. Record an append-only settlement criterion bound to the active contract
forgeloop record-decision-criterion \
  --task task-001 \
  --decision="Which authentication provider should be used?" \
  --settled-by="Use provider with native support for current JWT session tokens"

# 2. Inspect next action (surfaces the guidance)
forgeloop next --task task-001
```

---

### Recipe 14 — Executable Policy, Baseline Ratchet, and Recovery

```bash
# 1. Discover architecture conventions and candidate rules
#    (read-only observation; add --write to persist discovery and regenerate the lock)
forgeloop policy-discover --json

# 2. Record pre-existing debt into brownfield baseline
forgeloop baseline --record --json

# 3. Check policy verification status and lock integrity
forgeloop policy-status --json

# 4. Prove checker efficacy against mutation fixtures
forgeloop rule-verify --rule SECURITY.NO_HARDCODED_SECRET --json

# 5. Ratchet down baseline as debt is resolved during task
forgeloop baseline --update --json

# 6. If policy weakens mid-task, inspect next recovery action
forgeloop next --task task-001 --json
# Follow returned action (e.g. RESTORE_POLICY, REPAIR_CHECKER, REPAIR_POLICY)

# Intentional operator-authorized baseline reset (not normal recovery)
forgeloop baseline --record --policy-reset-authorized --json
```

---

### Recipe 15 — Release and Reacquire Claims for an Abandoned Task

```bash
# 1. Inspect deterministic classification and structured next action
forgeloop next --task task-001 --json

# 2. RECOVERABLE must use reconcile-closure; do not use task-recover
forgeloop reconcile-closure --task task-001 --id <verification-id> \
  --requirement "<exact verification text>" -- <verification-command>

# 3. Only STALE or ABANDONED may release effective claims
forgeloop task-recover --task task-001 --acknowledge-recovery --json

# 4. Other tasks may now adopt the released paths
forgeloop task-create --task replacement-task --claim src --json

# 5. Reacquisition fails while replacement-task owns src
forgeloop task-resume --task task-001 --json

# 6. After the conflicting owner completes, reacquire claims explicitly
forgeloop task-resume --task task-001 --claim src --json
```

`--acknowledge-recovery` records caller acknowledgement only. It does not grant
host authority or mark the task complete. Recovery preserves work state,
receipts, failures, policy snapshots, and continuity until normal lifecycle
work resumes. Claims are released only after ForgeLoop validates the recovery
artifact against the complete ledger history. If `next` returns
`RESOLVE_RECOVERY_INCONSISTENCY`, run `validate-protocol`; do not create, edit,
or delete `recovery.json` manually.

---

### Recipe 16 — Execute a Durable External Action Safely

Record the intended external effect before execution, satisfy the capability
policy and fingerprint-bound approval, and execute with an exact argument list:

```bash
forgeloop action-propose --task release --id action-publish --capability external.publish --effect-class EXTERNAL_PUBLICATION --target registry/release --operation "publish release" --idempotency-key release:publish:v1 --required-for-completion
forgeloop approval-request --task release --approval approval-publish --action action-publish --reason "reviewed release"
forgeloop approval-resolve --task release --approval approval-publish --decision APPROVED --authority CALLER_ACKNOWLEDGED
forgeloop run-action --task release --action action-publish --capability external.publish --effect-class EXTERNAL_PUBLICATION --target registry/release --idempotency-key release:publish:v1 --required-for-completion -- npm publish
# If the external outcome cannot be proven after start, do not retry:
forgeloop action-reconcile --task release --action action-publish --outcome UNKNOWN
```

Provenance and authority truths for this recipe:

- `CALLER_ACKNOWLEDGED` approval resolution records an acknowledgement; if the
  capability policy requires `REQUIRE_APPROVAL`, only a fresh `HOST_ATTESTED`
  approval resolved through a trusted embedding-host boundary authorizes the
  action. The standalone CLI can never mint it.
- `COMMIT_UNKNOWN` is an explicit reconciliation boundary, not a failed retry.
  Recording `UNKNOWN` keeps the action ambiguous. Settling `COMMITTED` or
  `NOT_COMMITTED` requires trusted host attestation plus evidence through a
  trusted integration boundary. A trusted `NOT_COMMITTED` returns the action
  to `PROPOSED` so authorization is re-evaluated before any retry.

After commit ambiguity is settled as `COMMITTED`, verify the independent
postcondition before completion:

```bash
forgeloop run-check --task release --id check-release-live --requirement publication -- node scripts/check-release-live.js
forgeloop action-verify --task release --action action-publish --evidence <execution-ref>
```

`COMMITTED != VERIFIED`: exit code 0 from the action command proves local
completion only. Verification requires canonical evidence from an independent
check execution.

Inspect the observed trajectory without inventing usage data:

```bash
forgeloop metrics --task release --json
forgeloop eval --task release --scenario scenarios/release.json --json
```

The efficiency comparison is present only when the scenario declares a
positive `reference.comparableSteps`; absent host token/cost/model data stays
unknown.

## Run ForgeLoop through MCP (safe mode)

Start the local MCP adapter and inspect what it exposes:

```bash
forgeloop-mcp --project . --mode safe
```

`safe` mode permits reads, normal loop mutations, and canonical `task-resume`.
Call the `forgeloop_capabilities` tool first: it reports versions, features,
launch policy, and the resource list. Task ownership is available from the
`forgeloop://task/{taskId}/ownership` resource — always the canonical claim
resolver projection.

## Resume a recovered task through MCP

Recovered tasks stay mutation-disabled until claims are reacquired:

```json
{ "tool": "forgeloop_task_resume", "arguments": { "taskId": "my-task" } }
```

Conflicting claims fail with `E_TASK_SCOPE_CONFLICT` and keep recovery intact.
Ordinary mutations against a recovered task are refused by core regardless of
transport.

## Deliberately opt into external execution

`run-check`/`reconcile-closure` require a full-mode launch flag; tool input
cannot grant it:

```bash
forgeloop-mcp --mode full --allow-external-execution
```

Execution uses exact argv arrays only — there is no generic shell tool — and
the server `--max-execution-time-ms` ceiling always applies. Output is bounded
on the exact UTF-8 serialization transmitted (`E_MCP_RESULT_TOO_LARGE`);
oversized structured input fails with `E_MCP_INPUT_TOO_LARGE`.

## Diagnose loopback-only HTTP errors

`forgeloop-mcp-http` binds loopback only. A non-loopback bind fails closed
with `E_MCP_REMOTE_NOT_SUPPORTED`; remote/authenticated HTTP is unsupported.
Host/Origin validation is DNS-rebinding defense, not authentication. Under
load, requests beyond the in-flight ceiling receive 503 `E_MCP_HTTP_BUSY`
with `Retry-After`.
