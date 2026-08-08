# Guias de Instruções para Agentes de IA

[![Docs quality](https://github.com/cassiomc1/mdfiles/actions/workflows/docs-quality.yml/badge.svg?branch=main)](https://github.com/cassiomc1/mdfiles/actions/workflows/docs-quality.yml)

Coleção bilíngue de guias operacionais para agentes de IA e desenvolvedores. O conteúdo cobre estratégia de produto, código, testes, segurança, performance, acessibilidade, design e games web em projetos web, mobile e desktop.

Bilingual collection of operational guides for AI agents and developers. It covers product strategy, code, testing, security, performance, accessibility, design, and web games across web, mobile, and desktop projects.

Os arquivos são Markdown e podem ser usados como referência ou como base para `AGENTS.md`, `CLAUDE.md`, `.cursor/rules` e `.github/copilot-instructions.md`. Adote somente os guias relevantes ao projeto; esta coleção não é um pacote de dependências.

The files are Markdown and can be used as references or as a foundation for `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, and `.github/copilot-instructions.md`. Adopt only the guides relevant to the project; this collection is not a dependency bundle.

## Catálogo / Catalog

| Tema / Topic | Quando usar / When to use | Português | English |
| --- | --- | --- | --- |
| Sites premium / Premium websites | Processo completo de estratégia ao lançamento / End-to-end process from strategy to launch | [`premium-sites-studio-pt.md`](./PT-BR/premium-sites-studio-pt.md) | [`premium-sites-studio-eng.md`](./ENG/premium-sites-studio-eng.md) |
| Código limpo / Clean code | Código legível, observável, seguro e operável / Readable, observable, secure, and operable code | [`clean-code-pt.md`](./PT-BR/clean-code-pt.md) | [`clean-code-eng.md`](./ENG/clean-code-eng.md) |
| Testes / Testing | Estratégia de testes orientada a risco / Risk-based testing strategy | [`test-code-pt.md`](./PT-BR/test-code-pt.md) | [`test-code-eng.md`](./ENG/test-code-eng.md) |
| Segurança / Security | Web, mobile, desktop, APIs e supply chain / Web, mobile, desktop, APIs, and supply chain | [`sec-code-pt.md`](./PT-BR/sec-code-pt.md) | [`sec-code-eng.md`](./ENG/sec-code-eng.md) |
| Design | Direção visual, UX, motion e performance percebida / Visual direction, UX, motion, and perceived performance | [`design-code-pt.md`](./PT-BR/design-code-pt.md) | [`design-code-eng.md`](./ENG/design-code-eng.md) |
| Performance | Medição, diagnóstico, budgets e otimização / Measurement, diagnosis, budgets, and optimization | [`perf-code-pt.md`](./PT-BR/perf-code-pt.md) | [`perf-code-eng.md`](./ENG/perf-code-eng.md) |
| Acessibilidade / Accessibility | Protocolo orientado à WCAG 2.2 para interfaces / WCAG 2.2-oriented protocol for interfaces | [`acessibilidade-code-pt.md`](./PT-BR/acessibilidade-code-pt.md) | [`accessibility-eng.md`](./ENG/accessibility-eng.md) |
| Games web / Web games | Arquitetura, design e operação de games 2D, 3D e procedurais / Architecture, design, and operation of 2D, 3D, and procedural games | [`games-code-design-web-pt.md`](./PT-BR/games-code-design-web-pt.md) | [`games-code-design-web-eng.md`](./ENG/games-code-design-web-eng.md) |

Cada guia declara no frontmatter o idioma, a contraparte, a versão e a data da última revisão. Os 8 pares estão alinhados na versão `2026.08`, revisada em `2026-08-08`.

Each guide declares its language, counterpart, version, and last review date in frontmatter. All 8 pairs are aligned at version `2026.08`, reviewed on `2026-08-08`.

## Como adotar / How to adopt

1. Escolha o idioma e os guias aplicáveis ao projeto. / Choose the language and the guides that apply to the project.
2. Use o guia de sites premium como processo principal quando houver uma entrega web completa. / Use the premium websites guide as the main process for complete web deliveries.
3. Combine design, acessibilidade, performance, segurança e testes como requisitos transversais. / Combine design, accessibility, performance, security, and testing as cross-cutting requirements.
4. Copie apenas os templates e regras necessários para o arquivo de instruções do projeto. / Copy only the templates and rules needed by the project's instruction file.
5. Preserve links para os guias de origem e evite duplicar regras divergentes. / Preserve links to the source guides and avoid duplicating divergent rules.

## Política de ferramentas / Tooling policy

**Português:** identifique a stack, a etapa do trabalho e os checks aplicáveis. Prefira uma ferramenta equivalente já disponível quando ela produzir evidência compatível. Peça autorização antes de instalar software ou alterar o ambiente. Se uma verificação necessária não puder ser executada e não houver alternativa segura, registre o bloqueio e não afirme que o check passou. Referências opcionais não devem ser instaladas automaticamente.

**English:** identify the stack, the current stage, and the applicable checks. Prefer an equivalent tool already available when it produces compatible evidence. Ask for authorization before installing software or changing the environment. If a required check cannot run and no safe alternative exists, record the blocker and do not claim that the check passed. Optional references must not be installed automatically.

## HyperFrames para vídeo e motion / HyperFrames for video and motion

[HyperFrames](https://hyperframes.heygen.com) é uma opção para trailers, demonstrações, apresentações e motion graphics determinísticos baseados em HTML, CSS e JavaScript. Ele complementa os guias de design, acessibilidade, performance e testes; não substitui essas validações. Consulte o [quickstart](https://hyperframes.heygen.com/quickstart) e a [CLI](https://hyperframes.heygen.com/packages/cli) antes da adoção. O render local requer Node.js 22+ e FFmpeg.

[HyperFrames](https://hyperframes.heygen.com) is an option for deterministic HTML, CSS, and JavaScript-based trailers, demos, presentations, and motion graphics. It complements the design, accessibility, performance, and testing guides; it does not replace those validations. Review the [quickstart](https://hyperframes.heygen.com/quickstart) and [CLI documentation](https://hyperframes.heygen.com/packages/cli) before adoption. Local rendering requires Node.js 22+ and FFmpeg.

## Estrutura / Structure

```text
.
├── PT-BR/                         # 8 guias em português
├── ENG/                           # 8 English guides
├── .github/workflows/             # automação de qualidade
├── .gitignore                     # arquivos locais ignorados pelo Git
├── .lychee.toml                   # verificação de links
├── .markdownlint-cli2.jsonc       # regras de Markdown
├── THIRD_PARTY_NOTICES.md         # proveniência e direitos
└── README.md
```

## Manutenção / Maintenance

- Atualize as duas contrapartes quando uma regra normativa mudar. / Update both counterparts when a normative rule changes.
- Preserve a paridade de requisitos, exceções, números, exemplos e referências. / Preserve parity for requirements, exceptions, numbers, examples, and references.
- Atualize `version` e `last-reviewed` no frontmatter quando aplicável. / Update `version` and `last-reviewed` in frontmatter when applicable.
- Use ponto decimal em inglês e vírgula decimal em português fora de código e URLs. / Use decimal points in English and decimal commas in Portuguese outside code and URLs.
- Verifique se os links relativos continuam dentro do repositório. / Verify that relative links remain inside the repository.

Lint local / Local lint:

```bash
npx --yes markdownlint-cli2@0.23.2
```

O workflow [Docs quality](./.github/workflows/docs-quality.yml) também verifica links, frontmatter, nomes únicos, contrapartes, fences de código e links relativos em pushes e pull requests.

The [Docs quality](./.github/workflows/docs-quality.yml) workflow also checks links, frontmatter, unique names, counterparts, code fences, and relative links on pushes and pull requests.

## Direitos e proveniência / Rights and provenance

Esta coleção não declara uma licença global. Qualquer reutilização depende da autorização do titular aplicável e das condições registradas em [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

This collection does not declare a global license. Any reuse depends on permission from the applicable rights holder and on the conditions recorded in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
