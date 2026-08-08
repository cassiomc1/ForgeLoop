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

## Loop universal / Universal loop

O kit transforma cada pedido em um ciclo verificável: descobrir o projeto, definir um contrato, selecionar os guias aplicáveis, executar, verificar, diagnosticar e corrigir até atingir o sucesso ou um bloqueio externo real. O [`LOOP_ENGINEERING.md`](./LOOP_ENGINEERING.md) é a fonte operacional; o [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md) evita carregar documentos irrelevantes; e o [`PROJECT_PROFILE.md`](./PROJECT_PROFILE.md) preserva somente fatos duráveis e comprovados do projeto.

The kit turns every request into a verifiable cycle: discover the project, define the execution contract, select applicable guides, execute, verify, diagnose, and correct until success or a genuine external blocker. Thin adapters support Codex, Claude Code, Cursor, and GitHub Copilot while delegating to the same canonical files.

```text
Pedido → descoberta → perfil → roteamento → plano → execução
       → verificação → correção, se necessária → evidências finais
```

### Instalação em um projeto

Baixe o repositório privado como ZIP ou clone-o em um diretório temporário. Copie esta estrutura para a raiz do projeto de destino, preservando os caminhos:

```text
AGENTS.md
CLAUDE.md
LOOP_ENGINEERING.md
GUIDE_ROUTER.md
PROJECT_PROFILE.md
LOOP_SYSTEM_DESIGN.md
.github/copilot-instructions.md
.cursor/rules/project-loop.mdc
PT-BR/
ENG/
```

Se o projeto já possuir `AGENTS.md`, `CLAUDE.md`, instruções do Copilot ou regras do Cursor, incorpore apenas o bloco que aponta para o loop; não sobrescreva regras específicas existentes. As pastas `scripts/`, `.github/workflows/` e os arquivos de qualidade são opcionais para quem apenas consome o kit, mas necessários para manter ou validar a coleção.

### Primeira execução

Na primeira tarefa em um projeto com código ou manifests, o agente deve trocar `profile-mode` de `template` para `project`, descobrir a stack e preencher somente fatos confirmados em `PROJECT_PROFILE.md`. O português é o idioma padrão; use `language: en` para selecionar as contrapartes inglesas.

O perfil não guarda tokens, senhas, chaves ou logs de tarefas. Comandos desconhecidos continuam marcados como não verificados até aparecer uma fonte real no projeto.

### Confirmar ativação

Envie este pedido ao agente antes da primeira implementação:

```text
Antes de implementar, informe qual perfil do projeto foi confirmado, quais guias foram selecionados pelo GUIDE_ROUTER.md e quais verificações serão usadas. Não altere arquivos ainda.
```

A resposta deve citar evidências do perfil, um único idioma, os IDs dos guias selecionados e comandos reais do projeto. Uma resposta genérica que não mencione o loop, o roteador ou as fontes indica que o adaptador não foi carregado.

### Atualizar o kit

Ao baixar uma versão nova, preserve os fatos específicos do `PROJECT_PROFILE.md` do projeto de destino. Compare adaptadores antes de substituí-los, atualize loop, roteador e guias como um conjunto coerente e não apague instruções locais. Se o validador tiver sido copiado, execute:

```bash
python3 scripts/validate_loop_system.py --self-test
python3 scripts/validate_loop_system.py
```

O racional e os limites da arquitetura estão em [`LOOP_SYSTEM_DESIGN.md`](./LOOP_SYSTEM_DESIGN.md).

## Política de ferramentas / Tooling policy

**Português:** identifique a stack, a etapa do trabalho e os checks aplicáveis. Prefira uma ferramenta equivalente já disponível quando ela produzir evidência compatível. Peça autorização antes de instalar software ou alterar o ambiente. Se uma verificação necessária não puder ser executada e não houver alternativa segura, registre o bloqueio e não afirme que o check passou. Referências opcionais não devem ser instaladas automaticamente.

**English:** identify the stack, the current stage, and the applicable checks. Prefer an equivalent tool already available when it produces compatible evidence. Ask for authorization before installing software or changing the environment. If a required check cannot run and no safe alternative exists, record the blocker and do not claim that the check passed. Optional references must not be installed automatically.

## HyperFrames para vídeo e motion / HyperFrames for video and motion

[HyperFrames](https://hyperframes.heygen.com) é uma opção para trailers, demonstrações, apresentações e motion graphics determinísticos baseados em HTML, CSS e JavaScript. Ele complementa os guias de design, acessibilidade, performance e testes; não substitui essas validações. Consulte o [quickstart](https://hyperframes.heygen.com/quickstart) e a [CLI](https://hyperframes.heygen.com/packages/cli) antes da adoção. O render local requer Node.js 22+ e FFmpeg.

[HyperFrames](https://hyperframes.heygen.com) is an option for deterministic HTML, CSS, and JavaScript-based trailers, demos, presentations, and motion graphics. It complements the design, accessibility, performance, and testing guides; it does not replace those validations. Review the [quickstart](https://hyperframes.heygen.com/quickstart) and [CLI documentation](https://hyperframes.heygen.com/packages/cli) before adoption. Local rendering requires Node.js 22+ and FFmpeg.

## Estrutura / Structure

```text
.
├── AGENTS.md                      # entrada Codex e agentes compatíveis
├── CLAUDE.md                      # entrada Claude Code
├── LOOP_ENGINEERING.md            # ciclo operacional canônico
├── GUIDE_ROUTER.md                # seleção contextual dos guias
├── PROJECT_PROFILE.md             # fatos verificados do projeto
├── LOOP_SYSTEM_DESIGN.md          # arquitetura e limites
├── PT-BR/                         # 8 guias em português
├── ENG/                           # 8 English guides
├── .cursor/rules/                 # regra sempre ativa do Cursor
├── .github/copilot-instructions.md # entrada GitHub Copilot
├── .github/workflows/             # automação de qualidade
├── scripts/                       # validação estrutural do kit
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
python3 scripts/validate_loop_system.py --self-test
python3 scripts/validate_loop_system.py
```

O workflow [Docs quality](./.github/workflows/docs-quality.yml) também verifica links, frontmatter, nomes únicos, contrapartes, fences de código, links relativos, adaptadores, pares do roteador e cenários de seleção em pushes e pull requests.

The [Docs quality](./.github/workflows/docs-quality.yml) workflow also checks links, frontmatter, unique names, counterparts, code fences, relative links, adapters, router pairs, and selection scenarios on pushes and pull requests.

## Direitos e proveniência / Rights and provenance

Esta coleção não declara uma licença global. Qualquer reutilização depende da autorização do titular aplicável e das condições registradas em [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

This collection does not declare a global license. Any reuse depends on permission from the applicable rights holder and on the conditions recorded in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
