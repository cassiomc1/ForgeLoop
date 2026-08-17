#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const steps = [
  {
    name: "Mermaid Diagram Verification",
    script: "scripts/check-generated-diagram.mjs",
  },
  {
    name: "Documentation Conformance Validation",
    script: "scripts/validate_documentation_conformance.mjs",
  },
];

console.log("Running ForgeLoop documentation check suite...\n");

for (const step of steps) {
  console.log(`▶ Running ${step.name}...`);
  const result = spawnSync(process.execPath, [path.join(repositoryRoot, step.script)], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    console.error(`\n❌ Step failed: ${step.name}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n✅ All documentation checks passed successfully.");
