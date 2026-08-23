import assert from "node:assert/strict";
import { test } from "node:test";

import {
  lstatWithTransientWindowsRetry,
  realpathWithTransientWindowsRetry,
} from "../src/core/filesystem.js";

test("Windows realpath retries transient EPERM before succeeding", async () => {
  let attempts = 0;
  const result = await realpathWithTransientWindowsRetry("C:\\repo\\.forgeloop\\locks\\task.lock", {
    platform: "win32",
    retryDelaysMs: [0, 0],
    realpathImpl: async (filePath) => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error("transient Windows sharing violation");
        error.code = "EPERM";
        throw error;
      }
      return filePath;
    },
  });

  assert.equal(result, "C:\\repo\\.forgeloop\\locks\\task.lock");
  assert.equal(attempts, 2);
});

test("realpath retry fails closed for persistent Windows EPERM", async () => {
  let attempts = 0;
  await assert.rejects(
    () => realpathWithTransientWindowsRetry("C:\\repo\\.forgeloop\\locks\\task.lock", {
      platform: "win32",
      retryDelaysMs: [0, 0],
      realpathImpl: async () => {
        attempts += 1;
        const error = new Error("persistent permission error");
        error.code = "EPERM";
        throw error;
      },
    }),
    (error) => error.code === "EPERM",
  );
  assert.equal(attempts, 3);
});

test("non-Windows realpath errors are not retried", async () => {
  let attempts = 0;
  await assert.rejects(
    () => realpathWithTransientWindowsRetry("/repo/.forgeloop/locks/task.lock", {
      platform: "linux",
      retryDelaysMs: [0, 0],
      realpathImpl: async () => {
        attempts += 1;
        const error = new Error("permission error");
        error.code = "EPERM";
        throw error;
      },
    }),
    (error) => error.code === "EPERM",
  );
  assert.equal(attempts, 1);
});

test("Windows lstat retries transient EPERM before succeeding", async () => {
  let attempts = 0;
  const result = await lstatWithTransientWindowsRetry("C:\\repo\\.forgeloop\\locks\\task.lock", {
    platform: "win32",
    retryDelaysMs: [0, 0],
    lstatImpl: async (filePath) => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error("transient Windows sharing violation");
        error.code = "EPERM";
        throw error;
      }
      return { isSymbolicLink: () => false, isDirectory: () => true };
    },
  });

  assert.equal(result.isDirectory(), true);
  assert.equal(attempts, 2);
});

test("lstat retry fails closed for persistent Windows EPERM", async () => {
  let attempts = 0;
  await assert.rejects(
    () => lstatWithTransientWindowsRetry("C:\\repo\\.forgeloop\\locks\\task.lock", {
      platform: "win32",
      retryDelaysMs: [0, 0],
      lstatImpl: async () => {
        attempts += 1;
        const error = new Error("persistent permission error");
        error.code = "EPERM";
        throw error;
      },
    }),
    (error) => error.code === "EPERM",
  );
  assert.equal(attempts, 3);
});

test("non-Windows lstat errors are not retried", async () => {
  let attempts = 0;
  await assert.rejects(
    () => lstatWithTransientWindowsRetry("/repo/.forgeloop/locks/task.lock", {
      platform: "linux",
      retryDelaysMs: [0, 0],
      lstatImpl: async () => {
        attempts += 1;
        const error = new Error("permission error");
        error.code = "EPERM";
        throw error;
      },
    }),
    (error) => error.code === "EPERM",
  );
  assert.equal(attempts, 1);
});
