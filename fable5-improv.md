# fable5-improv — Análise Completa do Projeto ForgeLoop e Melhorias Sugeridas

> Data da análise: 2026-08-29
> Versão analisada: `@cassiomc1/forgeloop` **1.6.3** (protocolo v1)
> Ambiente: Node v22.23.2 / npm 10.9.8 / Linux sandbox

---

## 1. Resumo Executivo

O **ForgeLoop** é um protocolo de engenharia portável e verificável para
ambientes de codificação assistidos por IA. É um CLI de protocolo/suporte
(não um runtime de agente) implementado apenas com built-ins do Node,
com 65 comandos CLI, 36 schemas versionados, adaptador MCP opcional e um
PoC de execução real com evidências criptográficas.

### Estado verificado nesta análise (evidência observada)

| Verificação | Resultado |
| --- | --- |
| `npm test` (Node) | ✅ **1281/1281 testes passando** (~288s) |
| `pytest` (Python, validadores CI) | ✅ 50 passed + 15 subtests |
| `npm run lint` (ESLint) | ✅ Sem erros/avisos |
| `npm run coverage` (c8) | ✅ **82.43% linhas / 74.97% branches / 82.63% funções** (gates: 80/70/75) |
| `npm run dependency:policy` | ✅ Apenas `c8` e `eslint` (dev-only) |
| `npm audit` | ✅ 0 vulnerabilidades |
| `npm run docs:generated:check` | ✅ Documentação gerada fresca |
| `npm run docs:diagrams:check` | ✅ Diagramas válidos (Archify 2.15.0) |
| `npm run docs:conformance` | ✅ 23 artefatos, 65 comandos, 191 códigos de erro |
| `npm run docs:report` | ✅ 0 contratos de documentação quebrados |
| `npm run poc:evidence:verify` | ✅ Pacote de evidência íntegro (drift STALE documentado/esperado) |
| `npm run mcp:test` (sem setup) | ❌ **16/16 falham sem `npm run mcp:setup` prévio** (ver §4.1) |
| CLI smoke (`--version`, `protocol-info`) | ✅ Funcional, startup ~170–260ms |
| TODO/FIXME no código | ✅ Zero ocorrências |
| Uso de `shell: true` em child_process | ✅ Nenhum (spawn seguro por argv) |

**Avaliação geral: projeto em estado excepcional de maturidade.** Os pontos
levantados abaixo são majoritariamente refinamentos de DX (developer
experience), robustez de tooling, manutenção de longo prazo e pequenas
inconsistências — não defeitos funcionais.

---

## 2. Visão da Arquitetura

```text
src/cli.js (713 l)  ──► dispatcher (CLI_COMMAND_DEFINITIONS + COMMAND_EXECUTORS)
src/commands/ (65 arquivos, ~4.4k l)  ──► formatação/apresentação por comando
src/core/     (141 arquivos, ~29k l)  ──► lógica de protocolo (estado, ledger,
                                          claims, completion, policy, actions…)
src/integration.js  ──► superfície programática estável (usada pelo MCP)
integrations/mcp/   ──► adaptador MCP local-first (pacote separado 0.1.0)
schemas/ (36)       ──► contratos JSON versionados (schemaVersion 1)
conformance/ (20)   ──► cenários de conformidade
tests/ (196 arquivos)──► regressão Node + validadores Python frozen
poc/                ──► evidência pública de execução real com auditoria
```

Pontos fortes estruturais:

- **Zero dependências de runtime** — só built-ins do Node; política de
  dependências executável (`check-dependency-policy.mjs`) que falha em CI.
- **Fail-closed em todo lugar** — recovery, claims, receipts e completion
  exigem prova validada; estados inconsistentes bloqueiam mutação.
- **Documentação com contrato executável** — manifest, matriz de revisão,
  exemplos executáveis validados em CI, ownership map em `DOCS_INDEX.md`.
