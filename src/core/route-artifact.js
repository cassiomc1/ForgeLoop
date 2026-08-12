import { assertRouteInvariants } from "./router.js";
import { ARTIFACT_PATHS, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { readContract } from "./contract.js";

export async function persistRoute(target, route, packageRoot, options = {}) {
  assertRouteInvariants(route);
  let { contractFingerprint, ...writeOptions } = options;
  if (contractFingerprint === undefined) {
    try {
      contractFingerprint = (await readContract(target, packageRoot)).fingerprint;
    } catch (error) {
      if (error.code !== "ARTIFACT_MISSING") throw error;
    }
  }
  const value = contractFingerprint === undefined
    ? route
    : { ...route, contractFingerprint };
  assertRouteInvariants(value);
  return writeJsonArtifact(
    target,
    ARTIFACT_PATHS.route,
    value,
    "routing-result",
    packageRoot,
    writeOptions,
  );
}

export async function readPersistedRoute(target, packageRoot) {
  const artifact = await readJsonArtifact(target, ARTIFACT_PATHS.route, "routing-result", packageRoot);
  assertRouteInvariants(artifact.value);
  return artifact;
}
