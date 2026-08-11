import { activateSession } from "../core/activation.js";

export { activateSession };

export async function runActivate({ target, packageRoot }) {
  return activateSession(target, packageRoot);
}

export function formatActivateResult(result) {
  return `activated: ${result.activationMarker}\nsession: ${result.sessionId}\n`;
}
