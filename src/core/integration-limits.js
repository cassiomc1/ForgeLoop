/**
 * Bounded input limits for structured integrations. These bound the
 * transport-facing surface; canonical ForgeLoop JSON safety limits remain
 * authoritative for persisted artifacts. Values are conservative and
 * intentionally small for an agent-facing API.
 */
export const INTEGRATION_LIMITS = Object.freeze({
  /** Maximum length of any single string input (task IDs, names, text). */
  maxStringLength: 4096,
  /** Maximum number of entries in a repeatable string option. */
  maxRepeatedValues: 32,
  /** Maximum number of exact argv items passed to external execution. */
  maxArgvItems: 64,
  /** Maximum length of a single argv item. */
  maxArgvItemLength: 2048,
  /** Maximum serialized size of a JSON-object input field. */
  maxStructuredInputBytes: 256 * 1024,
  /** Maximum serialized size of any tool/resource response payload. */
  maxOutputBytes: 4 * 1024 * 1024,
});
