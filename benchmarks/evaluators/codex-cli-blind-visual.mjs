#!/usr/bin/env node

/*
 * Independent visual-quality evaluator for the real-host benchmark.
 *
 * The implementation host never supplies its own quality scores. This module
 * renders anonymized candidate workspaces with an explicitly supplied,
 * already-installed Playwright runtime, then asks a separate read-only Codex
 * CLI process to score screenshots against the shared requirements.
 */

import { execFile } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const QUALITY_FIELDS = Object.freeze([
  "visualQuality",
  "responsiveQuality",
  "accessibility",
  "interactionPolish",
  "requirementsCompleteness",
]);
const CANDIDATE_LABELS = Object.freeze(["candidate-a", "candidate-b", "candidate-c"]);
const VIEWPORTS = Object.freeze([
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]);
const evaluatorBinary = process.env.FORGELOOP_BENCHMARK_EVALUATOR_BIN || "codex";
const evaluatorModel = process.env.FORGELOOP_BENCHMARK_EVALUATOR_MODEL || "gpt-5.4";
const evaluatorReasoning = process.env.FORGELOOP_BENCHMARK_EVALUATOR_REASONING || "low";

function evaluatorError(message) {
  const error = new Error(message);
  error.code = "E_BENCHMARK_QUALITY_EVALUATOR";
  return error;
}

function requireAbsolutePath(value, label) {
  if (!value || !path.isAbsolute(value)) throw evaluatorError(`${label} must be an absolute path`);
  return value;
}

async function loadPlaywright() {
  const root = requireAbsolutePath(
    process.env.FORGELOOP_BENCHMARK_PLAYWRIGHT_ROOT,
    "FORGELOOP_BENCHMARK_PLAYWRIGHT_ROOT",
  );
  const modulePath = path.join(root, "index.mjs");
  try {
    await access(modulePath);
  } catch {
    throw evaluatorError(`Playwright module is unavailable at ${modulePath}; no installation is attempted`);
  }
  const playwright = await import(pathToFileURL(modulePath).href);
  if (!playwright.chromium || typeof playwright.chromium.launch !== "function") {
    throw evaluatorError("the supplied Playwright runtime does not expose chromium.launch");
  }
  const executablePath = process.env.FORGELOOP_BENCHMARK_BROWSER
    ? requireAbsolutePath(process.env.FORGELOOP_BENCHMARK_BROWSER, "FORGELOOP_BENCHMARK_BROWSER")
    : playwright.chromium.executablePath();
  try {
    await access(executablePath);
  } catch {
    throw evaluatorError(`Chromium executable is unavailable at ${executablePath}; no installation is attempted`);
  }
  return { playwright, executablePath };
}

function deterministicCandidateOrder() {
  const order = [...CANDIDATE_LABELS];
  let state = 0x9e3779b9;
  for (let index = order.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state ^ (state >>> 16), 2246822519) + 3266489917) >>> 0;
    const swapIndex = state % (index + 1);
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  return order;
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const focusable = [...document.querySelectorAll(
      "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
    )].filter((element) => !element.disabled && element.getClientRects().length > 0);
    const focusTarget = focusable[0] ?? null;
    if (focusTarget) focusTarget.focus();
    const active = document.activeElement;
    const focusVisible = Boolean(active?.matches?.(":focus-visible"));
    return {
      horizontalOverflow: Math.max(root?.scrollWidth ?? 0, body?.scrollWidth ?? 0) > window.innerWidth,
      focusableCount: focusable.length,
      focusVisible,
      headingCount: document.querySelectorAll("h1, h2, h3, h4, h5, h6").length,
      landmarkCount: document.querySelectorAll("header, nav, main, footer, aside, section").length,
    };
  });
}

async function observeInteraction(page) {
  const target = page.locator("button, [role='button']").first();
  if (await target.count() === 0) return { attempted: false, updatedMessage: false };
  const message = page.locator("#message, #status").first();
  const before = await message.count() > 0 ? await message.textContent() : null;
  try {
    await target.click({ timeout: 5_000 });
  } catch {
    return { attempted: true, updatedMessage: false };
  }
  const after = await message.count() > 0 ? await message.textContent() : null;
  return { attempted: true, updatedMessage: before !== after };
}