- **CI com actions pinadas por SHA** — todas as `uses:` estão pinadas em
  hash de 40 caracteres (verificado).
- **Catálogo estável de 191 códigos de erro públicos** documentados.

---

## 3. Correções Necessárias (prioridade ALTA)

### 3.1 `npm run mcp:test` falha sem pré-requisito silencioso

**Sintoma observado:** rodar `npm run mcp:test` num checkout limpo produz
16/16 falhas com `ERR_MODULE_NOT_FOUND` (`@cassiomc1/forgeloop` e
`@modelcontextprotocol/client` ausentes), porque as dependências do
subpacote só existem após `npm run mcp:setup`.

**Problema:** a falha não é autoexplicativa — um contribuidor (ou agente
de IA) vê 16 erros de módulo e pode diagnosticar errado. O `CONTRIBUTING.md`
menciona `mcp:test`, mas não deixa explícita a ordem `mcp:setup` → `mcp:test`.

**Correção sugerida:**

1. Adicionar um *preflight guard* em `integrations/mcp/tests/` (ou num
   `pretest` do subpacote) que detecte a ausência de `node_modules` do MCP e
   falhe com mensagem acionável:
   `"MCP dependencies not installed. Run: npm run mcp:setup"`.
2. Alternativa mínima: fazer o script `mcp:test` do root delegar para um
   wrapper que verifica `integrations/mcp/node_modules/@modelcontextprotocol`
   antes de invocar `node --test`.
3. Documentar a ordem obrigatória em `CONTRIBUTING.md` e
   `integrations/mcp/README.md`.

### 3.2 Timeouts ausentes em 5 de 7 workflows do GitHub Actions

**Observado:** apenas `docs-quality.yml` (3 jobs) e `npm-publish.yml` têm
`timeout-minutes`. Os workflows `codeql.yml`, `dependency-review.yml`,
`forgeloop-audit.yml`, `package-smoke.yml` e `release-notes.yml` usam o
default de 360 minutos do GitHub.

**Risco:** um travamento (ex.: teste MCP travado no smoke em Windows)
consome 6h de runner por job da matriz (3 SOs no package-smoke).

**Correção:** adicionar `timeout-minutes` explícito e proporcional em todos
os jobs (ex.: 20–30 min para `package-smoke`, 15 min para `forgeloop-audit`,
30 min para `codeql`). O próprio teste
`"CLI portability timeout covers the slowest supported runner"` mostra que o
projeto já valoriza timeouts calibrados — falta cobrir todos os workflows.

### 3.3 Inconsistência de licença entre pacotes

**Observado:**

- Root: `"license": "SEE LICENSE IN LICENSE"` — mas o arquivo `LICENSE` é
  **MIT padrão**. O identificador SPDX correto seria simplesmente `"MIT"`.
- `integrations/mcp/package.json`: `"license": "MIT"` (correto).

**Impacto:** ferramentas de auditoria de licenças (FOSSA, license-checker,
npm registry UI) tratam `SEE LICENSE IN ...` como licença customizada
não-SPDX, gerando fricção e alertas falsos para consumidores corporativos.

**Correção:** trocar para `"license": "MIT"` no `package.json` root (ou, se
a intenção for a dupla licença MIT + CC BY 4.0 para docs, usar
`"MIT AND CC-BY-4.0"` — expressão SPDX válida — e documentar no README).

---

## 4. Ajustes Recomendados (prioridade MÉDIA)

### 4.1 Cobertura desigual em módulos críticos de core

Coverage global passa nos gates, mas há módulos de baixa cobertura em
caminhos sensíveis (dados do relatório c8 desta análise):

