---
name: test-code-eng
language: en
counterpart: ../PT-BR/test-code-pt.md
description: "Risk-based testing strategy and tools for modern languages and platforms."
version: "2026.08"
last-reviewed: "2026-08-08"
---

# Recommended Testing Guide by Language and Technology

> Practical software testing instructions (unit, integration, end-to-end) for the main languages and technologies used in modern development. Use this document as a reference to guide AI agents and developers on which tools to use and testing best practices for each stack.

> **Related documents**: for general clean code principles (names, small functions, formatting), see [`clean-code-eng.md`](./clean-code-eng.md). For security (including security testing/SAST/DAST), see [`sec-code-eng.md`](./sec-code-eng.md). For HTML video and motion, see [HyperFrames](https://hyperframes.heygen.com). This file is the canonical reference for which testing framework to use by language/platform.

> **Tooling policy**: identify the stack, the stage, and the applicable checks; prefer an already available equivalent that produces compatible evidence. Ask for authorization before installing a tool or changing the environment. If no safe equivalent exists, record the required check as blocked and never claim that it passed. Do not install merely optional resources.

## General principles (valid for any language)

- **Testing pyramid**: many unit tests (fast and inexpensive), fewer integration tests, and few end-to-end (E2E) tests (slow and expensive).
- **F.I.R.S.T**: tests should be **Fast**, **Independent** (independent from one another), **Repeatable** (repeatable in any environment), **Self-validating** (automatically return pass/fail, without manual inspection), and **Timely** (written on time, ideally alongside the code or before it — TDD).
- **Code coverage**: use it as an indicator, not as an absolute goal. Prioritize covering critical business rules (ideally 80%+ overall, 90-95%+ in business logic) instead of pursuing 100%.
- **Regression tests**: every bug fix should be accompanied by a test that proves the failure before the fix and the validation afterward.
- **Clear naming**: test names should describe the scenario and the expected result (e.g., `should_return_error_when_email_is_invalid`, `should_return_404_when_user_not_found`).
- **Isolation of external dependencies**: use mocks, stubs, fakes, or test doubles for databases, external APIs, queues, the filesystem, the system clock, etc., in unit tests. Integration tests may use real dependencies (ideally in disposable containers, e.g. Testcontainers).
- **CI required**: every test must run automatically in a CI pipeline (GitHub Actions, GitLab CI, Azure DevOps, CircleCI, etc.) on every push/PR.
- **Deterministic tests**: avoid `sleep`, dependence on system time, execution order, or uncontrolled random data (use fixed seeds).

---

## JavaScript / TypeScript (Node.js and Frontend)

### Unit and integration tests
- **Vitest** — currently the most recommended option for new projects (fast, compatible with Vite, API similar to Jest, native TypeScript, efficient watch mode).
- **Jest** — still widely used and mature, but losing ground to Vitest in new projects. A good choice for legacy projects or projects based on Create React App / older Next.js versions.
- **node:test** — Node.js's native runner (since Node 18+), with no external dependencies; a good option for simple libraries that want zero testing dependencies.

### End-to-end (E2E) and UI tests
- **Playwright** — current recommendation for E2E (Chromium, Firefox, WebKit), with better community satisfaction and reliability. Supports auto-wait, trace viewer, and parallel tests.
- **Cypress** — mature alternative with good DX, but with declining adoption compared to Playwright.
- **Testing Library** (`@testing-library/react`, `@testing-library/vue`, etc.) — for component tests focused on user behavior, not implementation details.

### Best practices
- Use `describe`/`it` with descriptive names.
- Separate unit tests (`*.test.ts`/`*.spec.ts` alongside the code) from E2E tests (the `e2e/` or `tests/e2e` directory).
- Configure coverage with `--coverage` (Vitest/Jest use Istanbul/v8 coverage).
- Mock HTTP calls with `msw` (Mock Service Worker) instead of mocking `fetch`/`axios` directly.
- Lint tests with ESLint (`eslint-plugin-jest`/`eslint-plugin-vitest`).
- Run `npm run format` (Prettier, generally configured through `package.json`) before committing/in CI, to ensure consistent formatting of the code and the test files themselves.
- Run `npm run lint` and `npm run format -- --check` (or `prettier --check`) in CI to fail the build if the code is not correctly formatted/linted, without relying on the developer to run it locally.

---

## Python

### Unit and integration tests
- **pytest** — the de facto standard in the Python community. Simple syntax (plain `assert`), powerful fixtures, and an extensive plugin ecosystem (`pytest-cov`, `pytest-mock`, `pytest-asyncio`, `pytest-xdist` for parallelism).
- **unittest** — standard library (stdlib), useful when no external dependency is desired, but less ergonomic than pytest.

### Coverage and quality
- **coverage.py** (through `pytest-cov`) to measure coverage.
- **tox** or **nox** to run tests across multiple Python versions/environments.
- **hypothesis** for property-based testing, useful for automatically generating edge cases.

### API/Web tests
- **httpx**/FastAPI's `TestClient`, or `Django TestCase`/`pytest-django` for web frameworks.
- **responses** or **requests-mock** to simulate external HTTP calls.

### Best practices
- Name files `test_*.py` or `*_test.py` (pytest convention).
- Use fixtures (`conftest.py`) for reusable setup/teardown.
- Typing with `mypy` complements tests by catching errors even before running them.
- Use `pytest.mark.parametrize` to reduce duplication by testing multiple cases with the same logic.

---

## .NET / C#

### Unit and integration tests
- **xUnit** — the current standard recommendation for new .NET projects (used by the .NET team itself, with native integration with `dotnet test`).
- **NUnit** — mature and widely used alternative, with a rich API of asserts and attributes.
- **MSTest** — Microsoft's framework, less popular than the previous two, but well integrated with Visual Studio.

### Mocking and assertions
- **Moq** or **NSubstitute** for dependency mocks/stubs.
- **FluentAssertions** for more readable asserts (`result.Should().Be(...)`).
- **AutoFixture** for automatic test data generation.

### Integration/API tests
- **WebApplicationFactory** (Microsoft.AspNetCore.Mvc.Testing) for testing ASP.NET Core APIs in memory.
- **Testcontainers for .NET** to start real dependencies (Postgres, SQL Server, Redis) in containers during tests.

### Best practices
- Organize into separate projects: `MeuProjeto.Tests` (unit) and `MeuProjeto.IntegrationTests`.
- Use `dotnet test --collect:"XPlat Code Coverage"` for coverage, with a report through **ReportGenerator** or **Coverlet**.
- Take advantage of `[Theory]`/`[InlineData]` attributes (xUnit) for parameterized tests.

---

## Java

### Unit and integration tests
- **JUnit 5 (Jupiter)** — current standard, with modern annotations (`@Test`, `@ParameterizedTest`, `@BeforeEach`).
- **TestNG** — robust alternative, popular for complex integration/E2E tests, with better support for dependent tests and native parallelism.

### Mocking and assertions
- **Mockito** for mocks.
- **AssertJ** for fluent asserts (`assertThat(x).isEqualTo(y)`).

### Integration/Spring tests
- **Spring Boot Test** (`@SpringBootTest`, `@WebMvcTest`, `@DataJpaTest`) for testing the Spring context in a granular way.
- **Testcontainers** for real databases and services in containers.

### Best practices
- Coverage with **JaCoCo**, integrated with Maven/Gradle.
- Use `@ParameterizedTest` + `@CsvSource`/`@MethodSource` to reduce duplication.
- Separate unit tests (`src/test/java`) from integration tests (the `*IT.java` suffix run by the Failsafe plugin in Maven).

---

## Go

### Unit and integration tests
- **testing** (native stdlib package) — sufficient for most cases, already supporting benchmarks and parallel tests (`t.Parallel()`).
- **Testify** (`testify/assert`, `testify/mock`, `testify/suite`) — the most popular library for enhancing the native package with asserts and mocks.
- **Ginkgo + Gomega** — BDD (Behavior-Driven Development) framework for more expressive specs, popular in infrastructure projects (e.g. Kubernetes).

### Best practices
- Name files `*_test.go` in the same package as the tested code.
- Use table-driven tests (`for _, tt := range cases { ... }`) as the idiomatic standard in Go.
- Native coverage: `go test -cover` / `go test -coverprofile=coverage.out`.
- Use `go vet` and `golangci-lint` as a complement to tests.

---

## Ruby

- **RSpec** — de facto standard for testing in Ruby/Rails, with BDD syntax (`describe`, `context`, `it`).
- **Minitest** — Ruby's standard library, lighter, used by those who prefer `unittest`-style syntax.
- **FactoryBot** for test data generation (dynamic fixtures).
- **Capybara** for system/E2E tests simulating user interaction in the browser.
- **VCR** or **WebMock** for recording/mocking external HTTP calls.

---

## PHP

- **PHPUnit** — de facto standard for unit and integration testing in PHP.
- **Pest** — modern alternative with more expressive syntax on top of PHPUnit, gaining popularity in Laravel projects.
- **Laravel**: uses PHPUnit/Pest integrated, with the `RefreshDatabase` trait for integration tests with a database.
- **Behat** for BDD tests (Gherkin/Cucumber-style).

---

## HTML / Visual Frontend

- **Accessibility testing**: **axe-core** (through `jest-axe` or a Playwright/Cypress plugin) to automatically validate WCAG.
- **HyperFrames**: treat the composition as testable frontend; run `hyperframes lint`/`hyperframes check` when available, validate previews at multiple output sizes, and use snapshots or visual comparison of critical frames to catch regressions.
- **Visual regression testing**: see the tools in the "CSS" section below (the same tools work for markup + style regression).
- **Markup validation**: W3C HTML Validator / `html-validate` in CI pipelines.
- **Lighthouse CI** for automated performance, SEO, and accessibility metrics.
- **Storybook** + **Testing Library** for testing UI components in isolation (including interactions through `play` functions).

---

## CSS

- **Style linting**: **Stylelint** — de facto standard for CSS/SCSS/Less linting; detects syntax errors, duplicate properties, excessive specificity, and enforces conventions (property order, BEM naming, etc.).
- **Visual regression testing**: since CSS has no testable "logic" in the traditional sense, the most effective test is to compare screenshots before/after changes:
  - **Playwright** (`toHaveScreenshot()`) — native, integrated into the E2E pipeline.
  - **Percy** or **Chromatic** — platforms dedicated to visual diffs, excellent when integrated with Storybook.
  - **BackstopJS** — tool focused specifically on visual regression of CSS/layout.
  - **reg-suit** — open-source alternative for visual regression.
- **Responsiveness testing**: run visual regression tests across multiple viewports (mobile, tablet, desktop) through Playwright (`page.setViewportSize`) or Cypress (`cy.viewport()`).
- **CSS-in-JS testing**: for styled-components/Emotion, use snapshot testing (Jest/Vitest `toMatchSnapshot()`) to detect unintentional changes in generated styles.
- **Compatibility validation**: **Can I Use** + **Autoprefixer**/**PostCSS** to ensure browser support; **BrowserStack**/**Sauce Labs** for real cross-browser testing.

---

## SQL / Databases

- **Migration testing**: run migrations up and down (`up`/`down`) in the CI pipeline.
- **Testcontainers** (Java, .NET, Node, Python, Go) to run real Postgres/MySQL/MongoDB in containers during integration tests, avoiding SQLite/mocks that mask differences in real database behavior.
- **dbt tests** (for data/analytics pipelines) — declarative data quality tests (`unique`, `not_null`, `relationships`).
- Always test complex queries and stored procedures with representative sample data (including edge cases: null values, empty strings, duplicates).

---

## REST / GraphQL APIs

- **Contract testing**: **Pact** for testing contracts between consumers and providers in microservices architectures.
- **HTTP API testing**: **Postman/Newman**, **REST Assured** (Java), **Supertest** (Node.js), **httpx**/`TestClient` (Python).
- **Load/performance testing**: **k6**, **Gatling**, **JMeter**, or **Locust** to simulate traffic and measure latency/throughput under load.
- **Schema validation**: validate payloads against the OpenAPI/JSON Schema/GraphQL SDL schema automatically in tests.

---

## Mobile (iOS / Android / Cross-platform)

- **iOS (Swift)**: **XCTest** (native) for unit and UI tests; **Quick + Nimble** for BDD.
- **Android (Kotlin/Java)**: **JUnit** + **Espresso** (UI tests) + **Mockito**/**MockK** (mocks for Kotlin).
- **React Native**: **Jest** + **React Native Testing Library**, **Detox** for E2E.
- **Flutter**: `flutter_test` (unit/widget tests, native to the SDK) + **integration_test** for E2E.

---

## Desktop Apps (Windows / macOS)

### Windows (WinUI, WPF, .NET, Electron)
- **Unit tests**: same .NET frameworks (xUnit/NUnit/MSTest) for business logic, isolating the UI layer through MVVM/MVU (testable ViewModel without depending on the real UI).
- **Native UI/E2E tests**: **WinAppDriver** (Microsoft, based on Selenium/Appium) for automating Win32/WPF/WinUI/UWP apps.
- **WinUI 3 / MAUI**: **Appium** (Windows driver) or **Microsoft.UI.Xaml.Tests** for UI tests within the framework itself.
- **Electron on Windows**: **Playwright** has experimental Electron support (`_electron` API) for E2E testing of Electron apps; alternative: **Spectron** (discontinued, avoid in new projects).
- **Packaging/installer**: validate the installer (MSIX/MSI) in a CI pipeline with post-installation smoke tests.

### macOS (AppKit, SwiftUI, Catalyst, Electron)
- **Unit tests**: **XCTest** (native), the same tool used on iOS — tests ViewModels/Services isolated from the AppKit/SwiftUI layer.
- **UI tests**: **XCUITest** to automate real UI interactions (clicks, menus, keyboard shortcuts) in native macOS apps.
- **Electron on macOS**: same approach as Windows — **Playwright** with Electron support.
- **Notarization/signing**: validate in CI that the final build passes Apple's `codesign`/notarization before distribution (post-build smoke test).

### Cross-platform desktop (Electron, Tauri, .NET MAUI)
- **Electron**: **Playwright** (Electron API) or **WebdriverIO** with the `wdio-electron-service` service for cross-platform E2E testing with the same codebase.
- **Tauri**: Rust backend tests with native `cargo test`; frontend/WebView tests with Playwright pointing to the Tauri window in dev mode.
- **.NET MAUI**: **xUnit**/**NUnit** for shared logic; **Appium** for end-to-end UI tests on Windows and macOS from the same suite.

### Common best practices
- Always separate business logic from the UI layer (MVVM/MVC/MVI) so it can be tested without rendering windows — real UI tests (WinAppDriver/XCUITest/Appium) are slower and should be restricted to critical flows (smoke tests).
- Run desktop UI tests on CI runners with virtual display support (`Xvfb` on Linux, self-hosted runners with real Windows/macOS for native tests — GitHub Actions offers `windows-latest` and `macos-latest` runners).
- Test at least 2 screen resolutions and 2 DPI scaling levels (Windows) / Retina vs. non-Retina (macOS).

---

## Infrastructure / DevOps / IaC

- **Terraform**: **Terratest** (Go) to validate provisioned infrastructure; `terraform validate`/`terraform plan` in CI.
- **Kubernetes**: **kind** or **k3d** for ephemeral clusters in CI; **Ginkgo/Gomega** (used by the Kubernetes project itself) for operator/controller tests.
- **Ansible**: **Molecule** to test playbooks/roles in isolation.
- **Docker**: validate `Dockerfile` with **hadolint** (linter) and test the final image with **Testcontainers** or **dgoss**.

---

## Complementary tools (any stack)

- **Linting/Static analysis**: ESLint, Pylint/Ruff, RuboCop, golangci-lint, SonarQube/SonarCloud — they do not replace tests, but they catch problems before tests do.
- **Mutation testing**: **Stryker** (JS/.NET), **PIT** (Java), **mutmut** (Python) — evaluates the actual quality of tests, not just line coverage.
- **Contract/Snapshot testing**: useful for APIs and UI components that change frequently in a controlled manner.
- **Testcontainers**: available for practically all major languages (Java, .NET, Node, Python, Go), always recommended whenever possible for integration tests with real services (databases, queues, caches) instead of mocks.

---

## Instruction template for CLAUDE.md / AGENTS.md about testing

```
## Testing

- Every new function/module must have a corresponding unit test.
- Every bug fix must include a regression test that fails before
  the fix and passes afterward.
- Testing framework by language:
  - Node/TS: Vitest (unit) + Playwright (E2E)
  - Python: pytest + pytest-cov
  - .NET: xUnit + Moq/NSubstitute + FluentAssertions
  - Java: JUnit 5 + Mockito + AssertJ
  - Go: native testing + Testify (table-driven tests)
  - Ruby: RSpec + FactoryBot
  - PHP: PHPUnit/Pest
  - Mobile: XCTest (iOS) + JUnit/Espresso (Android)
  - Desktop: WinAppDriver (Windows) + XCUITest (macOS), logic isolated through xUnit/NUnit
- Tests must run with a single command documented in the README/CLAUDE.md.
- Mock external dependencies (HTTP, database, filesystem, clock) in unit
  tests. Use Testcontainers (or equivalent) in integration tests
  with real services.
- Minimum coverage: 80% overall, 90%+ in critical business logic.
- No test may depend on execution order, system time,
  or random data without a fixed seed.
- Every test must run in CI on every push/PR.
- Automated formatting/linting: see the rules in [`clean-code-eng.md`](./clean-code-eng.md) (section
  "Formatting and style"). They must run in CI before/alongside the tests.
```

---

Research sources/basis: official documentation for each framework (Vitest, Playwright, pytest, xUnit, JUnit, Testify, RSpec, PHPUnit), and the "State of JS 2025" market research on adoption and satisfaction with JavaScript testing tools.
