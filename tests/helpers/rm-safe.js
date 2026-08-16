import { rm } from "node:fs/promises";

// Windows antivirus and indexing services can hold brief locks on files inside
// freshly created temp directories, surfacing EBUSY/EPERM during teardown.
// Centralized so retry tuning stays in one place instead of per test file.
const REMOVE_TREE_OPTIONS = Object.freeze({
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 100,
});

export async function removeTempTree(target) {
  await rm(target, REMOVE_TREE_OPTIONS);
}
