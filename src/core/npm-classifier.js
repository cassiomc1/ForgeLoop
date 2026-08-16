import {
  NPM_CI_COMMANDS,
  NPM_EXEC_COMMANDS,
  NPM_INIT_COMMANDS,
  NPM_INSTALL_COMMANDS,
  NPM_INSTALL_CI_TEST_COMMANDS,
  NPM_INSTALL_TEST_COMMANDS,
  NPM_KNOWN_BOOLEAN_OPTIONS,
  NPM_KNOWN_NON_INSTALLING_COMMANDS,
  NPM_OPTIONS_WITH_VALUE,
  NPM_SCRIPT_COMMANDS,
} from "./verification-constants.js";
import {
  extractNpmExecTool,
  extractToolFromArgs,
  normalizeExecutableName,
  tokenizeCommand,
  unwrapCommandArgv,
} from "./command-tokenizer.js";

export function parseNpmInvocationArgs(rest) {
  if (!Array.isArray(rest)) {
    return {
      subcommand: null,
      subcommandIndex: -1,
      args: [],
      leadingOptions: [],
      workspace: null,
      workspaces: false,
      ambiguous: true,
    };
  }

  const leadingOptions = [];
  let workspace = null;
  let workspaces = false;

  let i = 0;
  while (i < rest.length) {
    const arg = rest[i];
    if (arg === "--" || !arg.startsWith("-")) break;

    if (arg === "--workspaces" || arg === "--ws") {
      workspaces = true;
      leadingOptions.push(arg);
      i += 1;
      continue;
    }

    if (arg.startsWith("--workspace=")) {
      workspace = arg.slice("--workspace=".length) || null;
      leadingOptions.push(arg);
      i += 1;
      continue;
    }

    if (arg.startsWith("-w=")) {
      workspace = arg.slice(3) || null;
      leadingOptions.push(arg);
      i += 1;
      continue;
    }

    if (arg === "--workspace" || arg === "-w") {
      leadingOptions.push(arg);
      const value = rest[i + 1] ?? null;
      if (value !== null && !value.startsWith("-")) {
        workspace = value;
        leadingOptions.push(value);
        i += 2;
      } else {
        workspace = value;
        i += 1;
      }
      continue;
    }

    if (NPM_OPTIONS_WITH_VALUE.has(arg)) {
      leadingOptions.push(arg);
      const value = rest[i + 1] ?? null;
      if (value !== null && !value.startsWith("-")) {
        leadingOptions.push(value);
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (/^--[^=]+=/.test(arg) || NPM_KNOWN_BOOLEAN_OPTIONS.has(arg)) {
      leadingOptions.push(arg);
      i += 1;
      continue;
    }

    if (/^--/.test(arg)) {
      const next = rest[i + 1];
      if (next && !next.startsWith("-")) {
        return {
          subcommand: null,
          subcommandIndex: -1,
          args: [],
          leadingOptions,
          workspace,
          workspaces,
          ambiguous: true,
          reason: "NPM_OPTION_VALUE_AMBIGUOUS",
        };
      }
      leadingOptions.push(arg);
      i += 1;
      continue;
    }

    leadingOptions.push(arg);
    i += 1;
  }

  const subcommand = rest[i] ? rest[i].toLowerCase() : null;
  const trailingArgs = subcommand ? rest.slice(i + 1) : [];

  for (let j = 0; j < trailingArgs.length; j++) {
    const arg = trailingArgs[j];
    if (arg === "--") break;
    if (arg === "--workspaces" || arg === "--ws") {
      workspaces = true;
    } else if (arg.startsWith("--workspace=")) {
      workspace = arg.slice("--workspace=".length) || null;
    } else if (arg.startsWith("-w=")) {
      workspace = arg.slice(3) || null;
    } else if (arg === "--workspace" || arg === "-w") {
      const value = trailingArgs[j + 1];
      if (value && !value.startsWith("-")) {
        workspace = value;
        j += 1;
      }
    }
  }

  const ambiguous = subcommand === null;
  return {
    subcommand,
    subcommandIndex: subcommand ? i : -1,
    args: trailingArgs,
    leadingOptions,
    workspace,
    workspaces,
    ambiguous,
    ...(ambiguous ? { reason: "NPM_SUBCOMMAND_AMBIGUOUS" } : {}),
  };
}

export function parseNpmInvocation(argv) {
  const tokens = unwrapCommandArgv(Array.isArray(argv) ? argv : tokenizeCommand(argv));
  if (!tokens || tokens.length === 0) {
    return {
      subcommand: null,
      subcommandIndex: -1,
      args: [],
      leadingOptions: [],
      workspace: null,
      workspaces: false,
      ambiguous: true,
    };
  }
  if (normalizeExecutableName(tokens[0]) !== "npm") {
    return {
      subcommand: null,
      subcommandIndex: -1,
      args: [],
      leadingOptions: [],
      workspace: null,
      workspaces: false,
      ambiguous: true,
    };
  }
  return parseNpmInvocationArgs(tokens.slice(1));
}

export function npmWorkspaceSelection(npmInvocation) {
  return {
    scoped: Boolean(npmInvocation?.workspace || npmInvocation?.workspaces),
    workspace: npmInvocation?.workspace ?? null,
    allWorkspaces: npmInvocation?.workspaces === true,
  };
}

export function classifyNpmInvocation(npm) {
  const sub = npm.subcommand;

  if (npm.ambiguous) {
    return {
      resolutionMode: "UNKNOWN",
      mayInstall: true,
      installer: "npm",
      tool: null,
      reason: npm.reason || "NPM_SUBCOMMAND_AMBIGUOUS",
    };
  }

  if (NPM_EXEC_COMMANDS.has(sub)) {
    return {
      resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
      mayInstall: true,
      installer: `npm ${sub}`,
      tool: extractNpmExecTool(npm.args),
    };
  }

  if (NPM_INSTALL_COMMANDS.has(sub) || NPM_CI_COMMANDS.has(sub) || NPM_INSTALL_TEST_COMMANDS.has(sub) || NPM_INSTALL_CI_TEST_COMMANDS.has(sub)) {
    let tool = null;
    let installer = `npm ${sub}`;
    if (NPM_INSTALL_COMMANDS.has(sub)) {
      tool = extractToolFromArgs(npm.args);
      installer = "npm";
    }
    return {
      resolutionMode: "EXPLICIT_INSTALLATION",
      mayInstall: true,
      installer,
      tool,
    };
  }

  if (NPM_INIT_COMMANDS.has(sub)) {
    let firstMeaningful = null;
    for (let i = 0; i < npm.args.length; i++) {
      const arg = npm.args[i];
      if (arg === "--") {
        const next = npm.args[i + 1];
        firstMeaningful = next && !next.startsWith("-") ? next : null;
        break;
      }
      if (!arg.startsWith("-")) {
        firstMeaningful = arg;
        break;
      }
    }
    if (firstMeaningful) {
      return {
        resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
        mayInstall: true,
        installer: `npm ${sub}`,
        tool: firstMeaningful,
      };
    }
    return {
      resolutionMode: "LOCAL_PACKAGE_BINARY",
      mayInstall: false,
      installer: null,
      tool: null,
    };
  }

  if (sub === "update" || sub === "up" || sub === "upgrade") {
    return {
      resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
      mayInstall: true,
      installer: `npm ${sub}`,
      tool: extractToolFromArgs(npm.args),
    };
  }

  if (sub === "audit") {
    if (npm.args.includes("fix")) {
      return {
        resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
        mayInstall: true,
        installer: "npm audit fix",
        tool: null,
      };
    }
    return {
      resolutionMode: "LOCAL_PACKAGE_BINARY",
      mayInstall: false,
      installer: null,
      tool: null,
    };
  }

  if (NPM_SCRIPT_COMMANDS.has(sub)) {
    return {
      resolutionMode: "LOCAL_PACKAGE_BINARY",
      mayInstall: false,
      installer: null,
      tool: null,
      dispatch: { kind: "npm-script-command" },
    };
  }

  if (NPM_KNOWN_NON_INSTALLING_COMMANDS.has(sub)) {
    return {
      resolutionMode: "LOCAL_PACKAGE_BINARY",
      mayInstall: false,
      installer: null,
      tool: null,
    };
  }

  return {
    resolutionMode: "UNKNOWN",
    mayInstall: true,
    installer: "npm",
    tool: null,
    reason: "NPM_COMMAND_UNCLASSIFIED",
  };
}

export function getNpmScriptName(argv) {
  const npm = parseNpmInvocation(argv);
  if (npm.ambiguous || !npm.subcommand) return null;

  const sub = npm.subcommand;
  const args = npm.args;
  if (["test", "t", "tst"].includes(sub)) return "test";
  if (["start", "stop", "restart"].includes(sub)) return sub;
  if (["run", "run-script", "rum", "urn"].includes(sub)) {
    let afterDoubleDash = false;
    for (let idx = 0; idx < args.length; idx++) {
      const arg = args[idx];
      if (arg === "--") {
        afterDoubleDash = true;
        if (args[idx + 1] && !args[idx + 1].startsWith("-")) return args[idx + 1];
        continue;
      }
      if (!afterDoubleDash && !arg.startsWith("-")) {
        if (idx > 0 && (args[idx - 1] === "-w" || args[idx - 1] === "--workspace" || NPM_OPTIONS_WITH_VALUE.has(args[idx - 1]))) continue;
        return arg;
      }
    }
  }
  return null;
}

export function getNpmLifecycleCandidates({ scriptName, scripts = {} } = {}) {
  if (scriptName === "restart") {
    if (typeof scripts?.restart === "string" && scripts.restart.trim() !== "") {
      return ["prerestart", "restart", "postrestart"];
    }
    return ["prerestart", "prestop", "stop", "poststop", "prestart", "start", "poststart", "postrestart"];
  }
  return [`pre${scriptName}`, scriptName, `post${scriptName}`];
}
