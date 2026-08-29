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
}

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

