# Guias de Instruções para Agentes de IA

Esta coleção reúne guias práticos para orientar agentes de IA (Claude Code, Cursor, GitHub Copilot etc.) e desenvolvedores em boas práticas de código, testes, segurança, performance e design.

Os guias cobrem desenvolvimento **web** (desktop e mobile), **apps mobile nativos** (iOS/Android) e **apps desktop nativos** (Windows/macOS). Eles podem ser usados como referência direta ou como base para arquivos de contexto como `CLAUDE.md`, `AGENTS.md`, `.cursor/rules` e `.github/copilot-instructions.md`.

---

# Versão em Português

Esta é a versão principal dos guias, escrita em português.

## Arquivos em português

### [`clean-code.md`](./clean-code.md) — Código limpo para agentes de IA

Adaptação do artigo *"Clean Code for AI Agents"*, de Fabio Akita, organizada como instruções práticas para agentes de IA.

Cobre:

- Funções e arquivos pequenos.
- Princípio da Responsabilidade Única (SRP).
- Nomes significativos e buscáveis para facilitar o uso de `grep`.
- Comentários com contexto e proveniência.
- Tipagem explícita, DRY e injeção de dependência.
- Estrutura de diretórios previsível.
- Testes executáveis e formatação automática.
- Tratamento de erros com contexto.
- Debugging orientado por evidências: aumentar o nível de log quando a causa de um erro não for clara, reproduzir o problema e só então corrigir.
- Template para `CLAUDE.md`/`AGENTS.md`.

### [`test-code.md`](./test-code.md) — Testes por linguagem e tecnologia

Guia de frameworks, ferramentas e práticas de teste para:

- JavaScript/TypeScript e Node.js: Vitest, Jest, Playwright e Testing Library.
- Python: pytest, unittest, Hypothesis e pytest-cov.
- .NET/C#: xUnit, NUnit, MSTest, Moq e WebApplicationFactory.
- Java: JUnit 5, Mockito, AssertJ e Spring Boot Test.
- Go: `testing`, Testify e Ginkgo/Gomega.
- Ruby: RSpec, Minitest, FactoryBot e Capybara.
- PHP: PHPUnit, Pest e Behat.
- HTML/CSS: acessibilidade, Lighthouse, Storybook, Stylelint e regressão visual.
- SQL, bancos de dados, APIs REST/GraphQL e Testcontainers.
- Mobile: XCTest, Espresso, React Native, Detox e Flutter.
- Desktop: WinAppDriver, XCUITest, Appium, Electron, Tauri e .NET MAUI.

Também inclui princípios como pirâmide de testes, F.I.R.S.T, cobertura, testes determinísticos e integração contínua.

### [`sec-code.md`](./sec-code.md) — Segurança para web, mobile e desktop

Guia de *secure coding* baseado no OWASP Top 10:2025, OWASP Mobile Top 10:2024 e OWASP MASVS.

Cobre:

- Secure by design, menor privilégio e defesa em profundidade.
- Gestão segura de secrets e credenciais.
- Os dez riscos do OWASP Top 10:2025.
- Segurança de backend em Node.js, Python, .NET, Java, PHP, Ruby e Go.
- CSP, XSS, CSRF, CORS, cookies e headers HTTP.
- APIs REST/GraphQL, OAuth2, OIDC, JWT e rate limiting.
- Banco de dados, queries parametrizadas e criptografia.
- SAST, DAST, dependency scanning, containers e CI/CD.
- Segurança mobile no iOS e Android.
- Segurança desktop no Windows e macOS.
- Segurança de Electron, React Native, Flutter e .NET MAUI.
- Template de segurança para `CLAUDE.md`/`AGENTS.md`.

### [`design-code.md`](./design-code.md) — Design premium para web, mobile e desktop

Receita de direção visual, UX, motion e performance percebida para experiências digitais premium.

Cobre:

