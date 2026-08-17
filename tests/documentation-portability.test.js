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

test("generated documentation generator fails closed on missing, duplicate, invalid, or unknown regions", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "forgeloop-gen-mutation-"));

  try {
    await cp("docs", path.join(tempDir, "docs"), { recursive: true });
    await cp("schemas", path.join(tempDir, "schemas"), { recursive: true });
    await cp("src", path.join(tempDir, "src"), { recursive: true });

    const cliDocPath = path.join(tempDir, "docs", "CLI_REFERENCE.md");
    const originalCliDoc = await readFile(cliDocPath, "utf8");

    // 1. Missing region marker -> DOC_GENERATED_REGION_MISSING
    const missingRegionDoc = originalCliDoc.replace(
      /<!-- BEGIN FORGELOOP GENERATED: cli:init:options -->[\s\S]*?<!-- END FORGELOOP GENERATED: cli:init:options -->/,
      "- `--dry-run`: manual text",
    );
    await writeFile(cliDocPath, missingRegionDoc, "utf8");
    const missingRes = await processGeneratedDocumentation({ rootDir: tempDir, write: false });
    assert.equal(missingRes.valid, false);
    assert.ok(missingRes.errors.some((e) => e.includes("DOC_GENERATED_REGION_MISSING") && e.includes("cli:init:options")));

    // 2. Duplicate BEGIN marker -> DOC_GENERATED_REGION_DUPLICATE
    const dupRegionDoc = originalCliDoc.replace(
      "<!-- BEGIN FORGELOOP GENERATED: cli:init:options -->",
      "<!-- BEGIN FORGELOOP GENERATED: cli:init:options -->\n<!-- BEGIN FORGELOOP GENERATED: cli:init:options -->",
    );
    await writeFile(cliDocPath, dupRegionDoc, "utf8");
    const dupRes = await processGeneratedDocumentation({ rootDir: tempDir, write: false });
    assert.equal(dupRes.valid, false);
    assert.ok(dupRes.errors.some((e) => e.includes("DOC_GENERATED_REGION_DUPLICATE") && e.includes("cli:init:options")));

    // 3. Missing END marker -> DOC_GENERATED_REGION_INVALID
    const invalidRegionDoc = originalCliDoc.replace(
      "<!-- END FORGELOOP GENERATED: cli:init:options -->",
      "",
    );
    await writeFile(cliDocPath, invalidRegionDoc, "utf8");
    const invalidRes = await processGeneratedDocumentation({ rootDir: tempDir, write: false });
    assert.equal(invalidRes.valid, false);
    assert.ok(invalidRes.errors.some((e) => e.includes("DOC_GENERATED_REGION_INVALID") && e.includes("cli:init:options")));

    // 4. Unknown region marker -> DOC_GENERATED_REGION_UNKNOWN
    const unknownRegionDoc = originalCliDoc + "\n<!-- BEGIN FORGELOOP GENERATED: non-existent-region -->\nfoo\n<!-- END FORGELOOP GENERATED: non-existent-region -->\n";
    await writeFile(cliDocPath, unknownRegionDoc, "utf8");
    const unknownRes = await processGeneratedDocumentation({ rootDir: tempDir, write: false });
    assert.equal(unknownRes.valid, false);
    assert.ok(unknownRes.errors.some((e) => e.includes("DOC_GENERATED_REGION_UNKNOWN") && e.includes("non-existent-region")));

    // 5. Stale region in check mode -> DOC_GENERATED_REGION_STALE
    const staleRegionDoc = originalCliDoc.replace(
      /<!-- BEGIN FORGELOOP GENERATED: cli:init:options -->[\s\S]*?<!-- END FORGELOOP GENERATED: cli:init:options -->/,
      "<!-- BEGIN FORGELOOP GENERATED: cli:init:options -->\n\n- `--stale-flag`: completely stale\n\n<!-- END FORGELOOP GENERATED: cli:init:options -->",
    );
    await writeFile(cliDocPath, staleRegionDoc, "utf8");
    const staleRes = await processGeneratedDocumentation({ rootDir: tempDir, write: false });
    assert.equal(staleRes.valid, false);
    assert.ok(staleRes.errors.some((e) => e.includes("DOC_GENERATED_REGION_STALE") && e.includes("cli:init:options")));

    // 6. Write mode repairs stale region -> subsequent check passes
    const repairRes = await processGeneratedDocumentation({ rootDir: tempDir, write: true });
    assert.equal(repairRes.valid, true);
    assert.ok(repairRes.updatedFiles.includes("docs/CLI_REFERENCE.md"));

    // 7. Write mode performs ZERO writes when any structural error exists
    const brokenCliDoc = originalCliDoc
      .replace(
        /<!-- BEGIN FORGELOOP GENERATED: cli:init:options -->[\s\S]*?<!-- END FORGELOOP GENERATED: cli:init:options -->/,
        "<!-- BEGIN FORGELOOP GENERATED: cli:init:options -->\n\n- `--stale`: stale\n\n<!-- END FORGELOOP GENERATED: cli:init:options -->",
      )
      .replace("<!-- END FORGELOOP GENERATED: cli:doctor:options -->", "");
    await writeFile(cliDocPath, brokenCliDoc, "utf8");
    const snapshotBefore = await readFile(cliDocPath, "utf8");

    const failWriteRes = await processGeneratedDocumentation({ rootDir: tempDir, write: true });
    assert.equal(failWriteRes.valid, false);
    assert.deepEqual(failWriteRes.updatedFiles, []);

    const snapshotAfter = await readFile(cliDocPath, "utf8");
    assert.equal(snapshotAfter, snapshotBefore, "write mode must not modify files when validation fails");

    // 8. Nested region -> DOC_GENERATED_REGION_NESTED
    const doctorMatch = originalCliDoc.match(/<!-- BEGIN FORGELOOP GENERATED: cli:doctor:options -->[\s\S]*?<!-- END FORGELOOP GENERATED: cli:doctor:options -->/);
    const docWithoutDoctor = originalCliDoc.replace(doctorMatch[0], "");
    const nestedDoc = docWithoutDoctor.replace(
      "<!-- BEGIN FORGELOOP GENERATED: cli:init:options -->",
      `<!-- BEGIN FORGELOOP GENERATED: cli:init:options -->\n${doctorMatch[0]}`,
    );
    await writeFile(cliDocPath, nestedDoc, "utf8");
    const nestedRes = await processGeneratedDocumentation({ rootDir: tempDir, write: false });
    assert.equal(nestedRes.valid, false);
    assert.ok(nestedRes.errors.some((e) => e.includes("DOC_GENERATED_REGION_NESTED")));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});


