import path from "node:path";

export const E_VERIFICATION_TOOL_UNAVAILABLE = "E_VERIFICATION_TOOL_UNAVAILABLE";
export const E_INSTALLATION_AUTHORITY_REQUIRED = "E_INSTALLATION_AUTHORITY_REQUIRED";

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
  // Split on logical operators (&&, ||, ;, |) outside quotes
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

function classifySingleCommand(commandString) {
  const tokens = tokenizeCommand(commandString);
  if (tokens.length === 0) {
    return { resolutionMode: "UNKNOWN", mayInstall: false, installer: null };
  }

  // Skip leading VAR=val assignments
  let i = 0;
  while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) {
    i++;
  }
  if (i >= tokens.length) {
    return { resolutionMode: "UNKNOWN", mayInstall: false, installer: null };
  }

  const binaryToken = tokens[i];
  const binary = path.basename(binaryToken).toLowerCase();
  const rest = tokens.slice(i + 1);

  if (binaryToken.includes("node_modules/.bin/") || binaryToken.startsWith("./node_modules/")) {
    return { resolutionMode: "LOCAL_PACKAGE_BINARY", mayInstall: false, installer: null };
  }

  // Check npx
  if (binary === "npx") {
    if (rest.some((arg) => arg === "--no-install" || arg === "--no")) {
      return { resolutionMode: "NON_INSTALLING_RESOLUTION", mayInstall: false, installer: "npx" };
    }
    return { resolutionMode: "INSTALL_CAPABLE_RESOLUTION", mayInstall: true, installer: "npx" };
  }

  // Check pnpx, bunx, uvx
  if (binary === "pnpx" || binary === "bunx" || binary === "uvx") {
    return { resolutionMode: "INSTALL_CAPABLE_RESOLUTION", mayInstall: true, installer: binary };
  }

  // Check pnpm and yarn
  if (binary === "pnpm" || binary === "yarn") {
    if (rest[0] === "dlx") {
      return { resolutionMode: "INSTALL_CAPABLE_RESOLUTION", mayInstall: true, installer: `${binary} dlx` };
    }
    if (["add", "install", "i"].includes(rest[0])) {
      return { resolutionMode: "EXPLICIT_INSTALLATION", mayInstall: true, installer: binary };
    }
    return { resolutionMode: "LOCAL_PACKAGE_BINARY", mayInstall: false, installer: null };
  }

  // Check bun
  if (binary === "bun") {
    if (rest[0] === "x") {
      return { resolutionMode: "INSTALL_CAPABLE_RESOLUTION", mayInstall: true, installer: "bun x" };
    }
    if (["add", "install", "i"].includes(rest[0])) {
      return { resolutionMode: "EXPLICIT_INSTALLATION", mayInstall: true, installer: "bun" };
    }
    return { resolutionMode: "LOCAL_PACKAGE_BINARY", mayInstall: false, installer: null };
  }

  // Check uv
  if (binary === "uv") {
    if (rest[0] === "tool" && rest[1] === "run") {
      return { resolutionMode: "INSTALL_CAPABLE_RESOLUTION", mayInstall: true, installer: "uv tool run" };
    }
    if (rest[0] === "pip" && rest[1] === "install") {
      return { resolutionMode: "EXPLICIT_INSTALLATION", mayInstall: true, installer: "uv pip install" };
    }
    if (rest[0] === "add") {
      return { resolutionMode: "EXPLICIT_INSTALLATION", mayInstall: true, installer: "uv add" };
    }
    return { resolutionMode: "LOCAL_EXECUTABLE", mayInstall: false, installer: null };
  }

  // Check pipx
  if (binary === "pipx") {
    if (rest[0] === "run") {
      return { resolutionMode: "INSTALL_CAPABLE_RESOLUTION", mayInstall: true, installer: "pipx run" };
    }
    if (rest[0] === "install") {
      return { resolutionMode: "EXPLICIT_INSTALLATION", mayInstall: true, installer: "pipx install" };
    }
    return { resolutionMode: "LOCAL_EXECUTABLE", mayInstall: false, installer: null };
  }

  // Check npm
  if (binary === "npm") {
    if (["install", "i", "add"].includes(rest[0])) {
      return { resolutionMode: "EXPLICIT_INSTALLATION", mayInstall: true, installer: "npm" };
    }
    return { resolutionMode: "LOCAL_PACKAGE_BINARY", mayInstall: false, installer: null };
  }

  // Check python/pip
  if (binary === "pip" || binary === "pip3") {
    if (rest[0] === "install") {
      return { resolutionMode: "EXPLICIT_INSTALLATION", mayInstall: true, installer: binary };
    }
  }
  if (binary === "python" || binary === "python3") {
    if (rest[0] === "-m" && rest[1] === "pip" && rest[2] === "install") {
      return { resolutionMode: "EXPLICIT_INSTALLATION", mayInstall: true, installer: `${binary} -m pip install` };
    }
  }

  // Check cargo
  if (binary === "cargo") {
    if (rest[0] === "install" || rest[0] === "binstall") {
      return { resolutionMode: "EXPLICIT_INSTALLATION", mayInstall: true, installer: binary };
    }
  }

  // System package managers
  if (["brew", "apt", "apt-get", "apk", "dnf", "pacman"].includes(binary)) {
    if (["install", "add", "-S"].includes(rest[0])) {
      return { resolutionMode: "EXPLICIT_INSTALLATION", mayInstall: true, installer: binary };
    }
  }

  return { resolutionMode: "LOCAL_EXECUTABLE", mayInstall: false, installer: null };
}

export function classifyCommandResolution(commandString) {
  if (typeof commandString !== "string" || commandString.trim() === "") {
    return { resolutionMode: "UNKNOWN", mayInstall: false, installer: null };
  }

  const subcommands = splitCommandPipeline(commandString);
  for (const subcommand of subcommands) {
    const res = classifySingleCommand(subcommand);
    if (res.mayInstall) {
      return res;
    }
  }

  return classifySingleCommand(subcommands[0] || commandString);
}

export function validateVerificationAuthority(check) {
  const command = check?.details?.command
    ?? (check?.kind === "command" && typeof check?.source === "string" && !check.source.startsWith("check:")
      ? check.source
      : null);

  if (!command || typeof command !== "string") {
    return { valid: true, error: null };
  }

  const classification = classifyCommandResolution(command);
  const installationAuthorized = Boolean(
    check?.details?.installationAuthorized
    || check?.details?.authority?.softwareInstallation === "AUTHORIZED"
    || check?.details?.execution?.installationAuthorized
    || check?.installationAuthorized
    || check?.authority?.softwareInstallation === "AUTHORIZED"
  );

  if (classification.mayInstall && !installationAuthorized) {
    return {
      valid: false,
      error: {
        code: E_INSTALLATION_AUTHORITY_REQUIRED,
        message: `Verification command '${command}' uses installation-capable resolution (${classification.resolutionMode}) without recorded installation authority`,
      },
    };
  }

  return { valid: true, error: null };
}
