import { assertSafePath, fileExists, ensureWithin, readBytes } from "../core/filesystem.js";
import { readManifest, sha256, writeManifest } from "../core/manifest.js";
import { readTemplateEntries } from "../core/templates.js";
import { createEvidence } from "../core/evidence.js";
import { LAYOUT_VERSION } from "../core/target-layout.js";

function finding(code, severity, relativePath, message, remediation = null, evidence = null) {
  const evidenceRecord = evidence && typeof evidence === "object"
    ? evidence
    : createEvidence({
      kind: "OBSERVED",
      source: `ForgeLoop doctor:${relativePath}`,
      result: evidence ?? message,
    });
  return {
    code,
    severity,
    path: relativePath,
    message,
    remediation: remediation ?? (severity === "info" ? "No action required." : "Review the target path and apply the suggested correction."),
    evidence: evidenceRecord,
  };
}

function readProfileMode(bytes) {
  const text = bytes.toString("utf8");
  return text.match(/^profile-mode:\s*([^\s]+)\s*$/m)?.[1] ?? null;
}

const ADAPTER_PATHS = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  ".cursor/rules/project-loop.mdc",
  ".github/copilot-instructions.md",
]);

async function adoptAdapters({ target, manifest, adoptPaths, findings }) {
  if (!manifest || adoptPaths.length === 0) return manifest;

  const nextManifest = structuredClone(manifest);
  let changed = false;

  for (const relativePath of adoptPaths) {
    if (!ADAPTER_PATHS.has(relativePath)) {
      findings.push(
        finding(
          "adopt-invalid-path",
          "error",
          relativePath,
          "Only supported adapter paths can be adopted.",
        ),
      );
      continue;
    }

    const destination = ensureWithin(target, relativePath);
    try {
      await assertSafePath(target, relativePath);
    } catch (error) {
      findings.push(finding("unsafe-path", "error", relativePath, error.message));
      continue;
    }
    if (!(await fileExists(destination))) {
      findings.push(finding("adopt-file-missing", "error", relativePath, "Adapter file is missing."));
      continue;
    }

    nextManifest.files[relativePath] = {
      sha256: sha256(await readBytes(destination)),
      preserve: true,
    };
    findings.push(
      finding(
        "file-adopted",
        "info",
        relativePath,
        "Existing adapter is now recorded as preserved by ForgeLoop.",
      ),
    );
    changed = true;
  }

  if (changed) await writeManifest(target, nextManifest);
  return nextManifest;
}

export async function runDoctor({ target, packageRoot, adoptPaths = [], strict = false }) {
  const findings = [];
  let manifest = null;
  try {
    manifest = await readManifest(target);
    if (!manifest) {
      findings.push(finding("manifest-missing", "error", ".forgeloop/manifest.json", "Run forgeloop init first."));
    }
  } catch (error) {
    findings.push(finding("manifest-invalid", "error", ".forgeloop/manifest.json", error.message));
  }

  manifest = await adoptAdapters({ target, manifest, adoptPaths, findings });
  const entries = await readTemplateEntries(packageRoot);
  const layoutVersion = manifest?.layoutVersion ?? 1;
  if (manifest && layoutVersion < LAYOUT_VERSION) {
    findings.push(finding(
      "legacy-layout",
      "info",
      ".forgeloop/manifest.json",
      "Target uses the legacy root template layout; run forgeloop update to migrate the canonical kit under .forgeloop/kit.",
    ));
  }
  for (const entry of entries) {
    const managedPath = layoutVersion >= LAYOUT_VERSION ? entry.relativePath : entry.legacyRelativePath;
    const destination = ensureWithin(target, managedPath);
    try {
      await assertSafePath(target, managedPath);
    } catch (error) {
      findings.push(finding("unsafe-path", "error", managedPath, error.message));
      continue;
    }
    const hasLegacyAlternative = layoutVersion >= LAYOUT_VERSION
      && entry.legacyRelativePath !== entry.relativePath;
    if (hasLegacyAlternative) {
      try {
        await assertSafePath(target, entry.legacyRelativePath);
      } catch (error) {
        findings.push(finding("unsafe-path", "error", entry.legacyRelativePath, error.message));
        continue;
      }
    }
    if (!(await fileExists(destination))) {
      const legacyDestination = hasLegacyAlternative
        ? ensureWithin(target, entry.legacyRelativePath)
        : null;
      if (legacyDestination && await fileExists(legacyDestination)) {
        findings.push(finding(
          "legacy-root-file",
          "warning",
          entry.legacyRelativePath,
          "Canonical file remains in the legacy root layout; run forgeloop update to migrate it safely.",
        ));
        continue;
      }
      findings.push(finding("file-missing", "error", managedPath, "Managed file is missing."));
      continue;
    }

    if (entry.sourcePath === "PROJECT_PROFILE.md") {
      const mode = readProfileMode(await readBytes(destination));
      if (mode === "template") {
        findings.push(finding("profile-template", "info", managedPath, "Initialize profile-mode as project after confirming real project facts."));
      }
    }

    const record = manifest?.files?.[managedPath];
    if (!record) {
      if (ADAPTER_PATHS.has(managedPath)) {
        findings.push(
          finding(
            "unmanaged-file",
            "error",
            managedPath,
            "Existing adapter is not managed by ForgeLoop; merge the loop reference and rerun doctor.",
          ),
        );
      }
      continue;
    }
    const actualHash = sha256(await readBytes(destination));
    if (actualHash !== record.sha256 && !record.preserve) {
      findings.push(finding("file-drift", "warning", managedPath, "File differs from the last managed version; update will preserve it."));
    }
    if (hasLegacyAlternative) {
      const legacyPath = ensureWithin(target, entry.legacyRelativePath);
      if (await fileExists(legacyPath)) {
        findings.push(finding(
          "legacy-root-file",
          "warning",
          entry.legacyRelativePath,
          "A legacy root copy remains alongside the canonical hidden kit; review it after migration.",
        ));
      }
    }
  }

  const shippedPaths = new Set(entries.map((entry) => layoutVersion >= LAYOUT_VERSION ? entry.relativePath : entry.legacyRelativePath));
  for (const relativePath of Object.keys(manifest?.files ?? {})) {
    if (!shippedPaths.has(relativePath)) {
      findings.push(
        finding(
          "manifest-orphan",
          "warning",
          relativePath,
          "Manifest entry no longer corresponds to a shipped template.",
        ),
      );
    }
  }

  const ok = findings.every((item) => item.severity !== "error")
    && (!strict || findings.every((item) => item.severity !== "warning"));
  return {
    ok,
    findings,
    evidence: [createEvidence({
      kind: "OBSERVED",
      source: "ForgeLoop doctor",
      result: `${findings.length} findings; ${ok ? "healthy" : "needs attention"}`,
    })],
  };
}
