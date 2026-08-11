import { assertSafePath, ensureWithin, readBytes } from "../core/filesystem.js";
import { validateReceipt } from "../core/receipt.js";

export async function runValidateReceipt({ target, packageRoot, file }) {
  if (!file) throw new Error("--file is required for validate-receipt");
  await assertSafePath(target, file);
  const receiptPath = ensureWithin(target, file);
  let receipt;
  try {
    receipt = JSON.parse((await readBytes(receiptPath)).toString("utf8"));
  } catch (error) {
    throw new Error(`Unable to parse receipt ${file}: ${error.message}`);
  }
  return validateReceipt(receipt, packageRoot);
}
