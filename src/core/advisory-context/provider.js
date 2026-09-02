import { canonicalFingerprint } from "../artifacts.js";
import {
  normalizePortableText,
  assertPortableContextSafe,
  deepFreeze,
} from "../portable-context.js";
import {
  ADVISORY_CONTEXT_LIMITS,
  ADVISORY_CONTEXT_TRUST,
} from "./constants.js";
import {
  E_ADVISORY_CONTEXT_PROVIDER_INVALID,
  E_ADVISORY_CONTEXT_RESULT_INVALID,
  E_ADVISORY_CONTEXT_OUTPUT_LIMIT,
} from "../error-codes.js";

const PROVIDER_ID_REGEX = /^[a-z0-9][a-z0-9_-]*$/;

function providerError(code, message) {
  const error = new Error(message);
  error.name = "AdvisoryContextProviderError";
  error.code = code;
  return error;
}

export function assertAdvisoryContextProvider(provider) {
  if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
    throw providerError(
      E_ADVISORY_CONTEXT_PROVIDER_INVALID,
      "Advisory context provider must be an object",
    );
  }

  if (typeof provider.id !== "string" || !PROVIDER_ID_REGEX.test(provider.id)) {
    throw providerError(
      E_ADVISORY_CONTEXT_PROVIDER_INVALID,
      `Provider id must be a lowercase identifier matching ${PROVIDER_ID_REGEX}: received "${provider.id}"`,
    );
  }

  if (provider.version !== undefined && (typeof provider.version !== "string" || provider.version.trim() === "" || provider.version.length > 64)) {
    throw providerError(
      E_ADVISORY_CONTEXT_PROVIDER_INVALID,
      "Provider version must be a non-empty string under 64 characters when specified",
    );
  }

  if (typeof provider.recall !== "function") {
    throw providerError(
      E_ADVISORY_CONTEXT_PROVIDER_INVALID,
      `Provider "${provider.id}" must implement recall(input) function`,
    );
  }

  return provider;
}

export function createAdvisoryContextProviderRegistry({ providers = {} } = {}) {
  if (!providers || typeof providers !== "object" || Array.isArray(providers)) {
    throw providerError(
      E_ADVISORY_CONTEXT_PROVIDER_INVALID,
      "Advisory context providers registry must be an object map",
    );
  }

  const map = new Map();
  for (const [key, entry] of Object.entries(providers)) {
    if (!PROVIDER_ID_REGEX.test(key)) {
      throw providerError(
        E_ADVISORY_CONTEXT_PROVIDER_INVALID,
        `Invalid provider key "${key}" in registry`,
      );
    }
    if (typeof entry === "function") {
      map.set(key, entry);
    } else {
      assertAdvisoryContextProvider(entry);
      if (entry.id !== key) {
        throw providerError(
          E_ADVISORY_CONTEXT_PROVIDER_INVALID,
          `Provider id "${entry.id}" does not match registry key "${key}"`,
        );
      }
      map.set(key, entry);
    }
  }

  return Object.freeze({
    get(id) {
      return map.get(id) ?? null;
    },
    has(id) {
      return map.has(id);
    },
    list() {
      return [...map.keys()].sort();
    },
  });
}

