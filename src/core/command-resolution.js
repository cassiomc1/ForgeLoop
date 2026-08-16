import fs from "node:fs/promises";
import path from "node:path";

import {
  extractToolFromArgs,
  normalizeExecutableName,
  splitCommandPipeline,
  tokenizeCommand,
} from "./command-tokenizer.js";
import {
  classifyNpmInvocation,
  getNpmLifecycleCandidates,
  getNpmScriptName,
  parseNpmInvocation,
  parseNpmInvocationArgs,
} from "./npm-classifier.js";
import {
  classifyPnpmInvocation,
  classifyYarnInvocation,
} from "./package-manager-classifiers.js";

function classifySingleCommand(commandInput) {
  const tokens = Array.isArray(commandInput) ? [...commandInput] : tokenizeCommand(commandInput);
  if (tokens.length === 0) return { resolutionMode: "UNKNOWN", mayInstall: false, installer: null, tool: null };

  let i = 0;
  while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i++;
  if (i >= tokens.length) return { resolutionMode: "UNKNOWN", mayInstall: false, installer: null, tool: null };

  const binaryToken = tokens[i];
  const binary = normalizeExecutableName(binaryToken);
  const rest = tokens.slice(i + 1);

  if (binary === "call") return classifyCommandResolution(rest);

  if (binaryToken.includes("node_modules/.bin/") || binaryToken.startsWith("./node_modules/")) {
    return { resolutionMode: "LOCAL_PACKAGE_BINARY", mayInstall: false, installer: null, tool: binary };
  }

  if (binary === "npx") {
    if (rest.some((arg) => arg === "--no-install" || arg === "--no")) {
      const nonInstallArgs = rest.filter((arg) => arg !== "--no-install" && arg !== "--no");
      return {
        resolutionMode: "NON_INSTALLING_RESOLUTION",
        mayInstall: false,
        installer: "npx",
        tool: extractToolFromArgs(nonInstallArgs),
      };
    }
    return {
      resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
      mayInstall: true,
      installer: "npx",
      tool: extractToolFromArgs(rest),
    };
  }

  if (binary === "pnpx" || binary === "bunx" || binary === "uvx") {
    return {
      resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
      mayInstall: true,
      installer: binary,
      tool: extractToolFromArgs(rest),
    };
  }

  if (binary === "pnpm") return classifyPnpmInvocation(rest);
  if (binary === "yarn") return classifyYarnInvocation(rest);

  if (binary === "bun") {
    if (rest[0] === "x") {
      return {
        resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
        mayInstall: true,
        installer: "bun x",
        tool: extractToolFromArgs(rest.slice(1)),
      };
    }
    if (["add", "install", "i"].includes(rest[0])) {
      return {
        resolutionMode: "EXPLICIT_INSTALLATION",
        mayInstall: true,
        installer: "bun",
        tool: extractToolFromArgs(rest.slice(1)),
      };
    }
    return { resolutionMode: "LOCAL_PACKAGE_BINARY", mayInstall: false, installer: null, tool: null };
  }

  if (binary === "uv") {
    if (rest[0] === "tool" && rest[1] === "run") {
      return {
        resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
        mayInstall: true,
        installer: "uv tool run",
        tool: extractToolFromArgs(rest.slice(2)),
      };
    }
    if (rest[0] === "pip" && rest[1] === "install") {
      return {
        resolutionMode: "EXPLICIT_INSTALLATION",
        mayInstall: true,
        installer: "uv pip install",
        tool: extractToolFromArgs(rest.slice(2)),
      };
    }
    if (rest[0] === "add") {
      return {
        resolutionMode: "EXPLICIT_INSTALLATION",
        mayInstall: true,
        installer: "uv add",
        tool: extractToolFromArgs(rest.slice(1)),
      };
    }
    return { resolutionMode: "LOCAL_EXECUTABLE", mayInstall: false, installer: null, tool: null };
  }

  if (binary === "pipx") {
    if (rest[0] === "run") {
      return {
        resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
        mayInstall: true,
        installer: "pipx run",
        tool: extractToolFromArgs(rest.slice(1)),
      };
    }
    if (rest[0] === "install") {
      return {
        resolutionMode: "EXPLICIT_INSTALLATION",
        mayInstall: true,
        installer: "pipx install",
        tool: extractToolFromArgs(rest.slice(1)),
      };
    }
    return { resolutionMode: "LOCAL_EXECUTABLE", mayInstall: false, installer: null, tool: null };
  }

  if (binary === "npm") return classifyNpmInvocation(parseNpmInvocationArgs(rest));

  if (binary === "pip" || binary === "pip3") {
    if (rest[0] === "install") {
      return {
        resolutionMode: "EXPLICIT_INSTALLATION",
        mayInstall: true,
        installer: binary,
        tool: extractToolFromArgs(rest.slice(1)),
      };
    }
  }
  if (binary === "python" || binary === "python3") {
    if (rest[0] === "-m" && rest[1] === "pip" && rest[2] === "install") {
      return {
        resolutionMode: "EXPLICIT_INSTALLATION",
        mayInstall: true,
        installer: `${binary} -m pip install`,
        tool: extractToolFromArgs(rest.slice(3)),
      };
    }
  }

  if (binary === "cargo") {
    if (rest[0] === "install" || rest[0] === "binstall") {
      return {
        resolutionMode: "EXPLICIT_INSTALLATION",
        mayInstall: true,
        installer: binary,
        tool: extractToolFromArgs(rest.slice(1)),
      };
    }
  }

  if (["brew", "apt", "apt-get", "apk", "dnf", "pacman"].includes(binary)) {
    if (["install", "add", "-S"].includes(rest[0])) {
      return {
        resolutionMode: "EXPLICIT_INSTALLATION",
        mayInstall: true,
        installer: binary,
        tool: extractToolFromArgs(rest.slice(1)),
      };
    }
  }

  return { resolutionMode: "LOCAL_EXECUTABLE", mayInstall: false, installer: null, tool: null };
}

