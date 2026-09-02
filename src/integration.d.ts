export type ForgeLoopRiskClass =
  | "READ_ONLY"
  | "LOOP_MUTATION"
  | "CLAIM_REACQUISITION"
  | "EXTERNAL_EXECUTION"
  | "AUTHORITY_MUTATION"
  | "EXTERNAL_STATE_ATTESTATION"
  | "MAINTENANCE"
  | "CLAIM_RELEASE_RECOVERY"
  | "LEGACY_MIGRATION"
  | "FORCE_DESTRUCTIVE";

export interface ForgeLoopCommandInput {
  [key: string]: unknown;
  path?: string;
  taskId?: string | null;
  json?: boolean;
  timeoutMs?: number | null;
  commandArgv?: string[];
}

export interface ForgeLoopCommandEnvelope<T = unknown> {
  ok: boolean;
  command: string | null;
  exitCode: number;
  result: T | null;
  error: { code: string; message: string; next?: string } | null;
  metadata: {
    protocolVersion: number;
    integrationApiVersion: number;
    packageVersion?: string;
  };
}

export interface ForgeLoopCommandDefinition {
  name: string;
  category: string;
  mutation: "READ_ONLY" | "MUTATING" | "EXTERNAL_EXECUTION";
  options: Readonly<Record<string, Record<string, unknown>>>;
  writes: readonly string[];
  removes: readonly string[];
  mayExecuteExternalProcess: boolean;
  description: string;
}

export interface ForgeLoopInvocationClassification {
  command: string;
  riskClass: ForgeLoopRiskClass;
  readOnly: boolean;
  mutatesProtocol: boolean;
  removesArtifacts: boolean;
  executesExternalProcess: boolean;
  affectsClaimAuthority: boolean;
  destructive: boolean;
  requiredCapability: string | null;
}

export interface ForgeLoopContext {
  authorityContext: Record<string, unknown>;
  verificationExecutionAdapter?: Record<string, unknown>;
  verificationExecutionPolicy?: { requiredIsolation: string };
  usageProvider?: ForgeLoopUsageProvider;
  structuralQualityProviders?: Readonly<Record<string, ForgeLoopStructuralQualityProvider | ForgeLoopStructuralQualityProviderFactory>>;
  advisoryContextProviders?: Readonly<Record<string, ForgeLoopAdvisoryContextProvider | ForgeLoopAdvisoryContextProviderFactory>>;
}

export interface ForgeLoopAdvisoryContextItem {
  title?: string;
  summary: string;
  sourceRef?: string;
  observedAt?: string;
  confidence?: number;
  itemFingerprint?: string;
}

export interface ForgeLoopAdvisoryContextRecallInput {
  projectPath: string;
  taskId: string;
  query: string;
  limit?: number;
  maxItemChars?: number;
  maxTotalChars?: number;
  timeoutMs?: number;
}

export interface ForgeLoopAdvisoryContextRecallOutput {
  items: Array<{
    title?: string;
    summary: string;
    sourceRef?: string;
    observedAt?: string;
    confidence?: number;
  }>;
}

export interface ForgeLoopAdvisoryContextProvider {
  id: string;
  version?: string;
  recall(input: ForgeLoopAdvisoryContextRecallInput): Promise<ForgeLoopAdvisoryContextRecallOutput> | ForgeLoopAdvisoryContextRecallOutput;
}

export type ForgeLoopAdvisoryContextProviderFactory = () => ForgeLoopAdvisoryContextProvider | Promise<ForgeLoopAdvisoryContextProvider>;

export interface ForgeLoopNormalizedAdvisoryContextResult {
  provider: {
    id: string;
    version?: string;
  };
  taskId: string | null;
  authority: "ADVISORY";
  evidenceAuthority: "NONE";
  actionability: "NON_EXECUTABLE";
  trustRole: "NON_EVIDENCE_ADVISORY_CONTEXT";
  persisted: false;
  items: readonly ForgeLoopAdvisoryContextItem[];
}

export interface ForgeLoopStructuralQualityProviderInput {
  projectPath: string;
  taskId: string;
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface ForgeLoopStructuralQualityProvider {
  id: string;
  detect(input: ForgeLoopStructuralQualityProviderInput): Promise<Record<string, unknown>> | Record<string, unknown>;
  scan(input: ForgeLoopStructuralQualityProviderInput): Promise<Record<string, unknown>> | Record<string, unknown>;
}

export type ForgeLoopStructuralQualityProviderFactory = (input: ForgeLoopStructuralQualityProviderInput) => ForgeLoopStructuralQualityProvider | Promise<ForgeLoopStructuralQualityProvider>;

export declare const STRUCTURAL_QUALITY_ROOT_CAUSES: readonly ["modularity", "acyclicity", "depth", "equality", "redundancy"];
export declare const STRUCTURAL_QUALITY_MODES: readonly ["off", "observe", "gate"];
export declare const STRUCTURAL_QUALITY_STATUSES: readonly ["PASS", "FAIL", "BLOCKED", "NOT_OBSERVED"];
export declare const STRUCTURAL_QUALITY_CHECK_ID: "structural-quality";
export declare const STRUCTURAL_QUALITY_REQUIREMENT: string;
export declare function assertStructuralQualityProvider(provider: unknown): ForgeLoopStructuralQualityProvider;
export declare function normalizeStructuralQualitySnapshot(input: unknown, options?: { projectPath?: string | null }): Record<string, unknown>;
export declare function normalizeStructuralQualityDetection(input?: Record<string, unknown>, defaults?: Record<string, unknown>): Record<string, unknown>;

export interface ForgeLoopUsageProvider {
  getTaskUsage(input: { projectPath: string; taskId: string }): Promise<ForgeLoopUsage | Record<string, unknown>> | ForgeLoopUsage | Record<string, unknown>;
}

export interface ForgeLoopUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  model: string | null;
  provider: string | null;
  source: "PROVIDER_REPORTED" | "HOST_REPORTED";
}

