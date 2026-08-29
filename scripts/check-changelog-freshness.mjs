#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(args, cwd = repositoryRoot) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function latestReleaseTag(tags) {
  return tags
    .map((tag) => tag.trim())
    .filter((tag) => /^v?\d+\.\d+\.\d+$/u.test(tag))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true })).at(-1) ?? null;
}

export function unreleasedSection(changelog) {
  const heading = /^## Unreleased\s*$/imu.exec(changelog);
  if (!heading) return "";
  const rest = changelog.slice(heading.index + heading[0].length);
  const nextHeading = /^##\s/imu.exec(rest);
  return nextHeading ? rest.slice(0, nextHeading.index) : rest;
}

export function hasMeaningfulUnreleasedContent(section) {
  return section
    .replace(/<!--([\s\S]*?)-->/gu, "")
    .split("\n")
    .map((line) => line.trim())
    .some((line) => line && !/^No changes\.?$/iu.test(line));
}

export function checkChangelogFreshness({ changelog, tags = [], commitsSinceLatestTag = 0, allowEmpty = false } = {}) {
  const latestTag = latestReleaseTag(tags);
  const section = unreleasedSection(changelog);
  const hasChanges = commitsSinceLatestTag > 0;
  const populated = hasMeaningfulUnreleasedContent(section);
  const ok = allowEmpty || !hasChanges || populated;
  return { ok, latestTag, hasChanges, populated, section };
}

async function run() {
  const changelog = await readFile(path.join(repositoryRoot, "CHANGELOG.md"), "utf8");
  const tags = git(["tag", "--list"]).split("\n").filter(Boolean);
  const latestTag = latestReleaseTag(tags);
  const commitsSinceLatestTag = latestTag
    ? Number(git(["rev-list", "--count", `${latestTag}..HEAD`]))
    : Number(git(["rev-list", "--count", "HEAD"]));
  const result = checkChangelogFreshness({ changelog, tags, commitsSinceLatestTag, allowEmpty: process.argv.includes("--allow-empty") });
  if (!result.ok) {
    console.error(`CHANGELOG.md has changes since ${result.latestTag ?? "the initial commit"} but the Unreleased section is empty.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Changelog freshness valid: ${result.latestTag ?? "no release tag"}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await run();
  } catch (error) {
    console.error(`Changelog freshness check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
