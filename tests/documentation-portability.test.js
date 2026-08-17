import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { processGeneratedDocumentation } from "../scripts/generate_documentation_reference.mjs";
import { validateDocumentationConformance } from "../scripts/validate_documentation_conformance.mjs";
import { checkGeneratedDiagram } from "../scripts/check-generated-diagram.mjs";

test("documentation reference generator is deterministic and idempotent", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "forgeloop-portability-"));

  try {
    await cp("docs", path.join(tempDir, "docs"), { recursive: true });
    await cp("schemas", path.join(tempDir, "schemas"), { recursive: true });
    await cp("src", path.join(tempDir, "src"), { recursive: true });
    await cp("AGENTS.md", path.join(tempDir, "AGENTS.md"));
    await cp("CLAUDE.md", path.join(tempDir, "CLAUDE.md"));
    await cp(".cursor", path.join(tempDir, ".cursor"), { recursive: true });
    await cp(".github", path.join(tempDir, ".github"), { recursive: true });

    // First run --write
    const firstRun = await processGeneratedDocumentation({ rootDir: tempDir, write: true });
    assert.equal(firstRun.valid, true);

    const firstArtifactDoc = await readFile(path.join(tempDir, "docs", "ARTIFACT_REFERENCE.md"), "utf8");
    const firstCliDoc = await readFile(path.join(tempDir, "docs", "CLI_REFERENCE.md"), "utf8");
    const firstTroubleDoc = await readFile(path.join(tempDir, "docs", "TROUBLESHOOTING.md"), "utf8");

    // Second run --write
    const secondRun = await processGeneratedDocumentation({ rootDir: tempDir, write: true });
    assert.equal(secondRun.valid, true);
    assert.equal(secondRun.updatedFiles.length, 0, "Second generation must be a zero-diff no-op");

    const secondArtifactDoc = await readFile(path.join(tempDir, "docs", "ARTIFACT_REFERENCE.md"), "utf8");
    const secondCliDoc = await readFile(path.join(tempDir, "docs", "CLI_REFERENCE.md"), "utf8");
    const secondTroubleDoc = await readFile(path.join(tempDir, "docs", "TROUBLESHOOTING.md"), "utf8");

    assert.equal(secondArtifactDoc, firstArtifactDoc);
    assert.equal(secondCliDoc, firstCliDoc);
    assert.equal(secondTroubleDoc, firstTroubleDoc);

    // Check mode
    const checkRun = await processGeneratedDocumentation({ rootDir: tempDir, write: false });
    assert.equal(checkRun.valid, true);
    assert.equal(checkRun.errors.length, 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("documentation generation and validation succeed in directory paths containing spaces", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "forgeloop portability space-"));

  try {
    await cp("docs", path.join(tempDir, "docs"), { recursive: true });
    await cp("schemas", path.join(tempDir, "schemas"), { recursive: true });
    await cp("src", path.join(tempDir, "src"), { recursive: true });
    await cp("AGENTS.md", path.join(tempDir, "AGENTS.md"));
    await cp("CLAUDE.md", path.join(tempDir, "CLAUDE.md"));
    await cp(".cursor", path.join(tempDir, ".cursor"), { recursive: true });
    await cp(".github", path.join(tempDir, ".github"), { recursive: true });

    const genResult = await processGeneratedDocumentation({ rootDir: tempDir, write: false });
    assert.equal(genResult.valid, true);

    const confResult = await validateDocumentationConformance({ rootDir: tempDir });
    assert.equal(confResult.valid, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Mermaid diagram check validates target SVG explicitly", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "forgeloop-diagram-"));

  try {
    const validSvgPath = path.join("docs", "assets", "forgeloop-flow.svg");
    const validSvg = await readFile(validSvgPath, "utf8");

    // Test valid SVG
    const validTempSvg = path.join(tempDir, "valid-flow.svg");
    await writeFile(validTempSvg, validSvg, "utf8");
    await assert.doesNotReject(async () => {
      await checkGeneratedDiagram(validTempSvg);
    });

    // Test invalid SVG with corrupted SHA-256 fingerprint
    const invalidTempSvg = path.join(tempDir, "invalid-flow.svg");
    const corruptedSvg = validSvg.replace(/data-forgeloop-source-sha256="[^"]+"/, 'data-forgeloop-source-sha256="corrupted-hash"');
    await writeFile(invalidTempSvg, corruptedSvg, "utf8");

    await assert.rejects(async () => {
      await checkGeneratedDiagram(invalidTempSvg);
    }, /fingerprint does not match canonical source/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
