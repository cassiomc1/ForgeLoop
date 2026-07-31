# Guias de Instruções para Agentes de IA

Coleção de guias práticos em português para orientar **agentes de IA** (Claude Code, Cursor, GitHub Copilot, etc.) e desenvolvedores em boas práticas de código, testes, segurança, performance e design — cobrindo **web** (desktop e mobile), **apps mobile nativos** (iOS/Android) e **apps desktop nativos** (Windows/macOS).

Os arquivos foram pensados para serem usados como referência ao montar arquivos de contexto de agente (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, `.github/copilot-instructions.md`), ou para consulta direta durante o desenvolvimento. Cada arquivo indica no início quais outros são complementares, para evitar regras duplicadas entre eles.

---

## 📄 Arquivos

### [`clean-code.md`](./clean-code.md) — Código limpo para agentes de IA

Tradução e adaptação do artigo *"Clean Code for AI Agents"* de Fabio Akita, reorganizada como instruções práticas. Parte do princípio de que, em 2026, o principal "leitor" do código passou a ser um agente de IA, e não mais um humano — o que muda a prioridade de várias práticas clássicas do livro *Clean Code* (Uncle Bob).

Cobre, em ordem de importância para um agente:
- Funções e arquivos pequenos (evita truncamento de leitura)
- Princípio da Responsabilidade Única (SRP)
- Nomes significativos e **buscáveis** (importantes para grep)
- Comentários com contexto e proveniência (por que o agente deve *manter*, não remover, comentários)
- Tipagem explícita, DRY, testes executáveis, estrutura de diretórios previsível
- Injeção de dependência, evitar aninhamento profundo, erros com contexto, formatação automática
- Uma seção de **debugging**: o que fazer quando um erro não tem causa óbvia (aumentar o nível de log antes de tentar correções especulativas)
- Um template pronto para colar em `CLAUDE.md`/`AGENTS.md`

### [`test-code.md`](./test-code.md) — Guia de testes por linguagem e tecnologia

Framework e ferramentas de teste recomendados (unitário, integração, E2E) para as principais stacks do mercado, incluindo:
- **Backend/linguagens**: JavaScript/TypeScript (Vitest, Playwright, Jest), Python (pytest), .NET/C# (xUnit, Moq), Java (JUnit 5, Mockito), Go (testing + Testify), Ruby (RSpec), PHP (PHPUnit/Pest)
- **Frontend**: HTML (acessibilidade, Lighthouse, Storybook) e CSS (Stylelint, regressão visual, responsividade)
- **Dados e integração**: SQL/bancos de dados, APIs REST/GraphQL, Testcontainers
- **Mobile**: iOS (XCTest), Android (JUnit/Espresso), React Native (Detox), Flutter (`flutter_test`)
- **Desktop nativo**: Windows (WinAppDriver), macOS (XCUITest), apps cross-platform (Electron, Tauri, .NET MAUI)
- Princípios gerais (pirâmide de testes, F.I.R.S.T, cobertura, testes determinísticos) e um template pronto para `CLAUDE.md`/`AGENTS.md`

### [`sec-code.md`](./sec-code.md) — Boas práticas de segurança

Guia de segurança (*secure coding*) baseado no **OWASP Top 10:2025** (web) e no **OWASP Mobile Top 10:2024**, cobrindo:
- Princípios gerais (secure by design, menor privilégio, defesa em profundidade, nunca confiar no cliente, gestão de segredos)
- Os 10 riscos do OWASP Top 10:2025 e como mitigá-los
- Segurança de backend por linguagem (Node, Python, .NET, Java, PHP, Ruby, Go)
- Segurança de frontend (CSP, XSS, CSRF, cookies, CORS, headers HTTP)
- APIs REST/GraphQL, autenticação (OAuth2/JWT), banco de dados, DevOps/CI-CD (SAST/DAST, secrets management, container security)
- **Mobile**: os 10 riscos do OWASP Mobile Top 10:2024, com detalhes específicos de iOS (Keychain, ATS, certificate pinning) e Android (Keystore, Network Security Config, ProGuard/R8)
- **Desktop**: Windows (DPAPI, code signing) e macOS (Keychain, notarização, App Sandbox)
- Apps híbridos (Electron, React Native, Flutter, .NET MAUI) e um template pronto para `CLAUDE.md`/`AGENTS.md`

