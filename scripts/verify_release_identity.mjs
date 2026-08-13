#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(repositoryRoot, "package.json");
const DEFAULT_REGISTRY = "https://registry.npmjs.org";

function sha512Integrity(bytes) {
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
}

function check(name, expected, actual) {
  return { name, expected, actual, ok: expected === actual };
}

function assertReleaseCommit(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{40}$/.test(value)) {
    throw new Error("--release-commit must be a 40-character lowercase Git commit SHA");
  }
  return value;
}

function registryPackagePath(packageName) {
  return packageName.startsWith("@")
    ? packageName.replace("/", "%2f")
    : encodeURIComponent(packageName);
}

async function gitOutput(args, cwd = repositoryRoot) {
  const { stdout } = await execFileAsync("git", args, { cwd, encoding: "utf8" });
  return stdout.trim();
}

async function packageAtCommit(releaseCommit, cwd = repositoryRoot) {
  const raw = await gitOutput(["show", `${releaseCommit}:package.json`], cwd);
  return JSON.parse(raw);
}

async function remoteTagCommit(version, { remote = "origin", cwd = repositoryRoot } = {}) {
  const tag = `v${version}`;
  const output = await gitOutput(["ls-remote", "--tags", remote, `refs/tags/${tag}*`], cwd);
  const rows = output
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length === 2);
  const peeled = rows.find(([, ref]) => ref === `refs/tags/${tag}^{}`);
  const direct = rows.find(([, ref]) => ref === `refs/tags/${tag}`);
  return peeled?.[0] ?? direct?.[0] ?? null;
}

async function fetchNpmVersion(packageName, version, { fetchImpl = globalThis.fetch, registry = DEFAULT_REGISTRY } = {}) {
  const response = await fetchImpl(`${registry}/${registryPackagePath(packageName)}/${version}`);
  if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`);
  return response.json();
}

async function fetchTarball(url, { fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`npm tarball returned HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function verifyReleaseIdentity({
  packageJson,
  releasePackage,
  packageName = packageJson?.name,
  version = packageJson?.version,
  releaseCommit,
  npmMetadata,
  tarballBytes,
  tagCommit,
  fetchImpl = globalThis.fetch,
  registry = DEFAULT_REGISTRY,
  remote = "origin",
  cwd = repositoryRoot,
} = {}) {
  const commit = assertReleaseCommit(releaseCommit);
  const repositoryPackage = packageJson ?? { name: packageName, version };
  const publishedPackage = releasePackage ?? await packageAtCommit(commit, cwd);
  const targetVersion = version ?? repositoryPackage.version ?? publishedPackage.version;
  if (typeof packageName !== "string" || packageName.length === 0) throw new Error("package name is required");
  if (typeof targetVersion !== "string" || targetVersion.length === 0) throw new Error("package version is required");

  const npm = npmMetadata ?? await fetchNpmVersion(packageName, targetVersion, { fetchImpl, registry });
  const dist = npm.dist ?? {};
  const tarballUrl = dist.tarball ?? null;
  const bytes = tarballBytes ?? (tarballUrl ? await fetchTarball(tarballUrl, { fetchImpl }) : null);
  const computedSha1 = bytes ? createHash("sha1").update(bytes).digest("hex") : null;
  const computedIntegrity = bytes ? sha512Integrity(bytes) : null;
  const tag = tagCommit ?? await remoteTagCommit(targetVersion, { remote, cwd });

  const checks = [
    check("package.name", packageName, repositoryPackage.name),
    check("package.version", targetVersion, repositoryPackage.version),
    check("release.package.version", targetVersion, publishedPackage.version),
    check("npm.version", targetVersion, npm.version),
    check("npm.gitHead", commit, npm.gitHead),
    check("release.commit", commit, commit),
    check("github.tag", commit, tag),
    check("npm.tarball", true, Boolean(tarballUrl)),
    check("npm.sha1", dist.shasum ?? null, computedSha1),
    check("npm.sha512", dist.integrity ?? null, computedIntegrity),
  ];
  const valid = checks.every((item) => item.ok);
  return {
    status: valid ? "RELEASE_IDENTITY_VALID" : "RELEASE_IDENTITY_INVALID",
    valid,
    package: packageName,
    packageVersion: targetVersion,
    repositoryPackageVersion: repositoryPackage.version ?? null,
    releasePackageVersion: publishedPackage.version ?? null,
    npmVersion: npm.version ?? null,
    npmGitHead: npm.gitHead ?? null,
    releaseCommit: commit,
    githubTag: tag,
    tarballUrl,
    sha1: dist.shasum ?? null,
    sha512: dist.integrity ?? null,
    checks,
  };
}

function parseArgs(argv) {
  const options = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (["--version", "--release-commit", "--remote"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) throw new Error(`${argument} requires a value`);
      options[argument.slice(2).replaceAll("-", "_")] = value;
      index += 1;
    } else if (argument === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return options;
}

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: npm run release:identity -- --version X.Y.Z --release-commit <40-char-sha> [--json]");
  } else {
    try {
      const currentPackage = JSON.parse(await readFile(packagePath, "utf8"));
      const result = await verifyReleaseIdentity({
        packageJson: currentPackage,
        packageName: currentPackage.name,
        version: options.version,
        releaseCommit: options.release_commit,
        remote: options.remote ?? "origin",
      });
      console.log(options.json ? JSON.stringify(result, null, 2) : result.status);
      if (!result.valid) {
        for (const item of result.checks.filter((candidate) => !candidate.ok)) {
          console.error(`mismatch: ${item.name}: expected ${item.expected ?? "<missing>"}; received ${item.actual ?? "<missing>"}`);
        }
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(`RELEASE_IDENTITY_NOT_VERIFIED: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