| Módulo | Linhas | Branches | Observação |
| --- | --- | --- | --- |
| `core/repository.js` | **52.11%** | 70% | Interage com git/checkout — caminho de fingerprint |
| `core/policy-discovery.js` | **56%** | 31.42% | Descoberta de regras — entrada de política |
| `core/policy-adapters.js` | **63.4%** | 72.97% | Funções cobertas: só 41.66% |
| `core/task-identity.js` | **71.05%** | 77.77% | Identidade de task (hash/namespacing) |
| `core/task-migration-validation.js` | **75%** | 64.28% | Validação de migração legacy |
| `src/commands/` (agregado) | **74.79%** | 80.1% | Funções: 60.46% |
| `cli.js` | 84.01% | 92.38% | Funções: **57.69%** |

**Sugestão:** priorizar testes para `repository.js` e `policy-discovery.js`
(ambos alimentam decisões fail-closed; um branch não coberto ali é
exatamente onde um bug de segurança/consistência se esconderia). Considerar
também gates de cobertura **por diretório** (c8 suporta configuração por
arquivo via `check-coverage` + relatórios separados, ou nyc-style
`per-file: true`) para impedir que módulos críticos fiquem abaixo de 80%
escondidos pela média global.

### 4.2 Funções monolíticas muito longas em `src/core`

Heurística aplicada nesta análise encontrou funções com 120–996 linhas:

- `next-action.js: computeNextAction` — **~996 linhas** (arquivo tem 1307)
- `completion.js: evaluateCompletion` — ~279 linhas
- `completion-artifacts.js: recordTerminalResult` / `recordCheck` — ~260 l cada
- `action-ledger-projection.js: projectActionLedger` — ~259 linhas
- `phase.js: advanceWorkState` — ~252 linhas
- +15 outras acima de 120 linhas

**Impacto:** `computeNextAction` é o cérebro de decisão do protocolo; quase
1000 linhas numa função dificulta revisão, aumenta risco de regressão em
manutenção e torna a cobertura de branches (74.97% global) mais difícil de
elevar.

**Sugestão:** refatorar gradualmente por fase/decisão — o projeto já começou
esse padrão (`next-action-model.js`, `next-action-artifacts.js`,
`next-action-phases.js`, `next-action-continuity.js` existem). Extrair os
blocos de decisão por fase (`DISCOVERY`, `PLANNED`, `EXECUTING`, `VERIFYING`,
`REVIEWING`, terminal) em funções puras nomeadas e testáveis isoladamente,
mantendo `computeNextAction` como orquestrador de ~100 linhas. Como a suíte
tem 1281 testes, o risco da refatoração é bem mitigado.

### 4.3 Regras de ESLint muito permissivas para um projeto safety-critical

A configuração atual cobre apenas regras de corretude básica (dupe-keys,
no-undef, etc.) e `no-unused-vars` como **warn**. Para um projeto cujo valor
central é determinismo e fail-closed, recomenda-se adicionar:

- `eqeqeq: "error"` — igualdade estrita evita coerções silenciosas;
- `no-fallthrough`, `no-case-declarations` — vários dispatchers por switch;
- `prefer-const`, `no-var` — consistência com o estilo já usado;
- `complexity` (warn, limite ~25) — sinaliza funções como as do §4.2;
- `no-unused-vars` como `"error"` (hoje é warn e passa em CI silenciosamente);
- considerar `eslint-plugin-n` (regras Node: `n/no-sync` em caminhos async,
  `n/no-unsupported-features`) — é dev-dependency, exigiria atualizar a
  política de dependências deliberadamente.

### 4.4 Duração da suíte de testes (~4,8 min) em máquina de 2 vCPUs

`npm test` roda todos os 196 arquivos num único processo `node --test`
(spawnSync sequencial). ~288s local; a matriz de CI (Node 20/22/24) paga
esse custo 3×, mais coverage (novamente a suíte inteira).

**Sugestões:**

1. Habilitar paralelismo nativo: `node --test` aceita
   `--test-concurrency` (o isolamento por `mkdtemp` já usado em 109 arquivos
   de teste indica que a maioria é paralelizável).
