---
name: test-code-pt
language: pt-BR
counterpart: ../ENG/test-code-eng.md
description: "Estratégia e ferramentas de teste orientadas a risco para linguagens e plataformas modernas."
version: "2026.08"
last-reviewed: "2026-08-08"
---

# Guia de Testes Orientados a Risco por Linguagem e Tecnologia

> Instruções práticas para selecionar, executar e aprovar testes de software conforme risco, stack, compatibilidade e evidência operacional.

**Documentos relacionados**: para princípios gerais de código limpo (nomes, funções pequenas, formatação), veja [`clean-code-pt.md`](./clean-code-pt.md). Para segurança, inclusive SAST/DAST, veja [`sec-code-pt.md`](./sec-code-pt.md). Para acessibilidade, use o guia específico do repositório junto da [WCAG 2.2](https://www.w3.org/TR/WCAG22/). Para vídeo e motion HTML, consulte o [HyperFrames](https://hyperframes.heygen.com). Este arquivo é a referência canônica para decidir a estratégia de teste por linguagem e plataforma.

**Política de ferramentas**: identifique a stack, a etapa e os checks aplicáveis; prefira um equivalente já disponível que produza evidência compatível. Antes de instalar uma ferramenta ou alterar o ambiente, peça autorização. Se não houver equivalente seguro, registre o check necessário como bloqueado e nunca afirme que ele passou. Não instale recursos meramente opcionais.

## Comece pelo risco, não pela ferramenta

Antes de escrever ou selecionar testes, registre:

- ativo, jornada ou regra protegida;
- impacto de falha em usuário, receita, dados, segurança, acessibilidade e operação;
- probabilidade de regressão, complexidade da mudança e histórico de incidentes;
- plataformas, versões, dispositivos, permissões e condições de rede suportados;
- oráculo observável, ambiente, dados e responsável pelo resultado;
- evidência exigida e prazo de reavaliação.

Classifique cada item localmente. Os rótulos abaixo não impõem quantidade fixa de testes:

| Classe | Exemplo | Evidência mínima de aprovação |
| --- | --- | --- |
| Crítico | autenticação, pagamento, perda de dados, autorização, migração destrutiva | regras unitárias/por propriedades, integração realista, contrato e jornada E2E; revisão manual quando o oráculo exigir julgamento |
| Alto | fluxo frequente, integração externa, compatibilidade ou acessibilidade | testes de branches relevantes, integração/contrato e smoke na plataforma afetada |
| Padrão | conteúdo, apresentação ou lógica reversível de baixo impacto | checks focados na mudança e regressão proporcional ao alcance |

A pirâmide de testes é uma heurística de custo, não uma cota. Mantenha a maior parte da confiança em testes rápidos e determinísticos, mas use integração, contrato, UI, desempenho, segurança e avaliação manual quando somente essas camadas observarem o risco.

## Cobertura e força da suíte

- Não adote percentuais universais de cobertura nem exija um teste por função. Defina o contrato no repositório conforme baseline medido, criticidade, linguagem e custo de manutenção.
- Observe separadamente cobertura da base, linhas alteradas, branches/condições e caminhos críticos. Uma mudança não deve reduzir o baseline aplicável sem justificativa, responsável e risco aceito.
- Para regras críticas, liste casos, limites, estados inválidos e propriedades. Cobertura de linha não prova que asserções distinguem comportamento correto de incorreto.
- Execute **mutation testing** em módulos onde o custo compense, com [Stryker](https://stryker-mutator.io/), [PIT](https://pitest.org/) ou ferramenta equivalente da stack. Compare o mutation score ao baseline do próprio projeto e investigue mutantes sobreviventes relevantes; não transforme um número genérico em meta universal.
- Toda correção de bug deve preservar um teste de regressão que falhe no estado defeituoso e passe com a correção, salvo impossibilidade documentada.

## Matriz de seleção de ferramentas

Uma ferramenta é candidata, não vencedora por ranking. Registre a decisão no repositório e aplique esta ordem:

1. Elimine opções incompatíveis com runtime, framework, navegador, sistema operacional, arquitetura, política de segurança ou CI.
2. Em projeto existente, mantenha a ferramenta já adotada quando ela cobre o risco e recebe manutenção compatível com o ciclo do produto; migração precisa de benefício medido e plano de saída.
3. Faça uma prova com uma jornada crítica. Meça tempo de execução e diagnóstico, estabilidade, paralelismo, artefatos, custo de runners e esforço de manutenção.
4. Fixe versões, comandos, plataformas suportadas, owner e data de reavaliação. Não baseie a escolha em satisfação, popularidade ou adoção de uma pesquisa isolada.

| Contexto | Candidatas com documentação oficial | Decisão reproduzível |
| --- | --- | --- |
| Node.js/TypeScript | [`node:test`](https://nodejs.org/api/test.html), [Vitest](https://vitest.dev/guide/), [Jest](https://jestjs.io/docs/getting-started) | framework/build existente, ESM/CJS, TypeScript, mocks, watch, cobertura e runtime no CI |
| Componentes e navegador | [Testing Library](https://testing-library.com/docs/), [Playwright](https://playwright.dev/docs/intro), [Cypress](https://docs.cypress.io/) | navegadores exigidos, isolamento, artefatos de falha, paralelismo, acessibilidade e compatibilidade do app |
| Python | [pytest](https://docs.pytest.org/), [`unittest`](https://docs.python.org/3/library/unittest.html) | política de dependências, fixtures/plugins, versões de Python e integração existente |
| .NET | [xUnit.net](https://xunit.net/), [NUnit](https://docs.nunit.org/), [MSTest](https://learn.microsoft.com/dotnet/core/testing/unit-testing-mstest-intro) | versão do .NET, runner/IDE, modelo de fixtures, asserts e projetos existentes |
| Java/JVM | [JUnit](https://docs.junit.org/current/overview.html), [TestNG](https://testng.org/) | build Maven/Gradle, extensões, paralelismo, integração e convenções existentes |
| Go | [`testing`](https://pkg.go.dev/testing), [Testify](https://pkg.go.dev/github.com/stretchr/testify) | stdlib suficiente ou necessidade comprovada de helpers, suites e mocks |
| Ruby | [RSpec](https://rspec.info/documentation/), [Minitest](https://ruby-doc.org/3.4/gems/minitest/Minitest.html) | convenções Rails/Ruby, fixtures, DSL e base existente |
| PHP | [PHPUnit](https://docs.phpunit.de/), [Pest](https://pestphp.com/docs/installation) | versão do PHP/framework, plugins e custo de migração |
| Serviços reais | [Testcontainers](https://testcontainers.com/), harness nativo da stack | fidelidade necessária, disponibilidade de containers, tempo e isolamento no CI |
| Contratos HTTP/eventos | [Pact](https://docs.pact.io/), schema OpenAPI/JSON Schema/GraphQL | ownership consumidor/provedor, versionamento e compatibilidade entre deploys |
| Desempenho | [k6](https://grafana.com/docs/k6/latest/), [Gatling](https://docs.gatling.io/), [JMeter](https://jmeter.apache.org/usermanual/) ou [Locust](https://docs.locust.io/) | protocolo, modelo de carga, volume, distribuição, métricas e operação pela equipe |

Mocks, stubs e fakes pertencem aos testes isolados. Para integração, prefira dependências descartáveis equivalentes à produção quando isso reduz diferenças relevantes. Tipagem, lint e análise estática complementam os testes; não substituem a execução do comportamento.

## Matriz operacional por domínio e framework

Execute somente as linhas aplicáveis ao produto e ao risco registrado. Um nome de ferramenta sem hipótese, oráculo e gate não constitui estratégia.

| Contexto | Risco que exige evidência | Abordagem e gate operacional | Ferramentas/fontes oficiais |
| --- | --- | --- | --- |
| APIs e schemas | drift entre implementação e contrato, mudança incompatível, erro/autorização não descritos | valide request/response e casos negativos contra a versão do schema; execute contratos consumidor/provedor; bloqueie breaking change sem transição compatível e verificação do provedor | [OpenAPI](https://spec.openapis.org/oas/), [JSON Schema](https://json-schema.org/learn), [GraphQL](https://spec.graphql.org/) e [Pact](https://docs.pact.io/) |
| ASP.NET Core | diferenças de routing, middleware, autenticação, serialização e persistência | teste regras isoladas; use `WebApplicationFactory`/`TestServer` para o pipeline e dependência real descartável quando o banco importa; aprove somente com status, headers, auth, persistência e falhas críticas observados | [Microsoft — integration tests](https://learn.microsoft.com/aspnet/core/test/integration-tests) e [Testcontainers for .NET](https://dotnet.testcontainers.org/) |
| Spring Boot | slice que mascara configuração, profile/security incorreto, transação ou integração divergente | use slices para feedback focado e `@SpringBootTest`/porta aleatória quando o risco atravessa camadas; valide profile, security chain, transações, migração e dependências relevantes | [Spring Boot — testing](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html) e [Testcontainers](https://java.testcontainers.org/) |
| Rails | callbacks, validações, routes, jobs, mailers e fluxo de sistema divergentes | combine testes de model/request/job/mailbox/system conforme o risco e use o adapter de banco suportado na integração; o gate observa regra, resposta, side effects e ao menos a jornada crítica afetada | [Rails — Testing Rails Applications](https://guides.rubyonrails.org/testing.html) |
| Laravel | middleware, validation, policies/auth, filas e banco não exercitados por unitário puro | separe unit de feature/HTTP/database; use fakes apenas no limite que está fora do oráculo e verifique efeitos persistidos; aprove endpoint crítico com auth, validação, resposta, banco e job/evento aplicáveis | [Laravel — testing](https://laravel.com/docs/12.x/testing), [HTTP tests](https://laravel.com/docs/12.x/http-tests) e [database testing](https://laravel.com/docs/12.x/database-testing) |
| HTML e HyperFrames | markup inválido, overflow, timing não determinístico ou frame crítico incorreto | valide HTML; execute `hyperframes lint`/`hyperframes check` quando expostos pela versão fixada; faça preview/render nos formatos declarados e revise frames/limites críticos; qualquer erro estrutural, temporal ou de layout bloqueia | [WHATWG — validators](https://whatwg.org/validator/), [Nu HTML Checker](https://validator.w3.org/nu/) e [HyperFrames](https://hyperframes.heygen.com) |
| CSS e regressão visual | cascade, responsividade, tema, fonte ou ambiente altera layout/comportamento | rode Stylelint e asserções semânticas/interação; compare screenshots somente em ambiente controlado e na matriz de risco; diffs exigem revisão explícita e o gate não depende de snapshot de CSS gerado | [Stylelint](https://stylelint.io/user-guide/get-started/) e [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) |
| Terraform | configuração válida produz replace/destroy, custo, exposição ou estado inesperado | rode `fmt`/`validate`, teste asserts do módulo e revise `plan`; use conta/ambiente dedicado para `terraform test` que cria recursos; bloqueie ações inesperadas e confirme cleanup de todo recurso de teste | [Terraform validate](https://developer.hashicorp.com/terraform/cli/commands/validate), [test](https://developer.hashicorp.com/terraform/cli/commands/test) e [plan](https://developer.hashicorp.com/terraform/cli/commands/plan) |
| Kubernetes e containers | schema aceito localmente falha no cluster, rollout/probe/rollback ou imagem diverge | faça validação estrita e dry-run server-side; use cluster efêmero quando rollout/controller justificar; rode build checks e smoke da imagem; gate cobre probes, recursos, permissões, rollback aplicável e cleanup | [kubectl apply](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_apply/) e [Docker build checks](https://docs.docker.com/reference/build-checks/) |
| Ansible | playbook não idempotente, mudança destrutiva ou estado final incorreto | execute syntax/check quando seguro e cenário Molecule com converge, verify, idempotence e destroy conforme risco; aprove somente se a segunda convergência não causar mudança indevida e o ambiente for limpo | [Ansible Molecule](https://docs.ansible.com/projects/molecule/) e [test sequence](https://docs.ansible.com/projects/molecule/usage/) |

## Fixtures, cassettes e oráculos

- Prefira dados sintéticos mínimos. Quando derivar fixtures de produção, anonimize de forma irreversível e revise risco de reidentificação, retenção e licença antes do commit.
- Controle relógio, locale, timezone, IDs, seeds e ordem. Cada teste cria e remove o próprio estado ou usa isolamento comprovado.
- Cassettes de VCR/VCR.py são código versionado. Antes de gravar, filtre tokens, cookies, cabeçalhos de autorização, parâmetros, corpos de request/response e qualquer PII; faça secret scan antes do commit e proíba gravação automática no CI.
- Defina expiração e processo de regravação de cassettes para que respostas antigas não escondam mudanças de contrato. Uma reprodução gravada não substitui testes periódicos contra sandbox real.
- Snapshot aprova somente uma representação revisada. Snapshot de CSS gerado não é oráculo primário: combine-o com asserções semânticas, interação e regressão visual em viewports/temas relevantes. Atualizações em massa exigem revisão do diff e motivo.

## Acessibilidade: automação mais avaliação humana

`axe-core` e Lighthouse detectam apenas um subconjunto automatizável. Um resultado sem violações significa apenas que esses checks não encontraram falhas; não comprova conformidade WCAG. A W3C descreve regras automatizadas como verificações parciais e exige julgamento humano para cobrir todos os aspectos dos critérios.

Para cada jornada crítica e componente reutilizável:

- rode checks automatizados com `axe-core`/Lighthouse nos estados visíveis, inclusive modais, erros e conteúdo carregado dinamicamente;
- execute revisão manual contra WCAG 2.2 no nível adotado pelo produto;
- percorra tudo por teclado, valide ordem e visibilidade do foco, ausência de armadilhas e retorno de foco;
- teste nomes, papéis, estados, anúncios e leitura com tecnologias assistivas representativas, não somente a árvore de acessibilidade;
- valide contraste, zoom, reflow, orientação, movimento reduzido e ampliação sem perda de conteúdo ou função;
- em mobile nativo, teste em dispositivo real com VoiceOver/TalkBack e gestos, foco, teclado externo, tamanho de texto, rotação e controles da plataforma.

Registre navegador/SO, tecnologia assistiva e versão, critério WCAG, resultado, evidência e avaliador. Defeitos críticos de teclado, foco, nome/papel/estado ou acesso a uma jornada bloqueiam a aprovação.

## Aprovação funcional e jornadas críticas

Uma jornada aprovada deve cobrir estados feliz, vazio, inválido, negado, interrompido e recuperado conforme o risco. Inclua quando aplicável:

- rede lenta, perda e retomada de conexão, timeout, retry idempotente e operação offline;
- primeira execução, upgrade, logout/login, expiração de sessão e troca de conta;
- permissões negadas, concedidas depois e revogadas durante o uso;
- background/foreground, suspensão, encerramento e restauração de estado;
- locale, timezone, armazenamento cheio, baixa memória e dependência indisponível;
- combinações de SO, navegador e dispositivo definidas pelo contrato de suporte e telemetria, com dispositivos reais para riscos que emuladores não reproduzem.

O oráculo deve observar resultado de usuário e invariantes de dados, não detalhes incidentais da implementação.

## Desempenho e resiliência

Antes do teste, transforme expectativas em critérios de pass/fail ligados a SLOs ou budgets do produto:

- latência p95 e p99 por jornada/endpoint, throughput sustentado e taxa de erro;
- consumo de CPU, memória, energia, conexões e tamanho de artefatos quando relevantes;
- volume, distribuição de operações, concorrência, dataset e limites de dependências;
- budget de regressão relativo a um baseline comparável, além dos limites absolutos do SLO.

Documente hardware, região, build, configuração, dataset e interferências. Separe **warm-up** da janela medida. Quando desempenho for relevante, use smoke de capacidade e baseline comparável como evidência mínima. Acrescente **spike** somente se bursts, rate limits, autoscaling ou recuperação forem riscos; **soak** somente se duração, leaks, pools, filas, cache ou sessões longas forem hipóteses; stress/breakpoint somente quando limite, headroom ou modo de falha precisarem ser conhecidos, sempre em ambiente autorizado. A frequência de cada modalidade deriva do SLO, perfil de carga, mudanças e custo: não existe tipo ou cadência universal. Falhe o gate quando um threshold versionado não for atendido; média isolada não substitui p95/p99 nem distribuição.

## Mobile e desktop

### Mobile

- Teste lógica e componentes com os harnesses da plataforma; cubra jornadas nativas com [XCTest/XCUITest](https://developer.apple.com/documentation/xctest), [Espresso](https://developer.android.com/training/testing/espresso), [Detox](https://wix.github.io/Detox/) ou [`integration_test`](https://docs.flutter.dev/testing/integration-tests) somente quando compatíveis com a stack.
- Construa a matriz de versões, fabricantes e dispositivos a partir do contrato de suporte, telemetria e riscos de hardware. Emuladores aceleram feedback; dispositivos reais aprovam sensores, desempenho, acessibilidade, permissões e comportamento do SO.
- Exercite instalação/upgrade, deep links, notificações, interrupções, conectividade degradada/offline e transições background/foreground.

### Windows

- Isole lógica WinUI/WPF/WinForms/MAUI por MVVM/MVU e teste-a com o runner .NET adotado.
- Em **2026-08-08**, o caminho mantido pelo ecossistema Appium para UI Windows é o [Appium Windows Driver](https://github.com/appium/appium-windows-driver), instalado e versionado como driver do Appium. Ele ainda atua como proxy do servidor WinAppDriver e sua própria documentação alerta que esse servidor da Microsoft não recebe manutenção regular há anos.
- Trate harness que inicia **WinAppDriver diretamente** como legado: preserve somente quando uma suíte existente exigir, fixe a versão e mantenha um plano de substituição. Não crie uma nova arquitetura acoplada diretamente ao servidor legado.
- Valide instalador, privilégios/UAC, DPI, múltiplas janelas, atalhos e smoke pós-instalação em runners Windows compatíveis; limitações do driver devem aparecer como risco, nunca como check omitido silenciosamente.

### macOS e Electron

- Para apps Apple nativos, use XCTest/XCUITest conforme o risco e valide assinatura, notarização, permissões, menus, atalhos e smoke pós-instalação em macOS real.
- Para Electron, selecione [Playwright Electron](https://playwright.dev/docs/api/class-electron) ou [WebdriverIO Electron Service](https://webdriver.io/docs/desktop-testing/electron/) pela compatibilidade da versão, recursos exigidos e ambiente de CI.

### Tauri

- Teste backend Rust com `cargo test` e frontend isolado com a ferramenta web já adotada.
- Para E2E do aplicativo empacotado, em **2026-08-08** a documentação Tauri indica WebdriverIO com [`@wdio/tauri-service`](https://webdriver.io/docs/wdio-tauri-service/); o serviço pode usar servidor embutido ou `tauri-driver` nas plataformas suportadas. Fixe versões e siga a matriz publicada.
- Não descreva Playwright anexado à janela Tauri como caminho suportado. Se um projeto mantiver experimento próprio, ele precisa de owner, evidência por plataforma e aceite explícito do custo de manutenção.

## Migrações de banco e compatibilidade entre versões

- Teste migrações em banco vazio e em cópia sanitizada com volume e distribuição semelhantes à produção. Verifique tempo, locks, índices, constraints, integridade e retomada após falha.
- Use **expand-migrate-contract** para mudanças incompatíveis: expanda o schema sem remover o antigo; publique código que convive com as duas formas e migre/backfill dados; somente depois de telemetria e janela de compatibilidade, contraia o schema em outro deploy.
- Durante rollout, prove compatibilidade entre aplicativo antigo/novo e schema antigo/expandido. Teste jobs, consumidores, replicação e deploy parcial.
- Em produção, prefira **roll-forward** corrigindo a causa. Um `down` só é opção quando a reversão é realmente implementada, testada e não perde dados; caso contrário, marque a migração como irreversível e use o runbook de recuperação.
- Backup não basta: valide restore em ambiente isolado, RPO/RTO, permissões e sequência operacional antes de uma mudança crítica.

## Flaky tests, retries e quarentena

- Um teste que passa no retry continua **flaky**. Preserve a falha inicial e artefatos; retry limitado serve para diagnóstico/transientes conhecidos, nunca para tornar o gate verde ou esconder taxa de falha.
- Quarentena exige issue, owner, motivo, escopo mínimo, data de entrada e prazo de remoção. A jornada protegida precisa de evidência substituta enquanto o teste estiver fora do gate.
- Exponha contagem e taxa de flakiness por teste/suíte. Ultrapassar o budget local falha o gate ou bloqueia expansão da suíte conforme a política registrada.
- Corrija sincronização, isolamento, estado, dependência e ambiente; não use `sleep` crescente como solução. Remova teste redundante somente com prova de cobertura equivalente.

## Cadência de CI e evidência

| Evento | Gates esperados |
| --- | --- |
| A cada PR | lint/typecheck aplicáveis, unitários e integração impactados, smoke das jornadas críticas afetadas, checks automatizados de acessibilidade e segurança, cobertura/mutação conforme risco |
| Merge/branch protegida | contratos, integração ampliada e artefatos reproduzíveis; políticas de exceção validadas |
| Agendado | suites amplas selecionadas pelo risco: matriz de plataformas, E2E, sandbox externo, mutation testing caro, modalidades de carga justificadas e varreduras extensas |
| Release | instalador/upgrade/rollback operacional, smoke pós-deploy, evidência manual de acessibilidade concluída, restore/migração e critérios SLO do release; sem essa evidência, bloquear o release ou registrar exceção formal com owner e prazo |

Uma suíte ampla não precisa rodar inteira em toda PR quando o custo reduz o feedback sem diminuir risco. A seleção por impacto precisa ser conservadora, auditável e acompanhada por execução agendada que detecte lacunas. Um comando documentado deve reproduzir cada gate; qualquer check não executado é `bloqueado` ou `não aplicável` com justificativa, nunca `aprovado`.

## Template de instruções para CLAUDE.md / AGENTS.md

```markdown
## Testes

### Contrato de risco

- Jornadas críticas e owners: [links]
- Contrato de suporte: [SO/navegador/dispositivo/runtime]
- SLOs e budgets: [latência p95/p99, throughput, erro, recursos]
- Baseline: [cobertura da base/mudança/branches, mutation score, flakiness]

### Seleção e comandos

- Ferramentas/versões e motivo compatível com a stack: [registro]
- PR smoke: `[comando]`
- Suite ampliada agendada: `[comando]`
- Performance/acessibilidade/migração: `[comandos ou runbooks]`
- Gates de domínio (API/IaC/framework/HTML/CSS): `[comandos e evidências aplicáveis]`

### Gates

- Correções preservam regressão red/green; mudanças cobrem branches e riscos.
- Cobertura não regride contra o baseline aplicável sem aceite documentado.
- Mutation testing é aplicado a módulos críticos conforme budget local.
- Retry não apaga falha inicial; quarentena exige issue, owner e validade.
- Cassettes não contêm tokens, cookies, PII nem secrets em requests/responses.
- Acessibilidade combina automação e avaliação manual WCAG 2.2/AT.
- Migrações usam expand-migrate-contract, roll-forward e restore ensaiado.
- Check não executado é registrado como bloqueado ou não aplicável.
```

## Checklist de aprovação

- [ ] O risco e a jornada protegida estão nomeados, com owner e oráculo.
- [ ] A escolha de ferramenta considera stack, compatibilidade, manutenção, runtime, projeto existente e CI.
- [ ] Cobertura usa baseline da base/mudança/branches/caminhos críticos, sem percentual universal.
- [ ] Mutation testing foi executado ou descartado com justificativa de custo/risco.
- [ ] Smoke de PR e suites amplas agendadas têm comandos e evidências separados.
- [ ] SLOs/budgets incluem p95/p99, throughput, taxa de erro, warm-up e, quando aplicável, soak/spike.
- [ ] Cada domínio/framework aplicável tem risco, abordagem, ferramenta e gate operacional registrados.
- [ ] Jornadas cobrem rede degradada/offline, permissões e background/foreground quando relevantes.
- [ ] A matriz de SO/dispositivos inclui hardware real onde o emulador não prova o risco.
- [ ] Acessibilidade automatizada foi complementada por teclado, AT, zoom/reflow, foco, contraste e mobile nativo.
- [ ] Windows usa Appium Windows Driver; uso direto de WinAppDriver está registrado como legado.
- [ ] Tauri E2E usa `@wdio/tauri-service`/`tauri-driver`, não Playwright anexado à janela.
- [ ] Cassettes foram redigidos e escaneados; snapshots de CSS não são o oráculo primário.
- [ ] Quarentena tem issue, owner, prazo e evidência substituta; retries não mascaram falhas.
- [ ] Migrações seguem expand-migrate-contract, roll-forward, compatibilidade e restore; `down` é realmente reversível.
- [ ] Exceções, checks bloqueados e datas de reavaliação estão documentados.

## Fontes oficiais auditáveis

Afirmações temporais desta revisão foram verificadas em **2026-08-08**. Revalide versões, manutenção e suporte de plataforma antes de adotar ou atualizar uma ferramenta.

- [W3C — Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/): referência normativa e combinação de automação com avaliação humana.
- [W3C — Understanding ACT Rules](https://www.w3.org/WAI/WCAG22/Understanding/understanding-act-rules.html): regras automatizadas são checks parciais e um passe não comprova conformidade integral.
- [Deque — axe-core](https://github.com/dequelabs/axe-core): escopo automatizado, resultados `incomplete` e necessidade de revisão manual.
- [Chrome for Developers — Lighthouse accessibility audits](https://developer.chrome.com/docs/lighthouse/accessibility/): checks automatizados e itens manuais complementares.
- [Appium — drivers](https://appium.io/docs/en/latest/ecosystem/drivers/) e [Appium Windows Driver](https://github.com/appium/appium-windows-driver): instalação/suporte do driver e dependência/limitações do WinAppDriver.
- [Tauri — WebDriver](https://v2.tauri.app/develop/tests/webdriver/) e [WebdriverIO — Tauri Service](https://webdriver.io/docs/wdio-tauri-service/): `@wdio/tauri-service`, servidor embutido e `tauri-driver`; página Tauri atualizada em 2026-06-29.
- [W3C — WebDriver](https://www.w3.org/TR/webdriver2/): protocolo padronizado usado pelos drivers.
- [Grafana k6 — thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) e [tipos de teste](https://grafana.com/docs/k6/latest/testing-guides/test-types/): critérios pass/fail, percentis, smoke, spike e soak.
- [Playwright — retries](https://playwright.dev/docs/test-retries): distingue resultado aprovado, flaky e falho após retries.
- [VCR.py — filtragem de dados sensíveis](https://vcrpy.readthedocs.io/en/latest/advanced.html#filter-sensitive-data-from-the-request): filtros de headers, query, body e respostas antes da gravação.
- [Prisma — expand-and-contract migrations](https://docs.prisma.io/docs/guides/database/data-migration): sequência expandir, migrar dados e contrair em produção.
- [Stryker — mutation testing](https://stryker-mutator.io/docs/): uso de mutantes para avaliar a capacidade de detecção da suíte.
- [Spring Boot testing](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html), [ASP.NET Core integration tests](https://learn.microsoft.com/aspnet/core/test/integration-tests), [Rails testing](https://guides.rubyonrails.org/testing.html) e [Laravel testing](https://laravel.com/docs/12.x/testing): harnesses oficiais dos frameworks.
- [OpenAPI](https://spec.openapis.org/oas/), [JSON Schema](https://json-schema.org/learn), [GraphQL](https://spec.graphql.org/) e [Pact](https://docs.pact.io/): schemas e contratos de API.
- [Terraform testing](https://developer.hashicorp.com/terraform/cli/test), [Kubernetes kubectl apply](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_apply/), [Ansible Molecule](https://docs.ansible.com/projects/molecule/) e [Docker build checks](https://docs.docker.com/reference/build-checks/): evidência operacional de IaC/DevOps.
- [Stylelint](https://stylelint.io/user-guide/get-started/), [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots), [WHATWG validators](https://whatwg.org/validator/) e [HyperFrames](https://hyperframes.heygen.com): checks de CSS, visual, HTML e composição.
