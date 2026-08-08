# Roteador de Guias

> Selecione contexto técnico para o [Loop Engineering](./LOOP_ENGINEERING.md). Este arquivo decide **quais** guias consultar; cada guia decide **como** trabalhar naquele domínio.

## Contrato de seleção

1. Leia o pedido, o diff pretendido e o [perfil do projeto](./PROJECT_PROFILE.md).
2. Escolha um idioma.
3. Identifique as superfícies realmente afetadas.
4. Ative o guia principal e os complementares necessários aos riscos.
5. Localize títulos e palavras-chave antes de carregar arquivos longos.
6. Anuncie os IDs escolhidos e uma justificativa curta.
7. Reavalie a rota se o escopo mudar durante a execução.

### Idioma

A ordem de decisão é:

1. idioma explicitamente pedido pelo usuário;
2. `language` em `PROJECT_PROFILE.md`;
3. PT-BR como fallback.

Use somente a coluna selecionada do catálogo. Não carregue PT-BR e English juntos para obter “mais contexto”. A contraparte serve para outro idioma e para manutenção de paridade.

### Evidência de ativação

Ative por combinação de intenção, arquivos e risco. Uma palavra isolada em documentação, lockfile ou exemplo não comprova uma stack nem ativa automaticamente um guia.

Perguntas úteis:

- Qual comportamento ou artefato será alterado?
- Existe interface humana, dado sensível, caminho crítico ou sistema externo?
- Quais arquivos serão modificados?
- Quais verificações demonstrarão o resultado?
- O usuário pediu explicitamente um padrão ou domínio?

## Catálogo canônico

| ID | Português | English | Responsabilidade |
| --- | --- | --- | --- |
| `premium` | [Sites premium](./PT-BR/premium-sites-studio-pt.md) | [Premium websites](./ENG/premium-sites-studio-eng.md) | Processo integral de sites e experiências web de alto padrão |
| `clean` | [Código limpo](./PT-BR/clean-code-pt.md) | [Clean code](./ENG/clean-code-eng.md) | Estrutura, legibilidade, observabilidade e manutenção |
| `test` | [Testes](./PT-BR/test-code-pt.md) | [Testing](./ENG/test-code-eng.md) | Estratégia e ferramentas de verificação orientadas a risco |
| `security` | [Segurança](./PT-BR/sec-code-pt.md) | [Security](./ENG/sec-code-eng.md) | Web, APIs, mobile, desktop, dados e supply chain |
| `design` | [Design](./PT-BR/design-code-pt.md) | [Design](./ENG/design-code-eng.md) | Direção visual, UX, motion e performance percebida |
| `performance` | [Performance](./PT-BR/perf-code-pt.md) | [Performance](./ENG/perf-code-eng.md) | Medição, diagnóstico, budgets e otimização |
| `accessibility` | [Acessibilidade](./PT-BR/acessibilidade-code-pt.md) | [Accessibility](./ENG/accessibility-eng.md) | WCAG, teclado, foco, semântica e tecnologia assistiva |
| `games` | [Games web](./PT-BR/games-code-design-web-pt.md) | [Web games](./ENG/games-code-design-web-eng.md) | Arquitetura e operação de games 2D, 3D e procedurais |

## Regras por guia

### `clean` — código e estrutura

**Ative quando:** criar ou modificar código, corrigir bug, refatorar, alterar arquitetura, revisar qualidade ou produzir instruções de desenvolvimento.

**Não ative apenas porque:** o repositório contém snippets em uma documentação sem mudança de código.

**Combine normalmente com:** `test`; acrescente `security`, `performance`, `design` ou `accessibility` conforme a superfície.

**Localize primeiro:**

```bash
rg -n '^## (Estilo|Comentários|Testes|Dependências|Estrutura|Logging|Debugging)|responsabilidade|tipagem|erros' PT-BR/clean-code-pt.md
```

**Evidência esperada:** diff pequeno e legível, interfaces coerentes, tratamento de erro, testes e checks oficiais.

### `test` — estratégia de verificação

**Ative quando:** houver comportamento novo ou alterado, correção de bug, integração, release, mudança de configuração executável ou pedido de QA.