2. No workflow `docs-quality`, considerar **rodar `npm test` OU
   `npm run coverage`, não ambos** — coverage já executa a suíte inteira;
   o `npm test` extra duplica ~5 min por versão de Node. (Se o objetivo é
   detectar interferência do instrumentador, documentar isso como razão.)
3. Marcar testes lentos conhecidos com `--test-name-pattern`/shards para
   permitir um modo `test:quick` local para contribuidores.

### 4.5 Versionamento/publicação do pacote MCP indefinido

`@cassiomc1/forgeloop-mcp` está em `0.1.0` desde a introdução, sem lockfile
(ignorado no `.gitignore` deliberadamente), sem workflow de publicação
próprio e com dependência `@cassiomc1/forgeloop >=1.5.0 <2`.

**Sugestões:**

- Documentar explicitamente (em `docs/MCP.md` ou `integrations/mcp/README.md`)
  se o pacote MCP é publicado no npm ou é source-only; hoje o README raiz o
  referencia como pacote instalável, mas não há workflow `mcp-publish`.
- Se for publicado: adicionar checklist de release e verificação de
  identidade análoga ao `release:identity` do core.
- Considerar um lockfile commitado para o subpacote (reprodutibilidade de
  CI) ou documentar por que a resolução flutuante de
  `@modelcontextprotocol/server@^2.0.0` é aceitável na fronteira de confiança.

### 4.6 Imagem hero do README com 1.6 MB

`docs/assets/eng_readme_forgeloop.png` tem **1.6 MB** e é baixada em todo
`npm install`? Não — não está em `files` do package.json (bom), mas ainda
pesa no clone do repositório e no carregamento do README no GitHub/npm.

**Sugestão:** comprimir para WebP/PNG otimizado (< 300 KB é viável para
imagem de banner) mantendo o mesmo nome/caminho, ou servir via GitHub
raw/release asset.

### 4.7 `CHANGELOG.md` com `## Unreleased` vazio

Cosmético, mas o validador de release poderia exigir que a seção
`Unreleased` liste as mudanças mergeadas desde a última tag (hoje está
vazia mesmo com commits pós-1.6.3 na main — ex.: #120, #121 entraram como
1.6.2/1.6.3, ok, mas o processo não tem guarda automática). Um check em CI
que compara `git log vX.Y.Z..HEAD` com a presença de entradas em
`Unreleased` evitaria releases com changelog defasado.

---

## 5. Melhorias Evolutivas (prioridade BAIXA / roadmap)

### 5.1 Declarações TypeScript (`.d.ts`) para a superfície de integração

`src/integration.js` é a API programática estável consumida pelo MCP e por
harnesses externos, mas **não há typings**. Publicar um `integration.d.ts`
escrito à mão (sem adicionar TS como dependência — apenas o arquivo de
declaração + campo `"types"`/`exports.types` no package.json) melhoraria
drasticamente a DX de integradores e permitiria que agentes de IA validem
chamadas estaticamente. Zero impacto na política de dependências.

### 5.2 Saída `--json` com envelope de erro estruturado no CLI

O handler de erro global do CLI (`cli.js` linha ~696) imprime
`error: CODE: message` em texto para stderr. Quando o chamador pediu
`--json`, um envelope JSON de erro (`{"error":{"code":...,"message":...}}`)
em stdout/stderr tornaria o parsing por harnesses 100% uniforme —
hoje o consumidor precisa tratar dois formatos. (Verificar se
`executeForgeLoopCommand` já resolve isso na via programática; a via CLI
com argumentos inválidos ainda cai no formato texto.)

### 5.3 Shell completions e `forgeloop help <comando>`

Com 65 comandos e dezenas de flags, gerar completions (bash/zsh/fish) a
partir de `CLI_COMMAND_DEFINITIONS` seria barato (a fonte já é declarativa)
e valioso para operadores humanos. Idem para `forgeloop help <cmd>` como
alias de `--help` por comando.

### 5.4 Benchmark de regressão de performance do protocolo

