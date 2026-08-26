/**
 * Risk Evaluator CLI Integration Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const CLI_PATH = resolve("poc/workload/src/cli.js");

function runCliProcess(args, input = "") {
  try {
    const stdout = execFileSync(process.execPath, [CLI_PATH, ...args], {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { status: 0, stdout: stdout.trim(), stderr: "" };
  } catch (err) {
    return {
      status: err.status,
      stdout: err.stdout ? err.stdout.toString().trim() : "",
      stderr: err.stderr ? err.stderr.toString().trim() : "",
    };
  }
}

describe("CLI Flags & Input Handling", () => {
  it("prints version on --version", () => {
    const res = runCliProcess(["--version"]);
    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes("risk-eval v1.0.0"));
  });

  it("prints help on --help", () => {
    const res = runCliProcess(["--help"]);
    assert.equal(res.status, 0);
    assert.ok(res.stdout.includes("Usage:"));
    assert.ok(res.stdout.includes("--eval"));
  });

  it("evaluates valid inline JSON with --eval", () => {
    const payload = JSON.stringify({
      serviceName: "auth-api",
      environment: "production",
      changeType: "standard",
      securityReviewCompleted: true,
      maintenanceWindow: true,
    });

    const res = runCliProcess(["--eval", payload]);
    assert.equal(res.status, 0);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.serviceName, "auth-api");
    assert.equal(parsed.decision, "APPROVE");
  });

  it("evaluates file input via positional path", () => {
    const tmpFile = resolve("poc/workload/test/_tmp_request.json");
    try {
      writeFileSync(tmpFile, JSON.stringify({
        serviceName: "payment-db",
        environment: "staging",
        changeType: "emergency",
        securityReviewCompleted: true,
      }));

      const res = runCliProcess([tmpFile]);
      assert.equal(res.status, 0);
      const parsed = JSON.parse(res.stdout);
      assert.equal(parsed.serviceName, "payment-db");
      assert.equal(parsed.baseScore, 20);
    } finally {
      try {
        unlinkSync(tmpFile);
      } catch {}
    }
  });

  it("evaluates input from stdin", () => {
    const payload = JSON.stringify({
      serviceName: "catalog-service",
      environment: "production",
      changeType: "routine",
      securityReviewCompleted: true,
      maintenanceWindow: true,
    });

    const res = runCliProcess([], payload);
    assert.equal(res.status, 0);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.serviceName, "catalog-service");
    assert.equal(parsed.score, 0);
  });

  it("returns exit code 1 on empty input", () => {
    const res = runCliProcess([]);
    assert.equal(res.status, 1);
    const err = JSON.parse(res.stderr);
    assert.equal(err.error, "E_EMPTY_INPUT");
  });

  it("returns exit code 1 on malformed JSON", () => {
    const res = runCliProcess(["--eval", "{not-valid-json"]);
    assert.equal(res.status, 1);
    const err = JSON.parse(res.stderr);
    assert.equal(err.error, "E_JSON_PARSE_ERROR");
  });

  it("returns exit code 1 on schema validation failure", () => {
    const res = runCliProcess(["--eval", JSON.stringify({ invalid: true })]);
    assert.equal(res.status, 1);
    const err = JSON.parse(res.stderr);
    assert.equal(err.error, "E_INVALID_PAYLOAD");
    assert.ok(err.validationErrors.length > 0);
  });

  it("returns exit code 2 on --fail-on-reject when decision is REJECT", () => {
    const payload = JSON.stringify({
      serviceName: "core-payments",
      serviceCategory: "payments",
      environment: "production",
      changeType: "emergency",
      hasBreakingChange: true,
      dataMigration: true,
      rollbackPlan: false,
      securityReviewCompleted: false,
      maintenanceWindow: false,
    });

    const res = runCliProcess(["--eval", payload, "--fail-on-reject"]);
    assert.equal(res.status, 2);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.decision, "REJECT");
    assert.equal(parsed.tier, "CRITICAL");
  });
});
