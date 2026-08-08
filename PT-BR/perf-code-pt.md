---
name: perf-code-pt
language: pt-BR
counterpart: ../ENG/perf-code-eng.md
description: "Medição, diagnóstico e melhoria de performance em web, mobile, desktop, APIs e dados."
version: "2026.08"
last-reviewed: "2026-08-08"
---

# Guia de Performance para Desenvolvimento Web, Mobile, Desktop e Bancos de Dados

> Instruções práticas para projetar, medir, diagnosticar e melhorar performance em aplicações web, mobile (iOS/Android), desktop (Windows/macOS), APIs, infraestrutura e bancos de dados. Use este documento para orientar agentes de IA e desenvolvedores. Performance deve ser medida em cenários reais antes e depois da mudança — não otimizada por suposição.
> **Documentos relacionados**: para estrutura e legibilidade de código, ver [`clean-code-pt.md`](./clean-code-pt.md). Para testes funcionais, de integração e E2E, ver [`test-code-pt.md`](./test-code-pt.md). Para segurança e trade-offs de cache, secrets e infraestrutura, ver [`sec-code-pt.md`](./sec-code-pt.md). Para performance percebida, UX, motion e design responsivo, ver [`design-code-pt.md`](./design-code-pt.md). Para performance de preview e renderização de vídeo HTML, consulte o [HyperFrames](https://hyperframes.heygen.com). Este arquivo é a referência canônica de performance.
> **Política de ferramentas**: identifique a stack, a etapa e os checks aplicáveis; prefira um equivalente já disponível que produza evidência compatível. Antes de instalar uma ferramenta ou alterar o ambiente, peça autorização. Se não houver equivalente seguro, registre o check necessário como bloqueado e nunca afirme que ele passou. Não instale recursos meramente opcionais.

## Princípios gerais

- **Meça antes de otimizar**: reproduza o problema, registre uma baseline, encontre o gargalo com profiling/telemetria e só então altere o código.
- **Defina um orçamento de performance** por produto: tempo de inicialização, latência de API, tamanho de bundle, consumo de memória, FPS, CPU, bateria e custo de infraestrutura.
- **Otimize o caminho crítico**: priorize o que bloqueia a primeira renderização, a primeira interação, a operação mais usada ou o fluxo que gera maior impacto para o usuário.
- **Métricas de distribuição**: acompanhe mediana (p50), p75, p95 e p99. Uma média saudável pode esconder uma minoria de usuários com experiência muito ruim.
- **Performance percebida importa**: feedback imediato, skeleton/loading state, streaming e atualização progressiva podem melhorar a experiência sem mascarar uma operação lenta.
- **Não bloqueie a thread principal**: trabalho de CPU, I/O, parsing, serialização e processamento pesado devem ser assíncronos, paralelizados ou movidos para worker/background quando possível.
- **Menos trabalho é melhor que trabalho mais rápido**: elimine chamadas, renders, queries, alocações, payloads e inicializações desnecessárias antes de micro-otimizar um algoritmo.
- **Evite otimização especulativa**: não adicione cache, pooling, memoização ou complexidade sem evidência de gargalo e sem medir invalidação, memória e custo de manutenção.
- **Controle concorrência e recursos**: use timeouts, limites de fila, backpressure, quotas, circuit breakers e cancelamento para evitar que lentidão se transforme em exaustão de recursos.
- **Performance não pode quebrar segurança**: não desabilite TLS, autenticação, validação, isolamento ou controles de segurança para obter velocidade. Consulte [`sec-code-pt.md`](./sec-code-pt.md) antes de otimizar fluxos sensíveis.
- **Registre a causa da otimização**: documente a métrica afetada, o cenário reproduzido e o trade-off aceito; remova instrumentação temporária depois da investigação.

---

## Processo obrigatório de diagnóstico

1. **Defina o cenário**: plataforma, versão, hardware, rede, volume de dados, tamanho do usuário e fluxo afetado.
2. **Reproduza em build de produção/release**: builds de desenvolvimento, hot reload e logs excessivos distorcem resultados.
3. **Colete baseline**: registre p50/p95/p99, CPU, memória, I/O, rede, erros, throughput e consumo de bateria quando aplicável.
4. **Localize o gargalo**: use profiler, traces, logs estruturados, métricas e flame graphs. Não conclua que o problema é CPU sem medir CPU.
5. **Faça uma alteração pequena**: mude uma variável principal por vez para atribuir causalidade ao resultado.
6. **Teste carga e regressão**: valide o caminho otimizado com os mesmos dados e compare com a baseline; rode os testes de [`test-code-pt.md`](./test-code-pt.md).
7. **Valide em condições reais**: dispositivos modestos, rede lenta, cache frio/quente, volume realista e concorrência realista.
8. **Monitore após publicar**: compare RUM/telemetria de produção, defina alertas e reverta se o resultado degradar outros indicadores.

### Ferramentas gerais

- **Profiling**: Chrome DevTools/Lighthouse, Node.js `--prof`/clinic.js, Python `cProfile`/py-spy, .NET dotnet-trace/dotnet-counters, Java JFR/async-profiler, Go pprof, Instruments (Apple), Windows Performance Analyzer.
- **Observabilidade**: OpenTelemetry para traces/métricas/logs, Prometheus + Grafana, Application Insights, CloudWatch, Datadog ou equivalente.
- **Carga**: k6, Locust, Gatling, JMeter ou ferramenta equivalente. Use carga gradual e cenários próximos da produção.
- **Benchmarks**: compare versões com dados e ambiente fixos; não use benchmark sintético isolado como única evidência.

---

## Web — métricas e orçamento

### Core Web Vitals

Monitore dados de laboratório e de usuários reais (RUM). Para decidir se a experiência atende aos Core Web Vitals, use RUM próprio ou CrUX no percentil 75 (p75) dos carregamentos, segmentado entre mobile e desktop e por URL ou grupo de URLs relevante. Como referência inicial, busque os limiares "bons" recomendados pelo web.dev:

- **LCP (Largest Contentful Paint)**: até `2,5 s` — carregamento do maior conteúdo visível.
- **INP (Interaction to Next Paint)**: até `200ms` — responsividade das interações.
- **CLS (Cumulative Layout Shift)**: até `0,1` — estabilidade visual.
- Acompanhe também **TTFB**, FCP, peso de página, tempo de hidratação e erros JavaScript.

Lighthouse é diagnóstico de laboratório: reproduza e investigue problemas nele, mas não o use como prova da experiência real. RUM/CrUX no p75, com a segmentação definida acima, é a evidência para decidir se a experiência dos usuários melhorou.

### Entrega de documentos e rede

- Use **HTTP/2 ou HTTP/3**, TLS moderno e compressão Brotli (ou gzip como fallback).
- Configure cache HTTP corretamente (`Cache-Control`, `ETag`, `Last-Modified`) e use CDN para assets estáticos e conteúdo cacheável.
- Use hashing de nomes de assets (`app.[hash].js`) para cache longo sem servir versões antigas.
- Faça preload apenas de recursos críticos do caminho inicial (fonte crítica, imagem LCP); preload em excesso compete pelo mesmo bandwidth.
- Use `preconnect` somente para origens realmente críticas e `prefetch` para navegação provável, sem desperdiçar dados móveis.
- Reduza TTFB com cache de página/dados, conexão de banco reutilizada, processamento assíncrono e escolha adequada de região.
- Faça streaming de HTML/dados quando o framework suportar e quando isso reduzir o tempo até conteúdo útil.
- Evite cadeias de dependências de rede: um recurso crítico não deve depender de vários requests sequenciais para aparecer.

### HTML, CSS e imagens

- Envie imagens no formato e tamanho necessários: **AVIF/WebP**, compressão adequada, `srcset`, `sizes`, dimensões explícitas e `aspect-ratio`; não presuma que esses formatos são compatíveis sem fallback.
- Prefira `<picture>` com `AVIF`/`WebP` em `<source>` e JPEG/PNG no `<img>` como fallback. Só substitua esse markup por negociação de formato na CDN após comprovar, na matriz de suporte, que ela respeita `Accept`, retorna o fallback e varia o cache corretamente.

```html
<picture>
  <source srcset="/imagem.avif" type="image/avif">
  <source srcset="/imagem.webp" type="image/webp">
  <img src="/imagem.jpg" alt="Descrição da imagem" width="1200" height="800">
</picture>
```

- Não use `loading="lazy"` na imagem LCP; use carregamento prioritário para o conteúdo acima da dobra e lazy loading para o restante.
- Evite layout shift: reserve espaço para imagens, anúncios, embeds e fontes antes de eles carregarem.
- Minifique CSS, remova CSS não usado e evite seletores excessivamente complexos ou que forcem recálculo amplo.
- Prefira animações de `transform` e `opacity`; evite animar `top`, `left`, `width`, `height` ou propriedades que provoquem layout a cada frame.
- Carregue fontes com `font-display: swap`, limite variantes/pesos e use fallback com métricas compatíveis para reduzir layout shift.
- Substitua GIFs grandes por vídeo otimizado quando houver animação contínua.

### JavaScript / TypeScript no navegador

- Divida o bundle por rota/componente (`code splitting`) e carregue recursos não críticos sob demanda.
- Remova dependências e código não utilizados; analise o bundle com `source-map-explorer`, `webpack-bundle-analyzer` ou equivalente.
- Use `defer`/`async` corretamente; não bloqueie o parser com scripts não críticos no `<head>`.
- Quebre tarefas longas em partes menores e ceda à thread principal; evite loops síncronos grandes durante interação.
- Use Web Workers para parsing, compressão, cálculos e processamento que não precisam acessar o DOM.
- Debounce/throttle eventos de alta frequência (scroll, resize, input), usando listeners passivos quando apropriado.
- Evite renders desnecessários: mantenha estado próximo de onde é usado, virtualize listas longas, use memoização apenas após medir e estabilize props/callbacks quando o framework exigir.
- Não faça waterfall de requests: carregue em paralelo quando houver independência, use cache de dados e prefira streaming/paginação a payloads gigantes.
- Em SSR/hidratação, reduza o JavaScript enviado ao cliente; considere ilhas, componentes parciais ou Server Components quando adequados.

### React / Next.js

- Prefira Server Components/SSR para conteúdo que não precisa de interatividade no cliente; marque como client apenas o necessário.
- Use `next/image`, `next/font`, prefetch de rotas com critério e cache/revalidação de dados apropriados.
- Evite transformar o layout inteiro em Client Component por conveniência.
- Virtualize tabelas/listas longas e evite colocar estado global que cause rerender da aplicação inteira.
- Meça custo de hidratação e use React DevTools Profiler antes de aplicar `memo`, `useMemo` ou `useCallback` em massa.

### Vue / Nuxt / Angular

- Vue/Nuxt: use `defineAsyncComponent`, lazy routes, `v-once`/memoização quando comprovado e evite watchers amplos.
- Angular: use `OnPush`, `trackBy`/`track`, lazy routes, deferrable views e evite trabalho pesado em templates/change detection.
- Em ambos: mantenha bundles por rota e meça o custo de hidratação/renderização com DevTools e profiling do framework.

### WebAssembly, PWA e Web Workers

- Use WebAssembly apenas para trabalho realmente CPU-bound; o custo de download, compilação e cópia de dados pode superar o ganho.
- PWA: defina estratégia de cache do service worker, evite cachear dados sensíveis ou versões incompatíveis e limite o tamanho do precache.
- Service workers devem falhar de forma segura e permitir atualização previsível; nunca deixar usuários presos em um shell antigo.

---

## Backend e APIs web

### Regras comuns

- Faça I/O de rede e disco de forma assíncrona; configure timeout de conexão, leitura e operação completa.
- Reutilize conexões com pools dimensionados por medição; pool grande demais causa contenção e derruba o banco.
- Paginação obrigatória para coleções; prefira cursor/keyset pagination em grandes volumes a `OFFSET` profundo.
- Limite payloads, uploads, tamanho de resposta e complexidade de query; use compressão quando o payload justificar.
- Evite N+1 queries com eager loading, batching ou DataLoader, mas não carregue relações inteiras sem necessidade.
- Use cache com TTL, invalidação explícita e métricas de hit/miss; nunca confie em cache como única fonte de verdade.
- Use filas/background jobs para tarefas lentas (e-mail, relatórios, processamento de vídeo), com idempotência e retries com backoff.
- Faça graceful degradation: se recomendação, analytics ou serviço secundário falhar, o caminho principal continua funcionando.
- Instrumente latência por endpoint, status code, tamanho de payload, dependência externa e query; médias isoladas não são suficientes.

### Node.js / JavaScript / TypeScript

- Não bloqueie o event loop com CPU pesado, `JSON.parse` de payloads enormes, regex catastrófica ou compressão síncrona; mova trabalho para Worker Threads/filas.
- Use streams para arquivos e payloads grandes, em vez de carregar tudo em memória.
- Configure pools de conexão de banco e clientes HTTP reutilizáveis; não crie um cliente por request.
- Use `autocannon`, `clinic.js`, `0x` ou Node Profiler para encontrar event-loop lag e hot paths.
- Evite middleware global caro em rotas que não precisam dele; limite serialização de objetos e campos retornados.

### Python

- Use `asyncio`/ASGI para I/O concorrente quando a aplicação e as bibliotecas forem realmente assíncronas; não misture chamadas bloqueantes no event loop.
- Use workers/processos para CPU-bound e pools apropriados para I/O; meça antes de escolher threads ou processos.
- Prefira paginação, generators e streaming a listas gigantes em memória.
- Profile com `cProfile`, `py-spy` ou `scalene`; use `pytest-benchmark` para impedir regressões em funções críticas.
- Django: use `select_related`/`prefetch_related`, cache de template/dados com critério e evite queries dentro de loops.
- FastAPI: use modelos de resposta enxutos, endpoints async apenas quando o I/O for async e limite tamanho/concorrência.

### .NET / ASP.NET Core

- Use `async`/`await` de ponta a ponta em I/O; não use `.Result`/`.Wait()` em código de request.
- Use `IHttpClientFactory`, connection pooling, `ArrayPool<T>`/`MemoryPool<T>` somente após medir alocações e pressão do GC.
- Configure output/response caching, compressão e paginação; evite serializar entidades inteiras quando DTOs menores bastam.
- Use `dotnet-counters`, `dotnet-trace`, PerfView ou Application Insights para CPU, GC, alocações e latência.
- Evite alocar closures/objetos em hot paths sem necessidade; não troque clareza por micro-otimização prematura.

### Java / Spring

- Use JFR, async-profiler e métricas Micrometer/Actuator para localizar CPU, GC, locks e latência.
- Configure pools (HikariCP, threads, HTTP clients) com base em carga medida; não aumente threads como resposta automática à lentidão.
- Use paginação e projeções DTO/JPA para evitar carregar entidades e relações desnecessárias.
- Controle o custo do contexto Spring: lazy initialization pode melhorar startup, mas deve ser avaliada contra a latência da primeira requisição.
- Ajuste GC/heap somente após observar alocação, pausas e pressão de memória em ambiente representativo.

### Go

- Use `pprof`, benchmarks da stdlib, tracing e métricas para CPU, heap, goroutines e bloqueios.
- Reutilize buffers/conexões com cuidado; `sync.Pool` é para objetos temporários de alta frequência, não para esconder vazamentos.
- Propague `context.Context` com deadline/cancelamento e não crie goroutines sem estratégia de encerramento.
- Use streaming e backpressure; limite goroutines e tamanho de filas para evitar explosão sob carga.

---

## Banco de dados

### Princípios relacionais (PostgreSQL, MySQL, SQL Server)

- Analise queries reais com `EXPLAIN`/`EXPLAIN ANALYZE` (ou equivalente) e use dados representativos; nunca crie índice apenas por intuição.
- Mantenha estatísticas atualizadas (`ANALYZE`, auto-analyze/atualização equivalente) para que o otimizador escolha planos realistas.
- Crie índices alinhados às queries reais (`WHERE`, `JOIN`, `ORDER BY`), considerando seletividade e ordem das colunas em índices compostos.
- Não indexe tudo: índices aceleram leitura, mas aumentam custo de `INSERT`/`UPDATE`/`DELETE`, espaço e manutenção.
- Evite `SELECT *`; selecione apenas colunas necessárias e considere covering/index-only scans quando comprovado.
- Evite funções/casts na coluna filtrada quando impedirem o uso do índice; prefira consultas sargable.
- Use transações curtas, mantenha uma ordem consistente de aquisição de locks e investigue lock contention/deadlocks.
- Faça batch de operações independentes; evite milhares de round trips individuais (N+1 no banco).
- Use pool de conexões dimensionado pela capacidade do banco e do workload; mais conexões não significa mais throughput.
- Paginação por cursor/keyset para tabelas grandes; `OFFSET` alto força o banco a percorrer e descartar muitas linhas.
- Particione tabelas apenas quando volume, retenção ou padrão de consulta justificar; partição adiciona complexidade operacional.
- Faça vacuum/maintenance, estatísticas, backups e testes de restore conforme o banco; monitore crescimento, bloat e espaço.
- Para mudanças de schema grandes, use migrações compatíveis com leitura/escrita durante deploy (expand/contract) e evite lock prolongado.

### PostgreSQL

- Use `EXPLAIN (ANALYZE, BUFFERS)` em ambiente seguro para comparar plano estimado e execução real; lembre-se de que `ANALYZE` executa a operação.
- Monitore `pg_stat_statements`, cache hit ratio, locks, I/O, vacuum e queries lentas.
- Prefira índices parciais/compostos quando correspondem ao workload real; confirme uso antes de mantê-los.
- Use JSONB, full-text search, materialized views e particionamento somente quando o padrão de acesso justificar, não como substituto de modelagem adequada.

### MySQL / MariaDB

- Use `EXPLAIN`/`EXPLAIN ANALYZE`, Performance Schema e slow query log.
- Verifique engine, índices compostos, cardinalidade, `JOIN` e conversões implícitas de tipo.
- Configure pool e transações com atenção ao isolamento e locks do InnoDB; evite manter transação aberta durante chamadas externas.

### SQL Server

- Use Actual Execution Plan, Query Store, DMVs e Extended Events para identificar regressões, waits e queries caras.
- Avalie índices ausentes/sobrepostos, parameter sniffing, estatísticas e planos regressivos antes de alterar o schema.
- Use paginação e projeções; não resolva query lenta aumentando `MAXDOP` ou memória sem medir o workload completo.

### NoSQL, cache e busca

- **Redis**: defina TTL, limite tamanho de valores, evite comandos O(N) em requests críticos, monitore memória/eviction e use pipelining quando várias operações forem independentes.
- **MongoDB**: modele pelo padrão de acesso, crie índices com base em `explain()`, limite documentos e evite arrays sem limite; use projeção e paginação.
- **Elasticsearch/OpenSearch**: limite campos retornados, use filtros estruturados em vez de query textual quando possível, paginação search-after para grandes conjuntos e monitore shards/heap.
- Cache é aceleração, não banco primário: defina comportamento quando estiver frio, indisponível ou inconsistente.

---

## Mobile — iOS e Android

### Regras comuns

- Meça em dispositivos reais modestos e recentes, em build Release, com rede lenta/instável e bateria não ideal.
- Defina metas de cold/warm start, tempo até primeira tela interativa, fluidez de scroll/transições, memória, consumo de energia e tamanho do app.
- Não faça trabalho pesado no startup: inicialize apenas o necessário para mostrar a primeira tela e adie o restante até depois do primeiro frame/interação.
- Evite bloquear a UI thread/main thread; mova I/O, parsing, banco e cálculos para background e atualize a UI de forma segura.
- Carregue listas e imagens sob demanda, use paginação, cache limitado, prefetch controlado e placeholders com dimensões estáveis.
- Reduza trabalho de rede: payloads compactos, compressão, cache HTTP, requests agrupados e cancelamento de requests quando a tela deixar de existir.
- Monitore crash-free rate, ANR/hangs, jank, startup, consumo de memória/bateria e latência de API em produção.
- Nunca use profiling/logs verbosos permanentes em Release; a instrumentação deve preservar privacidade e seguir [`sec-code-pt.md`](./sec-code-pt.md).

### iOS (Swift / SwiftUI / UIKit)

- Use **Instruments** (Time Profiler, Allocations, Leaks, Energy Log, Network) e métricas de produção do Xcode/MetricKit.
- Use `async/await`, URLSession e operações em background; nunca bloqueie a main thread com I/O ou processamento.
- SwiftUI: mantenha `body` barato, controle identidade de views, evite estado global que cause recomputação ampla e use `LazyVStack`/`LazyHStack` para listas grandes.
- UIKit: reutilize células (`UICollectionView`/`UITableView`), pré-calcule layout quando necessário e evite trabalho pesado em `cellForItem`/main thread.
- Reduza custo de imagens: use dimensões adequadas, downsampling antes de exibir, cache com limite de memória e formatos eficientes.
- Use BackgroundTasks para trabalho adiável e respeite limites de execução/energia do sistema.
- Controle Auto Layout: evite hierarquias desnecessariamente profundas e loops de layout; meça com Instruments antes de reestruturar.
- Use `os_signpost`/signposts para medir fases críticas sem deixar prints permanentes no app.

### Android (Kotlin / Jetpack Compose / Views)

- Use Android Studio Profiler, **Macrobenchmark**, **Microbenchmark**, JankStats, Perfetto e Baseline Profiles.
- Use Baseline Profiles e Startup Profiles quando aplicável; valide ganho em dispositivos representativos.
- Adie inicialização de SDKs não essenciais; use App Startup/on-demand initialization em vez de inicializar tudo no primeiro frame.
- Kotlin: coroutines/Dispatchers adequados, cancelamento vinculado ao lifecycle e nenhum I/O bloqueante na Main dispatcher.
- Jetpack Compose: minimize recompositions, mantenha estado no nível correto, use `remember` com critério, `LazyColumn` para listas e evite trabalho pesado dentro de composables.
- Views: reutilize `RecyclerView`/ViewHolder, evite hierarquias profundas e use `ConstraintLayout`/layout simples com medição real.
- Use WorkManager para trabalho garantido/adiável; respeite Doze, limites de background e consumo de bateria.
- Reduza APK/AAB com R8/resource shrinking, use WebP/vector quando adequado e carregue imagens com Coil/Glide de forma dimensionada.
- Acompanhe startup, jank, ANR, memória, bateria e crashes via Android Vitals/Play Console.

### React Native e Flutter

- **React Native**: reduza bridge traffic, evite renders de listas inteiras, use `FlatList`/`FlashList` com virtualização e mova animações para a UI thread (Reanimated). Para profiling de renders e commits, use React Native DevTools; para camadas nativas, use Android Studio e Xcode. Mantenha Flipper apenas para integração manual/legada em versões antigas, não como ferramenta padrão atual.
- **Flutter**: use DevTools (CPU/Memory/Performance), mantenha frames dentro do orçamento, prefira `const` widgets, `ListView.builder`, imagens dimensionadas e evite rebuilds amplos; use isolates para CPU-bound.
- Em ambos, meça o custo da camada cross-platform e use código nativo somente para hot paths comprovados.

---

## Desktop — Windows e macOS

### Regras comuns

- Meça cold start, warm start, tempo até primeira janela interativa, latência das ações principais, CPU, memória, I/O, rede e consumo em background.
- Teste em hardware modesto, alto DPI/Retina, múltiplos monitores, janela redimensionada, disco lento e conexão offline/intermitente.
- Não bloqueie a thread de UI: use async/await, workers e filas para operações longas; mantenha a janela responsiva durante I/O.
- Carregue módulos, telas e dados sob demanda; adie inicializadores não críticos até a primeira janela estar interativa.
- Libere recursos ao minimizar/ir para background quando possível: timers, streams, polling, imagens e conexões não necessárias.
- Controle memória: observe vazamentos, referências de eventos, caches sem limite, documentos grandes e múltiplas janelas.
- Teste instalador, atualização, primeira execução, execução após update e desinstalação; performance de startup inclui o caminho real do usuário.

### Windows (WinUI 3, WPF, .NET, Win32)

- Use Windows Performance Analyzer/Recorder, Visual Studio Profiler, `dotnet-counters`, `dotnet-trace` e ETW conforme a stack.
- Meça Release em hardware representativo, tanto cold quanto warm startup, até a primeira frame realmente interativa.
- Adie carregamento de assemblies, serviços, dados e páginas não críticos; faça trabalho longo de forma assíncrona.
- WinUI/WPF: evite árvores visuais profundas, renders desnecessários e listas sem virtualização; use virtualization em `ListView`/`ItemsControl` quando possível.
- Reduza alocações e pressão de GC em caminhos quentes; só use pooling/structs/otimizações de baixo nível após profiling.
- Teste DPI scaling (100%, 125%, 150%, 200%), múltiplos monitores e redimensionamento para detectar layout caro ou quebrado.
- Use MSIX/packaging enxuto, remova assets/arquivos não usados e não inicialize serviços de atualização/telemetria antes da primeira interação.

### macOS (AppKit, SwiftUI, Catalyst)

- Use Instruments (Time Profiler, Allocations, Leaks, Energy Log, Network) e `os_signpost` para medir operações e startup.
- Respeite a main thread; use Swift concurrency/DispatchQueue para I/O e operações longas sem bloquear AppKit/SwiftUI.
- SwiftUI: reduza recomputações e hierarquias complexas, use lazy containers para listas e evite estado que invalide janelas inteiras.
- AppKit: reutilize views/células, virtualize tabelas/coleções, limite redraws e evite layouts que recalculam toda a janela.
- Use NSCache/URLCache ou cache próprio com limites de memória e política de descarte; nunca mantenha documentos/imagens ilimitados em memória.
- Suporte corretamente Apple Silicon e Intel quando necessário; valide o custo de tradução/arquitetura e distribua binários apropriados.
- Use BackgroundTasks/serviços adequados e reduza trabalho quando o app estiver em segundo plano para preservar energia.

### Electron / Tauri

- **Electron**: mantenha renderer leve, desative janelas ocultas desnecessárias, evite `nodeIntegration` por segurança, use preload/context isolation e não faça trabalho CPU-bound no renderer; considere Worker Threads/processos.
- **Tauri**: mantenha o WebView enxuto, evite serializar payloads grandes entre frontend e Rust, mova processamento para comandos Rust quando medir ganho e limite chamadas repetidas entre as camadas.
- Em ambos, meça startup do processo principal + renderer/WebView, tamanho do instalador, memória por janela e custo de múltiplas janelas.

---

## APIs, rede e arquitetura distribuída

- Defina SLOs de latência, disponibilidade e throughput por endpoint; monitore p50/p95/p99 separadamente.
- Reduza round trips: agrupe requests independentes, use HTTP/2 multiplexing, GraphQL/BFF com cuidado e endpoints que retornem exatamente o necessário.
- Use cache em camadas (browser/CDN/API/data) com TTL e invalidação; documente consistência eventual e comportamento de cache frio.
- Use compressão para payloads grandes, mas meça CPU versus bandwidth; não comprima respostas pequenas.
- Use connection pooling e keep-alive; configure DNS, TLS handshake, timeout e retry com backoff e jitter.
- Nunca faça retry cego: retries multiplicam carga. Use orçamento de retry, idempotency keys e circuit breaker.
- Use filas para desacoplar tarefas longas, com backpressure, limite de concorrência e dead-letter queue.
- Prefira streaming/paginação a respostas gigantes; limite tamanho de headers, corpo e resposta.
- Use CDN/edge para assets e conteúdo adequado; não coloque dados personalizados/sensíveis em cache compartilhado sem controle.

---

## Infraestrutura, containers e cloud

- Use autoscaling com base em métricas corretas (latência, fila, CPU, memória, requests), não somente CPU.
- Defina requests/limits de CPU e memória em containers; observe throttling, OOM kills e eviction.
- Use imagens pequenas e builds multi-stage; remova ferramentas e dependências de runtime não utilizadas.
- Configure health checks que testem dependências essenciais sem gerar cascata de tráfego; diferencie liveness de readiness.
- Prefira recursos próximos dos usuários e bancos na mesma região/rede quando a latência for relevante.
- Use CDN, object storage e cache para conteúdo estático; não sirva assets pesados por instâncias de aplicação.
- Monitore custo e performance juntos: instância maior nem sempre é a melhor solução; compare custo por request/ação concluída.
- Faça testes de carga em staging representativo e canary/gradual rollout em produção.
- Não aumente limites de timeout, memória ou threads para esconder vazamento, query lenta ou fila sem capacidade; investigue a causa.

---

## Performance e segurança

- Cachear dados autenticados exige isolamento por usuário/tenant; nunca permitir que cache compartilhado entregue resposta de outro usuário.
- Não remover validação, autorização, criptografia, rate limiting ou auditoria apenas para reduzir latência.
- Limite payloads e complexidade de requests para prevenir consumo descontrolado de CPU/memória (DoS de aplicação).
- Não logue payloads completos, tokens ou PII ao criar instrumentação de performance; consulte [`sec-code-pt.md`](./sec-code-pt.md).
- Faça profiling com dados anonimizados ou sintéticos quando os dados reais contiverem informação sensível.

---

## Template de instruções para incluir em CLAUDE.md / AGENTS.md

```
## Performance

- Meça antes de otimizar: reproduza o problema, registre baseline, faça
  profiling, identifique o gargalo e só então altere o código.
- Registre p50/p95/p99, não apenas médias. Valide em build Release e em
  hardware/rede representativos.
- Não bloqueie thread principal/event loop/UI com CPU, I/O, parsing ou
  serialização pesados. Use async, workers ou background jobs adequados.
- Evite N+1 queries, payloads gigantes, `SELECT *`, requests sequenciais
  desnecessários e listas sem paginação/virtualização.
- Use cache apenas com TTL, invalidação, limites de memória e métricas de
  hit/miss. Nunca trate cache como fonte única de verdade.
- Configure timeouts, cancelamento, limites de concorrência, backpressure e
  retries com backoff/jitter. Não faça retry infinito.
- Web: monitore LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1 no p75 de RUM/CrUX,
  segmentado por mobile/desktop e URL/grupo; use Lighthouse para diagnóstico,
  imagens responsivas com fallback, code splitting e CDN comprovada.
- Mobile: meça startup, jank, ANR/hangs, memória e bateria em dispositivos reais;
  adie inicialização e mantenha a UI thread livre.
- Desktop: meça cold/warm startup, primeira janela interativa, CPU/memória e
  responsiveness em hardware modesto, DPI/Retina e múltiplos monitores.
- Banco: use EXPLAIN/EXPLAIN ANALYZE, estatísticas atualizadas, índices baseados
  em queries reais e pool de conexões dimensionado por medição.
- Performance não justifica remover controles de segurança. Não desabilite
  TLS, autorização, validação ou rate limiting para ganhar velocidade.
- Depois de otimizar, rode os testes de [`test-code-pt.md`](./test-code-pt.md), compare com a baseline,
  verifique regressões e remova instrumentação temporária.
```

---

## Checklist de revisão de performance

### Medição e diagnóstico

- [ ] Existe uma baseline reproduzível antes da alteração.
- [ ] O gargalo foi confirmado por profiler/telemetria, não por suposição.
- [ ] p50/p75/p95/p99, CPU, memória, I/O e rede foram avaliados quando aplicável.
- [ ] A mudança foi isolada e comparada com o mesmo cenário anterior.

### Web e APIs

- [ ] LCP, INP e CLS foram avaliados no p75 de RUM/CrUX, por mobile/desktop e URL/grupo; Lighthouse foi usado apenas para diagnóstico.
- [ ] TTFB está dentro do orçamento definido.
- [ ] Assets têm compressão, dimensões, cache e carregamento adequados; AVIF/WebP têm fallback em JPEG/PNG ou negociação de CDN comprovada.
- [ ] Bundle foi analisado; código e dependências não usados foram removidos.
- [ ] Endpoints têm paginação, timeout, limites de payload e observabilidade.
- [ ] Não existem N+1 queries, waterfalls evitáveis ou respostas excessivamente grandes.

### Mobile e desktop

- [ ] Startup e primeira interação foram medidos em build Release.
- [ ] UI/main thread/event loop permanece responsivo durante I/O e cálculos.
- [ ] Memória, bateria/energia, jank e recursos em background foram avaliados.
- [ ] Testes cobrem dispositivo/hardware modesto, telas diferentes e rede ruim.

### Banco e infraestrutura

- [ ] Queries críticas foram analisadas com plano de execução e dados representativos.
- [ ] Índices, pools, cache e limites foram dimensionados por medição.
- [ ] Load test, canary ou rollout gradual foi planejado para mudanças de risco.
- [ ] Não há OOM, throttling, lock contention, filas sem limite ou retries infinitos.

### Segurança e qualidade

- [ ] A otimização não removeu controles de segurança ou privacidade.
- [ ] Logs e traces não expõem secrets, tokens ou PII.
- [ ] Testes funcionais e de performance rodam no CI conforme [`test-code-pt.md`](./test-code-pt.md).
- [ ] O resultado e os trade-offs estão documentados.

---

## Fontes e referências

- web.dev — Core Web Vitals, p75 e segmentação por dispositivo: https://web.dev/articles/vitals
- web.dev — Medição de campo, RUM e CrUX: https://web.dev/articles/vitals-field-measurement-best-practices
- web.dev — Performance de imagens e fallback com `<picture>`: https://web.dev/learn/performance/image-performance
- React Native — React Native DevTools e ferramentas nativas: https://reactnative.dev/docs/react-native-devtools
- Android Developers — App performance guide: https://developer.android.com/topic/performance/overview
- Apple Developer — Performance e Instruments: https://developer.apple.com/documentation/xcode/improving-your-app-s-performance/
- Microsoft Learn — Windows app performance: https://learn.microsoft.com/windows/apps/develop/performance/
- PostgreSQL — Performance tips e EXPLAIN: https://www.postgresql.org/docs/current/performance-tips.html
- OpenTelemetry: https://opentelemetry.io/docs/
- k6: https://grafana.com/docs/k6/latest/