O startup do CLI é bom (~170ms de import; ~260ms `--help`), mas não há
guarda contra regressão. Um teste leve que falhe se `protocol-info --json`
exceder um budget (ex.: 1s em runner compartilhado) protegeria a promessa
de "CLI de suporte leve" conforme `src/core` cresce (já são 29k linhas).

### 5.5 Consolidar documentos de release checklist

Há 3 checklists versionados (`RELEASE_CHECKLIST_1_4.md`, `_1_5_MCP.md`,
`_1_6_1.md`) todos shipados no pacote npm. Sugerido: manter apenas o
checklist corrente no pacote (`files`) e mover os históricos para o
repositório apenas (ou `docs/archive/`), reduzindo o tamanho do pacote e a
chance de um agente seguir um checklist obsoleto.

### 5.6 Remover stub deprecado `AGENT_COMPATIBILITY.md`

O próprio arquivo se declara *"deprecated since 1.2.4… scheduled for
removal in the next compatibility-breaking release"*. Ele ainda é shipado no
pacote npm (está em `files`). Enquanto a major não chega, poderia ao menos
sair do pacote publicado (mantendo-o no repo por compatibilidade de links),
já que não faz parte da superfície pública.

### 5.7 Cobertura de SO no CI para a suíte principal

`package-smoke.yml` roda em ubuntu/macos/windows, mas a suíte completa
(`npm test`, 1281 testes) só roda em Linux (`docs-quality.yml`). Existem
fixtures de Windows (`conformance/windows-workspace`) e ~4 pontos
`win32` no core — rodar a suíte completa em `windows-latest` ao menos em
`push: main` (não em todo PR, pelo custo) daria evidência real da
portabilidade que o `QUALITY_SCORECARD.md` declara.

### 5.8 Guia de contribuição para o fluxo Python frozen

Os validadores Python são "frozen CI-only compatibility tools", mas os
testes (`pytest`) rodam com `unittest` no CI e `pytest` funciona localmente.
Fixar a versão mínima de Python suportada (hoje implícita) e um comando
único documentado (`python3 -m unittest discover -s tests`) no
`CONTRIBUTING.md` evitaria divergência local/CI.

---

## 6. Segurança — Achados e Confirmações

Confirmado nesta análise (tudo positivo):

- ✅ Nenhum `shell: true`, `eval`, `execSync` com string interpolada no
  runtime; spawn sempre por argv exato (política de provenance do protocolo).
- ✅ `npm audit` limpo (0 vulnerabilidades, incluindo devDependencies).
- ✅ Todas as GitHub Actions pinadas por SHA completo.
- ✅ `permissions: contents: read` como default nos workflows; `id-token:
  write` apenas no publish (OIDC trusted publishing — melhor prática).
- ✅ Scanner de segredos próprio (`scan_secrets.py`) com testes.
- ✅ THREAT_MODEL.md substancial (44 KB) cobrindo path containment, JSON
  bounds, symlinks e autoridade.

Sugestões de endurecimento adicionais:

1. **`step-security/harden-runner`** (ou equivalente) nos workflows de
   publish para egress-filtering durante o release — mitiga exfiltração no
   momento mais sensível do supply chain.
2. **Verificação de checkout com `persist-credentials: false`** nos
   workflows que não precisam de push (checkout mantém o token no diretório
   por default).
3. **Assinatura/atestação de proveniência npm** — o publish OIDC já gera
   provenance? Se `npm publish --provenance` não estiver explícito no
   workflow, adicioná-lo (trusted publishing habilita, mas o flag explícito
   documenta a intenção e falha cedo se indisponível).
4. Duas actions em versões distintas de `actions/checkout` (v7.0.1 no audit,
   v4.2.2 no smoke/publish) — alinhar para reduzir superfície de revisão.

---

## 7. Documentação — Achados

Estado excepcional: 28 documentos com manifest machine-readable, matriz de
revisão, exemplos executáveis validados, ownership map e índice por
audiência. Pequenos pontos:

