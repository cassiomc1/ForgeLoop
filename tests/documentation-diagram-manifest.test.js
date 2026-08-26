import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  ARCHIFY_RENDERERS,
  GOVERNED_DIAGRAM_TYPES,
  rendererForDiagramType,
  validateDiagramManifest,
} from "../scripts/documentation-diagram-manifest.mjs";

const renderer = {
  name: "archify",
  version: "2.15.0",
  commit: "e1ac748f19cf805e44bf74fb93c796662152e273",
  source: "https://github.com/tt-a1i/archify/tree/v2.15.0",
  license: "MIT",
};

function validManifest() {
  return {
    version: 2,
    renderer: { ...renderer },
    policy: {
      supportedTypes: [...GOVERNED_DIAGRAM_TYPES],
      requireVisualReview: true,
    },
    diagrams: [{
      id: "flow",
      type: "workflow",
      defaultTheme: "dark",
      canonicalFor: ["high-level-engineering-flow"],
      source: "docs/diagrams/flow.workflow.json",
      html: "docs/assets/diagrams/flow.html",
      svg: "docs/assets/diagrams/flow.svg",
      receipt: "docs/assets/diagrams/flow.receipt.json",
      review: "docs/diagrams/reviews/flow.review.json",
      fallback: "README.md#architecture-flow",
      referencedBy: ["README.md", "docs/diagrams/README.md"],
    }],
  };
}

function assertManifestError(mutator, code) {
  const manifest = validManifest();
  mutator(manifest);
  assert.throws(
    () => validateDiagramManifest(manifest),
    (error) => error.code === code && error.message.includes(code),
  );
}

test("checked-in diagram manifest satisfies governance v2", async () => {
  const manifest = JSON.parse(await readFile("docs/diagrams/manifest.json", "utf8"));
  const validated = validateDiagramManifest(manifest);

  assert.equal(validated.version, 2);
  assert.deepEqual(validated.policy.supportedTypes, [
    "workflow",
    "architecture",
    "sequence",
    "dataflow",
    "lifecycle",
  ]);
  assert.equal(validated.policy.requireVisualReview, true);
  assert.deepEqual(rendererForDiagramType("workflow"), ARCHIFY_RENDERERS.workflow);
});

test("manifest validation enforces structure, taxonomy, ownership, and dark theme", () => {
  assert.doesNotThrow(() => validateDiagramManifest(validManifest()));
  assertManifestError((manifest) => { manifest.version = 1; }, "E_DIAGRAM_MANIFEST_INVALID");
  assertManifestError((manifest) => { manifest.renderer.version = "2.14.0"; }, "E_DIAGRAM_MANIFEST_INVALID");
  assertManifestError((manifest) => { manifest.policy.supportedTypes.shift(); }, "E_DIAGRAM_MANIFEST_TYPE");
  assertManifestError((manifest) => { manifest.policy.supportedTypes.push("workflow"); }, "E_DIAGRAM_MANIFEST_TYPE");
  assertManifestError((manifest) => { manifest.diagrams.push({ ...manifest.diagrams[0], id: "flow" }); }, "E_DIAGRAM_MANIFEST_DUPLICATE_ID");
  assertManifestError((manifest) => { manifest.diagrams[0].type = "unknown"; }, "E_DIAGRAM_MANIFEST_TYPE");
  assertManifestError((manifest) => { manifest.diagrams[0].defaultTheme = "light"; }, "E_DIAGRAM_MANIFEST_THEME");
  assertManifestError((manifest) => { manifest.diagrams[0].canonicalFor = []; }, "E_DIAGRAM_MANIFEST_INVALID");
  assertManifestError((manifest) => { manifest.diagrams.push({ ...manifest.diagrams[0], id: "flow-2" }); }, "E_DIAGRAM_MANIFEST_INVALID");
  assertManifestError((manifest) => { manifest.diagrams[0].canonicalFor = ["high-level-engineering-flow", "high-level-engineering-flow"]; }, "E_DIAGRAM_MANIFEST_INVALID");
  assertManifestError((manifest) => { manifest.diagrams[0].review = "docs/review.json"; }, "E_DIAGRAM_MANIFEST_INVALID");
  assertManifestError((manifest) => { manifest.diagrams[0].source = "/tmp/flow.json"; }, "E_DIAGRAM_MANIFEST_INVALID");
  assertManifestError((manifest) => { manifest.diagrams[0].html = "docs/diagrams/flow.html"; }, "E_DIAGRAM_MANIFEST_INVALID");
  assertManifestError((manifest) => { manifest.diagrams[0].review = "docs/assets/diagrams/flow.review.json"; }, "E_DIAGRAM_MANIFEST_INVALID");
  assertManifestError((manifest) => { manifest.diagrams[0].svg = validManifest().diagrams[0].html; }, "E_DIAGRAM_MANIFEST_DUPLICATE_PATH");
  assertManifestError((manifest) => { manifest.diagrams[0].referencedBy = []; }, "E_DIAGRAM_MANIFEST_REFERENCE");
});

test("renderer governance is broader than the currently implemented Archify mapping", () => {
  assert.deepEqual(GOVERNED_DIAGRAM_TYPES, ["workflow", "architecture", "sequence", "dataflow", "lifecycle"]);
  assert.throws(
    () => rendererForDiagramType("architecture"),
    (error) => error.code === "E_DIAGRAM_RENDERER_NOT_IMPLEMENTED" && error.message.includes("architecture"),
  );
  assert.throws(
    () => rendererForDiagramType("unknown"),
    (error) => error.code === "E_DIAGRAM_RENDERER_NOT_IMPLEMENTED" && error.message.includes("unknown"),
  );
});