### [`design-code.md`](./design-code.md) — Design premium para web, mobile e desktop

Guia de direção visual, UX, motion e performance percebida para criar (ou revisar) experiências digitais com aparência premium/high-end. Funciona como uma "receita" com valores exatos, não apenas sugestões:
- Paletas de cores prontas e combinações tipográficas prontas (escolher 1 de cada, nunca misturar)
- Layout, espaçamento, grid e anatomia de página padrão para landing pages
- Especificidades de **web mobile** (safe areas, área de toque, CTA sticky, performance mobile-first)
- Motion com GSAP/ScrollTrigger e regras de uso de 3D/Three.js
- Componentes premium com specs exatos (botões, cards, navegação, imagens)
- Acessibilidade, performance percebida (Core Web Vitals) e uma "lista negra" de anti-padrões a evitar
- **Apps mobile nativos** (iOS — Human Interface Guidelines; Android — Material Design 3)
- **Apps desktop nativos** (Windows — Fluent Design/WinUI; macOS — Human Interface Guidelines)
- Checklists de revisão para cada contexto (web, mobile, desktop)

### [`perf-code.md`](./perf-code.md) — Performance por tecnologia e plataforma

Guia técnico para medir, diagnosticar e melhorar performance real, sem otimizações especulativas. Cobre:
- Processo de profiling, baseline, métricas p50/p75/p95/p99, budgets e observabilidade
- **Web**: Core Web Vitals (LCP, INP, CLS), TTFB, CDN, cache, imagens, HTML/CSS, JavaScript, React/Next.js, Vue/Nuxt, Angular, PWA e WebAssembly
- **Backend e APIs**: Node.js/TypeScript, Python, .NET/ASP.NET Core, Java/Spring e Go
- **Bancos de dados**: PostgreSQL, MySQL/MariaDB, SQL Server, Redis, MongoDB e Elasticsearch/OpenSearch
- **Mobile**: iOS/Swift/SwiftUI/UIKit, Android/Kotlin/Compose/Views, React Native e Flutter
- **Desktop**: Windows/WinUI/WPF/Win32, macOS/AppKit/SwiftUI, Electron e Tauri
- **Infraestrutura**: APIs distribuídas, filas, containers, cloud, autoscaling e load testing
- Um template pronto para `CLAUDE.md`/`AGENTS.md` e checklist completo de revisão de performance

---

## English versions

English translations of all guides are available with `-eng` before the `.md` extension:

| Portuguese guide | English version | Description |
|---|---|---|
| [`clean-code.md`](./clean-code.md) | [`clean-code-eng.md`](./clean-code-eng.md) | Clean code principles adapted for AI agents. |
| [`test-code.md`](./test-code.md) | [`test-code-eng.md`](./test-code-eng.md) | Testing frameworks and practices by language and platform. |
| [`sec-code.md`](./sec-code.md) | [`sec-code-eng.md`](./sec-code-eng.md) | Secure coding practices for web, mobile and desktop. |
| [`design-code.md`](./design-code.md) | [`design-code-eng.md`](./design-code-eng.md) | Premium design guidelines for web, mobile and desktop apps. |
| [`perf-code.md`](./perf-code.md) | [`perf-code-eng.md`](./perf-code-eng.md) | Performance practices for web, mobile, desktop, APIs and databases. |

The English files preserve the same technical structure, commands, code examples, metrics, links and agent instruction templates as the Portuguese originals.

## 🎯 Como usar

1. Escolha o(s) arquivo(s) relevante(s) para o seu projeto.
2. Copie os blocos de "Template de instruções" (presentes em `clean-code.md`, `test-code.md`, `sec-code.md` e `perf-code.md`) para o `CLAUDE.md`/`AGENTS.md`/`.cursor/rules` do seu projeto, adaptando à sua stack.
3. Use `design-code.md` como receita ao criar ou revisar a UI de um produto (web, mobile ou desktop).
4. Use `perf-code.md` para definir budgets, instrumentação e critérios de performance antes de otimizar.
5. Se for expandir algum arquivo, verifique primeiro a nota "Documentos relacionados" no topo de cada um, para não duplicar uma regra que já existe em outro arquivo.
