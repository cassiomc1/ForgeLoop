# Guias de Instruções para Agentes de IA

Esta coleção reúne guias práticos para orientar agentes de IA (Claude Code, Cursor, GitHub Copilot etc.) e desenvolvedores em boas práticas de código, testes, segurança, performance e design.

Os guias cobrem desenvolvimento **web** (desktop e mobile), criação de sites em nível de grandes estúdios de design, **apps mobile nativos** (iOS/Android), **apps desktop nativos** (Windows/macOS) e, quando fizer sentido, composição audiovisual HTML/CSS/JS com [HyperFrames](https://hyperframes.heygen.com). Eles podem ser usados como referência direta ou como base para arquivos de contexto como `CLAUDE.md`, `AGENTS.md`, `.cursor/rules` e `.github/copilot-instructions.md`.

## Regra comum a todos os guias: ferramentas obrigatórias

Todos os guias desta coleção incluem a seguinte instrução para agentes de IA e desenvolvedores:

> Se qualquer ferramenta, dependência, runtime, CLI ou utilitário necessário para executar o guia (linter, formatter, framework de teste, scanner, profiler, engine, etc.) **não estiver instalado no ambiente, solicite a instalação ao usuário imediatamente** (ou instale com aprovação, conforme a política do ambiente). Nenhuma etapa, verificação ou entrega pode ser pulada, adiada ou substituída por "a ferramenta não está instalada" — a tarefa só está completa quando todas as verificações exigidas foram de fato executadas.

## Estrutura do projeto

Os arquivos estão organizados em duas pastas por idioma:

- [`PT-BR/`](./PT-BR/) — guias em português (versão principal), com sufixo `-pt.md`.
- [`ENG/`](./ENG/) — guias em inglês, com sufixo `-eng.md`.

## HyperFrames: vídeo e motion com HTML / HTML video and motion

Quando o projeto precisar de um trailer, demonstração de produto, motion graphic, apresentação ou outro vídeo automatizável, consulte o [HyperFrames](https://hyperframes.heygen.com). A ferramenta transforma HTML, CSS, mídia e animações controláveis por frame em vídeos renderizáveis e pode ser usada localmente por agentes de código.

Fluxo mínimo recomendado:

```bash
npx hyperframes skills update
npx hyperframes init meu-video
cd meu-video
npx hyperframes preview
npx hyperframes render
```

Para a instalação guiada e as opções de workflow, use o [quickstart oficial](https://hyperframes.heygen.com/quickstart). O render local exige Node.js 22+ e FFmpeg; valide custos, licenças, acessibilidade, mídia de terceiros e permissões antes de publicar.

For projects that need an automated trailer, product demo, motion graphic, presentation, or another video, see [HyperFrames](https://hyperframes.heygen.com). It turns HTML, CSS, media, and frame-controllable animation into renderable video and can be used locally by coding agents. Follow the [official quickstart](https://hyperframes.heygen.com/quickstart); local rendering requires Node.js 22+ and FFmpeg.

---

# Versão em Português

Esta é a versão principal dos guias, escrita em português.

## Arquivos em português (pasta [`PT-BR/`](./PT-BR/))

### [`PT-BR/premium-sites-studio-pt.md`](./PT-BR/premium-sites-studio-pt.md) — Sites premium em nível de estúdio

Processo completo para criar sites de alto nível, cobrindo estratégia, conteúdo, arquitetura de informação, direção criativa, design system, UX, implementação, motion, SEO, acessibilidade, performance, segurança, QA, lançamento e manutenção.

### [`PT-BR/clean-code-pt.md`](./PT-BR/clean-code-pt.md) — Código limpo para agentes de IA

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

### [`PT-BR/test-code-pt.md`](./PT-BR/test-code-pt.md) — Testes por linguagem e tecnologia

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

### [`PT-BR/sec-code-pt.md`](./PT-BR/sec-code-pt.md) — Segurança para web, mobile e desktop

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

### [`PT-BR/design-code-pt.md`](./PT-BR/design-code-pt.md) — Design premium para web, mobile e desktop

Receita de direção visual, UX, motion e performance percebida para experiências digitais premium.

Cobre:

- Paletas e combinações tipográficas prontas.
- Grid, espaçamento, composição e anatomia de páginas premium.
- Web desktop e web mobile.
- Safe areas, áreas de toque, CTA sticky e design responsivo.
- Motion com GSAP/ScrollTrigger e uso criterioso de Three.js.
- Efeitos canvas/WebGL opcionais com [Canvas UI](https://canvasui.dev/), com fallback acessível, reduced motion e atenção a compatibilidade/performance.
- Componentes premium, acessibilidade e Core Web Vitals.
- Apps mobile nativos seguindo Apple Human Interface Guidelines e Material Design 3.
- Apps desktop seguindo Fluent Design/WinUI no Windows e HIG no macOS.
- Checklists para web, mobile e desktop.

### [`PT-BR/perf-code-pt.md`](./PT-BR/perf-code-pt.md) — Performance por tecnologia e plataforma

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

### [`PT-BR/acessibilidade-code-pt.md`](./PT-BR/acessibilidade-code-pt.md) — Acessibilidade como linha de base (A11Y)

Protocolo de acessibilidade adaptado do projeto *A11Y.md* (WCAG 2.2 AA, ADA, EAA, ISO 9241-171).

Cobre:

- Princípio Zero: acessibilidade como pré-condição técnica, não melhoria posterior.
- Perfis de conformidade (Shield AAA, Standard AA, Launchpad A) e modelo de severidade.
- Contrato de comportamento para agentes de IA (sem inferência, APG, reuso de componentes, memória de decisões).
- Padrões técnicos POUR: contraste, alt text, teclado, foco, alvos de toque, `prefers-reduced-motion`, rótulos, `aria-live` e HTML semântico.
- Diretrizes visuais rígidas: indicador de foco, tipografia mínima e hit areas.
- Protocolo para componentes complexos e antipadrões (divs clicáveis, focus traps vazados, placeholder como rótulo, sopa de ARIA).
- Checklist de verificação (Definition of Done) com zoom/reflow, ordem de Tab e auditoria de exceções.

### [`PT-BR/games-code-design-web-pt.md`](./PT-BR/games-code-design-web-pt.md) — Desenvolvimento e design de games web

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

## Rule common to all guides: mandatory tooling

Every guide in this collection includes the following instruction for AI agents and developers:

> If any tool, dependency, runtime, CLI or utility required to execute the guide (linter, formatter, test framework, scanner, profiler, engine, etc.) **is not installed in the environment, request its installation from the user immediately** (or install it with approval, per the environment's policy). No step, check or deliverable may be skipped, postponed or replaced because "the tool is not installed" — the task is only complete when all required checks have actually been executed.

## English files (folder [`ENG/`](./ENG/))

### [`ENG/premium-sites-studio-eng.md`](./ENG/premium-sites-studio-eng.md) — Premium websites at studio level

Complete process for high-end websites, covering strategy, content, information architecture, creative direction, design systems, UX, implementation, motion, SEO, accessibility, performance, security, QA, launch, and maintenance.

### [`ENG/clean-code-eng.md`](./ENG/clean-code-eng.md) — Clean Code for AI Agents

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

### [`ENG/test-code-eng.md`](./ENG/test-code-eng.md) — Testing by Language and Technology

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

### [`ENG/sec-code-eng.md`](./ENG/sec-code-eng.md) — Security for Web, Mobile and Desktop

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

### [`ENG/design-code-eng.md`](./ENG/design-code-eng.md) — Premium Design for Web, Mobile and Desktop

A visual direction, UX, motion and perceived performance recipe for premium digital experiences.

It covers:

- Ready-made color palettes and typographic combinations.
- Grid, spacing, composition and premium page anatomy.
- Desktop web and mobile web.
- Safe areas, touch targets, sticky CTAs and responsive design.
- GSAP/ScrollTrigger motion and careful Three.js usage.
- Optional canvas/WebGL effects with [Canvas UI](https://canvasui.dev/), with accessible fallbacks, reduced-motion support, and compatibility/performance guidance.
- Premium components, accessibility and Core Web Vitals.
- Native mobile apps following Apple's Human Interface Guidelines and Material Design 3.
- Desktop apps following Fluent Design/WinUI on Windows and HIG on macOS.
- Web, mobile and desktop review checklists.

### [`ENG/perf-code-eng.md`](./ENG/perf-code-eng.md) — Performance by Technology and Platform

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

### [`ENG/accessibility-eng.md`](./ENG/accessibility-eng.md) — Accessibility as a Baseline (A11Y)

Accessibility protocol adapted from the *A11Y.md* project (WCAG 2.2 AA, ADA, EAA, ISO 9241-171).

It covers:

- Principle Zero: accessibility as a technical pre-condition, not a later improvement.
- Compliance profiles (Shield AAA, Standard AA, Launchpad A) and the severity model.
- AI agent behavior contract (no inference, APG, component reuse, decision memory).
- POUR technical standards: contrast, alt text, keyboard, focus, touch targets, `prefers-reduced-motion`, labels, `aria-live` and semantic HTML.
- Strict visual directives: focus indicator, minimum typography and hit areas.
- Complex component protocol and anti-patterns (clickable divs, leaked focus traps, placeholder labels, ARIA soup).
- Verification checklist (Definition of Done) with zoom/reflow, tab order and exceptions audit.

### [`ENG/games-code-design-web-eng.md`](./ENG/games-code-design-web-eng.md) — Web Game Development and Design

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

1. Escolha os arquivos adequados ao projeto na pasta [`PT-BR/`](./PT-BR/).
2. Copie os blocos de template para `CLAUDE.md`, `AGENTS.md` ou `.cursor/rules`.
3. Use `PT-BR/premium-sites-studio-pt.md` como processo principal para sites de alto nível; complemente com `PT-BR/design-code-pt.md` para UI/UX, `PT-BR/acessibilidade-code-pt.md` para regras de acessibilidade (WCAG/ARIA), `PT-BR/perf-code-pt.md` para budgets e critérios de performance e `PT-BR/games-code-design-web-pt.md` para desenvolvimento de games web procedural/data-driven.
4. Consulte `PT-BR/clean-code-pt.md`, `PT-BR/test-code-pt.md` e `PT-BR/sec-code-pt.md` para regras de código, testes e segurança.
5. Verifique a seção "Documentos relacionados" antes de adicionar uma regra, para evitar redundância.
6. Para vídeos e motion baseados em HTML, use o [HyperFrames](https://hyperframes.heygen.com) em conjunto com as regras de design, acessibilidade, performance e testes — ele não substitui essas validações.

### English

1. Choose the files that apply to the project from the [`ENG/`](./ENG/) folder.
2. Copy the instruction templates into `CLAUDE.md`, `AGENTS.md` or `.cursor/rules`.
3. Use `ENG/premium-sites-studio-eng.md` as the main process for high-end websites; complement it with `ENG/design-code-eng.md` for UI/UX, `ENG/accessibility-eng.md` for accessibility rules (WCAG/ARIA), `ENG/perf-code-eng.md` for performance budgets and criteria, and `ENG/games-code-design-web-eng.md` for procedural/data-driven web game development.
4. Consult `ENG/clean-code-eng.md`, `ENG/test-code-eng.md` and `ENG/sec-code-eng.md` for code quality, testing and security rules.
5. Check the "Related documents" section before adding a rule, to avoid duplication.
6. For HTML-based video and motion, use [HyperFrames](https://hyperframes.heygen.com) together with the design, accessibility, performance, and testing rules; it does not replace those validations.