**Não ative apenas porque:** um texto cita um framework de testes sem executar ou alterar software.

**Combine normalmente com:** todo guia que produza comportamento; use o domínio para decidir os níveis de teste.

**Localize primeiro:**

```bash
rg -n '^## |risco|regressão|unit|integração|E2E|acessibilidade|carga|CI' PT-BR/test-code-pt.md
```

**Evidência esperada:** reprodução RED quando aplicável, check específico GREEN e regressão proporcional.

### `security` — confiança e superfícies externas

**Ative quando:** houver autenticação, autorização, entrada não confiável, API, banco, upload, secrets, dependências, CI/CD, mobile/desktop, criptografia, dados pessoais, pagamento ou publicação.

**Não ative apenas porque:** um arquivo menciona OWASP ou segurança em uma referência sem alterar superfície de confiança.

**Combine normalmente com:** `clean` e `test`; acrescente `performance` quando controles afetarem latência ou disponibilidade.

**Localize primeiro:**

```bash
rg -n '^## |autenticação|autorização|upload|SSRF|CSP|OAuth|JWT|secrets|supply chain|mobile|desktop' PT-BR/sec-code-pt.md
```

**Evidência esperada:** limites de confiança explícitos, validação no servidor, least privilege, nenhum secret no Git e testes negativos.

### `performance` — custo mensurável

**Ative quando:** o pedido envolver lentidão, escala, caminho crítico, renderização, bundle, banco, rede, memória, bateria, carga, Web Vitals, FPS ou budget.

**Não ative apenas porque:** toda tarefa poderia teoricamente ser “mais rápida”. Sem risco ou métrica, evite otimização especulativa.

**Combine normalmente com:** `test`; use `design` para performance percebida e `security` para disponibilidade/abuso.

**Localize primeiro:**

```bash
rg -n '^## |baseline|budget|p75|p95|Web Vitals|profil|banco|mobile|desktop|carga' PT-BR/perf-code-pt.md
```

**Evidência esperada:** baseline, hipótese, medição comparável antes/depois e ausência de regressão funcional.

### `design` — interface e experiência

**Ative quando:** criar, redesenhar ou revisar UI, layout, componente, identidade visual, motion, responsividade, app mobile/desktop ou experiência premium.

**Não ative apenas porque:** uma API sem interface possui a palavra “design” em documentação arquitetural.

**Combine normalmente com:** `accessibility`, `test` e `performance`; use `security` para formulários, autenticação e conteúdo externo.

**Localize primeiro:**

```bash
rg -n '^## |paleta|tipografia|layout|mobile|motion|componentes|checklist' PT-BR/design-code-pt.md
```

**Evidência esperada:** estados completos, hierarquia coerente, responsividade, validação visual e fallback para aprimoramentos opcionais.

### `accessibility` — acesso equivalente

**Ative quando:** houver interface, conteúdo audiovisual, navegação, formulário, componente interativo, game, app mobile/desktop ou alteração que possa afetar conclusão de tarefa.

**Não ative apenas porque:** um serviço interno sem interface transporta dados já normalizados e não muda conteúdo ou contrato consumido por usuários.

**Combine normalmente com:** `design` e `test`; acrescente o guia do domínio da interface.

**Localize primeiro:**

```bash
rg -n '^## |WCAG|teclado|foco|contraste|ARIA|leitor|motion|Definition of Done' PT-BR/acessibilidade-code-pt.md
```

**Evidência esperada:** semântica, teclado, foco, contraste, zoom/reflow, reduced motion e teste manual/automatizado compatível.

### `premium` — produção completa de site

**Ative quando:** criar ou revisar integralmente landing page, site institucional, portfólio, campanha ou experiência web que exija padrão de estúdio.

**Não ative quando:** a tarefa é um componente isolado, uma API ou manutenção técnica sem processo completo de site.

**Combine normalmente com:** `design`, `accessibility`, `clean`, `test`, `security` e `performance`.

**Localize primeiro:**

```bash
rg -n '^## [0-9]+\.|brief|conteúdo|direção|design system|implementação|qualidade|lançamento' PT-BR/premium-sites-studio-pt.md
```

