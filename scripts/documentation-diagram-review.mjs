#!/usr/bin/env node

export const REQUIRED_VISUAL_REVIEW_CHECKS = Object.freeze([
  "darkThemeLegible",
  "noOverlap",
  "labelsReadable",
  "trustBoundariesClear",
  "mobilePreviewAcceptable",
  "textFallbackEquivalent",
  "accessibleMetadataPresent",
]);

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function reviewError(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

function isSha256(value) {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validateDiagramReview(review, expected) {
  if (!review || review.version !== 1 || !expected || review.diagramId !== expected.diagramId) {
    throw reviewError("E_DIAGRAM_REVIEW_INVALID", "invalid review identity");
  }

  if (review.status !== "approved") {
    throw reviewError("E_DIAGRAM_REVIEW_NOT_APPROVED", "review is not approved");
  }

  if (!review.binding
    || !isSha256(review.binding.sourceSha256)
    || !isSha256(review.binding.svgSha256)
    || !isSha256(expected.sourceSha256)
    || !isSha256(expected.svgSha256)) {
    throw reviewError("E_DIAGRAM_REVIEW_INVALID", "invalid SHA-256 binding");
  }

  if (review.binding.sourceSha256 !== expected.sourceSha256) {
    throw reviewError("E_DIAGRAM_REVIEW_SOURCE_STALE", "approved source is stale");
  }

  if (review.binding.svgSha256 !== expected.svgSha256) {
    throw reviewError("E_DIAGRAM_REVIEW_SVG_STALE", "approved SVG is stale");
  }

  for (const check of REQUIRED_VISUAL_REVIEW_CHECKS) {
    if (review.checks?.[check] !== true) {
      throw reviewError("E_DIAGRAM_REVIEW_CHECK_INCOMPLETE", check);
    }
  }

  if (typeof review.reviewedBy !== "string" || review.reviewedBy.trim() === "") {
    throw reviewError("E_DIAGRAM_REVIEW_INVALID", "reviewedBy is required");
  }

  if (!isIsoDate(review.reviewedAt)) {
    throw reviewError("E_DIAGRAM_REVIEW_INVALID", "reviewedAt must use YYYY-MM-DD");
  }

  return review;
}
