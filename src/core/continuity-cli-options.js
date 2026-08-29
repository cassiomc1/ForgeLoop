const OPTION_FIELDS = Object.freeze({
  "--focus-id": ["continuityFocusId", false],
  "--focus-summary": ["continuityFocusSummary", false],
  "--remaining": ["continuityRemaining", true],
  "--known-issue": ["continuityKnownIssues", true],
  "--changed-area": ["continuityChangedAreas", true],
  "--inspect-first": ["continuityInspectFirst", true],
  "--resume-note": ["continuityResumeNote", false],
});

function continuityInputError(message) {
  const error = new Error(message);
  error.code = "E_CLI_INVOCATION_INVALID";
  return error;
}

export function continuityOptionDefaults() {
  return {
    continuityFocusId: null,
    continuityFocusSummary: null,
    continuityRemaining: [],
    continuityKnownIssues: [],
    continuityChangedAreas: [],
    continuityInspectFirst: [],
    continuityResumeNote: null,
  };
}

export function consumeContinuityOption({ argument, argv, index, options }) {
  const definition = OPTION_FIELDS[argument];
  if (!definition) return { handled: false, index };
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) throw continuityInputError(`${argument} requires a value`);
  const [field, repeatable] = definition;
  if (repeatable) options[field].push(value);
  else options[field] = value;
  return { handled: true, index: index + 1 };
}

export function hasContinuityOptions(options = {}) {
  return Boolean(
    options.continuityFocusId
    || options.continuityFocusSummary
    || options.continuityResumeNote
    || options.continuityRemaining?.length
    || options.continuityKnownIssues?.length
    || options.continuityChangedAreas?.length
    || options.continuityInspectFirst?.length
  );
}

export function validateContinuityOptions(command, options = {}) {
  if (command !== "record-continuity" && hasContinuityOptions(options)) {
    throw continuityInputError(`Continuity recording options are not valid for ${command}`);
  }
  if (command === "record-continuity") {
    const hasFocusId = Boolean(options.continuityFocusId);
    const hasFocusSummary = Boolean(options.continuityFocusSummary);
    if (hasFocusId !== hasFocusSummary) {
      throw continuityInputError("record-continuity requires --focus-id and --focus-summary together");
    }
  }
  return options;
}
