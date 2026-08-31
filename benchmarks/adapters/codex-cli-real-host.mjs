#!/usr/bin/env node

/*
 * A deliberately provider-specific benchmark adapter.
 *
 * ForgeLoop Core remains provider-neutral: this adapter is the host boundary
 * that invokes the locally authenticated Codex CLI, reads the canonical
 * task/context projection, runs an isolated workload, and records only the
 * usage fields the host actually reports. It is not imported by Core.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const codexBinary = process.env.FORGELOOP_BENCHMARK_CODEX_BIN || "codex";
const model = process.env.FORGELOOP_BENCHMARK_MODEL || "gpt-5.4-mini";
const reasoningEffort = process.env.FORGELOOP_BENCHMARK_REASONING || "low";
const qualityEvaluatorSpecifier = process.env.FORGELOOP_BENCHMARK_QUALITY_EVALUATOR || null;
const provider = "codex-chatgpt";
const environmentClass = `codex-cli-${process.platform}-${process.arch}`;
const canonicalCli = path.join(packageRoot, "src", "cli.js");
const canonicalIntegration = await import(pathToFileURL(path.join(packageRoot, "src", "integration.js")).href);
const canonicalUsage = await import(pathToFileURL(path.join(packageRoot, "src", "core", "usage.js")).href);
const canonicalEvents = await import(pathToFileURL(path.join(packageRoot, "src", "core", "events.js")).href);
const canonicalTempRoots = new Set();
const qualityTempRoots = new Set();

const WORKLOADS = {
  "documentation-correction": {
    files: {
      "README.md": "# Fixture notes\n\nPlease recieve the weekly status report.\n",
    },
    requirements: [
      "In README.md, replace the misspelling `recieve` with `receive`.",
      "Add a `## Usage` heading followed by the exact command `forgeloop protocol-info --json`.",
      "Do not change files other than README.md.",
    ],
    comparableSteps: 3,
    async verify(root) {
      const text = await readFile(path.join(root, "README.md"), "utf8");
      const checks = [
        text.includes("receive") && !text.includes("recieve"),
        /## Usage\s+[^\n]*\n+[^\n]*forgeloop protocol-info --json/u.test(text),
        text.includes("# Fixture notes"),
      ];
      return { pass: checks.every(Boolean), steps: checks.length };
    },
  },
  "static-landing-page": {
    files: {
      "index.html": "<!doctype html>\n<html lang=\"en\"><head><title>Placeholder</title></head><body><p>Replace this page.</p></body></html>\n",
      "styles.css": "body { margin: 0; }\n",
      "script.js": "// Add the required interaction.\n",
    },
    requirements: [
      "Build a local HTML5 landing page for `Orbit`, with a semantic header, main hero, feature section, and footer.",
      "The hero must contain an h1 with `Ship better work`, a link to `#features`, and a button with an accessible name.",
      "Use styles.css for a responsive layout with a CSS custom property and a media query.",
      "Use script.js to add a click listener that updates an element with id `status` to visible success text.",
      "Use only local files and do not add external URLs, dependencies, or services.",
    ],
    comparableSteps: 8,
    async verify(root) {
      const [html, css, js] = await Promise.all([
        readFile(path.join(root, "index.html"), "utf8"),
        readFile(path.join(root, "styles.css"), "utf8"),
        readFile(path.join(root, "script.js"), "utf8"),
      ]);
      const checks = [
        /<html[^>]+lang=["']en["']/iu.test(html),
        /<header[\s>]/iu.test(html) && /<main[\s>]/iu.test(html) && /<footer[\s>]/iu.test(html),
        /<h1[^>]*>[^<]*Ship better work/iu.test(html),
        /href=["']#features["']/iu.test(html),
        /<button\b[^>]*>/iu.test(html) && /aria-label|>[^<]+</iu.test(html),
        /--[a-z-]+\s*:/u.test(css) && /@media\b/iu.test(css),
        /addEventListener\s*\(\s*["']click["']/u.test(js),
        /status/u.test(js) && /textContent|classList|hidden/u.test(js),
      ];
      return { pass: checks.every(Boolean), steps: checks.length };
    },
  },
  "small-bug-fix": {
    files: {
      "discount.cjs": "function applyDiscount(cents, percent) {\n  if (!Number.isFinite(cents) || !Number.isFinite(percent)) throw new TypeError('invalid input');\n  return Math.round(cents * (1 - percent));\n}\nmodule.exports = { applyDiscount };\n",
    },
    requirements: [
      "Fix discount.cjs so `percent` is interpreted as a percentage from 0 through 100, not as a fraction.",
      "Preserve integer-cent rounding and reject non-finite inputs.",
      "For 10,000 cents and 15 percent, return exactly 8,500 cents.",
    ],
    comparableSteps: 4,
    async verify(root) {
      const script = "const { applyDiscount } = require('./discount.cjs'); if (applyDiscount(10000, 15) !== 8500) process.exit(1); if (applyDiscount(999, 10) !== 899) process.exit(1); let rejected = false; try { applyDiscount(NaN, 10); } catch { rejected = true; } if (!rejected) process.exit(1);";
      try {
        await execFileAsync(process.execPath, ["-e", script], { cwd: root, timeout: 30_000 });
        return { pass: true, steps: 3 };
      } catch {
        return { pass: false, steps: 3 };
      }
    },
  },
  "api-feature": {
    files: {
      "api.cjs": "function listWidgets(items, options = {}) {\n  return items;\n}\nmodule.exports = { listWidgets };\n",
    },
    requirements: [
      "Extend api.cjs listWidgets(items, options) with an optional exact status filter.",
      "Support an optional positive integer limit after filtering.",
      "Return a new array and leave the input array unchanged.",
    ],
    comparableSteps: 4,
    async verify(root) {
      const script = "const { listWidgets } = require('./api.cjs'); const input = [{ id: 1, status: 'active' }, { id: 2, status: 'paused' }, { id: 3, status: 'active' }]; const result = listWidgets(input, { status: 'active', limit: 1 }); if (result.length !== 1 || result[0].id !== 1) process.exit(1); if (input.length !== 3) process.exit(1); if (listWidgets(input).length !== 3) process.exit(1); if (listWidgets(input, { limit: 0 }).length !== 3) process.exit(1);";
      try {
        await execFileAsync(process.execPath, ["-e", script], { cwd: root, timeout: 30_000 });
        return { pass: true, steps: 4 };
      } catch {
        return { pass: false, steps: 4 };
      }
    },
  },
  "authentication-change": {
    files: {
      "auth.cjs": "function authorize(user, requiredRole) {\n  return true;\n}\nmodule.exports = { authorize };\n",
    },
    requirements: [
      "Make auth.cjs authorize fail closed when the user or required role is missing.",
      "Return true only when user.roles is an array containing the exact required role.",
      "Do not accept a role substring or grant access on malformed input.",
    ],
    comparableSteps: 5,
    async verify(root) {
      const script = "const { authorize } = require('./auth.cjs'); if (authorize({ roles: ['admin'] }, 'admin') !== true) process.exit(1); if (authorize({ roles: ['admin'] }, 'user') !== false) process.exit(1); if (authorize({ roles: ['administrator'] }, 'admin') !== false) process.exit(1); if (authorize(null, 'admin') !== false) process.exit(1); if (authorize({ roles: 'admin' }, 'admin') !== false) process.exit(1);";
      try {
        await execFileAsync(process.execPath, ["-e", script], { cwd: root, timeout: 30_000 });
        return { pass: true, steps: 5 };
      } catch {
        return { pass: false, steps: 5 };
      }
    },
  },
  "infrastructure-release": {
    files: {
      "release.json": "{\n  \"name\": \"fixture-service\",\n  \"version\": \"1.0.0\"\n}\n",
    },
    requirements: [
      "Update release.json version to exactly `1.7.0`.",
      "Add a boolean `dryRun` property set to true.",
      "Preserve the service name and do not add credentials, URLs, or publication commands.",
    ],
    comparableSteps: 4,
    async verify(root) {
      try {
        const value = JSON.parse(await readFile(path.join(root, "release.json"), "utf8"));
        const text = JSON.stringify(value);
        const checks = [
          value.version === "1.7.0",
          value.dryRun === true,
          value.name === "fixture-service",
          !/https?:\/\//iu.test(text) && !/token|password|secret/iu.test(text),
        ];
        return { pass: checks.every(Boolean), steps: checks.length };
      } catch {
        return { pass: false, steps: 4 };
      }
    },
  },
  "novatask-saas-landing-page": {
    files: {
      "index.html": "<!doctype html>\n<html lang=\"en\"><head><title>NovaTask</title></head><body><p>Replace this page.</p></body></html>\n",
      "styles.css": "body { margin: 0; }\n",
      "script.js": "// Add the required local interaction.\n",
    },
    requirements: [
      "Create a polished local NovaTask SaaS landing page using HTML5, CSS3, and vanilla JavaScript.",
      "Include a semantic navigation, a hero with the exact product name `NovaTask`, a features section with id `features`, a pricing section, a final call to action, and a footer.",
      "Add a mobile-friendly CSS media query, visible keyboard focus styling, and a prefers-reduced-motion rule.",
      "Add a local call-to-action interaction that updates an element with id `message` without navigating away.",
      "Use no external services, authentication, secrets, publication steps, dependencies, or external URLs.",
    ],
    comparableSteps: 11,
    async verify(root) {
      const [html, css, js] = await Promise.all([
        readFile(path.join(root, "index.html"), "utf8"),
        readFile(path.join(root, "styles.css"), "utf8"),
        readFile(path.join(root, "script.js"), "utf8"),
      ]);
      const checks = [
        /<html[^>]+lang=["']en["']/iu.test(html),
        /NovaTask/u.test(html),
        /<nav[\s>]/iu.test(html) && /<main[\s>]/iu.test(html) && /<footer[\s>]/iu.test(html),
        /id=["']features["']/iu.test(html),
        /pricing/iu.test(html) && /call to action|cta|start/iu.test(html),
        /@media\b/iu.test(css),
        /:focus-visible/iu.test(css),
        /prefers-reduced-motion/iu.test(css),
        /addEventListener\s*\(\s*["']click["']/u.test(js),
        /message/u.test(js) && /textContent|classList|hidden/u.test(js),
        !/https?:\/\//iu.test(`${html}\n${css}\n${js}`),
      ];
      return { pass: checks.every(Boolean), steps: checks.length };
    },
  },
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function workloadFor(scenario) {
  const workload = WORKLOADS[scenario.scenarioId];
  if (!workload) throw new Error(`No real-host workload is defined for ${scenario.scenarioId}`);
  return workload;
}

function taskSpecification(scenario, workload) {
  return {
    benchmarkVersion: scenario.benchmarkVersion,
    scenarioId: scenario.scenarioId,
    description: scenario.description,
    input: scenario.input,
    expectedProfile: scenario.expectedProfile,
    requirements: workload.requirements,
    initialFiles: Object.keys(workload.files).sort(),
  };
}

function routeArguments(input) {
  return [
    "--work", input.workType,
    ...input.surfaces.flatMap((value) => ["--surface", value]),
    ...input.risks.flatMap((value) => ["--risk", value]),
    ...input.platforms.flatMap((value) => ["--platform", value]),
    ...(input.behaviorChange ? ["--behavior-change"] : []),
    ...(input.executableChange ? ["--executable-change"] : []),
  ];
}

async function runCli(args, cwd) {
  try {
    return await execFileAsync(process.execPath, [canonicalCli, ...args], {
      cwd,
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch (error) {
    return { stdout: error.stdout ?? "", stderr: error.stderr ?? "", error };
  }
}

async function createCanonicalContext({ scenario, mode, runIndex }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "forgeloop-benchmark-canonical-"));
  canonicalTempRoots.add(root);
  await runCli(["init", "--path", root], root);
  const taskId = `benchmark-${scenario.scenarioId}-${mode}-${runIndex}`;
  const contractPath = path.join(root, "benchmark-contract.json");
  const contract = {
    schemaVersion: 1,
    protocolVersion: 1,
    taskId,
    objective: `Execute the deterministic ${scenario.scenarioId} benchmark fixture.`,
    deliverables: Object.keys(workloadFor(scenario).files),
    constraints: ["Use the isolated local fixture only.", "Do not use network access."],
    risks: [],
    verification: ["The hidden deterministic fixture verifier passes."],
    successCriteria: ["The hidden deterministic fixture verifier passes."],
    stopConditions: ["The isolated fixture is unavailable."],
    unresolvedDecisions: [],
    sourceRefs: [],
  };
  await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
  const taskResult = await runCli(["task-create", "--path", root, "--task", taskId, "--contract-file", "benchmark-contract.json", "--json"], root);
  if (taskResult.error) throw new Error(`canonical task-create failed: ${taskResult.stderr || taskResult.error.message}`);
  const requestedProfile = mode === "forgeloopBalanced" ? "balanced" : "auto";
  const routeResult = await runCli([
    "route", "--path", root, "--task", taskId, ...routeArguments(scenario.input), "--execution-profile", requestedProfile, "--json",
  ], root);
  if (routeResult.error) throw new Error(`canonical route failed: ${routeResult.stderr || routeResult.error.message}`);
  await runCli(["preflight", "--path", root, "--task", taskId, "--json"], root);
  const resource = await canonicalIntegration.readForgeLoopIntegrationResource("task/context", {
    projectPath: root,
    packageRoot,
    taskId,
  });
  return { root, taskId, context: resource.data };
}

function contextForPrompt(mode, context) {
  if (mode === "direct") return "No ForgeLoop context is supplied in direct mode.";
  if (mode === "forgeloopAdaptive") {
    return [
      "Canonical ForgeLoop task/context projection (consume executionProfile.resolved exactly):",
      JSON.stringify({
        taskId: context.taskId,
        executionProfile: context.executionProfile,
        phase: context.phase,
        nextAction: context.nextAction,
        objective: context.objective,
        deliverables: context.deliverables,
        constraints: context.constraints,
        selectedGuideIds: context.selectedGuideIds,
        verificationRequirements: context.verificationRequirements,
        contextPolicy: context.contextPolicy,
        optionalContext: context.optionalContext,
        invariants: context.invariants,
      }),
    ].join("\n");
  }
  return [
    "ForgeLoop balanced host context:",
    JSON.stringify(context),
    "The normal host presentation includes relevant route details, guide descriptions, current lifecycle state, and verification context. It does not authorize skipping any lifecycle phase or check.",
    "Relevant guide context: inspect the task files first, make the smallest coherent change, and run the local verification implied by the task.",
    "Historical context: the task may be resumed through canonical lifecycle state; unchanged information is retained only for comparison in this benchmark.",
  ].join("\n");
}

function promptFor({ scenario, workload, mode, context }) {
  const specification = taskSpecification(scenario, workload);
  return [
    "You are the implementation host for one isolated benchmark task.",
    "Work only inside the current directory. Never access parent directories, network services, credentials, or the shared ForgeLoop repository.",
    "Modify only the files needed by the task. Do not modify hidden verifier code because no verifier is present in this workspace.",
    "Read the existing files, implement every requirement exactly, and run any safe local checks you can perform before replying.",
    "Do not create commits or publish anything. Reply with DONE only after the task is implemented.",
    "",
    "Task specification (identical across benchmark modes):",
    JSON.stringify(specification, null, 2),
    "",
    contextForPrompt(mode, context),
  ].join("\n");
}

function parseUsage(stdout) {
  const events = stdout.split(/\r?\n/u).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  const completed = [...events].reverse().find((event) => event.type === "turn.completed" && event.usage);
  if (!completed) return null;
  const reported = completed.usage;
  const inputTokens = Number.isInteger(reported.input_tokens) ? reported.input_tokens : null;
  const outputTokens = Number.isInteger(reported.output_tokens) ? reported.output_tokens : null;
  const totalTokens = Number.isInteger(reported.total_tokens)
    ? reported.total_tokens
    : inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null;
  if (inputTokens === null || outputTokens === null || totalTokens === null) return null;
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens: Number.isInteger(reported.cached_input_tokens) ? reported.cached_input_tokens : null,
    cacheWriteTokens: Number.isInteger(reported.cache_write_input_tokens) ? reported.cache_write_input_tokens : null,
    totalTokens,
    costUsd: null,
    model,
    provider,
    source: "HOST_REPORTED",
  };
}

function runCodex(prompt, cwd) {
  return new Promise((resolve) => {
    const child = execFile(codexBinary, [
      "exec",
      "--ephemeral",
      "--skip-git-repo-check",
      "--sandbox", "workspace-write",
      "--ignore-user-config",
      "--ignore-rules",
      "--json",
      "-m", model,
      "-c", `model_reasoning_effort=${reasoningEffort}`,
      prompt,
    ], {
      cwd,
      timeout: 15 * 60_000,
      maxBuffer: 16 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      resolve({ stdout: stdout ?? "", stderr: stderr ?? "", error });
    });
    // Codex appends piped stdin when it is open, even when a prompt argument
    // is present. The benchmark has no stdin prompt, so close the pipe.
    child.stdin.end();
  });
}

async function recordCanonicalUsage({ context, usage }) {
  if (!context || !usage) return;
  await canonicalUsage.writeTaskUsage(context.root, packageRoot, {
    taskId: context.taskId,
    usage,
    recordedAt: new Date().toISOString(),
  }, { taskId: context.taskId, operation: "benchmark-host-usage" });
  await canonicalEvents.appendProtocolEvent(context.root, {
    taskId: context.taskId,
    event: "USAGE_RECORDED",
    details: {
      source: usage.source,
      fields: Object.keys(usage).filter((key) => usage[key] !== null && key !== "source").sort(),
      usageArtifact: `.forgeloop/task-state/${context.taskId}/usage.json`,
    },
  }, packageRoot, { taskId: context.taskId });
}

async function cleanupRoot(root) {
  if (!root) return;
  canonicalTempRoots.delete(root);
  qualityTempRoots.delete(root);
  await rm(root, { recursive: true, force: true });
}

function qualityEligible(scenario) {
  return scenario?.input?.surfaces?.includes("ui") === true;
}

function unknownQuality() {
  return {
    source: "UNKNOWN",
    scores: {
      visualQuality: null,
      responsiveQuality: null,
      accessibility: null,
      interactionPolish: null,
      requirementsCompleteness: null,
    },
  };
}

async function loadQualityEvaluator() {
  if (!qualityEvaluatorSpecifier) return null;
  const evaluatorPath = path.resolve(process.cwd(), qualityEvaluatorSpecifier);
  const evaluatorModule = await import(pathToFileURL(evaluatorPath).href);
  const evaluator = evaluatorModule.evaluateBlindVisualCandidates
    ?? evaluatorModule.default?.evaluateBlindVisualCandidates
    ?? evaluatorModule.default;
  if (!evaluator || typeof evaluator !== "function") {
    throw new Error("quality evaluator must export evaluateBlindVisualCandidates(input)");
  }
  return evaluator;
}

function assertQualityResults(results, candidateCount) {
  if (!Array.isArray(results) || results.length !== candidateCount) {
    throw new Error(`quality evaluator must return one result per candidate (${candidateCount})`);
  }
  return results.map((quality, index) => {
    if (!quality || quality.source !== "EXTERNAL_REPORTED" || !quality.scores || typeof quality.scores !== "object") {
      throw new Error(`quality evaluator returned an invalid result for candidate ${index + 1}`);
    }
    const scores = {};
    for (const field of ["visualQuality", "responsiveQuality", "accessibility", "interactionPolish", "requirementsCompleteness"]) {
      const score = quality.scores[field];
      if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 5) {
        throw new Error(`quality evaluator returned an invalid ${field} score for candidate ${index + 1}`);
      }
      scores[field] = score;
    }
    return { source: "EXTERNAL_REPORTED", scores };
  });
}

export async function runBenchmark({ scenario, mode, runIndex }) {
  const workload = workloadFor(scenario);
  const promptSpecFingerprint = sha256(JSON.stringify(taskSpecification(scenario, workload)));
  const workspace = await mkdtemp(path.join(os.tmpdir(), "forgeloop-benchmark-workspace-"));
  let canonical = null;
  let retainForQuality = false;
  try {
    for (const [filename, contents] of Object.entries(workload.files)) {
      await writeFile(path.join(workspace, filename), contents, "utf8");
    }
    if (mode !== "direct") canonical = await createCanonicalContext({ scenario, mode, runIndex });
    const prompt = promptFor({ scenario, workload, mode, context: canonical?.context ?? null });
    const codexResult = await runCodex(prompt, workspace);
    const usage = parseUsage(codexResult.stdout ?? "");
    let verification = { pass: false, steps: workload.comparableSteps };
    if (!codexResult.error && usage) verification = await workload.verify(workspace);
    if (canonical && usage) await recordCanonicalUsage({ context: canonical, usage });
    retainForQuality = qualityEvaluatorSpecifier !== null && qualityEligible(scenario);
    return {
      usage: usage ?? {},
      promptSpecFingerprint,
      verification: verification.pass ? "PASS" : "FAIL",
      verificationCycles: 1,
      comparableSteps: verification.steps,
      // Codex exposes aggregate prompt usage, not a trustworthy decomposition
      // into ForgeLoop context items. Keep this explicitly unknown.
      contextUsage: undefined,
      metadata: {
        model,
        provider,
        environmentClass,
        host: "codex-cli",
        workloadFingerprint: promptSpecFingerprint,
      },
      ...(retainForQuality ? { qualityWorkspace: workspace } : {}),
    };
  } finally {
    if (retainForQuality) qualityTempRoots.add(workspace);
    else await cleanupRoot(workspace);
    await cleanupRoot(canonical?.root);
  }
}

export async function finalizeBenchmark({ records }) {
  if (!qualityEvaluatorSpecifier) {
    return { qualityByRunId: {}, summary: { status: "NOT_CONFIGURED" } };
  }
  const evaluator = await loadQualityEvaluator();
  const qualityByRunId = {};
  const failures = [];
  const groups = new Map();
  for (const record of records) {
    if (!qualityEligible(record.scenario)) continue;
    const key = `${record.scenario.scenarioId}:${record.runIndex}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  let evaluatedGroups = 0;
  try {
    for (const group of groups.values()) {
      const ordered = ["direct", "forgeloopBalanced", "forgeloopAdaptive"]
        .map((mode) => group.find((record) => record.mode === mode));
      const scenario = group[0]?.scenario;
      if (!scenario || ordered.some((record) => !record?.response?.qualityWorkspace)) {
        failures.push("incomplete-ui-candidate-group");
        for (const record of ordered.filter(Boolean)) qualityByRunId[record.runId] = unknownQuality();
        continue;
      }
      try {
        const results = await evaluator({
          requirements: [...new Set(workloadFor(scenario).requirements)],
          candidates: ordered.map((record) => ({ workspace: record.response.qualityWorkspace })),
        });
        const qualities = assertQualityResults(results, ordered.length);
        ordered.forEach((record, index) => {
          qualityByRunId[record.runId] = qualities[index];
        });
        evaluatedGroups += 1;
      } catch (error) {
        failures.push(error.message);
        for (const record of ordered) qualityByRunId[record.runId] = unknownQuality();
      }
    }
  } finally {
    await Promise.all([...qualityTempRoots].map((root) => cleanupRoot(root)));
  }
  return {
    qualityByRunId,
    summary: {
      status: failures.length > 0 ? "PARTIAL" : "MEASURED",
      eligibleGroups: groups.size,
      evaluatedGroups,
      unknownGroups: failures.length,
      ...(failures.length > 0 ? { failures } : {}),
    },
  };
}

export async function cleanup() {
  await Promise.all([
    ...[...canonicalTempRoots].map((root) => cleanupRoot(root)),
    ...[...qualityTempRoots].map((root) => cleanupRoot(root)),
  ]);
}
