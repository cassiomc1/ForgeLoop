import { accessSync, constants as fsConstants, lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import { assertJsonBytes, assertJsonLimits } from "./json-safety.js";

export const E_AUTHORITY_UNTRUSTED_SOURCE = "E_AUTHORITY_UNTRUSTED_SOURCE";
const E_AUTHORITY_INVALID = "E_AUTHORITY_INVALID";
const AUTHORITY_FILE_ENV = "FORGELOOP_AUTHORITY_FILE";
const AUTHORITY_DIR_ENV = "FORGELOOP_AUTHORITY_DIR";

function configuredValue(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function authoritySourceOptions(options = {}) {
  const explicitFile = configuredValue(options.trustedAuthorityFile);
  const explicitDir = configuredValue(options.trustedAuthorityDir);
  if (explicitFile) return { file: explicitFile, dir: null };
  if (explicitDir) return { file: null, dir: explicitDir };
  return {
    file: configuredValue(process.env[AUTHORITY_FILE_ENV]),
    dir: configuredValue(process.env[AUTHORITY_DIR_ENV]),
  };
}

export function trustedAuthorityConfiguration(options = {}) {
  const { file, dir } = authoritySourceOptions(options);
  return {
    trustedSourceConfigured: Boolean(file || dir),
    sourceType: file ? "external-file" : dir ? "external-dir" : null,
  };
}

function invalid(message) {
  return {
    trusted: false,
    error: { code: E_AUTHORITY_INVALID, message },
  };
}

function untrusted(message) {
  return {
    trusted: false,
    error: { code: E_AUTHORITY_UNTRUSTED_SOURCE, message },
  };
}

function authorityFileName(authorityRef) {
  if (typeof authorityRef !== "string" || authorityRef.trim() === "") return null;
  const ref = authorityRef.trim();
  if (ref === "." || ref === ".." || ref.includes("/") || ref.includes("\\")) return null;
  return ref.endsWith(".json") ? ref : `${ref}.json`;
}

function resolvedPath(candidate) {
  const absolute = path.resolve(candidate);
  const missingSegments = [];
  let current = absolute;
  while (true) {
    try {
      const existing = realpathSync(current);
      return path.resolve(existing, ...missingSegments);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) return absolute;
      missingSegments.unshift(path.basename(current));
      current = parent;
    }
  }
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === ""
    || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function isInsideTarget(target, candidate) {
  if (!target) return false;
  // Check both lexical paths and their real paths. The lexical check rejects
  // actor-created symlinks inside the target that point at an external file.
  return isWithin(path.resolve(target), path.resolve(candidate))
    || isWithin(resolvedPath(target), resolvedPath(candidate));
}

function readExternalJson(candidate, target, kind) {
  if (isInsideTarget(target, candidate)) {
    return untrusted(`Configured trusted authority ${kind} must be outside the actor-writable target`);
  }

  try {
    accessSync(candidate, fsConstants.R_OK);
    const info = lstatSync(candidate);
    if (kind === "file" && !info.isFile()) {
      return invalid("Configured trusted authority file is not a regular file");
    }
    if (kind === "directory" && !info.isDirectory()) {
      return invalid("Configured trusted authority directory is not a directory");
    }
    const bytes = readFileSync(candidate);
    assertJsonBytes(bytes, `trusted authority ${kind}`);
    const value = JSON.parse(bytes.toString("utf8"));
    assertJsonLimits(value, `trusted authority ${kind}`);
    return { value };
  } catch {
    return invalid(`Configured trusted authority ${kind} could not be read or parsed`);
  }
}

function grantsFromValue(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray(value.authorities)) {
    if (value.schemaVersion !== 1 || value.protocolVersion !== 1) return null;
    return value.authorities;
  }
  return value && typeof value === "object" ? [value] : null;
}

function findAuthority(value, authorityRef) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const keyedAuthority = value[authorityRef];
    if (keyedAuthority && typeof keyedAuthority === "object") return keyedAuthority;
  }
  const envelope = value && typeof value === "object" && !Array.isArray(value)
    && Array.isArray(value.authorities)
    ? value
    : null;
  const grants = grantsFromValue(value);
  if (!grants) return null;
  const authority = grants.find((item) => item?.authorityId === authorityRef || item?.id === authorityRef) ?? null;
  if (!authority || !envelope) return authority;
  return {
    ...authority,
    schemaVersion: envelope.schemaVersion,
    protocolVersion: envelope.protocolVersion,
  };
}

