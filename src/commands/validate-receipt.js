import { assertSafePath, ensureWithin, readBytes } from "../core/filesystem.js";
import { validateReceipt } from "../core/receipt.js";
import { assertJsonBytes, assertJsonLimits } from "../core/json-safety.js";

export async function runValidateReceipt({ target, packageRoot, file }) {
  if (!file) throw new Error("--file is required for validate-receipt");
  await assertSafePath(target, file);
  const receiptPath = ensureWithin(target, file);
  let receipt;
  try {
    const bytes = await readBytes(receiptPath);
    assertJsonBytes(bytes, file);
    receipt = JSON.parse(bytes.toString("utf8"));
    assertJsonLimits(receipt, file);
  } catch (error) {
    throw new Error(`Unable to parse receipt ${file}: ${error.message}`);
  }
  return validateReceipt(receipt, packageRoot);
}
