import { extractToolFromArgs } from "./command-tokenizer.js";

const INSTALL_COMMANDS = new Set(["add", "install", "i"]);

function classifyPackageManagerInvocation(binary, args) {
  const rest = Array.isArray(args) ? args : [];
  if (rest[0] === "dlx") {
    return {
      resolutionMode: "INSTALL_CAPABLE_RESOLUTION",
      mayInstall: true,
      installer: `${binary} dlx`,
      tool: extractToolFromArgs(rest.slice(1)),
    };
  }
  if (INSTALL_COMMANDS.has(rest[0])) {
    return {
      resolutionMode: "EXPLICIT_INSTALLATION",
      mayInstall: true,
      installer: binary,
      tool: extractToolFromArgs(rest.slice(1)),
    };
  }
  return {
    resolutionMode: "LOCAL_PACKAGE_BINARY",
    mayInstall: false,
    installer: null,
    tool: null,
  };
}

export function classifyPnpmInvocation(args) {
  return classifyPackageManagerInvocation("pnpm", args);
}

export function classifyYarnInvocation(args) {
  return classifyPackageManagerInvocation("yarn", args);
}
