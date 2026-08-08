# Plano de implementação: polimento integral dos guias

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: usar `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Os passos usam checkboxes (`- [ ]`) para rastreamento.

**Objetivo:** revisar e polir toda a coleção documental, com recomendações atuais e seguras, paridade PT-BR/ENG, metadados uniformes, proveniência explícita e validação automatizada.

**Arquitetura:** a execução é documental e incremental. Primeiro aplica o contrato transversal aos 16 guias; depois consolida README, histórico e CI; em seguida revisa cada par temático em um commit isolado; por fim executa uma auditoria integral de paridade e fecha os registros de implementação.

**Stack técnica:** Markdown, YAML frontmatter, GitHub Actions, markdownlint-cli2, Lychee, Python 3 para verificações estruturais, `rg`, Git.

## Restrições globais

- A especificação canônica é `docs/superpowers/specs/2026-08-08-repository-guide-polish-design.md`.
- Os oito pares PT-BR/ENG devem conter regras, exceções, exemplos e referências semanticamente equivalentes.
- Todo guia deve usar `name` igual ao nome do arquivo sem `.md`, `language` igual a `pt-BR` ou `en`, `version: "2026.08"`, `last-reviewed: "2026-08-08"` e `counterpart` relativo válido.
- A política comum de ferramentas deve selecionar apenas ferramentas necessárias à stack e à etapa, verificar equivalentes existentes, exigir autorização para instalação e registrar checks bloqueados sem alegar aprovação.
- Não escolher nem conceder licença global para a coleção; registrar proveniência em `THIRD_PARTY_NOTICES.md`.
- Não copiar ativos, textos, imagens ou código de galerias e referências externas.
- Preservar o diretório local `.commandcode/`; apenas ignorá-lo no Git.
- Não adicionar aplicação, package manager, framework web ou dependência local permanente.
- Actions devem ser fixadas por SHA completo, com a tag correspondente em comentário.
- Não publicar, abrir pull request nem mesclar no GitHub nesta execução.
- Cada tarefa deve terminar com `git diff --check`, validação direcionada, auto-revisão e commit próprio.

---

### Task 1: Padronizar metadados e política de ferramentas

**Arquivos:**

- Modificar: `.gitignore`.
- Modificar: todos os arquivos `PT-BR/*.md` e `ENG/*.md`.

**Interfaces:**

- Consome: contrato transversal da especificação.
- Produz: frontmatter previsível e política de ferramentas idêntica em significado para todas as tarefas seguintes.

- [ ] **Passo 1: registrar o estado anterior**

Executar:

```bash
for file in PT-BR/*.md ENG/*.md; do [ "$(sed -n '1p' "$file")" = '---' ] || echo "$file"; done
rg -n 'solicite a instalação|request its installation|request its installation immediately' PT-BR ENG
```

Esperado antes da edição: pelo menos 12 guias sem frontmatter e ocorrências da política absoluta de instalação.

- [ ] **Passo 2: adicionar o frontmatter aos 16 guias**

Em cada arquivo, inserir no topo um bloco YAML com `version: "2026.08"` e `last-reviewed: "2026-08-08"`, usando exatamente os demais valores desta tabela:

| Arquivo | `name` | `language` | `counterpart` | `description` |
| :--- | :--- | :--- | :--- | :--- |
| `PT-BR/acessibilidade-code-pt.md` | `acessibilidade-code-pt` | `pt-BR` | `../ENG/accessibility-eng.md` | `Protocolo prático de acessibilidade orientado à WCAG 2.2 para web, mobile e desktop.` |
| `ENG/accessibility-eng.md` | `accessibility-eng` | `en` | `../PT-BR/acessibilidade-code-pt.md` | `Practical WCAG 2.2-oriented accessibility protocol for web, mobile, and desktop.` |
| `PT-BR/clean-code-pt.md` | `clean-code-pt` | `pt-BR` | `../ENG/clean-code-eng.md` | `Práticas de código legível, observável, seguro e operável por agentes de IA.` |
| `ENG/clean-code-eng.md` | `clean-code-eng` | `en` | `../PT-BR/clean-code-pt.md` | `Practices for readable, observable, secure code operated by AI agents.` |
| `PT-BR/design-code-pt.md` | `design-code-pt` | `pt-BR` | `../ENG/design-code-eng.md` | `Direção visual, UX, motion e performance percebida para experiências digitais premium.` |
| `ENG/design-code-eng.md` | `design-code-eng` | `en` | `../PT-BR/design-code-pt.md` | `Visual direction, UX, motion, and perceived performance for premium digital experiences.` |
| `PT-BR/games-code-design-web-pt.md` | `games-code-design-web-pt` | `pt-BR` | `../ENG/games-code-design-web-eng.md` | `Arquitetura, design, testes e operação de games web 2D, 3D e procedurais.` |
| `ENG/games-code-design-web-eng.md` | `games-code-design-web-eng` | `en` | `../PT-BR/games-code-design-web-pt.md` | `Architecture, design, testing, and operation of 2D, 3D, and procedural web games.` |
| `PT-BR/perf-code-pt.md` | `perf-code-pt` | `pt-BR` | `../ENG/perf-code-eng.md` | `Medição, diagnóstico e melhoria de performance em web, mobile, desktop, APIs e dados.` |
| `ENG/perf-code-eng.md` | `perf-code-eng` | `en` | `../PT-BR/perf-code-pt.md` | `Performance measurement, diagnosis, and improvement for web, mobile, desktop, APIs, and data.` |
| `PT-BR/premium-sites-studio-pt.md` | `premium-sites-studio-pt` | `pt-BR` | `../ENG/premium-sites-studio-eng.md` | `Processo completo para criar sites premium no padrão de grandes estúdios de design.` |
| `ENG/premium-sites-studio-eng.md` | `premium-sites-studio-eng` | `en` | `../PT-BR/premium-sites-studio-pt.md` | `Complete process for building premium websites at major design-studio quality.` |
| `PT-BR/sec-code-pt.md` | `sec-code-pt` | `pt-BR` | `../ENG/sec-code-eng.md` | `Segurança verificável para desenvolvimento web, mobile, desktop, APIs e supply chain.` |
| `ENG/sec-code-eng.md` | `sec-code-eng` | `en` | `../PT-BR/sec-code-pt.md` | `Verifiable security guidance for web, mobile, desktop, APIs, and the software supply chain.` |
| `PT-BR/test-code-pt.md` | `test-code-pt` | `pt-BR` | `../ENG/test-code-eng.md` | `Estratégia e ferramentas de teste orientadas a risco para linguagens e plataformas modernas.` |
| `ENG/test-code-eng.md` | `test-code-eng` | `en` | `../PT-BR/test-code-pt.md` | `Risk-based testing strategy and tools for modern languages and platforms.` |

- [ ] **Passo 3: substituir a política comum de ferramentas**

Em cada guia, exigir esta sequência em linguagem natural localizada: identificar stack/etapa e checks aplicáveis; preferir equivalente já disponível com evidência compatível; pedir autorização antes de instalar ou alterar ambiente; registrar check necessário bloqueado quando não houver equivalente seguro; nunca afirmar que um check bloqueado passou; não instalar recurso meramente opcional.

- [ ] **Passo 4: preservar os guias de sites premium**

Fora do frontmatter e da política de ferramentas, não reestruturar `premium-sites-studio-pt.md` nem `premium-sites-studio-eng.md`. Confirmar que estratégia, conteúdo, acessibilidade, performance, segurança, QA, lançamento e manutenção continuam presentes.

- [ ] **Passo 5: atualizar ignores locais**

Manter `.DS_Store` e `.worktrees/`; adicionar `.commandcode/`. Não remover nem abrir `.commandcode/` no worktree principal.

- [ ] **Passo 6: validar contrato e commit**

Executar um script Python inline que, para cada `PT-BR/*.md` e `ENG/*.md`, leia o primeiro bloco YAML, confirme as seis chaves, unicidade de `name`, valores de idioma/versão/data e existência de `counterpart`. Executar também:

```bash
! rg -n 'solicite a instalação ao usuário imediatamente|request its installation from the user immediately|request its installation immediately' PT-BR ENG
git diff --check
git status --short
```

Esperado: 16 guias válidos; somente `.gitignore` e os 16 guias alterados.

Commit:

```bash
git add .gitignore PT-BR ENG
git commit -m "docs: padronizar metadados e politica de ferramentas"
```

### Task 2: Consolidar README, proveniência, histórico e CI documental

**Arquivos:**

- Criar: `THIRD_PARTY_NOTICES.md`.
- Criar: `docs/superpowers/README.md`.
- Criar: `.markdownlint-cli2.jsonc`.
- Criar: `.lychee.toml`.
- Criar: `.github/workflows/docs-quality.yml`.
- Modificar: `README.md`.
- Modificar: os três planos e as três especificações de `docs/superpowers` datados de `2026-08-07`.

**Interfaces:**

- Consome: metadados e política comum da Task 1.
- Produz: índice de manutenção, notices auditáveis e os checks usados por todas as tarefas posteriores.

- [ ] **Passo 1: corrigir estrutura e manutenção do README**

Manter apenas `# Guias de Instruções para Agentes de IA` como H1. Transformar as seções de idioma em H2 e ajustar seus subtítulos sem pular níveis. Preservar a descrição dos 16 guias, atualizar as descrições de código limpo para “síntese operacional influenciada pelo artigo” e incluir uma tabela bilíngue com par, idioma principal, contraparte, versão `2026.08`, revisão `2026-08-08` e status “mantido”.

Explicar a nova política de ferramentas nos dois idiomas e registrar que a coleção não declara licença global; reutilização depende de autorização do titular e dos notices de terceiros.

- [ ] **Passo 2: atualizar o fluxo HyperFrames**

Separar a instalação das skills da execução manual. Usar:

```bash
npx skills add heygen-com/hyperframes --full-depth
npx hyperframes init meu-video --example blank --non-interactive
cd meu-video
npx hyperframes doctor
npx hyperframes lint
npx hyperframes check
npx hyperframes preview
npx hyperframes render --output output.mp4
```

Informar Node.js 22+ e FFmpeg para render local, além de validação visual, direitos de mídia, acessibilidade e custos de serviços opcionais. Ligar o quickstart e a referência oficial da CLI.

- [ ] **Passo 3: criar notices de terceiros**

`THIRD_PARTY_NOTICES.md` deve listar: A11Y.md e sua licença MIT; o artigo “Clean Code for AI Agents” como influência sem alegar tradução autorizada; Canvas UI e Liquid Glass Design como referências condicionadas a licença/proveniência; Apple e W3C/OWASP como documentação normativa; HyperFrames e demais projetos como software externo sujeito às próprias licenças. Não adicionar texto integral de licença nem declarar uma licença global.

- [ ] **Passo 4: arquivar os registros de 2026-08-07**

Criar `docs/superpowers/README.md` explicando que specs registram decisões históricas e planos registram execução concluída. Nos seis arquivos de 2026-08-07, adicionar status `concluído`, data `2026-08-07`, evidência final `6e88768` e nota de que a proibição original de editar README valia apenas para o patch inicial; a consolidação posterior atualizou o índice. Marcar os checkboxes dos três planos como `[x]`, remover a instrução que manda executar trabalho pendente e corrigir `Premium Components` para `Componentes Premium` no plano Canvas PT-BR.

- [ ] **Passo 5: configurar Markdown lint**

Criar `.markdownlint-cli2.jsonc` para `**/*.md`, excluindo `.worktrees/**` e `.superpowers/**`. Manter regras padrão e documentar apenas estas exceções deliberadas: MD013 desativada por linhas operacionais/URLs; MD024 com `siblings_only`; MD033 desativada por exemplos HTML; MD034 desativada por listas auditáveis de URLs; MD036 desativada por rótulos editoriais existentes; MD040 desativada quando a linguagem do bloco é indeterminada.

- [ ] **Passo 6: configurar verificação de links**

Criar `.lychee.toml` com retries limitados, timeout explícito, cache, exclusão de loopback/exemplos locais e exclusão documentada apenas para `https://phaser.io/`, que bloqueia automação com 403. Não aceitar 404 nem excluir domínios para ocultar links quebrados.

- [ ] **Passo 7: criar o workflow fixado por SHA**

Criar `.github/workflows/docs-quality.yml` para push e pull request, com `permissions: contents: read`, timeout e concorrência cancelável. Usar exatamente:

```yaml
actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
DavidAnson/markdownlint-cli2-action@21c1be1b93ad9ed58fa840aacc3f279cde2a72ff # v24.2.0
lycheeverse/lychee-action@e7477775783ea5526144ba13e8db5eec57747ce8 # v2.9.0
```

Executar Markdown lint, Lychee com `.lychee.toml` e um Python inline que valide frontmatter, contrapartes, nomes únicos, cercas de código e links Markdown relativos.

- [ ] **Passo 8: validar e commit**

Executar:

```bash
npx --yes markdownlint-cli2@0.23.2
git diff --check
```

Se o binário oficial do Lychee não estiver disponível localmente, deixar sua execução para o action fixado e produzir uma verificação HTTP read-only equivalente na validação final; não alegar que Lychee local passou. Confirmar manualmente a sintaxe do workflow e do TOML.

Commit:

```bash
git add README.md THIRD_PARTY_NOTICES.md docs/superpowers .github .markdownlint-cli2.jsonc .lychee.toml
git commit -m "docs: consolidar governanca e qualidade da colecao"
```

### Task 3: Reforçar os guias de código limpo

**Arquivos:**

- Modificar: `PT-BR/clean-code-pt.md`.
- Modificar: `ENG/clean-code-eng.md`.

**Interfaces:**

- Consome: segurança como referência canônica e política da Task 1.
- Produz: práticas equivalentes de erros, observabilidade, concorrência e arquitetura.

- [ ] **Passo 1: substituir erros e debugging inseguros**

Usar códigos de erro estáveis e contexto seguro. Proibir valores brutos, secrets, tokens, PII, cartões e payloads completos em mensagens, traces e logs. Limitar debug detalhado a ambiente controlado não produtivo, com redaction/masking, reprodução orientada por evidência e remoção confirmada da instrumentação temporária.

- [ ] **Passo 2: tornar limites quantitativos heurísticas**

Converter “4–20 linhas”, “dois níveis” e “menos de cinco resultados” em sinais de revisão. Permitir exceção documentada quando coesão, legibilidade e vocabulário do domínio forem melhores. Atualizar/remover comentários obsoletos em vez de preservá-los absolutamente.

- [ ] **Passo 3: qualificar injeção e arquitetura**

Recomendar interfaces/wrappers para I/O, SDKs voláteis, integrações caras ou fakes úteis; permitir import direto para bibliotecas estáveis e puras. Separar domínio, aplicação e infraestrutura, manter I/O nas bordas, testar contratos e registrar decisões arquiteturais relevantes.

- [ ] **Passo 4: adicionar async e observabilidade**

Cobrir propagação de cancelamento, timeout explícito, retry limitado com backoff/jitter, limite de concorrência, cleanup, idempotência e testes de timeout/cancelamento/race. Definir evento estruturado com `event`, `level`, `request_id`/correlation ID, duração, resultado e campos redigidos; explicar quando usar logs, métricas e traces e como tratar retenção.

- [ ] **Passo 5: adicionar exemplos equivalentes**

Incluir exemplos pequenos de erro seguro, log estruturado redigido, timeout/cancelamento e dependência injetável, sem depender de framework específico. Adicionar Definition of Done para observabilidade, async e fronteiras arquiteturais.

- [ ] **Passo 6: validar e commit**

Executar buscas que confirmem `redact`/`redação`, `timeout`, `backoff`, `request_id`, `idempot` e proibições de dados brutos nos dois idiomas; confirmar que os exemplos inseguros anteriores não existem. Depois:

```bash
npx --yes markdownlint-cli2@0.23.2 PT-BR/clean-code-pt.md ENG/clean-code-eng.md
git diff --check
git add PT-BR/clean-code-pt.md ENG/clean-code-eng.md
git commit -m "docs: reforcar clean code seguro e observavel"
```

### Task 4: Atualizar os guias de acessibilidade para WCAG 2.2

**Arquivos:**

- Modificar: `PT-BR/acessibilidade-code-pt.md`.
- Modificar: `ENG/accessibility-eng.md`.

**Interfaces:**

- Consome: WCAG 2.2 Understanding e WAI-ARIA APG oficiais.
- Produz: critérios e testes equivalentes, sem promessa indevida de certificação.

- [ ] **Passo 1: corrigir foco e perfis**

Descrever SC 2.4.13 como área mínima equivalente ao perímetro de 2 CSS px e contraste de pelo menos 3:1 entre os mesmos pixels focados e não focados; manter o contraste não textual aplicável. Dizer que o guia apoia implementação orientada à WCAG e que certificação/conformidade legal depende de avaliação por escopo e jurisdição.

- [ ] **Passo 2: incluir critérios novos da WCAG 2.2**

Adicionar SC 2.5.7 Dragging Movements (AA), 3.2.6 Consistent Help (A), 3.3.7 Redundant Entry (A) e 3.3.8 Accessible Authentication Minimum (AA), cada um com regra operacional e teste no checklist.

- [ ] **Passo 3: corrigir componentes e canais**

Tornar `<button>` obrigatório salvo impossibilidade técnica documentada. Nesse caso, exigir APG completo, nome acessível, `disabled`, toggle quando aplicável, foco após ativação, teclado e teste manual com tecnologia assistiva. Exigir que cor não seja canal único; escolher texto, ícone, padrão ou semântica programática conforme o significado, sem impor redundância universal.

- [ ] **Passo 4: corrigir live regions e microinterações**

Exigir região previamente presente no DOM, `role="status"`/`aria-live="polite"` para mensagens não urgentes e `role="alert"` apenas para erros urgentes. Testar nas combinações suportadas de navegador/AT. Não adicionar `aria-label` a decoração sem papel acessível.

- [ ] **Passo 5: validar e commit**

Confirmar os cinco IDs `2.4.13|2.5.7|3.2.6|3.3.7|3.3.8`, APG, `role="status"`, `role="alert"`, jurisdição e teste manual nos dois arquivos. Depois:

```bash
npx --yes markdownlint-cli2@0.23.2 PT-BR/acessibilidade-code-pt.md ENG/accessibility-eng.md
git diff --check
git add PT-BR/acessibilidade-code-pt.md ENG/accessibility-eng.md
git commit -m "docs: alinhar acessibilidade a WCAG 2.2"
```

### Task 5: Ampliar os guias de segurança verificável

**Arquivos:**

- Modificar: `PT-BR/sec-code-pt.md`.
- Modificar: `ENG/sec-code-eng.md`.

**Interfaces:**

- Consome: OWASP ASVS 5.0, Cheat Sheet Series e documentação Android oficiais.
- Produz: baseline de segurança rastreável e controles executáveis equivalentes.

- [ ] **Passo 1: adotar ASVS e contratos de entrada**

Usar ASVS 5.0 L1 como baseline e L2 para aplicações sensíveis; Top 10 permanece conscientização. Ligar checklists a IDs quando aplicável. Criar contratos de SSRF (schemes/destinos allowlisted, redes privadas/loopback/link-local/metadata bloqueadas, DNS rebinding, redirects revalidados, timeout e limites) e upload (nome gerado, assinatura/conteúdo, limites inclusive pós-descompressão, storage privado fora do webroot, AV/CDR quando aplicável, download autorizado e sem execução).

- [ ] **Passo 2: corrigir headers, CORS e sessões**

Fornecer CSP com `object-src`, `base-uri`, `frame-ancestors`, `form-action`, rollout Report-Only e reporting. Validar CORS por scheme/host/port exatos, rejeitar `null`, regex permissiva e usar `Vary: Origin` quando necessário. Implantar HSTS em estágios; só usar `includeSubDomains`/preload após inventário e decisão explícita. Usar Lax/Strict por default, documentar exceção `SameSite=None; Secure`, prefixo `__Host-`, `Path=/`, sem `Domain`, timeouts idle/absolute e rotação de ID.

- [ ] **Passo 3: completar identidade e segredos**

OAuth/OIDC deve usar Authorization Code + PKCE, `state`, `nonce`, redirects exatos e proibir implicit/password grants. JWT deve allowlistar algoritmo e validar assinatura, `iss`, `aud`, `exp`, replay, revogação e reutilização de refresh. Cobrir identidades de workload/credenciais curtas, scanning pre-commit/CI/histórico, ambientes, rotação, revogação, auditoria, incidente e remediação do histórico Git.

- [ ] **Passo 4: completar supply chain, Android e criptografia**

Fixar actions/plugins por commit/digest, usar registries confiáveis, prevenir dependency confusion, verificar provenance/attestations, promover artefato imutável e fazer rollout gradual. Preferir TLS de plataforma e Certificate Transparency; pinning Android só por threat model, com backup pins, expiração, telemetria e recuperação. Usar Keystore + criptografia autenticada; `EncryptedSharedPreferences` apenas legado/migração. Priorizar Argon2id calibrado, scrypt fallback, bcrypt legado, PBKDF2 quando FIPS exigir e AEAD AES-GCM/ChaCha20-Poly1305 via biblioteca de alto nível; manter agilidade algorítmica.

- [ ] **Passo 5: qualificar GraphQL e validar**

Tratar introspection como redução opcional de exposição, nunca autorização/antiabuso. Confirmar presença de `ASVS 5.0`, `SSRF`, `DNS rebinding`, limites pós-descompressão, `Report-Only`, `__Host-`, `PKCE`, `Argon2id`, `ChaCha20-Poly1305`, `Keystore`, `dependency confusion` e `Vary: Origin` nos dois idiomas.

```bash
npx --yes markdownlint-cli2@0.23.2 PT-BR/sec-code-pt.md ENG/sec-code-eng.md
git diff --check
git add PT-BR/sec-code-pt.md ENG/sec-code-eng.md
git commit -m "docs: adotar baseline de seguranca verificavel"
```

### Task 6: Tornar os guias de testes orientados a risco

**Arquivos:**

- Modificar: `PT-BR/test-code-pt.md`.
- Modificar: `ENG/test-code-eng.md`.

**Interfaces:**

- Consome: documentação oficial de cada ferramenta citada e o guia de acessibilidade.
- Produz: critérios de seleção e aprovação reproduzíveis, sem rankings frágeis.

- [ ] **Passo 1: substituir claims comparativos e metas universais**

Trocar “mais recomendado”, “perdendo espaço”, “melhor satisfação”, “adoção em queda” e equivalentes por matriz baseada em stack, compatibilidade, manutenção, runtime, projeto existente e CI. Definir cobertura por risco/baseline, mudanças, branches e caminhos críticos; usar mutation testing; remover obrigação universal 80/90 e teste por função.

- [ ] **Passo 2: corrigir acessibilidade e desktop**

Declarar que axe/Lighthouse detectam subconjunto; exigir testes manuais WCAG 2.2, teclado, AT, zoom/reflow, foco, contraste e mobile nativo. Usar Appium Windows driver como caminho mantido e WinAppDriver direto como legado. Para Tauri, usar WebdriverIO com `@wdio/tauri-service`/`tauri-driver`, não Playwright anexado à janela.

- [ ] **Passo 3: definir aprovação operacional**

Incluir SLOs, p95/p99, throughput/error rate, warm-up, soak/spike, budgets, jornadas críticas, rede degradada/offline, permissões, background/foreground, SO/dispositivos reais, smoke por PR e suites amplas agendadas.

- [ ] **Passo 4: fortalecer fixtures, flaky tests e migrations**

Sanear tokens/PII de cassettes; snapshots de CSS gerado não são oráculo primário; quarantine exige owner e prazo, sem retry que masque falha. Migrações seguem expand-migrate-contract, roll-forward, compatibilidade/restore; `down` só quando reversível. Adicionar fontes oficiais auditáveis com versão ou data para claims temporais.

- [ ] **Passo 5: validar e commit**

Confirmar matriz, mutation testing, Appium, `@wdio/tauri-service`, p95/p99, soak, quarantine/owner, cassettes redigidos e expand-migrate-contract nos dois arquivos; confirmar ausência das metas universais e claims comparativos.

```bash
npx --yes markdownlint-cli2@0.23.2 PT-BR/test-code-pt.md ENG/test-code-eng.md
git diff --check
git add PT-BR/test-code-pt.md ENG/test-code-eng.md
git commit -m "docs: orientar testes por risco e capacidade"
```

### Task 7: Atualizar os guias de performance

**Arquivos:**

- Modificar: `PT-BR/perf-code-pt.md`.
- Modificar: `ENG/perf-code-eng.md`.

**Interfaces:**

- Consome: web.dev Web Vitals e documentação React Native oficiais.
- Produz: métricas de campo e compatibilidade atualizadas nos dois idiomas.

- [ ] **Passo 1: qualificar Core Web Vitals**

Manter os limites good atuais e dizer explicitamente que a decisão usa dados de campo RUM/CrUX no p75, segmentados por mobile/desktop e URL/grupo. Lighthouse é diagnóstico de laboratório, não prova de experiência real.

- [ ] **Passo 2: adicionar fallback de imagens**

Recomendar `<picture>` com AVIF/WebP em `<source>` e JPEG/PNG no `<img>`, ou negociação de CDN comprovada na matriz de suporte.

- [ ] **Passo 3: atualizar profiling React Native e notação inglesa**

Indicar React Native DevTools, Android Studio e Xcode. Manter Flipper apenas para legado/manual em versões antigas. Usar `2.5 s` e `0.1` no arquivo inglês; PT-BR pode usar `2,5 s` e `0,1`.

- [ ] **Passo 4: validar e commit**

Confirmar `p75`, `RUM`, `CrUX`, `mobile`, `desktop`, `<picture>`, fallback, React Native DevTools e a classificação de Flipper nos dois arquivos. Confirmar ausência de `2,5` e `0,1` no inglês.

```bash
npx --yes markdownlint-cli2@0.23.2 PT-BR/perf-code-pt.md ENG/perf-code-eng.md
git diff --check
git add PT-BR/perf-code-pt.md ENG/perf-code-eng.md
git commit -m "docs: atualizar metricas e ferramentas de performance"
```

### Task 8: Polir os guias de design

**Arquivos:**

- Modificar: `PT-BR/design-code-pt.md`.
- Modificar: `ENG/design-code-eng.md`.

**Interfaces:**

- Consome: salvaguardas já existentes de Canvas UI/Liquid Glass.
- Produz: regras visuais coerentes e progressive enhancement consolidado.

- [ ] **Passo 1: corrigir cores e tipografia**

Distinguir sete tokens semânticos de base (fundos, texto, texto secundário, primária, borda, acento) de acentos decorativos. Limitar acentos decorativos simultâneos sem contar tokens necessários de texto/fundo/borda; estados derivados devem manter contraste e coerência. Separar famílias Google Fonts de General Sans, Clash Display e Satoshi; exigir origem/licença e fallback de sistema para fontes externas.

- [ ] **Passo 2: corrigir imagens e Canvas UI**

Reservar `object-fit: cover` a imagens decorativas/editoriais. Usar `contain` ou proporção intrínseca para logos, gráficos, screenshots e conteúdo informativo. Tratar Canvas UI como referência adaptável condicionada a licença, proveniência e créditos; remover “copiável/copyable”.

- [ ] **Passo 3: consolidar progressive enhancement**

Criar uma seção normativa única para Canvas/Liquid Glass: HTML semântico funcional antes do efeito; fallback opaco com conteúdo/ação/estados equivalentes; funcionamento sem JS/WebGL; reduced motion/contrast/transparency; pausa fora da viewport e em página oculta; compatibilidade; limite de DPR/blur/efeitos simultâneos; aparelho modesto e pior fundo. Nas demais seções, apontar para este contrato sem duplicar prosa divergente.

- [ ] **Passo 4: qualificar defaults e preservar salvaguardas**

Trocar absolutos editoriais “RECEITA/ALWAYS” por default forte salvo requisito do usuário/produto ou exceção documentada. Preservar distinção entre blur e refração, limite de 1–2 superfícies Liquid Glass, controles HTML, blacklist, validação mensurável e orientação Apple somente quando plataforma/SDK/API forem aplicáveis.

- [ ] **Passo 5: validar e commit**

Confirmar `tokens semânticos/semantic tokens`, licença de fontes externas, `contain`, licença Canvas UI, fallback HTML opaco, página oculta, DPR, 1–2 superfícies e Apple condicional nos dois idiomas. Confirmar que `copyable/copiável` não descreve Canvas UI.

```bash
npx --yes markdownlint-cli2@0.23.2 PT-BR/design-code-pt.md ENG/design-code-eng.md
git diff --check
git add PT-BR/design-code-pt.md ENG/design-code-eng.md
git commit -m "docs: consolidar regras de design progressivo"
```

### Task 9: Sincronizar os guias de games web

**Arquivos:**

- Modificar: `PT-BR/games-code-design-web-pt.md`.
- Modificar: `ENG/games-code-design-web-eng.md`.

**Interfaces:**

- Consome: guias de design, acessibilidade, segurança, testes e performance do mesmo idioma.
- Produz: união sem perda do conteúdo forte e paridade semântica dos guias de games.

- [ ] **Passo 1: unir estrutura e referências**

Comparar os dois arquivos seção a seção e incorporar em cada idioma qualquer regra útil ausente, sem remover determinismo, input, áudio, saves, rede autoritativa, segurança, PWA, procedural generation ou fallbacks. Nos prefácios, ligar design e acessibilidade além dos módulos já citados.

- [ ] **Passo 2: limitar o game loop**

Nos exemplos e na prosa, usar `maxStepsPerFrame`, emitir evento/telemetria de slow frame e aplicar política intencional de recuperação ou ressincronização quando o teto for atingido; nunca executar catch-up ilimitado.

- [ ] **Passo 3: completar assets e acessibilidade**

Manifest deve conter hash, origem, licença e atribuição; CI valida os campos e preserva notices na distribuição. Ambos os idiomas devem exigir axe-core para a camada DOM e smoke manual de teclado, AT, zoom e fluxo de jogo; automação não prova conformidade.

- [ ] **Passo 4: corrigir referências quebradas**

Remover `https://web.dev/games/` e `https://www.w3.org/WAI/gaming/`. Usar `https://web.dev/articles/ready-player-web`, WCAG 2.2 e `https://gameaccessibilityguidelines.com/` com descrição correta de seu papel.

- [ ] **Passo 5: validar e commit**

Confirmar `maxStepsPerFrame`, slow frame, recovery/resync, `license`, `attribution`, origem, axe-core, design/acessibilidade e novos URLs nos dois arquivos. Confirmar ausência dos dois URLs 404 e revisar a paridade de headings/conteúdo, sem exigir contagem de linhas idêntica.

```bash
npx --yes markdownlint-cli2@0.23.2 PT-BR/games-code-design-web-pt.md ENG/games-code-design-web-eng.md
git diff --check
git add PT-BR/games-code-design-web-pt.md ENG/games-code-design-web-eng.md
git commit -m "docs: sincronizar guias de games web"
```

### Task 10: Executar auditoria integral e fechar registros

**Arquivos:**

- Modificar se necessário: qualquer documento alterado pelas Tasks 1–9, apenas para corrigir achados de integração.
- Modificar: `docs/superpowers/plans/2026-08-08-repository-guide-polish.md`.
- Modificar: `docs/superpowers/specs/2026-08-08-repository-guide-polish-design.md`.
- Modificar: `docs/superpowers/README.md`.

**Interfaces:**

- Consome: todos os commits das Tasks 1–9.
- Produz: coleção validada e registros com status concluído.

- [ ] **Passo 1: validar todos os documentos localmente**

Executar, com saída completa:

```bash
npx --yes markdownlint-cli2@0.23.2
git diff --check origin/main...HEAD
```

Executar o validador Python equivalente ao workflow para frontmatter, nomes únicos, contrapartes, cercas e links relativos. Executar Lychee local se houver binário seguro disponível; caso contrário, executar um verificador HTTP read-only que reporte status final de cada URL sem ocultar falhas.

- [ ] **Passo 2: procurar regressões conhecidas**

Confirmar ausência de URLs 404 conhecidos, política absoluta de instalação, Canvas UI “copyable”, `EncryptedSharedPreferences` como recomendação atual, Flipper como profiler principal, Playwright para janela Tauri, HSTS preload incondicional e valores brutos em erros/logs.

- [ ] **Passo 3: auditar paridade**

Comparar os oito pares por headings, termos normativos, números, exemplos, links oficiais e checklists. Corrigir qualquer requisito, exceção ou fonte presente em apenas um idioma. Validar a notação decimal por idioma.

- [ ] **Passo 4: fechar documentação da execução**

Marcar todas as checkboxes deste plano como `[x]`, adicionar status `concluído`, data `2026-08-08` e intervalo de commits da implementação. Atualizar a especificação para `implementada` e incluir este plano no índice `docs/superpowers/README.md` como registro concluído.

- [ ] **Passo 5: commit final de integração**

Executar novamente Markdown lint, validador estrutural, verificador de links e `git diff --check`. Só então:

```bash
git add -A
git commit -m "docs: concluir polimento integral dos guias"
```

Esperado: worktree limpo, todas as verificações concluídas com evidência e nenhuma pendência Critical/Important na revisão final independente.
