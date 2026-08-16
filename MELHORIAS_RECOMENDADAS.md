# Melhorias recomendadas — ForgeLoop v0.1.15

Data da revisão: 2026-08-16

Escopo: `src/`, `tests/`, schemas, scripts, documentação, pacote npm e CI/CD.

## Resultado

As nove melhorias identificadas na revisão foram implementadas nesta linha de
trabalho. A decisão de qualidade mantém o pacote sem dependências de runtime e
autoriza somente ferramentas de desenvolvimento explicitamente verificadas.
Os validadores Python permanecem congelados como CI-only para preservar seus
contratos históricos; isso é uma decisão documentada, não uma migração parcial.

## Checklist de implementação

| # | Melhoria | Status | Evidência principal |
| --- | --- | --- | --- |
| 1 | Dividir `verification-capability.js` e estabilizar classificadores npm/pnpm/yarn | ✅ Implementado | `verification-constants.js`, `command-tokenizer.js`, `npm-classifier.js`, `package-manager-classifiers.js`, `command-resolution.js`, `installation-authority.js`, fachada compatível e corpus real em `tests/fixtures/verification/npm-argv.json` |
| 2 | Corrigir colisão de `PROFILE_PATH` | ✅ Implementado | `src/commands/update.js` usa a constante legada nomeada de `target-layout.js` |
| 3 | Adicionar ESLint e cobertura | ✅ Implementado | `eslint.config.js`, ESLint, c8 com limites de 80% linhas / 75% funções / 70% branches / 80% statements e política de dependências |
| 4 | Refatorar dispatch do CLI | ✅ Implementado | `COMMANDS`, `COMMAND_HANDLERS` e `COMMAND_TABLE` em `src/cli.js`; `main()` despacha pela tabela |
| 5 | Enxugar README e indexar documentação | ✅ Implementado | README de catálogo/quickstart, `DOCS_INDEX.md`, ownership explícito e limites do pacote atualizados |
| 6 | Consolidar validadores Python | ✅ Implementado como decisão CI-only | `scripts/CI_VALIDATORS.md` registra escopo, comandos, motivo do congelamento e separação Node/Python |
| 7 | Substituir desenho manual do fluxo | ✅ Implementado | `docs/forgeloop-flow.mmd` é a fonte canônica; `scripts/generate-readme-flow.mjs` chama Mermaid CLI e grava fingerprint da fonte; CI valida o SVG sem exigir geometria idêntica entre sistemas |
| 8 | Centralizar fixture/retry Windows | ✅ Implementado | `tests/helpers/rm-safe.js` é o único helper de remoção temporária; sem retries inline nos testes |
| 9 | Refinar CI e portabilidade | ✅ Implementado | `npm ci`, política de dependências, matriz macOS/Linux/Windows, CodeQL, dependency review, release notes e auditoria sem `npx` implícito |

## Limites preservados

- `dependencies`, `optionalDependencies` e `peerDependencies` permanecem
  vazios; apenas ESLint, c8 e Mermaid CLI são `devDependencies` aprovadas.
- O Mermaid CLI é ferramenta de desenvolvimento e o SVG versionado é gerado
  localmente; `npm run docs:check` e o CI validam a fingerprint da fonte,
  preservando a sincronização sem transformar diferenças de fonte/renderizador
  entre macOS, Linux e Windows em falso positivo.
- Os validadores Python não foram duplicados em Node: continuam CI-only para
  evitar alterar silenciosamente os contratos textuais históricos.
- CodeQL, dependency review, release notes e publicação npm dependem do estado
  externo do GitHub/npm; a validação local não infere publicação, merge ou
  produção.

## Verificações locais desta implementação

```bash
npm ci
npm test
npm run lint
npm run coverage
npm run dependency:policy
npm run docs:flow
npm run docs:check
npm run pack:check
python3 -m unittest discover -s tests -v
python3 scripts/validate_markdown.py --self-test
python3 scripts/validate_markdown.py
python3 scripts/validate_loop_system.py --self-test
python3 scripts/validate_loop_system.py
python3 scripts/scan_secrets.py
```

O fechamento protocolar também exige `forgeloop preflight` em `READY`,
evidências observadas pelo ForgeLoop, `forgeloop next`, revisão, e
`forgeloop complete` em `VALID`. A publicação somente é considerada concluída
após o estado remoto do GitHub ser verificado separadamente.

Última execução local: `npm test` passou com 545/545 testes; `npm run coverage`
passou com 88% de statements/linhas, 78,45% de branches e 93,21% de funções;
os validadores Python passaram com 42 testes e os checks de documentação,
dependência, pacote e render Mermaid também passaram.
