import { discoverPolicy } from "../core/policy-discovery.js";

export async function runProfileInterview({
  target = process.cwd(),
  packageRoot,
  dryRun = false,
} = {}) {
  const discovery = await discoverPolicy({ target });
  return {
    status: "COMPLETE",
    mode: "OPTIONAL_INTERVIEW",
    dryRun,
    questions: [
      {
        topic: "languages",
        detected: discovery.languages,
        recommendation: discovery.languages.join(", ") || "none",
      },
      {
        topic: "testing",
        detected: discovery.testing.detected,
        framework: discovery.testing.framework,
        confidence: discovery.testing.confidence,
      },
      {
        topic: "linting",
        detected: discovery.linting.detected,
        tool: discovery.linting.tool,
        confidence: discovery.linting.confidence,
      },
      {
        topic: "architecture",
        detected: discovery.architecture.value,
        confidence: discovery.architecture.confidence,
      },
    ],
    discovery,
  };
}

export function formatProfileInterviewResult(result) {
  const lines = [
    "FORGELOOP PROFILE INTERVIEW (OPTIONAL):",
    `Languages: ${result.discovery?.languages?.join(", ") || "none detected"}`,
    `Testing: ${result.discovery?.testing?.detected ? `${result.discovery.testing.framework} [${result.discovery.testing.confidence}]` : "none"}`,
    `Linting: ${result.discovery?.linting?.detected ? `${result.discovery.linting.tool} [${result.discovery.linting.confidence}]` : "none"}`,
    `Architecture: ${result.discovery?.architecture?.value ? `${result.discovery.architecture.value} [${result.discovery.architecture.confidence}]` : "unknown"}`,
  ];
  return `${lines.join("\n")}\n`;
}