export interface ForgeLoopContextUsage {
  source: "HOST_REPORTED" | "UNKNOWN";
  profile: "light" | "balanced" | "full" | null;
  items: {
    taskContext: number | null;
    guides: number | null;
    history: number | null;
    protocolInstructions: number | null;
    repositoryContext: number | null;
    other: number | null;
  };
}

export declare const EXECUTION_PROFILES: readonly ["light", "balanced", "full"];
export declare const EXECUTION_PROFILE_REQUESTS: readonly ["auto", "light", "balanced", "full"];
export declare const LEGACY_EXECUTION_PROFILE: "balanced";
export declare function projectExecutionProfile(route?: Record<string, unknown> | null): "light" | "balanced" | "full" | null;
export declare function resolveExecutionProfile(input?: {
  routeInput?: Record<string, unknown>;
  contract?: Record<string, unknown> | null;
  taskDescriptor?: Record<string, unknown> | null;
  configuredProfile?: "auto" | "light" | "balanced" | "full";
  requestedProfile?: "auto" | "light" | "balanced" | "full" | null;
}): {
  requested: "auto" | "light" | "balanced" | "full";
  floor: "light" | "balanced" | "full";
  resolved: "light" | "balanced" | "full";
  reasons: readonly string[];
  escalated: boolean;
};

export interface ForgeLoopExecutionProfileContext {
  schemaVersion: 1;
  protocolVersion: 1;
  taskId: string;
  executionProfile: {
    requested: "auto" | "light" | "balanced" | "full";
    floor: "light" | "balanced" | "full";
    resolved: "light" | "balanced" | "full";
    reasons: readonly string[];
    escalated: boolean;
  };
  phase: string;
  nextAction: string | null;
  objective: string | null;
  deliverables: readonly string[];
  constraints: readonly string[];
  selectedGuideIds: readonly string[];
  verificationRequirements: readonly Record<string, unknown>[];
  contextPolicy: Record<string, unknown>;
  contextUsage?: ForgeLoopContextUsage;
  optionalContext: { available: readonly string[]; loaded: readonly string[] };
  invariants: Record<string, boolean>;
}

export declare const PROFILE_CONTEXT_POLICIES: Readonly<Record<string, Record<string, unknown>>>;
export declare function getExecutionProfileContextPolicy(profile: "light" | "balanced" | "full"): Record<string, unknown>;
export declare function legacyExecutionProfile(): ForgeLoopExecutionProfileContext["executionProfile"];
export declare function projectExecutionProfileContext(input: Record<string, unknown>): ForgeLoopExecutionProfileContext;
export declare function buildExecutionProfileContext(input: {
  target: string;
  packageRoot?: string;
  taskId: string;
  authorityContext?: Record<string, unknown>;
  runtimeContext?: Record<string, unknown>;
}): Promise<ForgeLoopExecutionProfileContext>;

export declare const FORGELOOP_INTEGRATION_API_VERSION: number;
export declare const FORGELOOP_INTEGRATION_RUNTIME_VERSION: number;
export declare const CLI_COMMAND_DEFINITIONS: Readonly<Record<string, ForgeLoopCommandDefinition>>;
export declare const INTEGRATION_LIMITS: Readonly<Record<string, number>>;
export declare const INTEGRATION_RISK_CLASSES: Readonly<Record<string, ForgeLoopRiskClass>>;
export declare const INTEGRATION_RESOURCE_DEFINITIONS: Readonly<Record<string, { scope: string; description: string }>>;
export declare const VERIFICATION_EXECUTION_POLICY_MODES: readonly string[];
export declare const VERIFICATION_ISOLATION_MODES: readonly string[];

export declare function getForgeLoopPackageVersion(): string;
export declare function defaultCommandInputValues(): ForgeLoopCommandInput;
export declare function validateForgeLoopCommandInput(input: {
  command: string;
  input?: ForgeLoopCommandInput;
  help?: boolean;
}): void;
export declare function executeForgeLoopCommand<T = unknown>(input: {
  command: string;
  projectPath?: string;
  input?: ForgeLoopCommandInput;
  authorityContext?: Record<string, unknown>;
  runtimeContext?: Record<string, unknown>;
}): Promise<ForgeLoopCommandEnvelope<T>>;
export declare function getForgeLoopCapabilities(input?: { packageVersion?: string | null }): Record<string, unknown>;
export declare function classifyForgeLoopInvocation(command: string, input?: ForgeLoopCommandInput): ForgeLoopInvocationClassification;
export declare function readForgeLoopIntegrationResource(uri: string, input?: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function resolveForgeLoopProjectRoot(projectPath?: string, input?: { cwd?: string }): Promise<string>;
export declare function createForgeLoopContext(input?: Record<string, unknown>): ForgeLoopContext;
