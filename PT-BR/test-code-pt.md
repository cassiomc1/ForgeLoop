# Guia de Testes Recomendados por Linguagem e Tecnologia

> Instruções práticas de testes de software (unitários, integração, end-to-end) para as principais linguagens e tecnologias usadas no desenvolvimento moderno. Use este documento como referência para orientar agentes de IA e desenvolvedores sobre quais ferramentas usar e boas práticas de teste em cada stack.

> **Documentos relacionados**: para princípios gerais de código limpo (nomes, funções pequenas, formatação) ver [`clean-code-pt.md`](./clean-code-pt.md). Para segurança (inclusive testes de segurança/SAST/DAST) ver [`sec-code-pt.md`](./sec-code-pt.md). Para vídeo e motion HTML, consulte o [HyperFrames](https://hyperframes.heygen.com). Este arquivo é a referência canônica de qual framework de teste usar por linguagem/plataforma.

> **Ferramentas obrigatórias**: se qualquer ferramenta, dependência, runtime, CLI ou utilitário necessário para executar este guia (linter, formatter, framework de teste, scanner, profiler, engine, etc.) não estiver instalado no ambiente, **solicite a instalação ao usuário imediatamente** (ou instale com aprovação, conforme a política do ambiente). Nenhuma etapa, verificação ou entrega pode ser pulada, adiada ou substituída por "a ferramenta não está instalada" — a tarefa só está completa quando todas as verificações exigidas foram de fato executadas.

## Princípios gerais (válidos para qualquer linguagem)

- **Pirâmide de testes**: muitos testes unitários (rápidos e baratos), menos testes de integração, poucos testes end-to-end (E2E) (lentos e caros).
- **F.I.R.S.T**: testes devem ser **Fast** (rápidos), **Independent** (independentes entre si), **Repeatable** (repetíveis em qualquer ambiente), **Self-validating** (retornam pass/fail automaticamente, sem inspeção manual) e **Timely** (escritos a tempo, idealmente junto com o código ou antes dele — TDD).
- **Cobertura de código**: use como indicador, não como meta absoluta. Priorize cobrir regras de negócio críticas (ideal 80%+ geral, 90-95%+ em lógica de negócio) em vez de perseguir 100%.
- **Testes de regressão**: toda correção de bug deve vir acompanhada de um teste que comprove a falha antes da correção e a validação depois.
- **Nomenclatura clara**: nomes de testes devem descrever o cenário e o resultado esperado (ex.: `deve_retornar_erro_quando_email_invalido`, `should_return_404_when_user_not_found`).
- **Isolamento de dependências externas**: use mocks, stubs, fakes ou test doubles para banco de dados, APIs externas, filas, sistema de arquivos, relógio do sistema etc., nos testes unitários. Testes de integração podem usar dependências reais (idealmente em containers descartáveis, ex. Testcontainers).
- **CI obrigatório**: todo teste deve rodar automaticamente em pipeline de CI (GitHub Actions, GitLab CI, Azure DevOps, CircleCI etc.) a cada push/PR.
- **Testes determinísticos**: evite `sleep`, dependência de horário do sistema, ordem de execução ou dados aleatórios não controlados (use seeds fixas).

---

## JavaScript / TypeScript (Node.js e Frontend)

### Testes unitários e de integração
- **Vitest** — atualmente a opção mais recomendada para projetos novos (rápido, compatível com Vite, API similar ao Jest, TypeScript nativo, watch mode eficiente).
- **Jest** — ainda amplamente usado e maduro, mas perdendo espaço para Vitest em projetos novos. Boa escolha para projetos legados ou baseados em Create React App / Next.js mais antigos.
- **node:test** — runner nativo do Node.js (desde Node 18+), sem dependências externas; boa opção para bibliotecas simples que querem zero dependências de teste.

### Testes end-to-end (E2E) e de UI
- **Playwright** — recomendação atual para E2E (Chromium, Firefox, WebKit), com melhor satisfação e confiabilidade da comunidade. Suporta auto-wait, trace viewer, testes paralelos.
- **Cypress** — alternativa madura, boa DX, mas com adoção em declínio frente ao Playwright.
- **Testing Library** (`@testing-library/react`, `@testing-library/vue`, etc.) — para testes de componentes focados em comportamento do usuário, não em detalhes de implementação.

### Boas práticas
- Use `describe`/`it` com nomes descritivos.
- Separe testes unitários (`*.test.ts`/`*.spec.ts` junto ao código) de testes E2E (pasta `e2e/` ou `tests/e2e`).
- Configure cobertura com `--coverage` (Vitest/Jest usam Istanbul/v8 coverage).
- Faça mock de chamadas HTTP com `msw` (Mock Service Worker) em vez de mockar `fetch`/`axios` diretamente.
- Lint de testes com ESLint (`eslint-plugin-jest`/`eslint-plugin-vitest`).
- Rode `npm run format` (Prettier, geralmente configurado via `package.json`) antes de commitar/em CI, para garantir formatação consistente do código e dos próprios arquivos de teste.
- Rode `npm run lint` e `npm run format -- --check` (ou `prettier --check`) em CI para falhar o build se o código não estiver formatado/lintado corretamente, sem depender de o dev rodar localmente.

---

## Python

### Testes unitários e de integração
- **pytest** — padrão de facto da comunidade Python. Sintaxe simples (`assert` puro), fixtures poderosas, plugins vastos (`pytest-cov`, `pytest-mock`, `pytest-asyncio`, `pytest-xdist` para paralelismo).
- **unittest** — biblioteca padrão (stdlib), útil quando não se quer dependência externa, mas menos ergonômica que pytest.

### Cobertura e qualidade
- **coverage.py** (via `pytest-cov`) para medir cobertura.
- **tox** ou **nox** para rodar testes em múltiplas versões de Python/ambientes.
- **hypothesis** para testes baseados em propriedades (property-based testing), útil para gerar casos de borda automaticamente.

### Testes de API/Web
- **httpx**/`TestClient` do FastAPI, ou `Django TestCase`/`pytest-django` para frameworks web.
- **responses** ou **requests-mock** para simular chamadas HTTP externas.

### Boas práticas
- Nomeie arquivos como `test_*.py` ou `*_test.py` (padrão pytest).
- Use fixtures (`conftest.py`) para setup/teardown reutilizável.
- Tipagem com `mypy` complementa os testes, pegando erros antes mesmo de rodar.
- Use `pytest.mark.parametrize` para reduzir duplicação testando múltiplos casos com a mesma lógica.

---

## .NET / C#

### Testes unitários e de integração
- **xUnit** — recomendação padrão atual para novos projetos .NET (usado pela própria equipe do .NET, integração nativa com `dotnet test`).
- **NUnit** — alternativa madura e muito usada, com API rica de asserts e atributos.
- **MSTest** — framework da Microsoft, menos popular que os dois anteriores, mas bem integrado ao Visual Studio.

### Mocking e assertions
- **Moq** ou **NSubstitute** para mocks/stubs de dependências.
- **FluentAssertions** para asserts mais legíveis (`result.Should().Be(...)`).
- **AutoFixture** para geração automática de dados de teste.

### Testes de integração/API
- **WebApplicationFactory** (Microsoft.AspNetCore.Mvc.Testing) para testar APIs ASP.NET Core em memória.
- **Testcontainers for .NET** para subir dependências reais (Postgres, SQL Server, Redis) em containers durante os testes.

### Boas práticas
- Organize em projetos separados: `MeuProjeto.Tests` (unitários) e `MeuProjeto.IntegrationTests`.
- Use `dotnet test --collect:"XPlat Code Coverage"` para cobertura, com relatório via **ReportGenerator** ou **Coverlet**.
- Aproveite atributos `[Theory]`/`[InlineData]` (xUnit) para testes parametrizados.

---

## Java

### Testes unitários e de integração
- **JUnit 5 (Jupiter)** — padrão atual, com anotações modernas (`@Test`, `@ParameterizedTest`, `@BeforeEach`).
- **TestNG** — alternativa robusta, popular em testes de integração/E2E complexos, com melhor suporte a testes dependentes e paralelismo nativo.

### Mocking e assertions
- **Mockito** para mocks.
- **AssertJ** para asserts fluentes (`assertThat(x).isEqualTo(y)`).

### Testes de integração/Spring
- **Spring Boot Test** (`@SpringBootTest`, `@WebMvcTest`, `@DataJpaTest`) para testar contexto Spring de forma granular.
- **Testcontainers** para bancos de dados e serviços reais em containers.

### Boas práticas
- Cobertura com **JaCoCo**, integrado ao Maven/Gradle.
- Use `@ParameterizedTest` + `@CsvSource`/`@MethodSource` para reduzir duplicação.
- Separe testes unitários (`src/test/java`) dos de integração (sufixo `*IT.java` rodado pelo Failsafe plugin no Maven).

---

## Go

### Testes unitários e de integração
- **testing** (pacote nativo da stdlib) — suficiente para a maioria dos casos, já com suporte a benchmarks e testes paralelos (`t.Parallel()`).
- **Testify** (`testify/assert`, `testify/mock`, `testify/suite`) — biblioteca mais popular para enriquecer o pacote nativo com asserts e mocks.
- **Ginkgo + Gomega** — framework BDD (Behavior-Driven Development) para specs mais expressivas, populares em projetos de infraestrutura (ex. Kubernetes).

### Boas práticas
- Nomeie arquivos `*_test.go` no mesmo pacote do código testado.
- Use table-driven tests (`for _, tt := range cases { ... }`) como padrão idiomático em Go.
- Cobertura nativa: `go test -cover` / `go test -coverprofile=coverage.out`.
- Use `go vet` e `golangci-lint` como complemento aos testes.

---

## Ruby

- **RSpec** — padrão de facto para testes em Ruby/Rails, com sintaxe BDD (`describe`, `context`, `it`).
- **Minitest** — biblioteca padrão do Ruby, mais leve, usada por quem prefere sintaxe estilo `unittest`.
- **FactoryBot** para geração de dados de teste (fixtures dinâmicas).
- **Capybara** para testes de sistema/E2E simulando interação do usuário no navegador.
- **VCR** ou **WebMock** para gravar/mockar chamadas HTTP externas.

---

## PHP

- **PHPUnit** — padrão de facto para testes unitários e de integração em PHP.
- **Pest** — alternativa moderna com sintaxe mais expressiva sobre o PHPUnit, ganhando popularidade em projetos Laravel.
- **Laravel**: usa PHPUnit/Pest integrados, com `RefreshDatabase` trait para testes de integração com banco.
- **Behat** para testes BDD (Gherkin/Cucumber-style).

---

## HTML / Frontend visual

- **Testes de acessibilidade**: **axe-core** (via `jest-axe` ou plugin do Playwright/Cypress) para validar WCAG automaticamente.
- **HyperFrames**: trate a composição como frontend testável; rode `hyperframes lint`/`hyperframes check` quando disponíveis, valide preview em múltiplos formatos e use snapshots ou comparação visual dos frames críticos para detectar regressões.
- **Testes de regressão visual**: ver ferramentas na seção "CSS" abaixo (mesmas ferramentas servem para regressão de marcação + estilo).
- **Validação de marcação**: W3C HTML Validator / `html-validate` em pipelines de CI.
- **Lighthouse CI** para métricas de performance, SEO e acessibilidade automatizadas.
- **Storybook** + **Testing Library** para testar componentes de UI isoladamente (incluindo interações via `play` functions).

---

## CSS

- **Linting de estilo**: **Stylelint** — padrão de facto para lint de CSS/SCSS/Less, detecta erros de sintaxe, propriedades duplicadas, especificidade excessiva e força convenções (ordem de propriedades, nomenclatura BEM, etc.).
- **Testes de regressão visual**: como CSS não tem "lógica" testável da forma tradicional, o teste mais eficaz é comparar screenshots antes/depois das mudanças:
  - **Playwright** (`toHaveScreenshot()`) — nativo, integrado ao pipeline de E2E.
  - **Percy** ou **Chromatic** — plataformas dedicadas a diffs visuais, ótimas integradas a Storybook.
  - **BackstopJS** — ferramenta focada especificamente em regressão visual de CSS/layout.
  - **reg-suit** — alternativa open-source para regressão visual.
- **Testes de responsividade**: rode os testes de regressão visual em múltiplos viewports (mobile, tablet, desktop) via Playwright (`page.setViewportSize`) ou Cypress (`cy.viewport()`).
- **Testes de CSS-in-JS**: para styled-components/Emotion, use snapshot testing (Jest/Vitest `toMatchSnapshot()`) para detectar mudanças não intencionais nos estilos gerados.
- **Validação de compatibilidade**: **Can I Use** + **Autoprefixer**/**PostCSS** para garantir suporte entre navegadores; **BrowserStack**/**Sauce Labs** para testes cross-browser reais.

---

## SQL / Bancos de Dados

- **Testes de migração**: rode migrations para cima e para baixo (`up`/`down`) em pipeline de CI.
- **Testcontainers** (Java, .NET, Node, Python, Go) para rodar Postgres/MySQL/MongoDB reais em containers durante os testes de integração, evitando SQLite/mocks que mascaram diferenças de comportamento do banco real.
- **dbt tests** (para pipelines de dados/analytics) — testes declarativos de qualidade de dados (`unique`, `not_null`, `relationships`).
- Sempre teste queries complexas e stored procedures com dados de exemplo representativos (incluindo casos de borda: valores nulos, strings vazias, duplicatas).

---

## APIs REST / GraphQL

- **Testes de contrato**: **Pact** para testar contratos entre consumidor e provedor em arquiteturas de microsserviços.
- **Testes de API HTTP**: **Postman/Newman**, **REST Assured** (Java), **Supertest** (Node.js), **httpx**/`TestClient` (Python).
- **Testes de carga/performance**: **k6**, **Gatling**, **JMeter** ou **Locust** para simular tráfego e medir latência/throughput sob carga.
- **Schema validation**: valide payloads contra o schema OpenAPI/JSON Schema/GraphQL SDL automaticamente nos testes.

---

## Mobile (iOS / Android / Cross-platform)

- **iOS (Swift)**: **XCTest** (nativo) para unitários e UI tests; **Quick + Nimble** para BDD.
- **Android (Kotlin/Java)**: **JUnit** + **Espresso** (UI tests) + **Mockito**/**MockK** (mocks para Kotlin).
- **React Native**: **Jest** + **React Native Testing Library**, **Detox** para E2E.
- **Flutter**: `flutter_test` (unitários/widget tests, nativo do SDK) + **integration_test** para E2E.

---

## Desktop Apps (Windows / macOS)

### Windows (WinUI, WPF, .NET, Electron)
- **Unitários**: mesmos frameworks do .NET (xUnit/NUnit/MSTest) para a lógica de negócio, isolando a camada de UI via MVVM/MVU (ViewModel testável sem depender da UI real).
- **Testes de UI/E2E nativos**: **WinAppDriver** (Microsoft, baseado em Selenium/Appium) para automação de apps Win32/WPF/WinUI/UWP.
- **WinUI 3 / MAUI**: **Appium** (driver do Windows) ou **Microsoft.UI.Xaml.Tests** para testes de UI dentro do próprio framework.
- **Electron no Windows**: **Playwright** tem suporte experimental a Electron (`_electron` API) para testes E2E de apps Electron; alternativa: **Spectron** (descontinuado, evitar em projetos novos).
- **Empacotamento/instalador**: valide o instalador (MSIX/MSI) em pipeline de CI com testes de smoke pós-instalação.

### macOS (AppKit, SwiftUI, Catalyst, Electron)
- **Unitários**: **XCTest** (nativo), mesma ferramenta usada em iOS — testa ViewModels/Services isolados da camada AppKit/SwiftUI.
- **Testes de UI**: **XCUITest** para automatizar interações reais de UI (cliques, menus, atalhos de teclado) em apps macOS nativos.
- **Electron no macOS**: mesma abordagem do Windows — **Playwright** com suporte a Electron.
- **Notarização/assinatura**: valide em CI que o build final passa por `codesign`/notarization da Apple antes de distribuir (smoke test pós-build).

### Cross-platform desktop (Electron, Tauri, .NET MAUI)
- **Electron**: **Playwright** (Electron API) ou **WebdriverIO** com o serviço `wdio-electron-service` para testes E2E multiplataforma com a mesma base de código.
- **Tauri**: testes de backend Rust com `cargo test` nativo; testes de frontend/WebView com Playwright apontando para a janela do Tauri em modo dev.
- **.NET MAUI**: **xUnit**/**NUnit** para lógica compartilhada; **Appium** para testes de UI end-to-end em Windows e macOS a partir da mesma suíte.

### Boas práticas comuns
- Separe sempre lógica de negócio da camada de UI (MVVM/MVC/MVI) para poder testar sem precisar renderizar janelas — testes de UI real (WinAppDriver/XCUITest/Appium) são mais lentos e devem ficar restritos a fluxos críticos (smoke tests).
- Rode testes de UI desktop em runners de CI com suporte a display virtual (`Xvfb` no Linux, self-hosted runners com Windows/macOS reais para testes nativos — GitHub Actions oferece runners `windows-latest` e `macos-latest`).
- Teste em pelo menos 2 resoluções de tela e 2 níveis de DPI scaling (Windows) / Retina vs. non-Retina (macOS).

---

## Infraestrutura / DevOps / IaC

- **Terraform**: **Terratest** (Go) para validar infraestrutura provisionada; `terraform validate`/`terraform plan` em CI.
- **Kubernetes**: **kind** ou **k3d** para clusters efêmeros em CI; **Ginkgo/Gomega** (usado pelo próprio projeto Kubernetes) para testes de operadores/controllers.
- **Ansible**: **Molecule** para testar playbooks/roles isoladamente.
- **Docker**: valide `Dockerfile` com **hadolint** (linter) e teste a imagem final com **Testcontainers** ou **dgoss**.

---

## Ferramentas complementares (qualquer stack)

- **Linting/Static analysis**: ESLint, Pylint/Ruff, RuboCop, golangci-lint, SonarQube/SonarCloud — não substituem testes, mas pegam problemas antes deles.
- **Mutation testing**: **Stryker** (JS/.NET), **PIT** (Java), **mutmut** (Python) — avalia a qualidade real dos testes, não apenas a cobertura de linhas.
- **Contract/Snapshot testing**: útil para APIs e componentes de UI que mudam com frequência controlada.
- **Testcontainers**: disponível para praticamente todas as linguagens principais (Java, .NET, Node, Python, Go), recomendado sempre que possível para testes de integração com serviços reais (bancos, filas, caches) em vez de mocks.

---

## Template de instruções para CLAUDE.md / AGENTS.md sobre testes

```
## Testes

- Toda função/módulo novo deve ter teste unitário correspondente.
- Toda correção de bug deve incluir um teste de regressão que falha antes
  da correção e passa depois.
- Framework de teste por linguagem:
  - Node/TS: Vitest (unitário) + Playwright (E2E)
  - Python: pytest + pytest-cov
  - .NET: xUnit + Moq/NSubstitute + FluentAssertions
  - Java: JUnit 5 + Mockito + AssertJ
  - Go: testing nativo + Testify (table-driven tests)
  - Ruby: RSpec + FactoryBot
  - PHP: PHPUnit/Pest
  - Mobile: XCTest (iOS) + JUnit/Espresso (Android)
  - Desktop: WinAppDriver (Windows) + XCUITest (macOS), lógica isolada via xUnit/NUnit
- Testes devem rodar com um único comando documentado no README/CLAUDE.md.
- Mock dependências externas (HTTP, banco, filesystem, relógio) em testes
  unitários. Use Testcontainers (ou equivalente) em testes de integração
  com serviços reais.
- Cobertura mínima: 80% geral, 90%+ em lógica de negócio crítica.
- Nenhum teste pode depender de ordem de execução, horário do sistema
  ou dados aleatórios sem seed fixa.
- Todo teste deve rodar em CI a cada push/PR.
- Formatação/lint automatizados: ver regras em [`clean-code-pt.md`](./clean-code-pt.md) (seção
  "Formatação e estilo"). Devem rodar em CI antes/junto dos testes.
```

---

Fontes/base de pesquisa: documentação oficial de cada framework (Vitest, Playwright, pytest, xUnit, JUnit, Testify, RSpec, PHPUnit), pesquisa de mercado "State of JS 2025" sobre adoção e satisfação de ferramentas de teste JavaScript.
