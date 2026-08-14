import { inspectTarget } from "../core/inspect.js";

export { inspectTarget };

export function formatInspectResult(report) {
  const lines = [
    `Target: ${report.target.path}`,
    `Manifest: ${report.manifest.status}`,
    `Profile: ${report.profile.mode ?? "unknown"}/${report.profile.status ?? "unknown"}`,
    `Protocol: v${report.protocol.version}`,
    `Authority source: ${report.authority.sourceType ?? "none configured"} / ${report.authority.trusted ? "TRUSTED" : report.authority.trustMode === "NONE" ? "UNATTESTED" : "UNTRUSTED"}`,
    `Authority trust: ${report.authority.trustMode}`,
    `State: ${report.state.status}`,
    `Adapters: ${report.adapters.detected.length} detected`,
    `Findings: ${report.findings.length}`,
    report.ok ? "healthy: ForgeLoop target is ready" : "unhealthy: ForgeLoop target needs attention",
  ];
  return `${lines.join("\n")}\n`;
}
