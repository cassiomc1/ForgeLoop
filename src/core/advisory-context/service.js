import path from "node:path";

import {
  normalizePortableText,
  assertPortableContextSafe,
} from "../portable-context.js";
import {
  ADVISORY_CONTEXT_LIMITS,
  normalizeAdvisoryRecallOptions,
} from "./constants.js";
import {
  normalizeAdvisoryContextResult,
  resolveAdvisoryContextProvider,
} from "./provider.js";
import {
  E_ADVISORY_CONTEXT_PROVIDER_INVALID,
  E_ADVISORY_CONTEXT_PROVIDER_UNAVAILABLE,
  E_ADVISORY_CONTEXT_QUERY_INVALID,
  E_ADVISORY_CONTEXT_TIMEOUT,
  E_PORTABLE_CONTEXT_INVALID,
} from "../error-codes.js";

function serviceError(code, message, cause) {
  const error = new Error(message, cause !== undefined ? { cause } : undefined);
  error.name = "AdvisoryContextServiceError";
  error.code = code;
  return error;
}

export async function recallAdvisoryContext({
  target,
  taskId,
  providerName,
  query,
  limit,
  maxItemChars,
  maxTotalChars,
  timeoutMs,
  runtimeContext,
} = {}) {
  if (!target || typeof target !== "string") {
    throw serviceError(
      E_ADVISORY_CONTEXT_PROVIDER_INVALID,
      "Target project path is required for advisory recall",
    );
  }

  if (!taskId || typeof taskId !== "string") {
    throw serviceError(
      E_ADVISORY_CONTEXT_PROVIDER_INVALID,
      "taskId is required for advisory recall",
    );
  }

  if (!providerName || typeof providerName !== "string") {
    throw serviceError(
      E_ADVISORY_CONTEXT_PROVIDER_INVALID,
      "providerName is required for advisory recall",
    );
  }

  let normalizedQuery;
  try {
    normalizedQuery = normalizePortableText(query, {
      label: "advisory query",
      maxLength: ADVISORY_CONTEXT_LIMITS.maxQueryChars,
    });
    assertPortableContextSafe(normalizedQuery, { label: "advisory query" });
  } catch (err) {
    if (err.code === E_PORTABLE_CONTEXT_INVALID) {
      throw err;
    }
    throw serviceError(
      E_ADVISORY_CONTEXT_QUERY_INVALID,
      `Advisory context query is invalid: ${err.message}`,
      err,
    );
  }

  const effectiveOptions = normalizeAdvisoryRecallOptions({
    limit,
    maxItemChars,
    maxTotalChars,
    timeoutMs,
  });

  let provider;
  try {
    provider = await resolveAdvisoryContextProvider({
      providers: runtimeContext?.advisoryContextProviders,
      providerName,
    });
  } catch (err) {
    throw serviceError(
      E_ADVISORY_CONTEXT_PROVIDER_INVALID,
      `Advisory context provider "${providerName}" failed validation: ${err.message}`,
      err,
    );
  }

  if (!provider) {
    throw serviceError(
      E_ADVISORY_CONTEXT_PROVIDER_UNAVAILABLE,
      `Advisory context provider "${providerName}" is not registered in runtime context`,
    );
  }

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(
        serviceError(
          E_ADVISORY_CONTEXT_TIMEOUT,
          `Advisory recall from provider "${providerName}" timed out after ${effectiveOptions.timeoutMs}ms`,
        ),
      );
    }, effectiveOptions.timeoutMs);
  });

  let rawResult;
  try {
    const recallPromise = Promise.resolve(
      provider.recall({
        projectPath: path.resolve(target),
        taskId,
        query: normalizedQuery,
        ...effectiveOptions,
      }),
    );
    rawResult = await Promise.race([recallPromise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }

  return normalizeAdvisoryContextResult(rawResult, {
    provider,
    taskId,
    ...effectiveOptions,
  });
}
