export const E_VERIFICATION_TOOL_UNAVAILABLE = "E_VERIFICATION_TOOL_UNAVAILABLE";
export const E_INSTALLATION_AUTHORITY_REQUIRED = "E_INSTALLATION_AUTHORITY_REQUIRED";
export const E_COMMAND_RESOLUTION_AMBIGUOUS = "E_COMMAND_RESOLUTION_AMBIGUOUS";
export const E_AUTHORITY_INVALID = "E_AUTHORITY_INVALID";
export const E_AUTHORITY_SCOPE_MISMATCH = "E_AUTHORITY_SCOPE_MISMATCH";

export const RESOLUTION_MODES = Object.freeze([
  "LOCAL_EXECUTABLE",
  "LOCAL_PACKAGE_BINARY",
  "NON_INSTALLING_RESOLUTION",
  "INSTALL_CAPABLE_RESOLUTION",
  "EXPLICIT_INSTALLATION",
  "UNKNOWN",
]);

export const NPM_INSTALL_COMMANDS = new Set([
  "install", "add", "i", "in", "ins", "inst", "insta", "instal", "isnt", "isnta", "isntal", "isntall",
]);

export const NPM_CI_COMMANDS = new Set([
  "ci", "clean-install", "ic", "install-clean", "isntall-clean",
]);

export const NPM_INSTALL_TEST_COMMANDS = new Set([
  "install-test", "it",
]);

export const NPM_INSTALL_CI_TEST_COMMANDS = new Set([
  "install-ci-test", "cit", "clean-install-test", "sit",
]);

export const NPM_EXEC_COMMANDS = new Set([
  "exec", "x",
]);

export const NPM_INIT_COMMANDS = new Set([
  "init", "create", "innit",
]);

export const NPM_SCRIPT_COMMANDS = new Set([
  "test", "t", "tst", "start", "stop", "restart", "run", "run-script", "rum", "urn",
]);

export const NPM_KNOWN_NON_INSTALLING_COMMANDS = new Set([
  "v", "view", "info", "show", "list", "ls", "outdated", "config", "help", "help-search", "doctor", "ping", "root", "prefix", "bin", "whoami",
]);

export const NPM_KNOWN_BOOLEAN_OPTIONS = new Set([
  "--silent", "--json", "--long", "--parseable", "--global", "-g", "--force", "--yes", "-y", "--no",
]);

export const NPM_OPTIONS_WITH_VALUE = new Set([
  "--workspace",
  "-w",
  "--loglevel",
  "--prefix",
  "-C",
  "--userconfig",
  "--registry",
  "--cache",
]);
