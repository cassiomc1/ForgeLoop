#!/usr/bin/env node
import path from "node:path";
import { compactTransactions } from "../src/core/transaction-maintenance.js";
const args = process.argv.slice(2);
const options = { target: process.cwd() };
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--apply") options.apply = true;
  else if (args[i] === "--path" && args[i + 1]) options.target = path.resolve(args[++i]);
  else if (args[i] === "--retain-days" && args[i + 1]) options.retainDays = Number(args[++i]);
  else throw new Error(`Unknown or incomplete option: ${args[i]}`);
}
console.log(JSON.stringify(await compactTransactions(options), null, 2));
