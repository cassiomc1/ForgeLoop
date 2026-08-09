import { assertSafePath, fileExists, ensureWithin, readBytes } from "../core/filesystem.js";
import { readManifest, sha256 } from "../core/manifest.js";
import { readTemplateEntries } from "../core/templates.js";

function finding(code, severity, relativePath, message) {
  return { code, severity, path: relativePath, message };
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

export async function runDoctor({ target, packageRoot }) {
  const findings = [];
  let manifest = null;
  try {
    manifest = await readManifest(target);
    if (!manifest) {
      findings.push(finding("manifest-missing", "error", ".mdfiles/manifest.json", "Run mdfiles init first."));
    }
  } catch (error) {
    findings.push(finding("manifest-invalid", "error", ".mdfiles/manifest.json", error.message));
  }

  const entries = await readTemplateEntries(packageRoot);
  for (const entry of entries) {
    const destination = ensureWithin(target, entry.relativePath);
    try {
      await assertSafePath(target, entry.relativePath);
    } catch (error) {
      findings.push(finding("unsafe-path", "error", entry.relativePath, error.message));
      continue;
    }
    if (!(await fileExists(destination))) {
      findings.push(finding("file-missing", "error", entry.relativePath, "Managed file is missing."));
      continue;
    }

    if (entry.relativePath === "PROJECT_PROFILE.md") {
      const mode = readProfileMode(await readBytes(destination));
      if (mode === "template") {
        findings.push(finding("profile-template", "info", entry.relativePath, "Initialize profile-mode as project after confirming real project facts."));
      }
    }

    const record = manifest?.files?.[entry.relativePath];
    if (!record) {
      if (ADAPTER_PATHS.has(entry.relativePath)) {
        findings.push(
          finding(
            "unmanaged-file",
            "error",
            entry.relativePath,
            "Existing adapter is not managed by mdfiles; merge the loop reference and rerun doctor.",
          ),
        );
      }
      continue;
    }
    const actualHash = sha256(await readBytes(destination));
    if (actualHash !== record.sha256 && !record.preserve) {
      findings.push(finding("file-drift", "warning", entry.relativePath, "File differs from the last managed version; update will preserve it."));
    }
  }

  const ok = findings.every((item) => item.severity !== "error");
  return { ok, findings };
}
