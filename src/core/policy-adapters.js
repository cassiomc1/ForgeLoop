import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./filesystem.js";
import { sha256 } from "./manifest.js";

const SECRET_PATTERNS = [
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "Private Key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: "GitHub Token", pattern: /gh[pousr]_[A-Za-z0-9_]{36,255}/ },
  { name: "Generic API Key", pattern: /(?:api_key|apikey|secret_key|auth_token)\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/i },
  { name: "Password Assignment", pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"'\s]{8,}["']/i },
];

const IGNORED_SECRET_FILES = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  ".forgeloop/policy/baseline.json",
  ".forgeloop/policy/policy.lock",
];

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".forgeloop",
  "dist",
  "build",
  "coverage",
]);

async function collectFiles(directory, baseDir = directory) {
  const files = [];
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        const nested = await collectFiles(fullPath, baseDir);
        files.push(...nested);
      } else if (entry.isFile()) {
        files.push(path.relative(baseDir, fullPath));
      }
    }
  } catch {
    // If directory not readable, return collected
  }
  return files;
}

export const BUILTIN_ADAPTERS = Object.freeze({
  ["secret-detection"]: {
    id: "secret-detection",
    description: "Scans repository files for hardcoded credentials, tokens, and private keys.",
    supports: () => true,
    check: async ({ target, files = null, contentOverrides = null } = {}) => {
      const targetFiles = files ?? (await collectFiles(target));
      const violations = [];
      let scannedFileCount = 0;

      for (const relPath of targetFiles) {
        if (IGNORED_SECRET_FILES.some((ignored) => relPath.endsWith(ignored))) continue;
        // Only inspect text/source files
        const ext = path.extname(relPath).toLowerCase();
        const textExtensions = [".js", ".mjs", ".ts", ".jsx", ".tsx", ".py", ".rs", ".go", ".json", ".yaml", ".yml", ".toml", ".env", ".md", ".sh"];
        if (ext && !textExtensions.includes(ext)) continue;

        let content;
        if (contentOverrides && contentOverrides[relPath] !== undefined) {
          content = contentOverrides[relPath];
        } else {
          try {
            content = await readFile(path.join(target, relPath), "utf8");
          } catch {
            continue;
          }
        }

        scannedFileCount += 1;
        const lines = content.split("\n");
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const line = lines[lineIndex];
          for (const { name, pattern } of SECRET_PATTERNS) {
            if (pattern.test(line)) {
              // Ignore test fixtures or documentation examples that explicitly mention dummy/fake/example
              if (line.includes("EXAMPLE") || line.includes("fake_") || line.includes("placeholder")) continue;
              const snippet = line.trim().slice(0, 80);
              const fingerprint = sha256(`SECURITY.NO_HARDCODED_SECRET:${relPath}:${lineIndex + 1}:${snippet}`);
              violations.push({
                ruleId: "SECURITY.NO_HARDCODED_SECRET",
                file: relPath,
                line: lineIndex + 1,
                snippet,
                fingerprint: `sha256:${fingerprint}`,
                message: `Potential hardcoded secret (${name}) detected at ${relPath}:${lineIndex + 1}`,
              });
            }
          }
        }
      }

      return {
        passed: violations.length === 0,
        scannedFiles: scannedFileCount,
        isInert: scannedFileCount === 0,
        violations,
      };
    },
  },

  "grain-complexity": {
    id: "grain-complexity",
    description: "Evaluates file and method complexity against configured thresholds.",
    supports: () => true,
    check: async ({ target, rule, files = null, contentOverrides = null } = {}) => {
      const threshold = rule?.check?.threshold ?? rule?.parameters?.threshold ?? 15;
      const targetFiles = files ?? (await collectFiles(target));
      const sourceExtensions = [".js", ".mjs", ".ts", ".jsx", ".tsx", ".py", ".rs", ".go"];
      const relevantFiles = targetFiles.filter((f) => sourceExtensions.includes(path.extname(f).toLowerCase()));
      const violations = [];
      let checkedCount = 0;

      for (const relPath of relevantFiles) {
        let content;
        if (contentOverrides && contentOverrides[relPath] !== undefined) {
          content = contentOverrides[relPath];
        } else {
          try {
            content = await readFile(path.join(target, relPath), "utf8");
          } catch {
            continue;
          }
        }

        checkedCount += 1;
        const lines = content.split("\n");
        let nestingLevel = 0;
        let maxNesting = 0;

        for (let i = 0; i < lines.length; i += 1) {
          const trimmed = lines[i].trim();
          const opens = (trimmed.match(/{/g) || []).length;
          const closes = (trimmed.match(/}/g) || []).length;
          nestingLevel += opens - closes;
          if (nestingLevel > maxNesting) maxNesting = nestingLevel;
        }

        // Check if complexity metric exceeds threshold
        if (maxNesting > threshold) {
          const fingerprint = sha256(`GRAIN.MAX_COMPLEXITY:${relPath}:${maxNesting}`);
          violations.push({
            ruleId: rule?.id ?? "GRAIN.MAX_COMPLEXITY",
            file: relPath,
            observed: maxNesting,
            threshold,
            fingerprint: `sha256:${fingerprint}`,
            message: `Complexity ${maxNesting} exceeds threshold of ${threshold} in ${relPath}`,
          });
        }
      }

      return {
        passed: violations.length === 0,
        scannedFiles: checkedCount,
        isInert: checkedCount === 0,
        violations,
      };
    },
  },

  "architecture-layers": {
    id: "architecture-layers",
    description: "Enforces clean layered dependency boundaries (e.g. domain cannot depend on infrastructure).",
    supports: () => true,
    check: async ({ target, rule, files = null, contentOverrides = null } = {}) => {
      const targetFiles = files ?? (await collectFiles(target));
      const sourceExtensions = [".js", ".mjs", ".ts", ".jsx", ".tsx", ".py", ".rs", ".go"];
      const domainFiles = targetFiles.filter((f) => {
        const norm = f.replace(/\\/g, "/");
        return (norm.startsWith("src/domain/") || norm.startsWith("domain/")) && sourceExtensions.includes(path.extname(f).toLowerCase());
      });

      const violations = [];
      let checkedCount = 0;

      for (const relPath of domainFiles) {
        let content;
        if (contentOverrides && contentOverrides[relPath] !== undefined) {
          content = contentOverrides[relPath];
        } else {
          try {
            content = await readFile(path.join(target, relPath), "utf8");
          } catch {
            continue;
          }
        }

        checkedCount += 1;
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i];
          if (/import\s+.*from\s+['"].*(?:infrastructure|infra|database|db)['"]/i.test(line) ||
              /require\(['"].*(?:infrastructure|infra|database|db)['"]\)/i.test(line)) {
            const snippet = line.trim();
            const fingerprint = sha256(`ARCH.NO_DIRECT_DATABASE_ACCESS:${relPath}:${i + 1}:${snippet}`);
            violations.push({
              ruleId: rule?.id ?? "ARCH.NO_DIRECT_DATABASE_ACCESS",
              file: relPath,
              line: i + 1,
              snippet,
              fingerprint: `sha256:${fingerprint}`,
              message: `Layer boundary violation in ${relPath}:${i + 1}: domain layer importing infrastructure`,
            });
          }
        }
      }

      return {
        passed: violations.length === 0,
        scannedFiles: checkedCount,
        isInert: checkedCount === 0,
        violations,
      };
    },
  },

  "repo-structure": {
    id: "repo-structure",
    description: "Verifies required repository structure and root layout.",
    supports: () => true,
    check: async ({ target, rule } = {}) => {
      const requiredFiles = rule?.parameters?.requiredFiles ?? rule?.check?.parameters?.requiredFiles ?? [];
      const violations = [];
      for (const req of requiredFiles) {
        const full = path.join(target, req);
        const exists = await fileExists(full);
        if (!exists) {
          const fingerprint = sha256(`REPO.STRUCTURE:${req}:missing`);
          violations.push({
            ruleId: rule?.id ?? "REPO.STRUCTURE",
            file: req,
            fingerprint: `sha256:${fingerprint}`,
            message: `Required file or directory missing: ${req}`,
          });
        }
      }

      return {
        passed: violations.length === 0,
        scannedFiles: requiredFiles.length,
        isInert: requiredFiles.length === 0,
        violations,
      };
    },
  },

  "test-runner": {
    id: "test-runner",
    description: "Candidate test command verifier within ForgeLoop command authority boundary.",
    supports: () => true,
    check: async ({ rule } = {}) => {
      // Discovered commands are candidate verifiers, evaluated in verification flow
      return {
        passed: true,
        scannedFiles: 1,
        isInert: false,
        violations: [],
        candidateCommand: rule?.check?.command ?? ["npm", "test"],
      };
    },
  },
});

export function getPolicyAdapter(adapterId) {
  return BUILTIN_ADAPTERS[adapterId] ?? null;
}
