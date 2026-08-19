import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  UNKNOWN: "UNKNOWN",
});

export const ENFORCEMENT_MODES = Object.freeze({
  BLOCKING: "BLOCKING",
  ADVISORY: "ADVISORY",
  NONE: "NONE",
});

export const BUILTIN_POLICY_RULES = Object.freeze([
  {
    id: "SECURITY.NO_HARDCODED_SECRET",
    severity: "HIGH",
    source: "builtin",
    blocking: true,
    why: "Credentials committed to source control can expose systems and users.",
    fix: "Move the credential to an approved secret source and remove it from tracked files.",
    confidence: CONFIDENCE_LEVELS.HIGH,
    check: {
      type: "adapter",
      adapter: "secret-detection",
    },
  },
]);

export async function discoverPolicy({ target = process.cwd() } = {}) {
  const languages = [];
  const entries = await (async () => {
    try {
      return await readdir(target);
    } catch {
      return [];
    }
  })();

  const entrySet = new Set(entries);

  // 1. Detect Languages & Manifests
  let packageJson = null;
  if (entrySet.has("package.json")) {
    try {
      const raw = await readFile(path.join(target, "package.json"), "utf8");
      packageJson = JSON.parse(raw);
      if (entrySet.has("tsconfig.json")) {
        languages.push("typescript");
      } else {
        languages.push("javascript");
      }
    } catch {
      // ignore parse error
    }
  }

  if (entrySet.has("pyproject.toml") || entrySet.has("requirements.txt") || entrySet.has("setup.py") || entrySet.has("Pipfile")) {
    languages.push("python");
  }
  if (entrySet.has("Cargo.toml")) {
    languages.push("rust");
  }
  if (entrySet.has("go.mod")) {
    languages.push("go");
  }
  if (entrySet.has("pom.xml") || entrySet.has("build.gradle") || entrySet.has("build.gradle.kts")) {
    languages.push("java");
  }

  // 2. Detect Testing
  let testing = {
    detected: false,
    confidence: CONFIDENCE_LEVELS.UNKNOWN,
  };

  if (packageJson?.scripts?.test) {
    testing = {
      detected: true,
      command: ["npm", "test"],
      framework: packageJson.devDependencies?.jest ? "jest"
        : packageJson.devDependencies?.vitest ? "vitest"
        : packageJson.devDependencies?.mocha ? "mocha"
        : "npm-test",
      confidence: CONFIDENCE_LEVELS.HIGH,
    };
  } else if (entrySet.has("Cargo.toml")) {
    testing = {
      detected: true,
      command: ["cargo", "test"],
      framework: "cargo",
      confidence: CONFIDENCE_LEVELS.HIGH,
    };
  } else if (entrySet.has("go.mod")) {
    testing = {
      detected: true,
      command: ["go", "test", "./..."],
      framework: "go",
      confidence: CONFIDENCE_LEVELS.HIGH,
    };
  } else if (entrySet.has("pytest.ini") || entrySet.has("tests") || entrySet.has("test")) {
    testing = {
      detected: true,
      command: ["pytest"],
      framework: "pytest",
      confidence: CONFIDENCE_LEVELS.MEDIUM,
    };
  }

  // 3. Detect Linting
  let linting = {
    detected: false,
    confidence: CONFIDENCE_LEVELS.UNKNOWN,
  };

  if (packageJson?.scripts?.lint) {
    linting = {
      detected: true,
      command: ["npm", "run", "lint"],
      tool: "eslint",
      confidence: CONFIDENCE_LEVELS.HIGH,
    };
  } else if (entrySet.has(".eslintrc") || entrySet.has(".eslintrc.json") || entrySet.has(".eslintrc.js") || entrySet.has("eslint.config.js") || entrySet.has("eslint.config.mjs")) {
    linting = {
      detected: true,
      command: ["npx", "eslint", "."],
      tool: "eslint",
      confidence: CONFIDENCE_LEVELS.MEDIUM,
    };
  }

  // 4. Detect Architecture
  let architecture = {
    value: null,
    confidence: CONFIDENCE_LEVELS.UNKNOWN,
    enforcement: ENFORCEMENT_MODES.NONE,
  };

  let hasDomain = false;
  let hasInfra = false;
  let hasApp = false;

  const checkDirs = async (parent) => {
    try {
      const subEntries = await readdir(parent, { withFileTypes: true });
      for (const ent of subEntries) {
        if (ent.isDirectory()) {
          const name = ent.name.toLowerCase();
          if (name === "domain") hasDomain = true;
          if (name === "infrastructure" || name === "infra") hasInfra = true;
          if (name === "application" || name === "app") hasApp = true;
        }
      }
    } catch {
      // ignore
    }
  };

  await checkDirs(target);
  if (entrySet.has("src")) {
    await checkDirs(path.join(target, "src"));
  }

  if (hasDomain && (hasInfra || hasApp)) {
    architecture = {
      value: "layered",
      confidence: CONFIDENCE_LEVELS.HIGH,
      enforcement: ENFORCEMENT_MODES.ADVISORY,
    };
  } else if (entrySet.has("src") || entrySet.has("lib") || entrySet.has("utils") || entrySet.has("services")) {
    architecture = {
      value: null,
      confidence: CONFIDENCE_LEVELS.LOW,
      enforcement: ENFORCEMENT_MODES.NONE,
    };
  }

  // 5. Generate Discovered Rules
  const discoveredRules = [];

  if (testing.detected && testing.confidence === CONFIDENCE_LEVELS.HIGH) {
    discoveredRules.push({
      id: "TEST.REQUIRED",
      severity: "MEDIUM",
      source: "discovered",
      blocking: false,
      why: "Automated test suite was detected in repository manifests.",
      fix: "Run test suite to verify changes.",
      confidence: testing.confidence,
      check: {
        type: "adapter",
        adapter: "test-runner",
        command: testing.command,
      },
    });
  }

  if (architecture.value === "layered" && architecture.confidence === CONFIDENCE_LEVELS.HIGH) {
    discoveredRules.push({
      id: "ARCH.NO_DIRECT_DATABASE_ACCESS",
      severity: "MEDIUM",
      source: "discovered",
      blocking: false,
      why: "Clean architecture requires domain layer isolation from infrastructure.",
      fix: "Depend on domain abstractions or repository interfaces.",
      confidence: architecture.confidence,
      check: {
        type: "adapter",
        adapter: "architecture-layers",
      },
    });
  }

  return {
    schemaVersion: 1,
    languages: [...new Set(languages)].sort(),
    testing,
    linting,
    architecture,
    discoveredRules,
  };
}
