export function tokenizeCommand(commandString) {
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

  if (current.length > 0) tokens.push(current);
  return tokens;
}

export function splitCommandPipeline(commandString) {
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
        i++;
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

export function extractToolFromArgs(args) {
  if (!Array.isArray(args) || args.length === 0) return null;
  for (let idx = 0; idx < args.length; idx++) {
    const arg = args[idx];
    if (arg === "-p" || arg === "--package") {
      if (args[idx + 1] && !args[idx + 1].startsWith("-")) return args[idx + 1];
    }
    if (arg.startsWith("--package=")) return arg.split("=")[1];
    if (!arg.startsWith("-")) return arg;
  }
  return null;
}

export function extractNpmExecTool(args) {
  if (!Array.isArray(args) || args.length === 0) return null;
  for (let idx = 0; idx < args.length; idx++) {
    const arg = args[idx];
    if (arg === "-p" || arg === "--package") {
      if (args[idx + 1] && !args[idx + 1].startsWith("-")) return args[idx + 1];
    }
    if (arg.startsWith("--package=")) return arg.slice("--package=".length);
  }
  let afterDoubleDash = false;
  for (let idx = 0; idx < args.length; idx++) {
    const arg = args[idx];
    if (arg === "--") {
      afterDoubleDash = true;
      if (args[idx + 1] && !args[idx + 1].startsWith("-")) return args[idx + 1];
      continue;
    }
    if (!afterDoubleDash && !arg.startsWith("-")) return arg;
  }
  return null;
}

export function normalizeExecutableName(binaryToken) {
  const base = binaryToken.split(/[\\/]/u).pop() ?? binaryToken;
  return base.toLowerCase().replace(/\.(?:cmd|bat|exe)$/u, "");
}

export function unwrapCommandArgv(argv) {
  if (!Array.isArray(argv) || argv.length === 0) return null;
  let i = 0;
  while (i < argv.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[i])) i++;
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
  if (binary === "call") return argv.slice(i + 1);
  return argv.slice(i);
}