export function classifyCommandResolution(commandInput) {
  if (Array.isArray(commandInput)) {
    if (commandInput.length === 0 || commandInput.some((item) => typeof item !== "string" || item.trim() === "")) {
      return { resolutionMode: "UNKNOWN", mayInstall: false, installer: null, tool: null };
    }
    const binary = normalizeExecutableName(commandInput[0]);
    if (["sh", "bash", "zsh", "dash", "ksh"].includes(binary)) {
      const shellFlagIndex = commandInput.findIndex((item, index) => index > 0 && /^-.*c/.test(item));
      const shellCommand = shellFlagIndex >= 0 ? commandInput[shellFlagIndex + 1] : null;
      if (shellCommand) return classifyCommandResolution(shellCommand);
    }
    if (binary === "cmd") {
      const shellFlagIndex = commandInput.findIndex((item, index) => index > 0 && /^\/c$/iu.test(item));
      const shellCommand = shellFlagIndex >= 0 ? commandInput.slice(shellFlagIndex + 1).join(" ") : null;
      if (shellCommand) return classifyCommandResolution(shellCommand);
    }
    return classifySingleCommand(commandInput);
  }

  if (typeof commandInput !== "string" || commandInput.trim() === "") {
    return { resolutionMode: "UNKNOWN", mayInstall: false, installer: null, tool: null };
  }

  const subcommands = splitCommandPipeline(commandInput);
  for (const subcommand of subcommands) {
    const result = classifySingleCommand(subcommand);
    if (result.mayInstall) return result;
  }
  return classifySingleCommand(subcommands[0] || commandInput);
}

export const MAX_NPM_SCRIPT_DEPTH = 16;

async function resolveNpmScriptRisk({ scriptName, packageJson, visited = new Set(), depth = 0 } = {}) {
  if (depth > MAX_NPM_SCRIPT_DEPTH) {
    return { resolutionMode: "UNKNOWN", mayInstall: true, installer: "npm-script", tool: null, reason: "MAX_SCRIPT_DEPTH" };
  }
  if (visited.has(scriptName)) {
    return { resolutionMode: "UNKNOWN", mayInstall: true, installer: "npm-script", tool: null, reason: "SCRIPT_CYCLE" };
  }

  const nextVisited = new Set(visited);
  nextVisited.add(scriptName);
  const candidates = getNpmLifecycleCandidates({ scriptName, scripts: packageJson?.scripts ?? {} });
  for (const candidate of candidates) {
    const scriptBody = packageJson?.scripts?.[candidate];
    if (typeof scriptBody !== "string" || scriptBody.trim() === "") continue;

    const direct = classifyCommandResolution(scriptBody);
    if (direct.mayInstall) {
      return {
        resolutionMode: direct.resolutionMode,
        mayInstall: true,
        installer: direct.installer ?? "npm-script",
        tool: direct.tool,
        dispatch: { kind: "npm-script", scriptName: candidate },
      };
    }

    for (const subcommand of splitCommandPipeline(scriptBody)) {
      const nestedScriptName = getNpmScriptName(subcommand);
      if (!nestedScriptName) continue;
      const nested = await resolveNpmScriptRisk({
        scriptName: nestedScriptName,
        packageJson,
        visited: nextVisited,
        depth: depth + 1,
      });
      if (nested?.mayInstall) return nested;
    }
  }
  return null;
}

async function readPackageJsonIfPresent(cwd) {
  if (!cwd || typeof cwd !== "string") return null;
  try {
    const raw = await fs.readFile(path.resolve(cwd, "package.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function resolveExecutionResolution({ argv, cwd } = {}) {
  const direct = classifyCommandResolution(argv);
  if (direct.mayInstall && direct.resolutionMode !== "UNKNOWN") return direct;

  const npmInvocation = parseNpmInvocation(argv);
  const scriptName = getNpmScriptName(argv);
  if (scriptName && (npmInvocation.workspace || npmInvocation.workspaces)) {
    return {
      resolutionMode: "UNKNOWN",
      mayInstall: true,
      installer: "npm-workspace",
      tool: null,
      reason: "NPM_WORKSPACE_SCRIPT_UNRESOLVED",
      dispatch: { kind: "npm-workspace-script", scriptName },
    };
  }

  if (direct.mayInstall) return direct;
  if (!scriptName) return direct;

  const packageJson = await readPackageJsonIfPresent(cwd);
  if (!packageJson || typeof packageJson.scripts !== "object" || packageJson.scripts === null) return direct;

  const nestedRisk = await resolveNpmScriptRisk({ scriptName, packageJson });
  return nestedRisk?.mayInstall ? nestedRisk : direct;
}
