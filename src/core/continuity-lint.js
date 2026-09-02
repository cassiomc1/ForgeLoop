const PLACEHOLDER_PATTERN = /\b(TODO|TBD|FIXME|N\/A|placeholder)\b/i;
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
const UNSTRUCTURED_CLAIM_PATTERN = /\b(all tests pass|verified manually|looks good|tests passed|working now)\b/i;
const MAX_NOTE_LENGTH = 4000;

export function lintContinuity(continuity = {}) {
  const violations = [];

  if (!continuity || typeof continuity !== "object") {
    return { passed: true, violations };
  }

  // 1. Inspect decisions array
  if (Array.isArray(continuity.decisions)) {
    continuity.decisions.forEach((decision, index) => {
      const field = `decisions[${index}]`;
      if (typeof decision !== "string" || decision.trim() === "") {
        violations.push({
          ruleId: "EMPTY_DECISION",
          field,
          message: "Decision item is empty or whitespace-only",
        });
        return;
      }

      if (CONTROL_CHAR_PATTERN.test(decision)) {
        violations.push({
          ruleId: "CONTROL_CHARACTERS",
          field,
          message: "Decision contains unescaped ASCII control characters",
        });
      }

      if (PLACEHOLDER_PATTERN.test(decision)) {
        violations.push({
          ruleId: "PLACEHOLDER_TEXT",
          field,
          message: "Decision contains placeholder text (TODO, TBD, FIXME, N/A, placeholder)",
        });
      }
    });
  }

  // 2. Inspect notes and text fields
  const textFields = [];

  if (typeof continuity.resumeNote === "string") {
    textFields.push({ field: "resumeNote", text: continuity.resumeNote });
  }

  if (Array.isArray(continuity.notes)) {
    continuity.notes.forEach((note, index) => {
      if (typeof note === "string") {
        textFields.push({ field: `notes[${index}]`, text: note });
      }
    });
  }

  if (Array.isArray(continuity.recentNotes)) {
    continuity.recentNotes.forEach((note, index) => {
      if (typeof note === "string") {
        textFields.push({ field: `recentNotes[${index}]`, text: note });
      }
    });
  }

  if (typeof continuity.currentFocus?.summary === "string") {
    textFields.push({ field: "currentFocus.summary", text: continuity.currentFocus.summary });
  }

  if (Array.isArray(continuity.remainingWork)) {
    continuity.remainingWork.forEach((item, index) => {
      if (typeof item?.summary === "string") {
        textFields.push({ field: `remainingWork[${index}].summary`, text: item.summary });
      }
    });
  }

  if (Array.isArray(continuity.knownIssues)) {
    continuity.knownIssues.forEach((item, index) => {
      if (typeof item?.summary === "string") {
        textFields.push({ field: `knownIssues[${index}].summary`, text: item.summary });
      }
    });
  }

  for (const { field, text } of textFields) {
    if (text.length > MAX_NOTE_LENGTH) {
      violations.push({
        ruleId: "OVERSIZED_NOTE",
        field,
        message: `Note length ${text.length} exceeds maximum recommended limit of ${MAX_NOTE_LENGTH} characters`,
      });
    }

    if (CONTROL_CHAR_PATTERN.test(text)) {
      violations.push({
        ruleId: "CONTROL_CHARACTERS",
        field,
        message: "Note contains unescaped ASCII control characters",
      });
    }

    if (PLACEHOLDER_PATTERN.test(text)) {
      violations.push({
        ruleId: "PLACEHOLDER_TEXT",
        field,
        message: "Note contains placeholder text (TODO, TBD, FIXME, N/A, placeholder)",
      });
    }

    if (UNSTRUCTURED_CLAIM_PATTERN.test(text)) {
      violations.push({
        ruleId: "UNSTRUCTURED_EVIDENCE_CLAIM",
        field,
        message: "Note contains informal verification claim without structured evidence",
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
