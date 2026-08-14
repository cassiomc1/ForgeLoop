import fs from "node:fs/promises";
import {
  E_AUTHORITY_UNTRUSTED_SOURCE,
  resolveTrustedAuthority,
} from "./trusted-authority.js";
import path from "node:path";
export {
  AUTHORITY_TRUST_MODES,
  createAuthorityContext,
  createForgeLoopContext,
} from "./runtime-context.js";

export const E_VERIFICATION_TOOL_UNAVAILABLE = "E_VERIFICATION_TOOL_UNAVAILABLE";
export const E_INSTALLATION_AUTHORITY_REQUIRED = "E_INSTALLATION_AUTHORITY_REQUIRED";
export const E_AUTHORITY_INVALID = "E_AUTHORITY_INVALID";
export const E_AUTHORITY_SCOPE_MISMATCH = "E_AUTHORITY_SCOPE_MISMATCH";

export { E_AUTHORITY_UNTRUSTED_SOURCE };

export const RESOLUTION_MODES = Object.freeze([
  "LOCAL_EXECUTABLE",
  "LOCAL_PACKAGE_BINARY",
  "NON_INSTALLING_RESOLUTION",
  "INSTALL_CAPABLE_RESOLUTION",
  "EXPLICIT_INSTALLATION",
  "UNKNOWN",
]);

export function classifyVerificationCapability({
  available = false,
  equivalentAvailable = false,
  installationAuthorized = false,
  installationRequired = false,
} = {}) {
  if (available) {
    return {
      action: "USE_AVAILABLE",
      reasonCode: null,
      message: "Verification tool is locally available.",
    };
  }

  if (equivalentAvailable) {
    return {
      action: "USE_EQUIVALENT",
      reasonCode: null,
      message: "An existing local equivalent verifier is available.",
    };
  }

  if (installationAuthorized) {
    return {
      action: "INSTALL_AUTHORIZED",
      reasonCode: null,
      message: "Installation is explicitly authorized for this verification requirement.",
    };
  }

  if (installationRequired) {
    return {
      action: "REQUEST_AUTHORITY",
      reasonCode: E_INSTALLATION_AUTHORITY_REQUIRED,
      message: "Verification tool is required but installation authority has not been granted.",
    };
  }

  return {
    action: "RECORD_NOT_VERIFIED",
    reasonCode: E_VERIFICATION_TOOL_UNAVAILABLE,
    message: "Verification tool is absent and installation was not authorized.",
  };
}

function tokenizeCommand(commandString) {
  const tokens = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < commandString.length; i++) {
    const char = commandString[i];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function splitCommandPipeline(commandString) {
  const parts = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < commandString.length; i++) {
    const char = commandString[i];
    const next = commandString[i + 1];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if ((char === "&" && next === "&") || (char === "|" && next === "|")) {
        if (current.trim().length > 0) parts.push(current.trim());
        current = "";
        i++; // skip next char
      } else if (char === ";" || char === "|") {
        if (current.trim().length > 0) parts.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    } else {
      current += char;
    }
  }

  if (current.trim().length > 0) parts.push(current.trim());
  return parts.length > 0 ? parts : [commandString];
}

function extractToolFromArgs(args) {
  if (!Array.isArray(args) || args.length === 0) return null;
  for (let idx = 0; idx < args.length; idx++) {
    const arg = args[idx];
    if (arg === "-p" || arg === "--package") {
      if (args[idx + 1] && !args[idx + 1].startsWith("-")) {
        return args[idx + 1];
      }
    }
    if (arg.startsWith("--package=")) {
      return arg.split("=")[1];
    }
    if (!arg.startsWith("-")) {
      return arg;
    }
  }
  return null;
}

