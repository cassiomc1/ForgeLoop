import { assertSafePath, fileExists, ensureWithin, readBytes, writeFileAtomic } from "../core/filesystem.js";
import {
  createManifest,
  readManifest,
  sha256,
  writeManifest,
} from "../core/manifest.js";
import { readTemplateEntries } from "../core/templates.js";
import { PROJECT_ARTIFACT_PATHS } from "../core/task-paths.js";

/**
 * Executable-policy artifacts initialized by `forgeloop init`. The manifest is
 * the initialization commit marker and must never be written before these have
 * been produced and verified.
 */
export const POLICY_INIT_ARTIFACTS = Object.freeze([
  PROJECT_ARTIFACT_PATHS.policyDiscovery,
  PROJECT_ARTIFACT_PATHS.policyBaseline,
  PROJECT_ARTIFACT_PATHS.policyLock,
]);

export const E_POLICY_INITIALIZATION_FAILED = "E_POLICY_INITIALIZATION_FAILED";

function policyInitializationError(cause) {
  const error = new Error(`Executable policy initialization failed: ${cause.message}`);
  error.code = E_POLICY_INITIALIZATION_FAILED;
  error.cause = cause;
  error.artifacts = [...POLICY_INIT_ARTIFACTS];
  return error;
}

function baselineSemanticallyEqual(a, b) {
  return a?.schemaVersion === b?.schemaVersion
    && JSON.stringify(a?.entries ?? []) === JSON.stringify(b?.entries ?? []);
}

function lockSemanticallyEqual(a, b) {
  return a?.algorithm === b?.algorithm
    && a?.digest === b?.digest
    && a?.rulesDigest === b?.rulesDigest
    && a?.baselineDigest === b?.baselineDigest;
}

/**
 * Reconciles an existing policy artifact against the freshly computed
 * canonical initialized state.
 *
 *   - missing             -> write it
 *   - valid + equal       -> reuse (resumable output of a failed init)
 *   - valid + different   -> not provably ForgeLoop-owned: preserve and fail
 *                            with a deterministic conflict
 *   - invalid/corrupt     -> fail closed; never overwrite unknown content
 */
async function reconcilePolicyArtifact(target, packageRoot, readExisting, expected, { semanticEqual, label }) {
  let existing = null;
  try {
    existing = await readExisting(target, packageRoot);
  } catch (cause) {
    throw policyInitializationError(
      new Error(`${label} exists but is invalid and cannot be safely reconciled: ${cause.message}`),
    );
  }
  if (existing === null) return { action: "write" };
  if (semanticEqual(existing, expected)) return { action: "reuse" };
  throw policyInitializationError(
    new Error(`${label} does not match the canonical initialized state and is not provably ForgeLoop-owned; preserve it or remove it before re-running init`),
  );
}

/**
 * Initializes a target project with the ForgeLoop kit and executable-policy
 * bootstrap, committing manifest authority LAST.
 *
 * Execution order:
 *   1. validate all destination paths
 *   2. read template entries
 *   3. inspect existing unmanaged/resumable files
 *   4. discover policy (uncertainty is fine; infrastructure failure is not)
 *   5. compute initial baseline
 *   6. compute effective rules
 *   7. compute policy.lock
 *   8. write kit files (resumable output is reused)
 *   9. write discovery.json (reconciled)
 *  10. write baseline.json (reconciled)
 *  11. write policy.lock (reconciled)
 *  12. verify executable-policy capability
 *  13. verify written policy.lock
 *  14. write manifest atomically
 *  15. return success
 *
 * Any policy-bootstrap failure raises E_POLICY_INITIALIZATION_FAILED and
 * leaves no committed manifest, so a retry reconciles already-correct files
 * without manual cleanup.
 *
 * `hooks` is a deterministic failure-injection seam used only by tests:
 *   afterPolicyDiscovery(discovery, { target, packageRoot })
 *   beforeBaselineWrite({ target, packageRoot, baseline })
 *   beforePolicyLockWrite({ target, packageRoot, lock })
 *   beforeManifestWrite({ target, packageRoot, manifest, actions })
 */