export function normalizeAdvisoryContextResult(raw, {
  provider,
  taskId,
  limit = ADVISORY_CONTEXT_LIMITS.defaultItems,
  maxItemChars = ADVISORY_CONTEXT_LIMITS.defaultMaxItemChars,
  maxTotalChars = ADVISORY_CONTEXT_LIMITS.defaultMaxTotalChars,
} = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw providerError(
      E_ADVISORY_CONTEXT_RESULT_INVALID,
      "Advisory context result must be a JSON object",
    );
  }

  assertPortableContextSafe(raw, { label: "advisory context raw result" });

  if (!Array.isArray(raw.items)) {
    throw providerError(
      E_ADVISORY_CONTEXT_RESULT_INVALID,
      "Advisory context result items must be an array",
    );
  }

  const effectiveLimit = Math.min(
    Math.max(1, limit ?? ADVISORY_CONTEXT_LIMITS.defaultItems),
    ADVISORY_CONTEXT_LIMITS.maxItems,
  );
  const effectiveMaxItemChars = Math.min(
    Math.max(100, maxItemChars ?? ADVISORY_CONTEXT_LIMITS.defaultMaxItemChars),
    ADVISORY_CONTEXT_LIMITS.maxItemChars,
  );
  const effectiveMaxTotalChars = Math.min(
    Math.max(500, maxTotalChars ?? ADVISORY_CONTEXT_LIMITS.defaultMaxTotalChars),
    ADVISORY_CONTEXT_LIMITS.maxTotalChars,
  );

  const selectedItems = raw.items.slice(0, effectiveLimit);
  let totalChars = 0;
  const normalizedItems = [];

  for (let i = 0; i < selectedItems.length; i += 1) {
    const item = selectedItems[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw providerError(
        E_ADVISORY_CONTEXT_RESULT_INVALID,
        `Item at index ${i} must be an object`,
      );
    }

    if (item.summary === undefined || item.summary === null) {
      throw providerError(
        E_ADVISORY_CONTEXT_RESULT_INVALID,
        `Item at index ${i} requires a non-empty summary`,
      );
    }

    let summary;
    try {
      summary = normalizePortableText(item.summary, {
        label: `items[${i}].summary`,
        maxLength: effectiveMaxItemChars,
      });
    } catch (err) {
      throw providerError(E_ADVISORY_CONTEXT_RESULT_INVALID, err.message);
    }

    let title;
    if (item.title !== undefined && item.title !== null) {
      try {
        title = normalizePortableText(item.title, {
          label: `items[${i}].title`,
          maxLength: ADVISORY_CONTEXT_LIMITS.maxTitleChars,
          optional: true,
        });
      } catch (err) {
        throw providerError(E_ADVISORY_CONTEXT_RESULT_INVALID, err.message);
      }
    }

    let sourceRef;
    if (item.sourceRef !== undefined && item.sourceRef !== null) {
      try {
        sourceRef = normalizePortableText(item.sourceRef, {
          label: `items[${i}].sourceRef`,
          maxLength: ADVISORY_CONTEXT_LIMITS.maxSourceRefChars,
          optional: true,
        });
      } catch (err) {
        throw providerError(E_ADVISORY_CONTEXT_RESULT_INVALID, err.message);
      }
    }

    let observedAt;
    if (item.observedAt !== undefined && item.observedAt !== null) {
      try {
        observedAt = normalizePortableText(item.observedAt, {
          label: `items[${i}].observedAt`,
          maxLength: 128,
          optional: true,
        });
      } catch (err) {
        throw providerError(E_ADVISORY_CONTEXT_RESULT_INVALID, err.message);
      }
    }

    let confidence;
    if (item.confidence !== undefined && item.confidence !== null) {
      if (
        typeof item.confidence !== "number"
        || !Number.isFinite(item.confidence)
        || item.confidence < 0
        || item.confidence > 1
      ) {
        throw providerError(
          E_ADVISORY_CONTEXT_RESULT_INVALID,
          `Item at index ${i} confidence must be a finite number between 0 and 1`,
        );
      }
      confidence = item.confidence;
    }

    const itemCharLength =
      (title?.length ?? 0)
      + summary.length
      + (sourceRef?.length ?? 0)
      + (observedAt?.length ?? 0);

    totalChars += itemCharLength;
    if (totalChars > effectiveMaxTotalChars) {
      throw providerError(
        E_ADVISORY_CONTEXT_OUTPUT_LIMIT,
        `Advisory context output exceeded the total character limit of ${effectiveMaxTotalChars} (accumulated ${totalChars})`,
      );
    }

    const cleanItem = {
      ...(title ? { title } : {}),
      summary,
      ...(sourceRef ? { sourceRef } : {}),
      ...(observedAt ? { observedAt } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
    };

    const itemFingerprint = canonicalFingerprint(cleanItem);
    cleanItem.itemFingerprint = itemFingerprint;
    normalizedItems.push(Object.freeze(cleanItem));
  }

  const normalized = {
    provider: {
      id: provider?.id ?? "unknown",
      ...(provider?.version ? { version: provider.version } : {}),
    },
    taskId: taskId ?? null,
    authority: ADVISORY_CONTEXT_TRUST.authority,
    evidenceAuthority: ADVISORY_CONTEXT_TRUST.evidenceAuthority,
    actionability: ADVISORY_CONTEXT_TRUST.actionability,
    trustRole: ADVISORY_CONTEXT_TRUST.trustRole,
    persisted: ADVISORY_CONTEXT_TRUST.persisted,
    items: Object.freeze(normalizedItems),
  };

  assertPortableContextSafe(normalized, { label: "advisory context normalized result" });
  return deepFreeze(normalized);
}
