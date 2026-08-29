import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hasMeaningfulUnreleasedContent,
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
