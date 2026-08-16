# Melhorias Recomendadas — ForgeLoop v0.1.15

Data da revisão: 2026-08-16 · Última atualização de status: 2026-08-16
Escopo: código-fonte (`src/`), testes (`tests/`), schemas, scripts, documentação e CI/CD.

## Visão geral

O projeto está em bom estado geral: zero dependências de runtime, tratamento de erros
disciplinado (códigos como `E_PREFLIGHT_NOT_READY`), filosofia *fail-closed* consistente,
`THREAT_MODEL.md` exemplar e CI com actions fixadas por SHA e *trusted publishing*.
As recomendações abaixo atacam os principais pontos de risco e manutenibilidade.

**Status desta revisão:** um lote de correções seguras e reversíveis foi executado em
2026-08-16 (itens 2, 4-parcial, 7-parcial, 8 e 9-parcial). Os itens arquiteturalmente
maiores permanecem como recomendações pendentes, pois exigem decisões de postura do
projeto (ver observação sobre dependências no item 3).

## Prioridade Alta

### 1. Dividir `src/core/verification-capability.js` (1.157 linhas) — PENDENTE
É o módulo mais complexo e o que mais recebeu patches de hardening (5+ commits na última
release só para o classificador npm). O churn indica fragilidade especulativa frente à
evolução da CLI do npm.

- Extrair classificadores específicos por gerenciador (npm / pnpm / yarn) + um parser
  de invocação compartilhado.
- Criar um **corpus de fixtures** com argvs reais do npm para estabilizar o classificador
  e transformar regressões em casos de teste.
- Fazer o mesmo com `src/core/next-action.js` (904 linhas) e `src/core/preflight.js` (583 linhas).

### 2. Corrigir a colisão do nome `PROFILE_PATH` — ✅ EXECUTADO
`src/commands/update.js` definia `PROFILE_PATH = "PROJECT_PROFILE.md"` (caminho legado),
enquanto `src/core/target-layout.js` exporta `PROFILE_PATH` com outro valor.

**Correção aplicada:** `update.js` não define mais a constante local; importa
`LEGACY_PROFILE_PATH` de `target-layout.js` e todas as referências foram renomeadas.

### 3. Adicionar ESLint e medição de cobertura — PENDENTE (com ressalva)
Não há linter/formatter de JS nem ferramenta de cobertura no repositório.

- ESLint (flat config) + `c8` integrado ao `scripts/run-tests.js`.
- Definir um limite mínimo de cobertura para `src/core`.
- Alguns comandos (`doctor.js`, `update.js`) não têm arquivos de teste dedicados.

**Ressalva após revisão:** adicionar ESLint/c8 introduce `devDependencies` em um pacote
que hoje é 100% livre de dependências — postura que o THREAT_MODEL valoriza e que agora é
guardada no CI (ver item 9). A decisão precisa vir antes: ou o projeto abre exceção
explícita para devDependencies de ferramenta, ou mantém a postura zero-dependência e
investe em revisão manual + convenções. Cobertura continua sendo a lacuna mais
importante deste item.

## Prioridade Média

### 4. Refatorar `src/cli.js` (678 linhas) — ✅ PARCIAL
O `main()` tem ~220 linhas de `if/else` de dispatch e a lista de comandos aparecia
duplicada (string de usage + array do parser).

**Correção aplicada:** a lista de comandos agora deriva de um único array `COMMANDS`
(`src/cli.js`); o texto de usage, o allowlist de `--json` e o reconhecimento de comando
do parser compartilham a mesma fonte. Output de `--help` verificado byte a byte idêntico
ao anterior.

**Pendente:** a refatoração completa para uma tabela declarativa de comandos
(`nome → { runner, formatter, flags, fn de exitCode }`), eliminando o dispatch if/else.

### 5. Enxugar o README (722 linhas) e a documentação embarcada — PENDENTE
`README.md` e `LOOP_ENGINEERING.md` (1.165 linhas) têm sobreposição conceitual
significativa. São 19 arquivos MD na raiz (~3.800 linhas), todos incluídos no tarball npm.

- Reduzir o README a catálogo + quickstart; detalhes do protocolo ficam em
  `LOOP_ENGINEERING.md`.
