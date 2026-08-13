import { assertRouteInvariants } from "./router.js";
import { ARTIFACT_PATHS, readJsonArtifact, writeJsonArtifact } from "./artifacts.js";
import { readContract } from "./contract.js";
import { ensureResumableState } from "./resumability.js";

export async function persistRoute(target, route, packageRoot, options = {}) {
  assertRouteInvariants(route);
  let { contractFingerprint, ...writeOptions } = options;
  let contractArtifact = null;
  if (contractFingerprint === undefined) {
    try {
      contractArtifact = await readContract(target, packageRoot);
      contractFingerprint = contractArtifact.fingerprint;
    } catch (error) {
      if (error.code !== "ARTIFACT_MISSING") throw error;
    }
  }
  const value = contractFingerprint === undefined
    ? route
    : { ...route, contractFingerprint };
  assertRouteInvariants(value);
  const artifact = await writeJsonArtifact(
    target,
    ARTIFACT_PATHS.route,
    value,
    "routing-result",
    packageRoot,
    writeOptions,
  );
  if (contractArtifact && contractArtifact.fingerprint === artifact.value.contractFingerprint) {
    await ensureResumableState({ target, packageRoot, contract: contractArtifact, route: artifact });
  }
  return artifact;
}

export async function readPersistedRoute(target, packageRoot) {
  const artifact = await readJsonArtifact(target, ARTIFACT_PATHS.route, "routing-result", packageRoot);
  assertRouteInvariants(artifact.value);
  return artifact;
}