async function renderCandidate({ browser, candidate, label, outputRoot }) {
  const screenshotPaths = [];
  const observations = [];
  const page = await browser.newPage();
  const blockedExternalRequests = [];
  await page.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    if (/^https?:\/\//iu.test(requestUrl)) {
      blockedExternalRequests.push(requestUrl);
      await route.abort();
      return;
    }
    await route.continue();
  });
  try {
    const entrypoint = path.join(candidate.workspace, "index.html");
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(pathToFileURL(entrypoint).href, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      const neutral = await inspectPage(page);
      const screenshotPath = path.join(outputRoot, `${label}-${viewport.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const interaction = await observeInteraction(page);
      screenshotPaths.push(screenshotPath);
      observations.push({
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        ...neutral,
        ...interaction,
      });
    }
  } finally {
    await page.close();
  }
  return {
    label,
    screenshotPaths,
    observations,
    blockedExternalRequestCount: blockedExternalRequests.length,
  };
}

function qualitySchema() {
  const scoreProperties = Object.fromEntries(QUALITY_FIELDS.map((field) => [field, {
    type: "number",
    minimum: 0,
    maximum: 5,
  }]));
  const candidateSchema = {
    type: "object",
    required: ["scores", "rationale"],
    additionalProperties: false,
    properties: {
      scores: {
        type: "object",
        required: QUALITY_FIELDS,
        additionalProperties: false,
        properties: scoreProperties,
      },
      rationale: { type: "string" },
    },
  };
  return {
    type: "object",
    required: ["candidates"],
    additionalProperties: false,
    properties: {
      candidates: {
        type: "object",
        required: CANDIDATE_LABELS,
        additionalProperties: false,
        properties: Object.fromEntries(CANDIDATE_LABELS.map((label) => [label, candidateSchema])),
      },
    },
  };
}

function evaluationPrompt({ requirements, renderedCandidates }) {
  const candidateObservations = renderedCandidates.map((candidate) => ({
    label: candidate.label,
    images: candidate.screenshotPaths.map((filename) => path.basename(filename)),
    neutralObservations: candidate.observations,
    blockedExternalRequestCount: candidate.blockedExternalRequestCount,
  }));
  return [
    "You are an independent blind visual evaluator for a local static web deliverable.",
    "Evaluate only the attached anonymized screenshots and the neutral observations below.",
    "Do not inspect source files, infer execution modes, use file paths as clues, or assume any candidate label has a preferred meaning.",
    "The three candidates were produced by separate runs of the same requirements; score each candidate independently.",
    "Use a 0 through 5 scale, where 0 is absent or unusable and 5 is excellent. Use one decimal place only when it improves precision.",
    "Return JSON only in the requested schema with one score object for each candidate and a short rationale.",
    "Score fields: visualQuality (visual hierarchy, typography, spacing, contrast, finish), responsiveQuality (desktop/mobile composition and overflow), accessibility (semantic structure, readable contrast, visible focus and usable controls), interactionPolish (clear feedback and coherent local interaction), requirementsCompleteness (visible fulfillment of the requirements).",
    "Requirements:",
    JSON.stringify(requirements, null, 2),
    "Neutral observations (not scores):",
    JSON.stringify(candidateObservations, null, 2),
  ].join("\n");
}

function parseJsonCandidate(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first < 0 || last <= first) throw evaluatorError("quality evaluator did not return JSON");
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      throw evaluatorError("quality evaluator returned malformed JSON");
    }
  }
}

function extractFinalMessage(stdout) {
  const messages = stdout.split(/\r?\n/u).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean).reverse();
  for (const event of messages) {
    if (event.type === "item.completed" && event.item?.type === "agent_message") {
      if (typeof event.item.text === "string") return event.item.text;
      const content = event.item.content?.find?.((item) => typeof item.text === "string");
      if (content?.text) return content.text;
    }
  }
  return null;
}

function validateEvaluation(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !value.candidates) {
    throw evaluatorError("quality evaluator response must contain candidates");
  }
  return CANDIDATE_LABELS.map((label) => {
    const entry = value.candidates[label];
    if (!entry || typeof entry !== "object" || !entry.scores || typeof entry.scores !== "object") {
      throw evaluatorError(`quality evaluator response is missing ${label}`);
    }
    const scores = {};
    for (const field of QUALITY_FIELDS) {
      const score = entry.scores[field];
      if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 5) {
        throw evaluatorError(`${label}.${field} must be a finite number from 0 through 5`);
      }
      scores[field] = score;
    }
    return { source: "EXTERNAL_REPORTED", scores };
  });
}

async function runEvaluator({ prompt, imagePaths, workingDirectory }) {
  const schemaPath = path.join(workingDirectory, "quality-evaluation.schema.json");
  const outputPath = path.join(workingDirectory, "quality-evaluation.json");
  await writeFile(schemaPath, `${JSON.stringify(qualitySchema(), null, 2)}\n`, "utf8");
  const args = [
    "exec",
    "--ephemeral",
    "--skip-git-repo-check",
    "--sandbox", "read-only",
    "--ignore-user-config",
    "--ignore-rules",
    "--json",
    "-m", evaluatorModel,
    "-c", `model_reasoning_effort=${evaluatorReasoning}`,
    "--output-schema", schemaPath,
    "--output-last-message", outputPath,
    prompt,
    ...imagePaths.flatMap((imagePath) => ["--image", imagePath]),
  ];
  const result = await new Promise((resolve, reject) => {
    const child = execFile(evaluatorBinary, args, {
      cwd: workingDirectory,
      timeout: 10 * 60_000,
      maxBuffer: 16 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout ?? "";
        error.stderr = stderr ?? "";
        reject(error);
        return;
      }
      resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
    });
    // A prompt is passed as an argument; leaving stdin open makes Codex wait
    // for an unintended appended prompt block.
    child.stdin.end();
  }).catch((error) => {
    const diagnostic = [error.stderr, error.stdout].filter(Boolean).join("\n").trim();
    throw evaluatorError(`blind evaluator process failed: ${diagnostic || error.message}`.trim());
  });
  let finalMessage;
  try {
    finalMessage = await readFile(outputPath, "utf8");
  } catch {
    finalMessage = extractFinalMessage(result.stdout ?? "");
  }
  if (typeof finalMessage !== "string" || finalMessage.trim() === "") {
    throw evaluatorError("blind evaluator produced no final message");
  }
  return validateEvaluation(parseJsonCandidate(finalMessage));
}

export async function evaluateBlindVisualCandidates({ requirements, candidates }) {
  if (!Array.isArray(candidates) || candidates.length !== CANDIDATE_LABELS.length) {
    throw evaluatorError("blind visual evaluation requires exactly three candidates");
  }
  if (!Array.isArray(requirements) || requirements.length === 0) {
    throw evaluatorError("blind visual evaluation requires non-empty requirements");
  }
  const { playwright, executablePath } = await loadPlaywright();
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "forgeloop-blind-quality-"));
  const labelOrder = deterministicCandidateOrder();
  const labeledCandidates = candidates.map((candidate, index) => ({
    ...candidate,
    label: labelOrder[index],
  }));
  try {
    await mkdir(temporaryRoot, { recursive: true });
    const browser = await playwright.chromium.launch({ headless: true, executablePath });
    try {
      const renderedCandidates = [];
      for (const candidate of labeledCandidates) {
        if (!candidate.workspace || !path.isAbsolute(candidate.workspace)) {
          throw evaluatorError("candidate workspace must be an absolute path");
        }
        renderedCandidates.push(await renderCandidate({
          browser,
          candidate,
          label: candidate.label,
          outputRoot: temporaryRoot,
        }));
      }
      const imagePaths = renderedCandidates
        .flatMap((candidate) => candidate.screenshotPaths)
        .sort((left, right) => path.basename(left).localeCompare(path.basename(right)));
      const scoresByLabel = await runEvaluator({
        prompt: evaluationPrompt({ requirements, renderedCandidates }),
        imagePaths,
        workingDirectory: temporaryRoot,
      });
      const byLabel = new Map(CANDIDATE_LABELS.map((label, index) => [label, scoresByLabel[index]]));
      return labeledCandidates.map((candidate) => byLabel.get(candidate.label));
    } finally {
      await browser.close();
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
