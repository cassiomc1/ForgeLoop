# Public npm Framework Design

## Objective

Turn the Markdown instruction kit into a public, installable npm product without
changing its role as a portable instruction system. The first release provides
an `mdfiles` CLI with `init`, `doctor`, and `update` commands.

## Product boundary

The product is an agent-engineering kit and installer, not an application
runtime, remote prompt service, orchestrator, or project generator. The
canonical guides remain Markdown in `ENG/`; the existing Python validators stay
the source repository's quality checks.

## Distribution

Publish one public scoped package, `@cassiomc1/mdfiles`, with the binary name
`mdfiles`. A read-only npm registry check on 2026-08-09 returned 404 for this
name, so it is currently available pending the owner's npm scope permissions.
The package embeds the canonical guides and thin agent
adapters, so an invocation does not depend on downloading a second content
archive. The repository remains the source of truth and releases are tagged
with semantic versions.

Publishing is a later release gate, not part of the initial local implementation:
the package name must be confirmed, a rights inventory must distinguish
original material from third-party material, and the public license files must
be in place. The intended publishing path is GitHub Actions npm trusted
publishing with OIDC and provenance.

## CLI contract

### `mdfiles init [--path <directory>] [--dry-run]`

- Defaults to the current working directory.
- Creates the managed kit files only when they are absent.
- Creates `.mdfiles/manifest.json` with the package version, managed paths,
  content hashes, and preservation flags.
- Marks `PROJECT_PROFILE.md` as preserved after first creation.
- Never overwrites existing files and never installs dependencies.
- Returns a non-zero exit code only for invalid arguments or filesystem errors.

### `mdfiles doctor [--path <directory>] [--json]`

- Performs local-only checks for required canonical files, adapters, manifest
  validity, profile mode, and tracked file drift.
- Reports actionable findings without exposing file contents or secrets.
- Returns zero when the installed kit is healthy and non-zero when findings
  require attention.

### `mdfiles update [--path <directory>] [--dry-run]`

- Uses the templates embedded in the invoked npm package version.
- Reads the manifest and considers only files managed by this kit.
- Updates an existing file only when its current hash equals the last managed
  hash; otherwise reports a conflict and leaves the file untouched.
- Never overwrites `PROJECT_PROFILE.md`, local instructions, or unmanaged files.
- Adds newly introduced managed files when they are absent.
- Writes a new manifest only after all safe writes succeed.
- Returns non-zero when conflicts or filesystem errors remain.

## Internal structure

The package uses Node.js built-ins only at runtime and supports Node.js 20 or
newer. The release workflow uses Node.js 22.14 or newer and npm 11.5.1 or
newer, matching npm's current trusted-publishing requirements.

```text
src/
  cli.js
  commands/init.js
  commands/doctor.js
  commands/update.js
  core/manifest.js
  core/templates.js
  core/filesystem.js
tests/
  cli.test.js
```

The CLI resolves templates from the repository's canonical root files so the
guide collection is not duplicated into a second source tree. `package.json`
controls the published file allowlist and exposes the `mdfiles` binary.

## Safety and compatibility

- All file operations are confined to the requested target directory.
- Paths are normalized and rejected when they escape the target.
- Writes use temporary files followed by atomic replacement where supported.
- Dry runs report planned actions without changing files.
- Conflicts are explicit; there is no `--force` command in v1.
- The manifest is versioned and forward-compatible enough for future fields.
- Existing project-specific instructions always have precedence over kit
  defaults.

## Licensing

The proposed distribution separates software and content licensing:

- CLI and validator code: MIT, after rights confirmation.
- Original guides: CC BY 4.0, after rights confirmation.
- Adapted or externally sourced material: retain the applicable upstream terms
  and attribution in `THIRD_PARTY_NOTICES.md`.

No package is published until this inventory is complete. A public GitHub
repository alone does not grant the permissions required for redistribution.

## Verification

The feature must be covered by Node's built-in test runner for init, doctor,
update, dry-run behavior, conflict detection, profile preservation, path safety,
and manifest round-tripping. Existing Python validators, Markdown checks,
secret scanning, and a packed-package smoke test remain required regressions.