function extractNpmExecTool(args) {
  if (!Array.isArray(args) || args.length === 0) return null;
  for (let idx = 0; idx < args.length; idx++) {
    const arg = args[idx];
    if (arg === "-p" || arg === "--package") {
      if (args[idx + 1] && !args[idx + 1].startsWith("-")) {
        return args[idx + 1];
      }
    }
    if (arg.startsWith("--package=")) {
      return arg.slice("--package=".length);
    }
  }
  let afterDoubleDash = false;
  for (let idx = 0; idx < args.length; idx++) {
    const arg = args[idx];
    if (arg === "--") {
      afterDoubleDash = true;
      if (args[idx + 1] && !args[idx + 1].startsWith("-")) {
        return args[idx + 1];
      }
      continue;
    }
    if (!afterDoubleDash && !arg.startsWith("-")) {
      return arg;
    }
  }
  return null;
}

function normalizeExecutableName(binaryToken) {
  const base = binaryToken.split(/[\\/]/u).pop() ?? binaryToken;
  return base.toLowerCase().replace(/\.(?:cmd|bat|exe)$/u, "");
}

function classifySingleCommand(commandInput) {
  const tokens = Array.isArray(commandInput) ? [...commandInput] : tokenizeCommand(commandInput);
  if (tokens.length === 0) {
    return { resolutionMode: "UNKNOWN", mayInstall: false, installer: null, tool: null };
  }

  let i = 0;
  while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) {
    i++;
  }
  if (i >= tokens.length) {
    return { resolutionMode: "UNKNOWN", mayInstall: false, installer: null, tool: null };
  }

  const binaryToken = tokens[i];
  const binary = normalizeExecutableName(binaryToken);
  const rest = tokens.slice(i + 1);

  if (binary === "call") {
    return classifyCommandResolution(rest);
  }

  if (binaryToken.includes("node_modules/.bin/") || binaryToken.startsWith("./node_modules/")) {
    return { resolutionMode: "LOCAL_PACKAGE_BINARY", mayInstall: false, installer: null, tool: binary };
  }

  // Check npx
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

  // Check pnpx, bunx, uvx
  if (binary === "pnpx" || binary === "bunx" || binary === "uvx") {
    return {
      resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
      mayInstall: true,
      installer: binary,
      tool: extractToolFromArgs(rest),
    };
  }

  // Check pnpm and yarn
  if (binary === "pnpm" || binary === "yarn") {
    if (rest[0] === "dlx") {
      return {
        resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
        mayInstall: true,
        installer: `${binary} dlx`,
        tool: extractToolFromArgs(rest.slice(1)),
      };
    }
    if (["add", "install", "i"].includes(rest[0])) {
      return {
        resolutionMode: "EXPLICIT_INSTALLATION",
        mayInstall: true,
        installer: binary,
        tool: extractToolFromArgs(rest.slice(1)),
      };
    }
    return { resolutionMode: "LOCAL_PACKAGE_BINARY", mayInstall: false, installer: null, tool: null };
  }

  // Check bun
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

  // Check uv
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

  // Check pipx
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

  // Check npm
  if (binary === "npm") {
    if (["exec", "x"].includes(rest[0])) {
      const execArgs = rest.slice(1);
      return {
        resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
        mayInstall: true,
        installer: `npm ${rest[0]}`,
        tool: extractNpmExecTool(execArgs),
      };
    }
    if (["install", "i", "add"].includes(rest[0])) {
      return {
        resolutionMode: "EXPLICIT_INSTALLATION",
        mayInstall: true,
        installer: "npm",
        tool: extractToolFromArgs(rest.slice(1)),
      };
    }
    return { resolutionMode: "LOCAL_PACKAGE_BINARY", mayInstall: false, installer: null, tool: null };
  }

  // Check python/pip
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

  // Check cargo
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

  // System package managers
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
    const res = classifySingleCommand(subcommand);
    if (res.mayInstall) {
      return res;
    }
  }

  return classifySingleCommand(subcommands[0] || commandInput);
}