- Paletas e combinações tipográficas prontas.
- Grid, espaçamento, composição e anatomia de páginas premium.
- Web desktop e web mobile.
- Safe areas, áreas de toque, CTA sticky e design responsivo.
- Motion com GSAP/ScrollTrigger e uso criterioso de Three.js.
- Componentes premium, acessibilidade e Core Web Vitals.
- Apps mobile nativos seguindo Apple Human Interface Guidelines e Material Design 3.
- Apps desktop seguindo Fluent Design/WinUI no Windows e HIG no macOS.
- Checklists para web, mobile e desktop.

### [`perf-code.md`](./perf-code.md) — Performance por tecnologia e plataforma

Guia técnico para medir, diagnosticar e melhorar performance sem otimizações especulativas.

Cobre:

- Baseline, profiling, budgets e métricas p50/p75/p95/p99.
- Web: Core Web Vitals, TTFB, CDN, cache, imagens, CSS, JavaScript, React/Next.js, Vue/Nuxt, Angular, PWA e WebAssembly.
- Backend/APIs: Node.js, Python, .NET, Java e Go.
- Bancos: PostgreSQL, MySQL/MariaDB, SQL Server, Redis, MongoDB e Elasticsearch/OpenSearch.
- Mobile: iOS, Android, React Native e Flutter.
- Desktop: Windows, macOS, Electron e Tauri.
- APIs distribuídas, filas, containers, cloud, autoscaling e testes de carga.
- Relação entre performance e segurança.
- Template para agentes e checklist de revisão.

### [`acessibilidade-code.md`](./acessibilidade-code.md) — Acessibilidade como linha de base (A11Y)

Protocolo de acessibilidade adaptado do projeto *A11Y.md* (WCAG 2.2 AA, ADA, EAA, ISO 9241-171).

Cobre:

- Princípio Zero: acessibilidade como pré-condição técnica, não melhoria posterior.
- Perfis de conformidade (Shield AAA, Standard AA, Launchpad A) e modelo de severidade.
- Contrato de comportamento para agentes de IA (sem inferência, APG, reuso de componentes, memória de decisões).
- Padrões técnicos POUR: contraste, alt text, teclado, foco, alvos de toque, `prefers-reduced-motion`, rótulos, `aria-live` e HTML semântico.
- Diretrizes visuais rígidas: indicador de foco, tipografia mínima e hit areas.
- Protocolo para componentes complexos e antipadrões (divs clicáveis, focus traps vazados, placeholder como rótulo, sopa de ARIA).
- Checklist de verificação (Definition of Done) com zoom/reflow, ordem de Tab e auditoria de exceções.

### [`games-code-design-web.md`](./games-code-design-web.md) — Desenvolvimento e design de games web

Guia específico para criar games web 2D e 3D, com foco em desenvolvimento procedural e data-driven.

Cobre:

- Escolha de Canvas, WebGL/WebGPU, Phaser, PixiJS, Three.js, Babylon.js, PlayCanvas, Godot Web e TypeScript/Vite.
- Arquitetura de game loop, simulação com timestep fixo, ECS/data-oriented design e separação entre simulação e apresentação.
- Geração procedural determinística: seeds, PRNG injetável, chunks, streaming, regras, constraints, validação, versionamento, reprodutibilidade e fallbacks.
- Conteúdo híbrido: combinação de autoria manual com sistemas procedurais e critérios para saber quando não usar procedural.
- Input, Gamepad API, Pointer Lock, física, câmera, assets, áudio, acessibilidade e compatibilidade mobile.
- Multiplayer com WebSockets/WebRTC, servidor autoritativo, reconciliação e segurança.
- WebAssembly, Rust, C++, Emscripten, PWA, service workers, CDN, testes, CI/CD e performance.
- Template para agentes e checklist de revisão de games web.

---

# English Version

This section documents the English translations of the guides. The English files preserve the technical structure, commands, metrics, code examples, links and agent instruction templates from the Portuguese originals.