function findInMemoryAuthority(authorities, authority, authorityRef) {
  if (authority !== undefined) {
    return authority?.authorityId === authorityRef || authority?.id === authorityRef ? authority : null;
  }
  if (authorities !== undefined) {
    return findAuthority(authorities, authorityRef);
  }
  return undefined;
}

function resolveFromExternalFile(authorityRef, target, file) {
  const read = readExternalJson(file, target, "file");
  if (read.error) return read;
  const authority = findAuthority(read.value, authorityRef);
  return authority
    ? { trusted: true, authority, sourceType: "external-file" }
    : invalid(`Referenced installation authority '${authorityRef}' was not found in the trusted authority file`);
}

function resolveFromExternalDirectory(authorityRef, target, dir) {
  const fileName = authorityFileName(authorityRef);
  if (!fileName) return invalid("Installation authority reference must be a simple authority ID");
  if (isInsideTarget(target, dir)) {
    return untrusted("Configured trusted authority directory must be outside the actor-writable target");
  }
  try {
    accessSync(dir, fsConstants.R_OK);
    if (!lstatSync(dir).isDirectory()) {
      return invalid("Configured trusted authority directory is not a directory");
    }
  } catch {
    return invalid("Configured trusted authority directory could not be read");
  }
  const authorityPath = path.join(dir, fileName);
  const read = readExternalJson(authorityPath, target, "file");
  if (read.error) return read;
  const authority = findAuthority(read.value, authorityRef);
  return authority
    ? { trusted: true, authority, sourceType: "external-dir" }
    : invalid(`Referenced installation authority '${authorityRef}' does not match the trusted authority file`);
}

function projectLocalAuthorityExists(authorityRef, target) {
  const fileName = authorityFileName(authorityRef);
  if (!fileName || !target) return false;
  const localPath = path.join(target, ".forgeloop", "authorities", fileName);
  try {
    accessSync(localPath, fsConstants.F_OK);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    return true;
  }
}

export function resolveTrustedAuthority({
  authorityRef,
  target,
  trustedAuthorityFile,
  trustedAuthorityDir,
  authorities,
  authority,
} = {}) {
  const fileName = authorityFileName(authorityRef);
  if (!fileName) return invalid("Installation authority reference must be a simple authority ID");

  const sources = authoritySourceOptions({ trustedAuthorityFile, trustedAuthorityDir });
  if ((sources.file || sources.dir) && !target) {
    return untrusted("A target path is required to validate trusted authority provenance");
  }
  if (sources.file) return resolveFromExternalFile(authorityRef, target, sources.file);
  if (sources.dir) return resolveFromExternalDirectory(authorityRef, target, sources.dir);

  // In-memory authorities are a host-injected policy interface. They never
  // originate from project-local files and are intentionally resolved only
  // after the explicit external sources above.
  const inMemory = findInMemoryAuthority(authorities, authority, authorityRef);
  if (inMemory !== undefined) {
    return inMemory
      ? { trusted: true, authority: inMemory, sourceType: "in-memory" }
      : invalid(`Referenced installation authority '${authorityRef}' could not be resolved`);
  }

  if (projectLocalAuthorityExists(authorityRef, target)) {
    return untrusted("Project-local authority artifacts are references only and are not trusted authority sources");
  }
  return invalid(`Referenced installation authority '${authorityRef}' could not be resolved`);
}
