/**
 * Input Schema Validation
 *
 * Validates candidate change requests prior to risk evaluation.
 * Returns structured validation errors for invalid or malformed requests.
 */

const ALLOWED_ENVIRONMENTS = new Set(["development", "dev", "staging", "stage", "production", "prod"]);
const ALLOWED_CHANGE_TYPES = new Set(["standard", "routine", "emergency", "experimental"]);

export function validateChangeRequest(input) {
  const errors = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      valid: false,
      errors: ["Input must be a non-null JSON object"],
    };
  }

  // serviceName (required string)
  if (typeof input.serviceName !== "string" || input.serviceName.trim().length === 0) {
    errors.push("Field 'serviceName' is required and must be a non-empty string");
  }

  // environment (required enum string)
  if (typeof input.environment !== "string" || !ALLOWED_ENVIRONMENTS.has(input.environment.toLowerCase())) {
    errors.push(`Field 'environment' is required and must be one of: ${Array.from(ALLOWED_ENVIRONMENTS).join(", ")}`);
  }

  // changeType (required enum string)
  if (typeof input.changeType !== "string" || !ALLOWED_CHANGE_TYPES.has(input.changeType.toLowerCase())) {
    errors.push(`Field 'changeType' is required and must be one of: ${Array.from(ALLOWED_CHANGE_TYPES).join(", ")}`);
  }

  // targetRegions (optional array of strings)
  if (input.targetRegions !== undefined) {
    if (!Array.isArray(input.targetRegions)) {
      errors.push("Field 'targetRegions', if provided, must be an array of strings");
    } else {
      for (let i = 0; i < input.targetRegions.length; i++) {
        if (typeof input.targetRegions[i] !== "string" || input.targetRegions[i].trim().length === 0) {
          errors.push(`Field 'targetRegions[${i}]' must be a non-empty string`);
        }
      }
    }
  }

  // boolean flags (optional booleans)
  const booleanFields = [
    "hasBreakingChange",
    "dataMigration",
    "rollbackPlan",
    "securityReviewCompleted",
    "maintenanceWindow",
    "automatedRollback",
  ];

  for (const field of booleanFields) {
    if (input[field] !== undefined && typeof input[field] !== "boolean") {
      errors.push(`Field '${field}', if provided, must be a boolean`);
    }
  }

  // canaryPercentage (optional number between 0 and 100)
  if (input.canaryPercentage !== undefined) {
    if (typeof input.canaryPercentage !== "number" || Number.isNaN(input.canaryPercentage) || input.canaryPercentage < 0 || input.canaryPercentage > 100) {
      errors.push("Field 'canaryPercentage', if provided, must be a number between 0 and 100");
    }
  }

  // serviceCategory (optional string)
  if (input.serviceCategory !== undefined && typeof input.serviceCategory !== "string") {
    errors.push("Field 'serviceCategory', if provided, must be a string");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
