import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePortableText,
  assertPortableContextSafe,
  PortableContextError,
} from "../src/core/portable-context.js";
import { E_PORTABLE_CONTEXT_INVALID } from "../src/core/error-codes.js";

test("normalizes bounded portable text", () => {
  assert.equal(
    normalizePortableText("resume auth work", {
      label: "resumeNote",
      maxLength: 2000,
    }),
    "resume auth work",
  );
});

test("rejects non-string or empty text", () => {
  assert.throws(
    () => normalizePortableText("", { label: "note", maxLength: 100 }),
    (error) => error.code === E_PORTABLE_CONTEXT_INVALID,
  );
  assert.throws(
    () => normalizePortableText("   ", { label: "note", maxLength: 100 }),
    (error) => error.code === E_PORTABLE_CONTEXT_INVALID,
  );
  assert.throws(
    () => normalizePortableText(123, { label: "note", maxLength: 100 }),
    (error) => error.code === E_PORTABLE_CONTEXT_INVALID,
  );
});

test("handles optional text when null or undefined", () => {
  assert.equal(normalizePortableText(null, { label: "note", optional: true }), null);
  assert.equal(normalizePortableText(undefined, { label: "note", optional: true }), null);
  assert.throws(
    () => normalizePortableText(null, { label: "note", optional: false }),
    (error) => error.code === E_PORTABLE_CONTEXT_INVALID,
  );
  assert.throws(
    () => normalizePortableText(undefined, { label: "note", optional: false }),
    (error) => error.code === E_PORTABLE_CONTEXT_INVALID,
  );
});

test("rejects control characters", () => {
  assert.throws(
    () => normalizePortableText("hello\u0000world", {
      label: "resumeNote",
      maxLength: 2000,
    }),
    (error) => error.code === E_PORTABLE_CONTEXT_INVALID,
  );
  assert.throws(
    () => normalizePortableText("hello\x1bworld", {
      label: "resumeNote",
      maxLength: 2000,
    }),
    (error) => error.code === E_PORTABLE_CONTEXT_INVALID,
  );
});

test("rejects length overflow", () => {
  assert.throws(
    () => normalizePortableText("a".repeat(101), {
      label: "title",
      maxLength: 100,
    }),
    (error) => error.code === E_PORTABLE_CONTEXT_INVALID,
  );
});

test("accepts safe portable context object", () => {
  const safeObj = {
    title: "Authentication decision",
    summary: "Selected refresh token rotation",
  };
  assert.doesNotThrow(() => assertPortableContextSafe(safeObj));
});

test("rejects secret-like portable context", () => {
  assert.throws(
    () => assertPortableContextSafe({
      summary: "authorization: Bearer super-secret-value",
    }),
    (error) => error.code === E_PORTABLE_CONTEXT_INVALID,
  );
});

test("rejects oversized JSON structures via JSON limits", () => {
  assert.throws(
    () => assertPortableContextSafe({
      oversized: "a".repeat(100_001),
    }),
    (error) => error.code === E_PORTABLE_CONTEXT_INVALID,
  );
});