function unwrapCommandArgv(argv) {
  if (!Array.isArray(argv) || argv.length === 0) return null;
  let i = 0;
  while (i < argv.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[i])) {
    i++;
  }
  if (i >= argv.length) return null;
  const binary = normalizeExecutableName(argv[i]);
  if (["sh", "bash", "zsh", "dash", "ksh"].includes(binary)) {
    const shellFlagIndex = argv.findIndex((item, index) => index > i && /^-.*c/.test(item));
    const shellCommand = shellFlagIndex >= 0 ? argv[shellFlagIndex + 1] : null;
    if (shellCommand) return tokenizeCommand(shellCommand);
  }
  if (binary === "cmd") {
    const shellFlagIndex = argv.findIndex((item, index) => index > i && /^\/c$/iu.test(item));
    const shellCommand = shellFlagIndex >= 0 ? argv.slice(shellFlagIndex + 1).join(" ") : null;
    if (shellCommand) return tokenizeCommand(shellCommand);
  }
  if (binary === "call") {
    return argv.slice(i + 1);
  }
  return argv.slice(i);
}

export function getNpmScriptName(argv) {
  const tokens = unwrapCommandArgv(Array.isArray(argv) ? argv : tokenizeCommand(argv));
  if (!tokens || tokens.length < 2) return null;
  const binary = normalizeExecutableName(tokens[0]);
  if (binary !== "npm") return null;

  const rest = tokens.slice(1);
  const sub = rest[0]?.toLowerCase();
  if (sub === "test" || sub === "t" || sub === "tst") return "test";
  if (sub === "start" || sub === "stop" || sub === "restart") return sub;
  if (sub === "run" || sub === "run-script") {
    let afterDoubleDash = false;
    for (let idx = 1; idx < rest.length; idx++) {
      const arg = rest[idx];
      if (arg === "--") {
        afterDoubleDash = true;
        if (rest[idx + 1] && !rest[idx + 1].startsWith("-")) {
          return rest[idx + 1];
        }
        continue;
      }
      if (!afterDoubleDash && !arg.startsWith("-")) {
        return arg;
      }
    }
  }
  return null;
}

