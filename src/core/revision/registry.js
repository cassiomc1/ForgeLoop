import { createGitRevisionProvider } from "./git.js";

export const REVISION_PROVIDERS = Object.freeze({
  git: createGitRevisionProvider,
});