export async function runInit({
  target,
  dryRun,
  packageRoot,
  packageVersion,
  hooks = {},
} = {}) {
  const entries = await readTemplateEntries(packageRoot);
  const existingManifest = await readManifest(target);
  if (existingManifest) {
    throw new Error("Target is already initialized; run forgeloop update instead.");
  }
  const manifest = createManifest(packageVersion);
  const actions = [];

  // 1. Validate every destination before any write so a symlinked kit cannot
  // leave a partially initialized target behind.
  for (const entry of entries) await assertSafePath(target, entry.relativePath);
  for (const relativePath of POLICY_INIT_ARTIFACTS) await assertSafePath(target, relativePath);

  // 4-7. Compute the full executable-policy bootstrap in memory first. Unknown
  // or low-confidence discovery is legitimate autonomy and succeeds; only
  // genuine discovery/serialization/computation failures fail closed.
  const { discoverPolicy } = await import("../core/policy-discovery.js");
  const {
    loadEffectiveRules,
    computePolicyLockData,
    writeDiscoveryReport,
    writePolicyLock,
    detectPolicyCapability,
    verifyPolicyLock,
    readDiscoveryReport,
    readPolicyLock,
    readBaseline,
    writeBaseline,
  } = await import("../core/policy-engine.js");
  const { createBaselineFromViolations } = await import("../core/policy-baseline.js");

  let discovery;
  let baseline;
  let effectiveRules;
  let lock;
  try {
    discovery = await discoverPolicy({ target });
    if (hooks.afterPolicyDiscovery) {
      discovery = await hooks.afterPolicyDiscovery(discovery, { target, packageRoot });
    }
    baseline = createBaselineFromViolations([]);
    effectiveRules = await loadEffectiveRules(target, packageRoot);
    lock = computePolicyLockData(effectiveRules, baseline);
  } catch (cause) {
    throw policyInitializationError(cause);
  }

  // 8. Write kit files. Existing files that match the shipped template are
  // resumable init output; PROJECT_PROFILE.md is preserved by contract; other
  // pre-existing (brownfield) files are preserved as unowned.
  for (const entry of entries) {
    const destination = ensureWithin(target, entry.relativePath);
    if (await fileExists(destination)) {
      const existingBytes = await readBytes(destination);
      if (sha256(existingBytes) === sha256(entry.bytes)) {
        actions.push({ action: "reuse", path: entry.relativePath, reason: "matches template" });
      } else if (entry.sourcePath === "PROJECT_PROFILE.md") {
        actions.push({ action: "skip", path: entry.relativePath, reason: "preserved" });
        manifest.files[entry.relativePath] = {
          sha256: sha256(existingBytes),
          preserve: true,
        };
        continue;
      } else {
        actions.push({ action: "skip", path: entry.relativePath, reason: "pre-existing" });
        continue;
      }
      manifest.files[entry.relativePath] = {
        sha256: sha256(entry.bytes),
        preserve: entry.sourcePath === "PROJECT_PROFILE.md",
      };
      continue;
    }

    actions.push({
      action: dryRun ? "would-create" : "created",
      path: entry.relativePath,
    });
    await writeFileAtomic(destination, entry.bytes, { dryRun });
    manifest.files[entry.relativePath] = {
      sha256: sha256(entry.bytes),
      preserve: entry.sourcePath === "PROJECT_PROFILE.md",
    };
  }

  // 9-11. Write policy artifacts, reconciling resumable output from a failed
  // previous init instead of overwriting unknown content.
  if (dryRun) {
    actions.push(
      { action: "would-write", path: PROJECT_ARTIFACT_PATHS.policyDiscovery, reason: "dry-run" },
      { action: "would-write", path: PROJECT_ARTIFACT_PATHS.policyBaseline, reason: "dry-run" },
      { action: "would-write", path: PROJECT_ARTIFACT_PATHS.policyLock, reason: "dry-run" },
    );
  } else {
    const discoveryReconcile = await reconcilePolicyArtifact(
      target,
      packageRoot,
      readDiscoveryReport,
      discovery,
      { semanticEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b), label: `${PROJECT_ARTIFACT_PATHS.policyDiscovery}` },
    );
    const baselineReconcile = await reconcilePolicyArtifact(
      target,
      packageRoot,
      readBaseline,
      baseline,
      { semanticEqual: baselineSemanticallyEqual, label: `${PROJECT_ARTIFACT_PATHS.policyBaseline}` },
    );
    const lockReconcile = await reconcilePolicyArtifact(
      target,
      packageRoot,
      readPolicyLock,
      lock,
      { semanticEqual: lockSemanticallyEqual, label: `${PROJECT_ARTIFACT_PATHS.policyLock}` },
    );

    actions.push(
      { action: discoveryReconcile.action === "reuse" ? "reuse" : "created", path: PROJECT_ARTIFACT_PATHS.policyDiscovery, reason: discoveryReconcile.action === "reuse" ? "matches canonical state" : "initialized" },
      { action: baselineReconcile.action === "reuse" ? "reuse" : "created", path: PROJECT_ARTIFACT_PATHS.policyBaseline, reason: baselineReconcile.action === "reuse" ? "matches canonical state" : "initialized" },
      { action: lockReconcile.action === "reuse" ? "reuse" : "created", path: PROJECT_ARTIFACT_PATHS.policyLock, reason: lockReconcile.action === "reuse" ? "matches canonical state" : "initialized" },
    );

    try {
      if (discoveryReconcile.action === "write") {
        await writeDiscoveryReport(target, discovery, packageRoot);
      }
      if (hooks.beforeBaselineWrite) {
        await hooks.beforeBaselineWrite({ target, packageRoot, baseline });
      }
      if (baselineReconcile.action === "write") {
        await writeBaseline(target, baseline, packageRoot);
      }
      if (hooks.beforePolicyLockWrite) {
        await hooks.beforePolicyLockWrite({ target, packageRoot, lock });
      }
      if (lockReconcile.action === "write") {
        await writePolicyLock(target, lock, packageRoot);
      }
    } catch (cause) {
      throw policyInitializationError(cause);
    }

    // 12-13. Verify canonical policy state before committing authority.
    let capability;
    let lockVerification;
    try {
      capability = await detectPolicyCapability(target, packageRoot);
      if (capability !== "AVAILABLE") {
        throw new Error(`Executable policy capability is ${capability} after bootstrap`);
      }
      lockVerification = await verifyPolicyLock(target, packageRoot);
      if (lockVerification.status !== "VALID") {
        throw new Error(`Executable policy lock verification failed: ${lockVerification.status}`);
      }
    } catch (cause) {
      throw policyInitializationError(cause);
    }
  }

  // 14. Commit manifest authority LAST: successful initialization is only
  // real once the manifest exists.
  if (hooks.beforeManifestWrite) {
    try {
      await hooks.beforeManifestWrite({ target, packageRoot, manifest, actions });
    } catch (cause) {
      throw policyInitializationError(cause);
    }
  }
  await writeManifest(target, manifest, { dryRun });

  return { actions, manifest };
}