async function readPackageJsonIfPresent(cwd) {
  if (!cwd || typeof cwd !== "string") return null;
  try {
    const pkgPath = path.resolve(cwd, "package.json");
    const raw = await fs.readFile(pkgPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function resolveExecutionResolution({ argv, cwd } = {}) {
  const direct = classifyCommandResolution(argv);
  if (direct.mayInstall) return direct;

  const scriptName = getNpmScriptName(argv);
  if (!scriptName) return direct;

  const packageJson = await readPackageJsonIfPresent(cwd);
  if (!packageJson || typeof packageJson.scripts !== "object" || packageJson.scripts === null) {
    return direct;
  }

  const lifecycleCandidates = [
    `pre${scriptName}`,
    scriptName,
    `post${scriptName}`,
  ];

  for (const candidate of lifecycleCandidates) {
    const scriptBody = packageJson.scripts[candidate];
    if (typeof scriptBody === "string" && scriptBody.trim() !== "") {
      const nested = classifyCommandResolution(scriptBody);
      if (nested.mayInstall) {
        return {
          resolutionMode: nested.resolutionMode,
          mayInstall: true,
          installer: nested.installer ?? "npm-script",
          tool: nested.tool,
          dispatch: {
            kind: "npm-script",
            scriptName: candidate,
          },
        };
      }
    }
  }

  return direct;
}

export function getInstallationAuthorityRef(check) {
  return (
    check?.details?.installationAuthorityRef
    ?? check?.details?.authorityRef
    ?? check?.installationAuthorityRef
    ?? check?.authorityRef
    ?? null
  );
}

function normalizeToolName(toolName) {
  if (typeof toolName !== "string") return "";
  if (toolName.startsWith("@")) {
    const parts = toolName.slice(1).split("@");
    return `@${parts[0]}`;
  }
  return toolName.split("@")[0];
}

export function validateAuthorityGrant({ authority, taskId, type = "SOFTWARE_INSTALLATION", tool } = {}) {
  if (!authority || typeof authority !== "object") {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: "Authority grant artifact is missing or invalid",
      },
    };
  }

  if (authority.schemaVersion !== 1 || authority.protocolVersion !== 1) {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: `Authority grant schema version (${authority.schemaVersion}) or protocol version (${authority.protocolVersion}) is invalid`,
      },
    };
  }

  if (authority.type !== type) {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: `Authority grant type '${authority.type}' does not match expected '${type}'`,
      },
    };
  }

  if (authority.status !== "AUTHORIZED") {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: `Authority grant is not active (status: '${authority.status}')`,
      },
    };
  }

  if (authority.source === "agent-self") {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: "Self-asserted authority grants with source 'agent-self' are not permitted",
      },
    };
  }

  if (!["operator", "host", "project-policy"].includes(authority.source)) {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: `Authority grant source '${authority.source}' is not recognized`,
      },
    };
  }

  if (taskId && authority.taskId && authority.taskId !== taskId) {
    return {
      valid: false,
      error: {
        code: E_AUTHORITY_INVALID,
        message: `Authority grant taskId '${authority.taskId}' does not match current task '${taskId}'`,
      },
    };
  }

  if (tool && authority.scope?.tool && authority.scope.tool !== "*") {
    const requestedNorm = normalizeToolName(tool);
    const scopeNorm = normalizeToolName(authority.scope.tool);
    const exactMatch = authority.scope.tool === tool
      || tool.startsWith(`${authority.scope.tool}@`)
      || authority.scope.tool.startsWith(`${tool}@`)
      || requestedNorm === scopeNorm;

    if (!exactMatch) {
      return {
        valid: false,
        error: {
          code: E_AUTHORITY_SCOPE_MISMATCH,
          message: `Authority grant scope tool '${authority.scope.tool}' does not match requested verification tool '${tool}'`,
        },
      };
    }
  }

  return { valid: true, error: null };
}

export function validateVerificationAuthority(check, options = {}) {
  const canonicalResolution = check?.execution?.resolution ?? check?.details?.execution?.resolution;
  const command = check?.details?.command
    ?? (check?.kind === "command" && typeof check?.source === "string" && !check.source.startsWith("check:")
      ? check.source
      : null);

  if (!canonicalResolution && (!command || typeof command !== "string")) {
    return { valid: true, error: null };
  }

  const classification = canonicalResolution ?? classifyCommandResolution(command);
  if (!classification.mayInstall) {
    return { valid: true, error: null };
  }

  const authorityRef = getInstallationAuthorityRef(check);
  if (!authorityRef) {
    return {
      valid: false,
      error: {
        code: E_INSTALLATION_AUTHORITY_REQUIRED,
        message: `Verification command '${command}' uses installation-capable resolution (${classification.resolutionMode}) without recorded installation authority reference`,
      },
    };
  }

  const resolved = resolveTrustedAuthority({
    authorityRef,
    target: options.target,
    trustedAuthorityFile: options.trustedAuthorityFile,
    trustedAuthorityDir: options.trustedAuthorityDir,
    authorities: options.authorities,
    authority: options.authority,
    authorityContext: options.authorityContext,
    runtimeContext: options.runtimeContext,
  });
  if (!resolved.trusted) {
    if (resolved.error?.code === E_AUTHORITY_INVALID && resolved.sourceConfigured === false) {
      return {
        valid: false,
        error: {
          code: E_INSTALLATION_AUTHORITY_REQUIRED,
          message: "Installation-capable verification requires a host-attested authority context",
        },
      };
    }
    return { valid: false, error: resolved.error };
  }

  return validateAuthorityGrant({
    authority: resolved.authority,
    taskId: options.taskId,
    type: "SOFTWARE_INSTALLATION",
    tool: classification.tool,
  });
}