- Criar um índice de documentação.
- Avaliar reduzir os docs enviados no pacote npm ao essencial.

### 6. Consolidar validadores Python — PENDENTE
`validate_markdown.py` (748 linhas), `validate_loop_system.py` (925 linhas) e
`scan_secrets.py` (251 linhas) duplicam capacidades que já existem em testes Node,
criando acoplamento de toolchain em CI.

- Migrar para scripts Node, ou congelar como "CI-only" com nota explícita.

## Prioridade Baixa

### 7. Substituir `scripts/generate-readme-flow.mjs` (761 linhas) — ✅ PARCIAL
Código desenhado à mão para gerar o SVG do README.

**Correção aplicada:** removido o fallback de versão hardcoded (`|| "0.1.15"`); o script
agora falha explicitamente se `package.json` não tiver versão, em vez de embutir uma
versão potencialmente errada.

**Pendente:** substituir o desenho manual por Mermaid/D2 com render em CI.

### 8. Centralizar a lógica de fixture/retry do Windows — ✅ EXECUTADO
~13 arquivos de teste repetiam `rm(..., { maxRetries, retryDelay })` para contornar
EBUSY/EPERM no Windows.

**Correção aplicada:** criado `tests/helpers/rm-safe.js` com `removeTempTree()`; os 13
arquivos passaram a usá-lo e nenhum `maxRetries` inline permanece nos testes. O ajuste
fino de retry agora tem um único ponto de manutenção.

### 9. Refinos de CI — ✅ PARCIAL
**Correções aplicadas** (`.github/workflows/docs-quality.yml`):

- Job `cli-portability` agora cruza os 3 sistemas operacionais com Node 20 **e** 24
  (antes: só Node 20).
- Novo step "Guard zero-dependency posture": falha o build se qualquer grupo de
  dependências (`dependencies`, `optionalDependencies`, `peerDependencies`,
  `devDependencies`) for populado — equivalente honesto ao `npm audit` para um pacote
  sem dependências e sem lockfile.

**Pendente:** CodeQL, release notes automatizadas e revisão de dependências via
GitHub (aplicável somente se a postura zero-dependência mudar).

## Pontos fortes a preservar (não mudar)

- **Zero dependências de runtime e dev** — postura de supply-chain excelente, agora
  garantida por guard no CI.
- **Validador de schema próprio** (`src/core/schema-validation.js`) — sem ajv de propósito;
  mantém o pacote livre de dependências (mas documente as limitações de dialeto).
- **`src/core/json-safety.js`** — limites de bytes/profundidade/arrays antes do parse.
- **THREAT_MODEL.md** com rastreabilidade por teste — melhor artefato do repositório.
- **Publish com trusted publishing** (sem token de longa duração) e actions fixadas por SHA.
- **Validador `verify_release_identity.mjs`** — conferência de SHA/gitHead/tag vs registro npm.

## Checklist resumido

| # | Melhoria | Prioridade | Esforço | Status |
|---|----------|-----------|---------|--------|
| 1 | Dividir `verification-capability.js` + corpus de fixtures npm | Alta | Alto | Pendente |
| 2 | Corrigir colisão `PROFILE_PATH` | Alta | Baixo | ✅ Executado |
| 3 | ESLint + cobertura (c8) | Alta | Médio | Pendente (ver ressalva) |
| 4 | Tabela declarativa de comandos no `cli.js` | Média | Médio | ✅ Parcial (dedup feito) |
| 5 | Enxugar README / docs embarcadas | Média | Médio | Pendente |
| 6 | Unificar validadores Python → Node | Média | Médio | Pendente |
| 7 | README flow via Mermaid | Baixa | Baixo | ✅ Parcial (fallback removido) |
| 8 | Helpers de teste Windows | Baixa | Baixo | ✅ Executado |
| 9 | CI: portability multi-Node + guarda de dependências | Baixa | Baixo | ✅ Parcial (CodeQL pendente) |

## Verificação do lote executado

- `npm test`: 530 testes, 0 falhas.
- `npm run pack:check`: 4/4 passando.
- Output de `--help` do CLI comparado byte a byte com a versão anterior (idêntico).
- `python3 scripts/validate_markdown.py`: 9 guias e 72 arquivos Markdown validados.