**Evidência esperada:** gates de estratégia, conteúdo, direção, produção, qualidade, lançamento e operação aprovados.

### `games` — runtime e produto de game web

**Ative quando:** projetar, implementar, testar ou operar game web 2D/3D, geração procedural, game loop, assets, input, multiplayer ou distribuição do jogo.

**Não ative quando:** “game” aparece apenas como gamificação simples de uma interface comum; nesse caso use os guias de UI e código.

**Combine normalmente com:** `clean`, `test`, `security`, `performance` e `accessibility`; acrescente `design` para UI e direção visual.

**Localize primeiro:**

```bash
rg -n '^## |game loop|procedural|input|assets|áudio|multiplayer|WASM|PWA|CI/CD' PT-BR/games-code-design-web-pt.md
```

**Evidência esperada:** simulação verificável, determinismo quando prometido, fallback de capacidade, budgets, acessibilidade e gates de release.

## Matriz por tipo de trabalho

| Trabalho | Guia principal | Complementares normalmente necessários | Excluir quando |
| --- | --- | --- | --- |
| Alteração documental | Guia do domínio | `test` somente se exemplos/comandos forem executáveis | Não há comportamento de software |
| Código ou bug sem UI | `clean` | `test`; `security` e `performance` pelo risco | Superfície não foi alterada |
| Backend/API/dados | `clean` | `test`, `security`; `performance` para caminho crítico | Não existe aquela camada |
| UI web/mobile/desktop | `design` | `accessibility`, `clean`, `test`; risco define os demais | Mudança não alcança usuário |
| Site completo | `premium` | `design`, `accessibility`, `clean`, `test`, `security`, `performance` | Entrega não é um site integral |
| Game web | `games` | `clean`, `test`, `security`, `performance`, `accessibility`; `design` com UI | Produto não é game |
| Vídeo/motion HTML | `design` | `accessibility`, `performance`, `test`, `security` | Não há composição audiovisual |
| Infra/CI/CD | `security` | `test`; `performance` quando disponibilidade/custo mudar | Alteração é texto não executável |

HyperFrames é opcional e só deve ser usado quando solicitado ou já disponível e adequado. Sua presença em referências não autoriza instalação.

## Cenários verificáveis

Os comentários de rota são contratos estáveis para o validador. Eles registram IDs, não caminhos ou instruções de carregamento.

### Landing page premium

<!-- route:landing-page-premium=premium,design,accessibility,clean,test,security,performance -->

Verificar brief, conteúdo, UI responsiva, estados, WCAG, build, testes, Web Vitals, formulários, analytics e lançamento.

### API com autenticação

<!-- route:api-auth=clean,test,security,performance -->

Verificar contratos HTTP, validação, autenticação/autorização, testes negativos, persistência, rate limiting, observabilidade e latência do caminho crítico.

### Bug sem interface

<!-- route:bug-sem-interface=clean,test -->

Começar com reprodução e teste de regressão. Ativar `security` ou `performance` somente se a causa ou a correção alcançar essas superfícies.

### App mobile com UI

<!-- route:app-mobile-ui=clean,test,design,accessibility,security,performance -->

Verificar plataforma nativa/cross-platform real, estados, gestos, teclado/foco, acessibilidade, armazenamento, rede, bateria, memória e testes em alvo compatível.

### Game web multiplayer

<!-- route:game-web-multiplayer=games,clean,test,security,performance,accessibility,design -->

Verificar game loop, servidor autoritativo, reconciliação, input, assets, fallback, budgets, acessibilidade, segurança e release.

### Alteração documental

<!-- route:documentacao=domain -->

`domain` significa o único guia de domínio implicado pela alteração. Verificar Markdown, links, caminhos, comandos, exemplos e paridade quando a regra normativa mudar.

## Mudança de rota

Se a investigação revelar nova superfície, atualize o conjunto antes de editar essa área. Registre apenas a justificativa concisa; não crie log versionado por tarefa.

Se um guia aplicável estiver ausente ou inacessível, use defaults conservadores, não invente conteúdo e declare a limitação na entrega.
