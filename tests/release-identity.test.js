import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { verifyReleaseIdentity } from "../scripts/verify_release_identity.mjs";

const releaseCommit = "0123456789abcdef0123456789abcdef01234567";

function metadataFor(bytes, overrides = {}) {
  return {
    version: "0.1.8",
    gitHead: releaseCommit,
    dist: {
      tarball: "https://registry.npmjs.org/@cassiomc1/forgeloop/-/forgeloop-0.1.8.tgz",
      shasum: createHash("sha1").update(bytes).digest("hex"),
      integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    },
    ...overrides,
  };
}

test("release identity returns RELEASE_IDENTITY_VALID only when every identity agrees", async () => {
  const bytes = Buffer.from("frozen release tarball bytes\n");
  const result = await verifyReleaseIdentity({
    packageJson: { name: "@cassiomc1/forgeloop", version: "0.1.8" },
    version: "0.1.8",
    releaseCommit,
    releasePackage: { name: "@cassiomc1/forgeloop", version: "0.1.8" },
    npmMetadata: metadataFor(bytes),
    tarballBytes: bytes,
    tagCommit: releaseCommit,
  });

  assert.equal(result.status, "RELEASE_IDENTITY_VALID");
  assert.equal(result.valid, true);
  assert.equal(result.releaseCommit, releaseCommit);
  assert.equal(result.githubTag, releaseCommit);
  assert.equal(result.checks.every((item) => item.ok), true);
});

test("release identity rejects a tag, gitHead, and digest mismatch", async () => {
  const bytes = Buffer.from("frozen release tarball bytes\n");
  const result = await verifyReleaseIdentity({
    packageJson: { name: "@cassiomc1/forgeloop", version: "0.1.8" },
    version: "0.1.8",
    releaseCommit,
    releasePackage: { name: "@cassiomc1/forgeloop", version: "0.1.8" },
    npmMetadata: metadataFor(bytes, {
      gitHead: "fedcba9876543210fedcba9876543210fedcba98",
      dist: {
        ...metadataFor(bytes).dist,
        shasum: "0000000000000000000000000000000000000000",
      },
    }),
    tarballBytes: bytes,
    tagCommit: "fedcba9876543210fedcba9876543210fedcba98",
  });

  assert.equal(result.status, "RELEASE_IDENTITY_INVALID");
  assert.equal(result.valid, false);
  assert.deepEqual(
    result.checks.filter((item) => !item.ok).map((item) => item.name),
    ["npm.gitHead", "github.tag", "npm.sha1"],
  );
});

test("release identity does not fetch or write when supplied frozen metadata", async () => {
  const bytes = Buffer.from("offline frozen release\n");
  let fetchCalled = false;
  const result = await verifyReleaseIdentity({
    packageJson: { name: "@cassiomc1/forgeloop", version: "0.1.8" },
    releaseCommit,
    releasePackage: { name: "@cassiomc1/forgeloop", version: "0.1.8" },
    npmMetadata: metadataFor(bytes),
    tarballBytes: bytes,
    tagCommit: releaseCommit,
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error("network must not be used");
    },
  });

  assert.equal(result.status, "RELEASE_IDENTITY_VALID");
  assert.equal(fetchCalled, false);
});

test("verify_release_identity.mjs CLI responds to --help and rejects invalid args", async () => {
  const { execFileSync } = await import("node:child_process");
  const scriptPath = "scripts/verify_release_identity.mjs";
  const helpOutput = execFileSync(process.execPath, [scriptPath, "--help"], { encoding: "utf8" });
  assert.match(helpOutput, /Usage: npm run release:identity/i);

  assert.throws(() => {
    execFileSync(process.execPath, [scriptPath, "--unknown-flag"], { encoding: "utf8", stdio: "pipe" });
  });
});
