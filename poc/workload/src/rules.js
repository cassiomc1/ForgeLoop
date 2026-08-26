/**
 * Deterministic Risk Evaluation Rules
 *
 * Defines the immutable rule set and scoring weights for change risk assessment.
 * Rules are evaluated in strict alphabetical order by rule ID to ensure determinism.
 */

export const RISK_RULES = Object.freeze([
  {
    id: "R001_MULTI_REGION_BLAST_RADIUS",
    name: "Multi-Region Deployment",
    category: "blast_radius",
    weight: 20,
    isMitigation: false,
    description: "Deployment targets multiple regions simultaneously, increasing potential blast radius.",
    evaluate: (payload) => Array.isArray(payload.targetRegions) && payload.targetRegions.length > 1,
  },
  {
    id: "R002_BREAKING_CHANGE",
    name: "Breaking API/Schema Change",
    category: "compatibility",
    weight: 30,
    isMitigation: false,
    description: "Change includes backward-incompatible interface or data schema modifications.",
    evaluate: (payload) => payload.hasBreakingChange === true,
  },
  {
    id: "R003_DATA_MIGRATION_NO_ROLLBACK",
    name: "Data Migration Without Automated Rollback",
    category: "persistence",
    weight: 35,
    isMitigation: false,
    description: "Database migration is specified without a verified automated rollback plan.",
    evaluate: (payload) => payload.dataMigration === true && payload.rollbackPlan !== true,
  },
  {
    id: "R004_SECURITY_REVIEW_PENDING",
    name: "Pending Security Review",
    category: "security",
    weight: 25,
    isMitigation: false,
    description: "Security review has not been completed or verified for this change.",
    evaluate: (payload) => payload.securityReviewCompleted !== true,
  },
  {
    id: "R005_OFF_HOURS_PRODUCTION_DEPLOYMENT",
    name: "Off-Hours Production Deployment",
    category: "operational",
    weight: 15,
    isMitigation: false,
    description: "Production change requested outside designated maintenance or standard deployment windows.",
    evaluate: (payload) => {
      const isProd = payload.environment === "production" || payload.environment === "prod";
      return isProd && payload.maintenanceWindow !== true;
    },
  },
  {
    id: "R006_HIGH_FREQUENCY_PAYMENT_PATH",
    name: "Critical Payment Path Surface",
    category: "criticality",
    weight: 25,
    isMitigation: false,
    description: "Service operates on critical financial or payment transaction pathways.",
    evaluate: (payload) => {
      const cat = typeof payload.serviceCategory === "string" ? payload.serviceCategory.toLowerCase() : "";
      return cat === "payments" || cat === "billing" || cat === "checkout";
    },
  },
  {
    id: "R007_MITIGATION_CANARY_CONFIGURED",
    name: "Canary Deployment Configured",
    category: "mitigation",
    weight: -15,
    isMitigation: true,
    description: "Canary release strategy configured with traffic percentage between 1% and 20%.",
    evaluate: (payload) => typeof payload.canaryPercentage === "number" && payload.canaryPercentage > 0 && payload.canaryPercentage <= 20,
  },
  {
    id: "R008_MITIGATION_AUTOMATED_ROLLBACK",
    name: "Automated Rollback Configured",
    category: "mitigation",
    weight: -15,
    isMitigation: true,
    description: "Health-metric bound automated rollback is active and verified.",
    evaluate: (payload) => payload.automatedRollback === true,
  },
]);
