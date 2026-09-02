// Read-only structural-quality projections live in the service so lifecycle,
// integration, and CLI consumers share one canonical source of truth.
export { projectStructuralQualityStatus } from "./service.js";
