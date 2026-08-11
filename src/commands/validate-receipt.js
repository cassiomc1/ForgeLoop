import { assertSafePath, ensureWithin, readBytes } from "../core/filesystem.js";
import { validateReceipt } from "../core/receipt.js";
import { assertJsonBytes, assertJsonLimits } from "../core/json-safety.js";
import { ARTIFACT_PATHS } from "../core/artifacts.js";

export async function runValidateReceipt({ target, packageRoot, file }) {
  const relativeFile = file ?? ARTIFACT_PATHS.receipt;
  await assertSafePath(target, relativeFile);
  const receiptPath = ensureWithin(target, relativeFile);
  let receipt;
  try {
    const bytes = await readBytes(receiptPath);
    assertJsonBytes(bytes, relativeFile);
    receipt = JSON.parse(bytes.toString("utf8"));
    assertJsonLimits(receipt, relativeFile);
  } catch (error) {
    throw new Error(`Unable to parse receipt ${relativeFile}: ${error.message}`);
  }
  return validateReceipt(receipt, packageRoot);
}
