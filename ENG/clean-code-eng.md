# Clean Code for AI Agents

> Translation and adaptation of the tips from the article "Clean Code for AI Agents" by Fabio Akita (akitaonrails.com), organized as practical instructions to guide AI agents (Claude Code, Cursor, Copilot, etc.) to write higher-quality code.

> **Related documents**: for language-specific testing frameworks/tools, see `test-code-eng.md`. For security best practices, see `sec-code-eng.md`. For visual/UX guidelines, see `design-code-eng.md`. This file focuses on code quality and structure; it does not repeat the detailed content of the others.

> **Mandatory tooling**: if any tool, dependency, runtime, CLI or utility required to execute this guide (linter, formatter, test framework, scanner, profiler, engine, etc.) is not installed in the environment, **request its installation from the user immediately** (or install it with approval, per the environment's policy). No step, check or deliverable may be skipped, postponed or replaced because "the tool is not installed" — the task is only complete when all required checks have actually been executed.

## Context

In 2008, Robert C. Martin (Uncle Bob) published the book *Clean Code*, establishing that code should be written to be read by humans. In 2026, the primary "reader" of code became an AI agent. This changes the relative importance of several practices: some have become even more critical, others have changed in weight, and new requirements have emerged that Uncle Bob could not have anticipated.

## Real constraints of AI agents

- **File truncation**: agents read files in limited chunks (e.g., ~2000 lines at a time). Large files do not fit in a single read.
- **Attention degrades with context**: even with large context windows, information retrieval quality drops well before the technical limit.
- **Grep is cheaper than a complete read**: agents prefer searching for patterns (`rg`, `grep`) to loading entire files. Unique and specific names make this search effective.
- **Each tool call costs tokens**: short files, concise logs, and lean test output keep the agent productive and inexpensive.
- **Latency matters**: large files that are slow to process create noticeable friction during the session.
- **Visual inconsistency harms search**: mixed indentation, varied brace styles, etc. cost extra tokens for the agent to "understand" the mess.

## Ranking of practices (from most to least important)

### 1. Small functions and files
Functions should do **one thing only**, and do it well. Ideal size: 4 to 20 lines. Files should stay below 500 lines, ideally 200-300. This allows the agent to load the complete unit of meaning in a single tool call, avoiding truncation and fragmented reasoning.

### 2. Single Responsibility Principle (SRP)
Each module should have a single responsibility and a single reason to change. This allows the agent to isolate the code unit, run focused tests, and edit without fear of side effects. An 800-line class doing three things is worse than three 250-line classes.

### 3. Meaningful and unique names
Names should reveal intent and, above all, be **searchable**. Generic names (`data`, `process`, `handler`, `Manager`, `Service`) generate dozens of irrelevant search results. Distinct names (`UserRegistrationValidator`, `InvoiceLineItemTotal`) take the agent directly to the target. Rule of thumb: if a grep for the name returns many irrelevant results, the name is bad for the agent.

### 4. Comments with context and provenance
Unlike the original Clean Code, which viewed comments as a sign of bad code, AI agents **like and benefit from comments**. The agent already understands syntax perfectly, but does not know the "why": why this approach was chosen, which bug motivated this strange logic, which business constraint forces this specific order, or which issue/commit is related. Docstrings with intent and usage examples help greatly.
**Do not remove comments written by the agent itself** during reviews — they carry context that the agent itself will want to reread later. Only remove redundant and obvious comments (see item 13).

### 5. Explicit typing
Code with explicit types (TypeScript instead of plain JavaScript, type hints in Python, RBS in Ruby) gives the agent an immediate "answer key": what goes in, what comes out, and which states are valid. Dynamic code without annotations forces the agent to infer types from usage, which costs reasoning and generates errors.

### 6. DRY (Don't Repeat Yourself)
Duplication is worse for agents than for humans: when a change is needed, the agent may update one copy and forget the others, since there is no "natural gravity" of attention pulling it toward the scattered copies. Factoring repeated logic into a reusable function/module is safety for automated refactoring.

### 7. Tests the agent can run
Tests should follow F.I.R.S.T. (Fast, Independent, Repeatable, Self-validating, Timely) and, in addition, **run without manual intervention**: an execution command documented in the README/CLAUDE.md, output in a predictable format, without depending on manual database seeding or secret credentials outside the repository. TDD is no longer a philosophy and has become a technical requirement: the agent writes code, runs tests, reads the output, adjusts, and repeats. Without tests, the agent delivers plausible code that silently breaks things.

### 8. Predictable directory structure
Strong framework conventions (Rails, Django, Next.js, Laravel) help the agent anticipate file paths without having to list directories. Projects without conventions make the agent waste time exploring with `find`.

### 9. Dependency injection and testability
Code with injected dependencies (rather than instantiated internally) is easier to test in isolation. The agent can replace a real dependency with a fake in a test without touching the logic. Configuration isolation (e.g., centralizing the LLM model name in a single constant) prevents a simple change from requiring edits to dozens of files.

### 10. Avoid deep nesting
Each indentation level requires more attention from the model to track state. Prefer early returns, guard clauses, and flattened logic over `if` inside `for` inside `if` inside `try`.

### 11. Errors with context
Vague error messages (`"invalid input"`) force the agent to spend an extra round investigating the problem. Prefer detailed messages, including the received value and the expected format (e.g., `"invalid input: received {value}, expected a non-empty string of digits"`).

### 12. Formatting and style
Use the language's standard/most popular formatter (`cargo fmt`, `gofmt`, `prettier`, `black`/`ruff`, `rubocop -A`) and configure it to run automatically (pre-commit, on save). Do not waste time discussing style manually — let the tool decide.

### 13. Comments that describe the obvious
They are still bad, and now even worse: they cost tokens (money) without adding value. Avoid comments such as `// increment i by 1` above `i++`.

## What Uncle Bob could not have anticipated

- **Meta-documentation files for agents** (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, `.github/copilot-instructions.md`): read by the agent before any action, they should be short, direct, imperative, and action-focused — without philosophical prose.
- **README with high-level architecture**: simple diagrams (ASCII or Mermaid) help the agent quickly understand the shape of the project.
- **Structured logging**: JSON logs with named fields are much more useful to the agent than free-form text logs because they can be parsed and filtered easily.
- **Accessible observability commands**: `pnpm test`, `make lint`, `cargo check`, etc. — predictable commands that the agent can invoke to validate changes.
- **Idempotent setup scripts**: the agent needs to be able to run `bin/setup` or `scripts/bootstrap.sh` on a clean machine and reach a functional state without relying on someone's tacit knowledge.

## Debugging: increase the log before giving up

When a runtime error occurs or the user reports a bug and the root cause is not obvious from the available error/stack trace, the agent should not guess or try speculative fixes for no reason. The correct next step is to **temporarily increase the log/debug level in the relevant section of code** (e.g., change `LOG_LEVEL` to `debug`/`trace`, add targeted `console.log`/`print`/`logger.debug` calls for the variables and suspected flow, enable the tool's verbose mode), reproduce the error, read the output, and only then formulate a hypothesis about the cause. After identifying and fixing the root cause, remove the temporary logs added solely for investigation (keep only permanently useful structured logging).

This avoids two common failures of AI agents: (1) applying a plausible "fix" without confirming the real cause, creating rework; (2) giving up or asking the user for more information when the application itself could reveal the cause with more instrumentation.

## Instruction template to include in CLAUDE.md / AGENTS.md

No AI model follows these practices by default — they must be **explicitly instructed**. Use the template below as a starting point (adapt it to the language and project):

```
## Code style

- Functions: 4-20 lines. Split if larger.
- Files: fewer than 500 lines. Split by responsibility.
- One thing per function, one responsibility per module (SRP).
- Names: specific and unique. Avoid `data`, `handler`, `Manager`.
  Prefer names that return fewer than 5 grep results in the project.
- Types: explicit. No `any`, no generic `Dict`, no untyped functions.
- No code duplication. Extract shared logic into a function/module.
- Prefer early returns to nested ifs. Maximum of 2 indentation levels.
- Exception messages must include the problematic value and the expected format.

## Comments

- Keep the comments you write yourself — do not remove them during refactorings.
  They carry intent and context.
- Write the WHY, not the WHAT. Avoid `// increment the counter` above `i++`.
- Docstrings in public functions: intent + a usage example.
- Reference issue numbers / commits when a line exists because
  of a specific bug or external constraint.

## Tests

- See detailed framework/tool rules per language in `test-code-eng.md`.
- Minimum rule here: tests run with a single documented command, and every
  new function and every bug fix receives a corresponding test.

## Dependencies

- Inject dependencies via constructor/parameter, not via import/global.
- Encapsulate third-party libraries behind a thin interface owned by the project.

## Structure

- Follow the framework convention (Rails, Django, Next.js, etc.).
- Prefer small, focused modules over "god" files.
- Predictable paths: controller/model/view, src/lib/test, etc.

## Formatting

- Use the language's standard formatter (`cargo fmt`, `gofmt`, `prettier`,
  `black`, `rubocop -A`). Do not discuss style beyond this.

## Logging

- Structured JSON for debugging/observability logs.
- Plain text only for CLI output intended for the end user.

## Debugging

- If a runtime error or bug reported by the user has no clear root cause
  from the current log/stack trace, DO NOT guess the fix.
  First increase the log/debug level (log level env var, targeted prints/logger.debug
  calls for the variables and suspected flow, the tool's verbose mode),
  reproduce the error, read the output, and only then fix it.
- Remove temporary investigation logs after fixing the problem.
```

## Summary

Clean code was never a fad — it has become infrastructure. Most practices from the original Clean Code still apply, but some recommendations that used to be opinions ("a file should have N lines") have become measurable technical constraints ("a file with X lines makes the agent perform worse"). Those who write clean code with the agent in mind save money on tokens, session time, and reduce hallucinations in the output.

---

Original source: https://akitaonrails.com/en/2026/04/20/clean-code-for-ai-agents/