1. **Volume total muito alto para agentes** — `LOOP_ENGINEERING.md` (75 KB,
   1470 linhas) + `PROTOCOL_INTEGRATION.md` (23 KB) + `GUIDE_ROUTER.md`
   (17 KB) são leitura obrigatória segundo `CLAUDE.md`/`AGENTS.md`. Para
   janelas de contexto pequenas, um **sumário normativo condensado**
   (~200 linhas, gerado e validado contra o canônico, como já é feito com
   `docs:generated:check`) reduziria custo de token sem perder autoridade.
2. `.lychee.toml` acumula 8+ exclusões de URLs intermitentes — considerar
   revisão trimestral agendada (issue automática) para remover exclusões de
   hosts que voltaram a funcionar.
3. O README menciona instalação do MCP como pacote npm, mas ver §4.5 sobre a
   lacuna de workflow de publicação.

---

## 8. Priorização Consolidada

| # | Item | Tipo | Prioridade | Esforço |
| --- | --- | --- | --- | --- |
| 3.1 | Guard de pré-requisito em `mcp:test` | Correção DX | 🔴 Alta | Baixo |
| 3.2 | `timeout-minutes` em todos os workflows | Correção CI | 🔴 Alta | Baixo |
| 3.3 | Licença SPDX (`MIT`) no package.json root | Correção | 🔴 Alta | Trivial |
| 4.1 | Cobertura em `repository.js` / `policy-discovery.js` | Ajuste | 🟡 Média | Médio |
| 4.2 | Refatorar `computeNextAction` (~996 l) | Ajuste | 🟡 Média | Alto |
| 4.3 | Endurecer regras ESLint | Ajuste | 🟡 Média | Baixo |
| 4.4 | Paralelizar testes / evitar suíte duplicada em CI | Ajuste | 🟡 Média | Médio |
| 4.5 | Definir publicação/versionamento do MCP | Ajuste | 🟡 Média | Baixo |
| 4.6 | Otimizar imagem hero (1.6 MB) | Ajuste | 🟡 Média | Trivial |
| 4.7 | Guarda de changelog `Unreleased` | Ajuste | 🟡 Média | Baixo |
| 5.1 | `.d.ts` para `/integration` | Melhoria | 🟢 Baixa | Médio |
| 5.2 | Envelope JSON de erro no CLI | Melhoria | 🟢 Baixa | Baixo |
| 5.3 | Shell completions | Melhoria | 🟢 Baixa | Médio |
| 5.4 | Benchmark de startup/regressão | Melhoria | 🟢 Baixa | Baixo |
| 5.5 | Arquivar checklists de release antigos | Melhoria | 🟢 Baixa | Trivial |
| 5.6 | Remover stub deprecado do pacote npm | Melhoria | 🟢 Baixa | Trivial |
| 5.7 | Suíte completa em Windows no push main | Melhoria | 🟢 Baixa | Baixo |
| 5.8 | Padronizar fluxo Python no CONTRIBUTING | Melhoria | 🟢 Baixa | Trivial |
| 6.x | Harden-runner, persist-credentials, --provenance | Segurança | 🟡 Média | Baixo |
| 7.1 | Sumário normativo condensado para agentes | Docs | 🟢 Baixa | Médio |

---

## 9. Metodologia

Todos os achados acima são **evidência observada** nesta sessão de análise:
execução real de `npm test`, `npm run coverage`, `npm run lint`,
`npm run dependency:policy`, `npm audit`, `pytest`, validadores de docs,
verificador de evidência do PoC, smoke do CLI, inspeção de workflows,
medição de tempos e análise estática dos fontes (contagem de linhas,
heurística de funções longas, grep de padrões de risco). Nenhuma conclusão
foi inferida de documentação sem verificação, seguindo o próprio padrão de
evidência do ForgeLoop (`OBSERVED` vs `INFERRED`).
