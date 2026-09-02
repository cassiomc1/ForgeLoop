import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkChangelogFreshness,
  hasMeaningfulUnreleasedContent,
  releaseSection,
  stripHtmlComments,
} from "../scripts/check-changelog-freshness.mjs";

test("strips complete and multiline HTML comments without backtracking", () => {
  assert.equal(
    stripHtmlComments("Visible <!-- hidden\ncontent --> text"),
    "Visible  text",
  );
});

test("ignores an unterminated HTML comment when checking changelog content", () => {
  assert.equal(stripHtmlComments("Visible <!-- hidden content"), "Visible ");
  assert.equal(hasMeaningfulUnreleasedContent("<!-- hidden content"), false);
});

test("preserves meaningful changelog content around comments", () => {
  assert.equal(
    hasMeaningfulUnreleasedContent("<!-- release note -->\nNo changes."),
    false,
  );
  assert.equal(
    hasMeaningfulUnreleasedContent("<!-- release note -->\n- Add verification"),
    true,
  );
});

test("recognizes a populated pending release section before its tag exists", () => {
  const changelog = `# Changelog\n\n## 1.10.0 - 2026-09-02\n\n- Add the release contract\n\n## 1.9.0 - 2026-08-30\n`;
  assert.deepEqual(releaseSection(changelog), {
    version: "1.10.0",
    section: "\n\n- Add the release contract\n\n",
  });
  assert.equal(
    checkChangelogFreshness({
      changelog,
      tags: ["v1.9.0"],
      commitsSinceLatestTag: 1,
    }).ok,
    true,
  );
});

test("does not treat an already tagged release as pending content", () => {
  const changelog = "# Changelog\n\n## 1.10.0 - 2026-09-02\n\n- Released\n";
  assert.equal(
    checkChangelogFreshness({
      changelog,
      tags: ["v1.10.0"],
      commitsSinceLatestTag: 1,
    }).ok,
    false,
  );
});
