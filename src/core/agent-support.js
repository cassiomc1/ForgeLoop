function agent(record) {
  return Object.freeze({
    ...record,
    instructionFiles: Object.freeze([...record.instructionFiles]),
  });
}

export const AGENT_SUPPORT = Object.freeze([
  agent({
    id: "codex",
    name: "Codex",
    support: "direct",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://developers.openai.com/codex/guides/agents-md",
    notes: "Reads AGENTS.md files from the global scope down to the working directory.",
  }),
  agent({
    id: "claude-code",
    name: "Claude Code",
    support: "direct",
    instructionFiles: ["CLAUDE.md"],
    officialDocs: "https://code.claude.com/docs/en/memory",
    notes: "Reads CLAUDE.md; it does not read AGENTS.md unless CLAUDE.md imports it.",
  }),
  agent({
    id: "cursor",
    name: "Cursor",
    support: "direct",
    instructionFiles: ["AGENTS.md", ".cursor/rules/project-loop.mdc"],
    officialDocs: "https://cursor.com/docs/rules",
    notes: "Uses the always-applicable MDC rule and also supports a root AGENTS.md.",
  }),
  agent({
    id: "github-copilot",
    name: "GitHub Copilot",
    support: "direct",
    instructionFiles: [".github/copilot-instructions.md"],
    officialDocs: "https://docs.github.com/en/copilot/how-tos/configure-custom-instructions-in-your-ide/add-repository-instructions-in-your-ide",
    notes: "Uses repository-wide Copilot instructions; supported agent instruction files vary by Copilot surface.",
  }),
  agent({
    id: "antigravity",
    name: "Antigravity",
    support: "agents-md",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://antigravity.google/docs/cli/best-practices",
    notes: "Parses a workspace-root AGENTS.md; workspace rules can additionally live in .agents/rules/.",
  }),
  agent({
    id: "opencode",
    name: "OpenCode",
    support: "agents-md",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://opencode.ai/docs/rules/",
    notes: "Uses project AGENTS.md; opencode.json can add other instruction files when needed.",
  }),
  agent({
    id: "hermes",
    name: "Hermes",
    support: "agents-md",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/context-files.md",
    notes: "AGENTS.md is supported, but .hermes.md or HERMES.md has higher project priority.",
  }),
  agent({
    id: "pi",
    name: "Pi",
    support: "agents-md",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md",
    notes: "Discovers AGENTS.md from the project root through the current working directory.",
  }),
  agent({
    id: "command-code",
    name: "Command Code",
    support: "agents-md",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://commandcode.ai/docs/core-concepts/memory",
    notes: "Reads project AGENTS.md; .commandcode/AGENTS.md is an optional project-specific location.",
  }),
  agent({
    id: "freebuff",
    name: "Freebuff",
    support: "agents-md",
    instructionFiles: ["AGENTS.md"],
    officialDocs: "https://github.com/CodebuffAI/freebuff/blob/main/common/src/constants/knowledge.ts",
    notes: "Recognizes AGENTS.md as a project knowledge file alongside knowledge.md and CLAUDE.md.",
  }),
]);