## English files

### [`clean-code-eng.md`](./clean-code-eng.md) — Clean Code for AI Agents

English adaptation of Fabio Akita's *"Clean Code for AI Agents"* article, organized as practical instructions for AI coding agents.

It covers:

- Small functions and files.
- The Single Responsibility Principle (SRP).
- Meaningful, searchable names for effective `grep` navigation.
- Comments containing context and provenance.
- Explicit typing, DRY and dependency injection.
- Predictable directory structure.
- Executable tests and automated formatting.
- Context-rich error handling.
- Evidence-driven debugging: increase the log level when the root cause is unclear, reproduce the issue, and only then fix it.
- A template for `CLAUDE.md`/`AGENTS.md`.

### [`test-code-eng.md`](./test-code-eng.md) — Testing by Language and Technology

Guide to testing frameworks, tools and practices for:

- JavaScript/TypeScript and Node.js: Vitest, Jest, Playwright and Testing Library.
- Python: pytest, unittest, Hypothesis and pytest-cov.
- .NET/C#: xUnit, NUnit, MSTest, Moq and WebApplicationFactory.
- Java: JUnit 5, Mockito, AssertJ and Spring Boot Test.
- Go: `testing`, Testify and Ginkgo/Gomega.
- Ruby: RSpec, Minitest, FactoryBot and Capybara.
- PHP: PHPUnit, Pest and Behat.
- HTML/CSS: accessibility, Lighthouse, Storybook, Stylelint and visual regression testing.
- SQL, databases, REST/GraphQL APIs and Testcontainers.
- Mobile: XCTest, Espresso, React Native, Detox and Flutter.
- Desktop: WinAppDriver, XCUITest, Appium, Electron, Tauri and .NET MAUI.

It also includes the testing pyramid, F.I.R.S.T principles, coverage, deterministic tests and continuous integration.

### [`sec-code-eng.md`](./sec-code-eng.md) — Security for Web, Mobile and Desktop

Secure coding guide based on OWASP Top 10:2025, OWASP Mobile Top 10:2024 and OWASP MASVS.

It covers:

- Secure by design, least privilege and defense in depth.
- Secure secrets and credential management.
- All ten OWASP Top 10:2025 risks.
- Backend security for Node.js, Python, .NET, Java, PHP, Ruby and Go.
- CSP, XSS, CSRF, CORS, cookies and HTTP security headers.
- REST/GraphQL APIs, OAuth2, OIDC, JWT and rate limiting.
- Databases, parameterized queries and cryptography.
- SAST, DAST, dependency scanning, containers and CI/CD.
- Mobile security for iOS and Android.
- Desktop security for Windows and macOS.
- Electron, React Native, Flutter and .NET MAUI security.
- A security template for `CLAUDE.md`/`AGENTS.md`.

### [`design-code-eng.md`](./design-code-eng.md) — Premium Design for Web, Mobile and Desktop

A visual direction, UX, motion and perceived performance recipe for premium digital experiences.

It covers:

- Ready-made color palettes and typographic combinations.
- Grid, spacing, composition and premium page anatomy.
- Desktop web and mobile web.
- Safe areas, touch targets, sticky CTAs and responsive design.
- GSAP/ScrollTrigger motion and careful Three.js usage.
- Premium components, accessibility and Core Web Vitals.
- Native mobile apps following Apple's Human Interface Guidelines and Material Design 3.
- Desktop apps following Fluent Design/WinUI on Windows and HIG on macOS.
- Web, mobile and desktop review checklists.

### [`perf-code-eng.md`](./perf-code-eng.md) — Performance by Technology and Platform

Technical guide for measuring, diagnosing and improving performance without speculative optimization.

It covers:

- Baselines, profiling, budgets and p50/p75/p95/p99 metrics.
- Web: Core Web Vitals, TTFB, CDN, caching, images, CSS, JavaScript, React/Next.js, Vue/Nuxt, Angular, PWA and WebAssembly.
- Backend/APIs: Node.js, Python, .NET, Java and Go.
- Databases: PostgreSQL, MySQL/MariaDB, SQL Server, Redis, MongoDB and Elasticsearch/OpenSearch.
- Mobile: iOS, Android, React Native and Flutter.
- Desktop: Windows, macOS, Electron and Tauri.
- Distributed APIs, queues, containers, cloud, autoscaling and load testing.
- The relationship between performance and security.
- An agent template and performance review checklist.

### [`accessibility-eng.md`](./accessibility-eng.md) — Accessibility as a Baseline (A11Y)

Accessibility protocol adapted from the *A11Y.md* project (WCAG 2.2 AA, ADA, EAA, ISO 9241-171).

It covers:

- Principle Zero: accessibility as a technical pre-condition, not a later improvement.
- Compliance profiles (Shield AAA, Standard AA, Launchpad A) and the severity model.
- AI agent behavior contract (no inference, APG, component reuse, decision memory).
- POUR technical standards: contrast, alt text, keyboard, focus, touch targets, `prefers-reduced-motion`, labels, `aria-live` and semantic HTML.
- Strict visual directives: focus indicator, minimum typography and hit areas.
- Complex component protocol and anti-patterns (clickable divs, leaked focus traps, placeholder labels, ARIA soup).
- Verification checklist (Definition of Done) with zoom/reflow, tab order and exceptions audit.

### [`games-code-design-web-eng.md`](./games-code-design-web-eng.md) — Web Game Development and Design

A dedicated guide for building 2D and 3D web games, with a focus on procedural and data-driven development.

It covers:

- Choosing Canvas, WebGL/WebGPU, Phaser, PixiJS, Three.js, Babylon.js, PlayCanvas, Godot Web and TypeScript/Vite.
- Game loop architecture, fixed-step simulation, ECS/data-oriented design and separation between simulation and presentation.
- Deterministic procedural generation: seeds, injectable PRNG, chunks, streaming, rules, constraints, validation, versioning, reproducibility and fallbacks.
- Hybrid content: combining authored content with procedural systems and criteria for when not to use procedural generation.
- Input, Gamepad API, Pointer Lock, physics, cameras, assets, audio, accessibility and mobile compatibility.
- Multiplayer with WebSockets/WebRTC, authoritative servers, reconciliation and security.
- WebAssembly, Rust, C++, Emscripten, PWA, service workers, CDN, testing, CI/CD and performance.
- An agent template and web game review checklist.

---

## Como usar / How to use

### Português

1. Escolha os arquivos em português adequados ao projeto.
2. Copie os blocos de template para `CLAUDE.md`, `AGENTS.md` ou `.cursor/rules`.
3. Use `design-code.md` para orientar UI/UX, `acessibilidade-code.md` para regras de acessibilidade (WCAG/ARIA), `perf-code.md` para definir budgets e critérios de performance e `games-code-design-web.md` para desenvolvimento de games web procedural/data-driven.
4. Consulte `clean-code.md`, `test-code.md` e `sec-code.md` para regras de código, testes e segurança.
5. Verifique a seção "Documentos relacionados" antes de adicionar uma regra, para evitar redundância.

### English

1. Choose the English files that apply to the project.
2. Copy the instruction templates into `CLAUDE.md`, `AGENTS.md` or `.cursor/rules`.
3. Use `design-code-eng.md` for UI/UX guidance, `accessibility-eng.md` for accessibility rules (WCAG/ARIA), `perf-code-eng.md` for performance budgets and criteria, and `games-code-design-web-eng.md` for procedural/data-driven web game development.
4. Consult `clean-code-eng.md`, `test-code-eng.md` and `sec-code-eng.md` for code quality, testing and security rules.
5. Check the "Related documents" section before adding a rule, to avoid duplication.
