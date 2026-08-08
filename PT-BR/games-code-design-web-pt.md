---
name: games-code-design-web-pt
language: pt-BR
counterpart: ../ENG/games-code-design-web-eng.md
description: "Arquitetura, design, testes e operação de games web 2D, 3D e procedurais."
version: "2026.08"
last-reviewed: "2026-08-08"
---

# Guia de Desenvolvimento e Design de Games Web 2D e 3D

> Instruções práticas para projetar, implementar, testar, otimizar e publicar games executados no navegador, em 2D e 3D, com suporte a desktop, mobile e diferentes capacidades de hardware. Use este documento para orientar agentes de IA e desenvolvedores. Escolha a tecnologia pelo tipo de jogo e pelas restrições de distribuição; não empilhe engines e abstrações sem necessidade.
>
> **Documentos relacionados**: para estrutura, legibilidade, tipagem e organização do código, ver [`clean-code-pt.md`](./clean-code-pt.md). Para testes, cobertura, Playwright e CI, ver [`test-code-pt.md`](./test-code-pt.md). Para segurança de clientes web, APIs, secrets e dependências, ver [`sec-code-pt.md`](./sec-code-pt.md). Para profiling, budgets, CDN, PWA e WebAssembly, ver [`perf-code-pt.md`](./perf-code-pt.md). Para direção visual, UX, motion e design responsivo, ver [`design-code-pt.md`](./design-code-pt.md). Para implementação orientada à WCAG 2.2, tecnologia assistiva e testes manuais, ver [`acessibilidade-code-pt.md`](./acessibilidade-code-pt.md). Para trailers, devlogs e vídeos de gameplay baseados em HTML, consulte o [HyperFrames](https://hyperframes.heygen.com). Este arquivo é a referência específica para games web 2D/3D e seus sistemas de runtime.
>
> **Política de ferramentas**: identifique a stack, a etapa e os checks aplicáveis; prefira um equivalente já disponível que produza evidência compatível. Antes de instalar uma ferramenta ou alterar o ambiente, peça autorização. Se não houver equivalente seguro, registre o check necessário como bloqueado e nunca afirme que ele passou. Não instale recursos meramente opcionais.

## Princípios gerais

- **Escolha o menor runtime que resolve o jogo**: Canvas 2D para jogos 2D simples, uma engine 2D para jogos com cenas e física, e WebGL/WebGPU ou uma engine 3D quando a cena realmente exigir renderização 3D.
- **Progressive enhancement é obrigatório**: o jogo deve detectar capacidades, escolher um caminho de renderização e oferecer fallback funcional quando WebGPU, WebGL, áudio, Gamepad ou Pointer Lock não estiverem disponíveis.
- **Dados dirigem o jogo**: regras, entidades, itens, inimigos, níveis, tabelas de balanceamento e configurações devem estar em dados versionados e validados, não espalhados em condicionais dentro do código.
- **Desenvolva de forma procedural sempre que fizer sentido**: prefira geração determinística e data-driven para mundos, níveis, variações, loot, inimigos, desafios, efeitos e conteúdo de alto volume. As regras estão detalhadas na seção “Geração procedural e data-driven”.
- **Procedural não é sinônimo de aleatório**: use seeds, PRNG injetável, regras e constraints explícitas. O resultado precisa ser reproduzível para debug, replay, testes, suporte e multiplayer.
- **Separação de simulação e apresentação**: a lógica de jogo deve poder rodar sem DOM, Canvas ou engine específica; renderização, áudio, input e transporte de rede são adaptadores.
- **Servidor é autoridade no multiplayer**: o cliente pode prever e interpolar, mas não deve ser a fonte de verdade para regras competitivas, dano, inventário, pontuação ou permissões.
- **A experiência inclui acessibilidade e compatibilidade**: controles alternativos, texto, áudio configurável, pausa, redução de movimento e fallback visual são requisitos de produto, não melhorias posteriores.
- **Meça em dispositivos e navegadores reais**: FPS médio isolado não basta; acompanhe frame time, p95/p99, startup, memória, rede, bateria, temperatura, tamanho de assets e taxas de falha.

---

## Processo recomendado

1. **Defina o contrato do jogo**: gênero, câmera, 2D/3D, dispositivos, orientação, modo offline, multiplayer, orçamento de download, FPS alvo, tamanho de sessão e requisitos de acessibilidade.
2. **Escolha a stack mínima**: compare Canvas 2D, uma engine 2D, WebGL/WebGPU e engines 3D conforme a seção de tecnologias. Não comece pela ferramenta mais sofisticada.
3. **Faça um vertical slice**: implemente uma cena jogável com boot, input, loop, assets, áudio, pausa, fallback, telemetria e deploy. Meça antes de produzir conteúdo em escala.
4. **Modele os dados e seeds**: defina schemas, identificadores estáveis, versão do algoritmo, seed global e seeds derivadas por sistema/chunk.
5. **Implemente a simulação testável**: mantenha regras, física, geração e serialização independentes da renderização e do relógio real.
6. **Defina budgets**: startup, download inicial, memória, draw calls, entidades, colisões, tempo de simulação, frame time, latência e consumo de bateria.
7. **Teste em camadas**: unitário e property-based para regras; integração para engine/adaptadores; E2E para boot, controles e fluxos críticos; testes manuais em dispositivos reais.
8. **Publique progressivamente**: build de produção, assets com hash, CDN, service worker versionado, monitoramento, rollback e compatibilidade documentada.

---

## Escolha de tecnologia

### Canvas 2D

Use **HTML Canvas 2D** quando o jogo for 2D, tiver câmera e efeitos relativamente simples, e você quiser controlar diretamente o renderizador sem uma engine completa.

- Use `CanvasRenderingContext2D`, `requestAnimationFrame`, `ImageBitmap`, `OffscreenCanvas` e Web Workers quando o suporte e a arquitetura justificarem.
- Mantenha um canvas lógico fixo ou escalável e converta coordenadas de ponteiro/toque para o espaço do jogo; não misture pixels CSS com unidades de mundo.
- Use atlas/spritesheets, batching manual, `drawImage` e pré-carregamento; evite criar e destruir objetos gráficos a cada frame.
- Um DOM acessível deve complementar o canvas para menus, configurações, HUD textual importante e controles; não esconda toda a informação dentro de pixels.
- Migre para WebGL/WebGPU ou engine 2D quando partículas, iluminação, milhares de sprites, pós-processamento ou batching manual passarem a dominar o custo e a complexidade.

### WebGL e WebGPU com fallback

- **WebGL2** é o caminho de compatibilidade principal para renderização acelerada no navegador; mantenha WebGL1/Canvas 2D apenas se a audiência exigir e o jogo conseguir funcionar com a redução visual.
- **WebGPU** oferece uma API moderna e mais próxima de arquiteturas explícitas de GPU, mas não deve ser a única rota de um jogo web público sem uma estratégia de fallback testada.
- Detecte capacidades no boot: disponibilidade da API, criação do contexto/device, limites relevantes, extensões, memória estimada e orientação/viewport.
- Se WebGPU falhar, tente WebGL2; se WebGL falhar, tente Canvas 2D ou uma tela de indisponibilidade com instruções claras. Não use `try/catch` como única estratégia: registre a causa e teste cada caminho.
- Separe recursos por backend quando necessário: shaders WGSL para WebGPU, GLSL para WebGL, materiais simplificados e texturas menores no fallback.
- Trate perda de contexto (`webglcontextlost`/`webglcontextrestored`) e falhas de `GPUDevice`; libere recursos e reconstrua o estado sem corromper a progressão salva.
- Prefira recursos progressivos: o jogo deve iniciar com uma cena mínima e elevar qualidade após a detecção, em vez de bloquear o boot aguardando o caminho máximo.

### Engines e bibliotecas

- **Phaser**: escolha forte para jogos 2D completos, com cenas, input, animações, tilemaps, câmera, loaders e integração com física. Use os sistemas da engine quando eles reduzem código incidental, mas mantenha regras de domínio separadas.
- **PixiJS**: escolha para renderização 2D de alto desempenho e controle arquitetural próprio. Combine com sistemas explícitos de cena, input, física e estado; não trate PixiJS como engine de gameplay completa.
- **Three.js**: escolha modular para 3D no navegador, especialmente quando a equipe precisa controlar cenas, materiais, loaders, câmeras e integração com uma aplicação web. Use `WebGLRenderer` ou o caminho WebGPU conforme a compatibilidade, sempre com fallback.
- **Babylon.js**: escolha para um framework 3D mais integrado, com ferramentas de cena, materiais, física, animação, WebXR e suporte a diferentes backends. Controle o custo de abstrações e carregue só os módulos necessários.
- **PlayCanvas**: escolha quando editor colaborativo, pipeline visual, runtime web e publicação iterativa forem vantagens importantes. Versione os assets e exportações; não dependa de configuração manual escondida no editor.
- **Godot Web export**: escolha quando o jogo já é desenvolvido em Godot ou quando a equipe precisa da engine completa e aceita o custo do runtime web. Valide o tamanho do download, suporte a threads/SharedArrayBuffer, input, áudio, WebGL/WebGL2/WebGPU conforme a versão e comportamento em mobile antes de comprometer o projeto.
- **TypeScript + Vite**: é uma base recomendada para jogos web customizados e para integrar engines/bibliotecas. Use `vite build`, code splitting, imports dinâmicos, plugins somente quando necessários e tipos estritos.
- Não use Phaser, PixiJS, Three.js, Babylon.js, PlayCanvas e Godot juntos por padrão. Se houver mais de um runtime, documente a fronteira, o custo de bundle e o motivo técnico.

### Matriz prática de decisão

| Necessidade | Caminho inicial recomendado | Fallback/observação |
| --- | --- | --- |
| Puzzle 2D pequeno, poucas entidades | Canvas 2D + TypeScript + Vite | Canvas 2D já é o fallback |
| Jogo 2D com cenas, tilemap, física e UI | Phaser | Reduza efeitos ou ofereça modo Canvas 2D/baixa qualidade quando viável |
| Renderização 2D customizada ou app visual interativo | PixiJS + sistemas próprios | Canvas 2D para dispositivos sem aceleração |
| 3D modular com integração web | Three.js | WebGL2 e cena simplificada |
| 3D integrado com ferramentas e subsistemas | Babylon.js | WebGL2/qualidade reduzida |
| 3D/editor colaborativo e publicação web | PlayCanvas | Testar runtime e pipeline em CI |
| Projeto criado em engine multiplataforma | Godot Web export | Validar tamanho, threads, APIs e mobile cedo |
| Simulação CPU-bound ou código legado nativo | WASM com Rust/C++/Emscripten | Implementação TypeScript mais simples como fallback |

---

## Arquitetura do runtime

### Camadas recomendadas

Organize o projeto para que dependências apontem para dentro, das bordas para o domínio:

```text
src/
  app/              # boot, configuração, ciclo de vida e composição
  domain/           # regras puras, comandos, eventos, simulação e geração
  ecs/              # entidades, componentes, queries e sistemas, se aplicável
  rendering/        # Canvas 2D, WebGL/WebGPU ou adaptador da engine
  input/            # teclado, toque, mouse, gamepad, Pointer Lock
  audio/            # Web Audio, música, SFX e mixer
  physics/          # adapter da biblioteca física ou solver próprio
  assets/           # manifest, loaders, cache e validação
  net/              # WebSockets/WebRTC, protocolo, reconciliação
  accessibility/    # HUD DOM, legendas, remapeamento e preferências
  persistence/      # saves, replay, versões de schema e migrações
  telemetry/        # métricas sem dados sensíveis
  workers/          # parsing, geração, navegação e tarefas CPU-bound
```

- O **domínio** não deve importar `window`, `document`, `AudioContext`, `WebGLRenderingContext` nem classes concretas da engine.
- Use portas/adapters para relógio, PRNG, storage, transporte, renderer, áudio e input. Em testes, injete fakes determinísticos.
- Faça o estado persistente e o estado transitório serem explícitos. Não serialize caches, referências de renderização ou objetos da engine como se fossem estado do jogo.
- Use eventos de domínio para comunicação entre sistemas, mas não transforme todo método em evento assíncrono. Publique apenas mudanças significativas e documente a ordem.
- Evite singletons globais para seed, input, áudio e estado; eles tornam testes, múltiplas instâncias e replay difíceis.

### Game loop e tempo

Use um loop com simulação de passo fixo e renderização desacoplada quando a lógica exigir física, multiplayer, replay ou reprodutibilidade:

```ts
type Clock = { now(): number };

const FIXED_STEP = 1 / 60;
const maxStepsPerFrame = 5;
let accumulator = 0;
let previous = clock.now();

function frame() {
  const current = clock.now();
  const delta = Math.min((current - previous) / 1000, 0.25);
  previous = current;
  accumulator += delta;

  processInput();

  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < maxStepsPerFrame) {
    simulate(FIXED_STEP);
    accumulator -= FIXED_STEP;
    steps += 1;
  }

  if (accumulator >= FIXED_STEP) {
    telemetry.record('slow_frame', { pendingMs: accumulator * 1000, steps });
    if (session.isMultiplayer) {
      network.requestAuthoritativeResync();
      accumulator = 0; // aguarda snapshot sem acumular dívida local
    } else {
      accumulator = Math.min(accumulator, FIXED_STEP);
    }
  }

  const alpha = accumulator / FIXED_STEP;
  render(alpha);
  requestAnimationFrame(frame);
}
```

Regras:

- Use `requestAnimationFrame` para sincronizar a apresentação com o navegador; nunca use `setInterval` como render loop.
- Limite o `delta` para evitar o “spiral of death” após aba em background, suspensão do celular ou breakpoint.
- Defina `maxStepsPerFrame` explicitamente e nunca faça catch-up ilimitado. Ao atingir o teto, emita telemetria/evento de `slow_frame` com a dívida de tempo e a causa disponível; aplique uma política documentada de recuperação local (por exemplo, descartar dívida acima de uma etapa) ou solicite snapshot/ressincronização autoritativa no multiplayer. Enquanto aguarda o snapshot, limite ou zere a dívida local para manter `alpha <= 1` e deduplique a solicitação pendente. Não esconda o atraso executando passos sem limite.
- Em jogos simples sem física/rede, um delta variável pode ser aceitável; documente o trade-off e teste variações de frame rate.
- Congele ou reduza a simulação quando `document.visibilityState === 'hidden'`, mas preserve timers de servidor e reconexão conforme o contrato do jogo.
- Não use `Date.now()` ou `Math.random()` dentro da simulação determinística. Injete `Clock` e `PRNG`.
- Defina a ordem: coletar input → converter comandos → simular regras/IA/física → emitir eventos → atualizar áudio/efeitos → renderizar → coletar métricas.
- Separe atualização lógica de interpolação visual. A interpolação não pode alterar o estado autoritativo.

### ECS e design data-oriented

Use **ECS (Entity Component System)** ou um desenho data-oriented quando houver muitas entidades, sistemas independentes, necessidade de consultas eficientes ou simulação em lote. Não adote ECS só por moda em um jogo pequeno.

- Entidade é um identificador estável; componente é dado sem comportamento incidental; sistema opera sobre conjuntos de componentes.
- Prefira arrays densos, `TypedArray`, estruturas SoA (Structure of Arrays) e queries por assinatura nos hot paths. Evite milhares de objetos com métodos e closures por frame.
- Separe dados de simulação, renderização, colisão e UI. Um sprite, mesh ou body físico deve referenciar uma entidade, não ser a entidade inteira.
- Defina ownership e ciclo de vida: criação, ativação, remoção, pooling e invalidação de referências.
- Mantenha sistemas com ordem explícita: input, movimento, geração, IA, física, dano, progressão, câmera e apresentação.
- Não force tudo em ECS: menus, configuração, carregadores e fluxos de aplicação podem usar classes/módulos convencionais mais claros.

---

## Geração procedural e data-driven

> **Regra central**: desenvolva sempre de forma procedural/data-driven onde isso fizer sentido, com controle de aleatoriedade, reprodutibilidade e validação. “Procedural” significa que o sistema produz variação a partir de regras e dados; não significa esconder conteúdo ou abandonar autoria.

### Quando usar

Use procedural para:

- mapas, salas, labirintos, biomas, estradas, ondas de inimigos e desafios repetíveis;
- variação de loot, atributos, combinações de itens, nomes, recompensas e parâmetros de balanceamento;
- distribuição de vegetação, partículas, decoração, efeitos, animações secundárias e ambientação de alto volume;
- conteúdo infinito ou grande demais para ser todo armazenado manualmente;
- geração de casos de teste, fixtures, bots, benchmarks, cenários de carga e replays.

Não use procedural como substituto automático para:

- conteúdo autoral que precisa de composição, ritmo e intenção visual específicos;
- UX crítica, onboarding, menus, configurações, mensagens de erro e fluxos de compra;
- narrativa dirigida, diálogos importantes, puzzles com solução cuidadosamente ensinada ou momentos emocionais;
- requisitos de acessibilidade que dependem de uma ordem, contraste, leitura ou affordance garantidos;
- conteúdo licenciado, competitivo ou regulado que precisa ser exatamente auditável.

### Como combinar manual e procedural

- Faça um **layout manual** de macroestrutura e use procedural para preencher variações locais, decoração, inimigos e recursos.
- Use templates autorais, prefabs, salas de entrada/saída e pontos de interesse manuais como constraints do gerador.
- Reserve “beats” narrativos, checkpoints, tutoriais e rotas acessíveis em posições fixas; gere apenas o espaço entre eles.
- Permita overrides por ID: um conteúdo gerado pode ser substituído por uma definição manual sem alterar o contrato do sistema.
- Use seleção ponderada e regras de pacing para controlar dificuldade, repetição e distribuição; não dependa de chance bruta.
- Se a geração falhar, use uma versão manual validada ou um seed de fallback conhecido. Conteúdo crítico nunca pode resultar em tela vazia, soft lock ou rota inacessível.

### Seeds e PRNG injetável

- Defina um `seed` inicial explícito por sessão, mundo ou partida. Mostre-o em ferramentas de debug e permita copiá-lo para reproduzir um caso.
- Injete uma interface de PRNG no domínio, por exemplo `nextUint32()`, `nextFloat()`, `pick()` e `shuffle()`. Não chame `Math.random()` diretamente em regras de jogo.
- Use um algoritmo documentado e estável para a versão do jogo; se trocar o algoritmo, mantenha compatibilidade ou versione o resultado.
- Derive streams independentes por sistema/chunk usando uma função estável, por exemplo `deriveSeed(worldSeed, algorithmVersion, 'biome', chunkX, chunkY)`. Isso evita que adicionar uma rolagem em um sistema mude todo o mundo.
- Não compartilhe um único stream sem disciplina: geração de decoração não deve alterar o mapa ou o loot por consumir números extras.
- Salve `worldSeed`, `algorithmVersion`, versão de regras, versão de tabelas de dados e overrides necessários para restaurar a partida.
- Não use seed como segredo. Seeds de partidas competitivas devem ser combinadas com nonce/commit-reveal ou geradas no servidor quando previsibilidade permitir trapaça.

### Geração em etapas

Estruture o pipeline em fases pequenas, cada uma com entrada/saída, seed derivada e validação:

1. **Configuração**: leia schema, seed, dificuldade, tamanho, versão do algoritmo e limites de custo.
2. **Macroestrutura**: gere regiões, salas, nós, biomas, grafo de progressão ou terreno base.
3. **Conectividade**: garanta que entradas, objetivos, checkpoints e rotas necessárias estejam conectados.
4. **Constraints**: aplique regras de colisão, acessibilidade, pacing, recursos mínimos, visibilidade e limites de repetição.
5. **Conteúdo**: escolha prefabs, inimigos, itens, encontros e decoração por tabelas data-driven.
6. **Apresentação**: derive sprites, meshes, materiais, partículas e áudio sem mudar a simulação.
7. **Validação final**: rode invariantes, reachability, limites, checksum e orçamento de entidades/assets.
8. **Cache/streaming**: serialize o resultado ou a receita necessária para carregar, depurar e repetir o chunk.

Falhas devem ser explícitas: retorne `GenerationError` com seed, etapa, versão e constraint violada; tente reparo limitado e depois fallback determinístico. Nunca faça um loop infinito procurando um resultado “bonito”.

### Streaming, chunks e mundos grandes

- Divida o mundo em chunks com coordenadas inteiras estáveis, margem de segurança e regras de vizinhança.
- Gere e descarte chunks fora do raio de interesse; faça o trabalho pesado em Web Workers quando não depender do renderer.
- Use seed derivada da coordenada para que um chunk seja regenerável sem manter o mundo inteiro na memória.
- Faça streaming em anéis/prioridades: primeiro o chunk atual e a rota provável, depois vizinhos e decoração.
- Mantenha bordas determinísticas: o resultado de um chunk deve concordar com seus vizinhos; use funções de densidade, células compartilhadas ou dados de borda versionados.
- Nunca descarte alterações do jogador sem uma política: persista deltas por chunk ou defina claramente o que é regenerável e o que é permanente.
- Limite custo de geração, número de chunks ativos, entidades e memória. Cancelar uma geração antiga é obrigatório quando o jogador se afasta.

### Regras, constraints e validação

- Expresse constraints como código testável ou dados declarativos: `mustBeReachable`, `minResources`, `noOverlap`, `maxDifficulty`, `accessibleRoute`, `requiredObjective`.
- Valide propriedades, não apenas snapshots: conectividade, ausência de colisão inicial, caminho ao objetivo, distribuição de itens, faixa de dificuldade, limites de performance e serialização.
- Use solver/backtracking/reparo apenas com limites de tempo e tentativas; tenha um gerador simples de fallback.
- Registre métricas de rejeição: se 80% dos candidatos falham, ajuste as regras em vez de aumentar tentativas indefinidamente.
- Faça seeds de “golden cases” para cenários conhecidos e mantenha-os após mudanças de algoritmo.

### Versionamento e reprodutibilidade

- Versione o algoritmo, schemas, tabelas, prefabs e assets que influenciam a geração.
- Não altere silenciosamente uma tabela que afete partidas salvas; use migração, compatibilidade ou marque a versão como incompatível.
- Inclua no replay/log o seed, versão do algoritmo, sequência de inputs, tick inicial e configuração relevante.
- Para diagnóstico, registre a receita/seed e o identificador de build, sem registrar dados pessoais desnecessários.
- Se a geração não precisar ser reproduzida byte a byte entre navegadores, defina invariantes de equivalência e use operações numéricas estáveis; para multiplayer competitivo, prefira simulação autoritativa no servidor.

### Testes property-based

- Use **property-based testing** para gerar seeds, tamanhos, configurações e combinações de dados variadas.
- Propriedades mínimas: termina dentro do orçamento; não produz `NaN`/infinito; resultado é serializável; mesma entrada produz mesmo resultado; chunks são consistentes; objetivos são alcançáveis; constraints são satisfeitas; limites de entidades/recursos são respeitados.
- Guarde o caso mínimo reduzido quando uma propriedade falhar: seed, configuração, versão e sequência de comandos.
- Combine propriedades com snapshots de poucos seeds estáveis; snapshot sozinho não cobre o espaço de entrada.
- Teste também degenerados: tamanho zero/mínimo/máximo, seed `0`, seeds negativas se suportadas, mapa cheio, nenhum prefab elegível, rede interrompida e assets ausentes.

---

## Input, câmera e dispositivos

- Normalize teclado, mouse, toque, stylus e Gamepad em comandos de domínio (`move`, `aim`, `accept`, `pause`), não espalhe `keydown` pela gameplay.
- Use `KeyboardEvent.code` quando a ação depender da posição física e permita remapeamento por ação; não dependa apenas de `key` ou layout US.
- Para ponteiro/toque, use Pointer Events, `setPointerCapture`, `touch-action` adequado e conversão para coordenadas do canvas. Diferencie toque, arrasto, clique e gesto de câmera.
- **Gamepad API**: trate conexão/desconexão (`gamepadconnected`, `gamepaddisconnected`), índices instáveis, dead zones, remapeamento, vibração opcional e layouts diferentes. Mostre o dispositivo detectado e não assuma que o botão `0` tem sempre a mesma função.
- **Pointer Lock API**: use apenas após gesto explícito do usuário; trate `pointerlockchange`, `pointerlockerror`, escape, perda de foco e alternativa por arrastar/toque. Nunca prenda o ponteiro sem explicar como sair.
- Em mobile, respeite orientação, safe areas, notch, teclado virtual, zoom acidental e multitouch. Botões virtuais devem ter alvos grandes e configuração de opacidade/posição.
- Separe estado “pressionado”, “acabou de pressionar” e “acabou de soltar” por tick. Limpe teclas ao perder foco/visibilidade para não deixar ações presas.
- Câmera deve ter limites, smoothing configurável, opção de reduzir tremor e comportamento correto em resize/device pixel ratio.

---

## Física, colisão e simulação

- Escolha um solver adequado ao gênero: colisão AABB/círculo simples pode ser melhor que uma biblioteca completa em um platformer; física rígida 2D/3D exige integração, estabilidade e profiling.
- Use timestep fixo, unidades coerentes e limites de velocidade/posição. Evite depender de ordem indefinida de iteração.
- Separe corpos físicos, colliders, sensores, layers/masks e regras de gameplay. O contato físico não deve automaticamente significar dano, pickup ou interação sem uma regra explícita.
- Faça queries e broad phase antes da narrow phase; use spatial hash, quadtree, BVH ou estrutura da engine somente quando profiling mostrar necessidade.
- Não confie em colisão do cliente para decisões autoritativas. No servidor, valide movimento, alcance, cadência, área de efeito e transições permitidas.
- Teste tunneling, alta velocidade, corpos empilhados, bordas, plataformas móveis, teleporte, pausa, rollback/reconexão e escalas extremas.
- Se a física não for deterministicamente reproduzível entre plataformas, não use o estado físico bruto como protocolo de multiplayer; envie comandos/estado autoritativo ou use uma simulação comum controlada.

---

## Assets, cenas e pipeline de conteúdo

- Mantenha um manifest data-driven e versionado com ID, tipo, URL, hash, origem/proveniência, licença, atribuição, tamanho, dependências, compressão, variante de qualidade e fallback. A atribuição deve identificar o titular e o texto ou destino exigido pela licença, quando aplicável.
- Use `GLB/glTF` para modelos 3D quando adequado, spritesheets/atlases para 2D e formatos de textura/áudio compatíveis com os navegadores alvo. Comprima e valide no build.
- Faça pré-carregamento por fases: shell mínimo, assets da primeira cena, conteúdo próximo e conteúdo opcional. Mostre progresso real, não uma barra falsa.
- Use `createImageBitmap`, `ImageDecoder`, workers e parsing assíncrono quando suportados e medidos; não bloqueie a thread principal com importação de arquivos grandes.
- Para 3D, limite materiais, meshes e animações, use LOD, instancing, frustum/occlusion culling quando aplicável e comprima geometria/texturas. Para 2D, reduza trocas de textura, draw calls e resoluções fora da viewport.
- Não carregue dados arbitrários de uma URL informada pelo usuário sem validação. Prefira allowlist de origem, manifest assinado ou assets empacotados.
- Licenças e atribuições devem acompanhar o asset no manifest, e os notices gerados a partir dele devem acompanhar toda distribuição do jogo; não copie conteúdo protegido apenas porque está acessível na web.
- Assets críticos têm fallback: ícone/textura placeholder, som silencioso, fonte alternativa, mesh simplificada e UI textual. Um erro de asset não deve travar o boot inteiro.

---

## Áudio com Web Audio

- Use **Web Audio API** com `AudioContext`, `GainNode`, `AudioBufferSourceNode`, `AudioWorklet` quando processamento customizado for necessário, e bus/mixer separados para música, SFX, voz e ambience.
- Crie ou retome o `AudioContext` após gesto do usuário para respeitar políticas de autoplay; trate `suspended`, `running` e `closed`.
- Faça pré-carregamento seletivo de buffers e streaming para música/áudio longo; limite vozes simultâneas e aplique prioridade/voice stealing.
- Controle volume por categoria, mute, faixa dinâmica, pausa e preferência persistente. Não use áudio como única forma de comunicar dano, sucesso, alerta ou objetivo.
- Use `PannerNode`/posicionamento espacial com moderação e fallback estéreo/mono em dispositivos com limitações. Teste fones, alto-falantes, Bluetooth e troca de saída.
- Evite criar nodes a cada frame; reutilize ou desconecte corretamente para prevenir vazamentos. Mova DSP caro para `AudioWorklet` apenas quando o custo e a compatibilidade justificarem.
- Respeite `prefers-reduced-motion` para efeitos sincronizados e ofereça legendas/indicadores para voz e eventos relevantes.

---

## Acessibilidade e UX de game

- Ofereça remapeamento de teclado, Gamepad e controles de toque; permita sensibilidade, dead zone, inversão de eixo, hold/toggle e tamanho/opacidade dos controles.
- Inclua pausa real, reinício, checkpoints, salvar/sair, confirmação para ações destrutivas e recuperação após perda de foco ou conexão.
- Não comunique estado só por cor: use forma, ícone, texto, padrão, som configurável e/ou vibração opcional.
- Ofereça escala de texto/HUD, contraste alto, modo daltônico por regras semânticas, redução de partículas/tremor/flash, `prefers-reduced-motion` e opção de desligar efeitos rápidos.
- Evite flashes perigosos, strobing e efeitos com frequência/intensidade que possam causar desconforto. Teste a configuração de redução, não apenas sua presença.
- Use DOM semântico e ARIA para menus, inventário, configurações, diálogos e mensagens; Canvas/WebGL não substitui uma interface acessível. Mantenha foco, leitura por screen reader e navegação por teclado nos overlays.
- Forneça legendas, transcrição e indicadores visuais de direção/alerta quando áudio espacial ou fala forem importantes.
- Não dependa de hover, pointer lock ou vibração. Toda ação essencial precisa de alternativa por teclado, botão, toque ou controle configurável.
- Teste com teclado, screen reader, zoom, contraste, orientação retrato/paisagem, controles externos, baixo volume e motion reduzido.
- Use `axe-core` somente para a camada DOM semântica; Canvas/WebGL e gameplay exigem smoke manual de teclado, tecnologia assistiva, zoom e fluxo de jogo. Automação encontra apenas parte dos problemas e não prova conformidade.

---

## Multiplayer: WebSockets e WebRTC

### Transporte e modelo

- Use **WebSockets** para conexão persistente cliente-servidor, estado autoritativo, comandos, matchmaking e mensagens confiáveis/ordenadas quando o servidor é o centro da sessão.
- Use **WebRTC** (`RTCPeerConnection`, `RTCDataChannel`) para comunicação peer-to-peer ou baixa latência quando o produto puder operar com signaling, NAT traversal, TURN, reconexão e riscos de exposição de IP. Não assuma que P2P elimina a necessidade de servidor autoritativo.
- Separe signaling, autenticação, matchmaking e gameplay. WebRTC ainda precisa de signaling e frequentemente de STUN/TURN.
- Defina protocolo versionado com schema, tamanho máximo, tipos de mensagem, sequência, tick, timestamp, ack quando necessário e comportamento para mensagens desconhecidas.
- Faça backpressure: limite fila, frequência de input, payload, entidades sincronizadas e mensagens por segundo. Desconecte ou degrade clientes abusivos.

### Simulação e sincronização

- Prefira server authoritative com snapshots, comandos de input, interpolação, client prediction e reconciliation conforme o gênero.
- Use tick de servidor explícito; cliente não deve decidir dano, moeda, inventário, resultado de RNG competitivo ou validade de movimento.
- Para latência, aplique interpolação de snapshots, prediction somente onde reversão for aceitável e rollback apenas com uma estratégia testada e estado serializável.
- Procedural em multiplayer deve usar seed/algoritmo versionados e mesma receita, ou o servidor deve enviar os resultados necessários. Não deixe cada cliente gerar loot competitivo independentemente.
- Sincronize eventos e identificadores, não objetos inteiros e efeitos visuais efêmeros. Reenvie o estado necessário após reconexão e trate mensagens duplicadas/fora de ordem.
- Teste latência, jitter, perda, duplicação, reorder, desconexão no carregamento, reconexão, aba em background, clock skew, versão incompatível e servidor cheio.

### Segurança de sessão

- Autentique no servidor, valide autorização por sala/ação, expire sessões e não coloque secrets de serviço no bundle.
- Valide todos os dados do cliente: schema, limites, rate, ownership, transições e estado atual. Nunca confie em `score`, `position`, `damage`, `itemId` ou `seed` enviados pelo cliente.
- Use TLS (`wss://`/HTTPS), CORS/origin checks quando apropriado, limites de mensagem, heartbeat, timeout e proteção contra spam/flood.
- Não exponha PII, tokens permanentes ou logs de payloads sensíveis. Consulte [`sec-code-pt.md`](./sec-code-pt.md) para regras gerais de web security.

---

## WASM, Rust, C++ e Emscripten

- Use **WebAssembly** para código CPU-bound medido, simuladores, pathfinding, compressão, codecs, bibliotecas nativas existentes ou lógica compartilhada entre plataformas. Não use WASM para todo código por padrão.
- **Rust** é uma boa escolha para módulos com segurança de memória, dados compactos e API explícita via `wasm-bindgen`, `wasm-pack` ou toolchain equivalente.
- **C++ + Emscripten** é apropriado para portar engine/biblioteca existente; controle `-s MODULARIZE`, filesystem virtual, memória, exceções, threads e tamanho do runtime conforme o caso.
- Defina uma ABI pequena e versionada. Reduza cópias entre JS/WASM usando buffers lineares, `TypedArray` e lotes; chamadas frequentes atravessando a fronteira podem custar mais que a lógica.
- Faça fallback TypeScript quando o módulo não compilar, falhar ao carregar, exigir threads não disponíveis ou consumir mais que o budget de startup.
- Threads em WASM dependem de `SharedArrayBuffer` e headers de isolamento cross-origin, como `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: require-corp`; teste CDN, iframes, analytics e assets de terceiros antes de habilitar.
- Sirva `.wasm` com MIME correto, compressão Brotli/gzip adequada e cache por hash. Não faça `instantiate` de módulos grandes no caminho crítico se o jogo puder iniciar sem eles.
- Teste ABI, endianness/tipos, perda de precisão, memória, cancelamento, exceções e comportamento sem WebAssembly.

---

## Performance e compatibilidade cross-browser/mobile

### Budgets e profiling

- Defina frame time: para 60 FPS, a meta é aproximadamente `16,67ms`; distribua o budget entre simulação, física, geração, upload de GPU, render, áudio e UI. Para 30 FPS, a meta é `33,33ms`, mas não use isso como desculpa para picos.
- Acompanhe p50/p95/p99 de frame time, long tasks, FPS, startup, tempo até input, memória JS/GPU quando disponível, draw calls, triângulos, entidades, cache hit, downloads e erros de contexto.
- Profile em build de produção com Chrome DevTools Performance/Memory, Firefox Performance, Safari Web Inspector, `performance.mark()`/`performance.measure()`, WebGL/WebGPU tooling e profiler da engine.
- Use `PerformanceObserver` para long tasks e recursos; amostre telemetria, respeite privacidade e não envie replays/payloads por padrão.
- Instrumente geração por etapa, loaders, compilação de shaders, primeiro frame, primeiro input, troca de cena e reconexão.

### Estratégias

- Divida o bundle, faça lazy loading de cenas e conteúdo opcional, e remova dependências não usadas. Assets grandes devem ser carregados por proximidade/progressão.
- Reduza alocações em hot paths; reutilize arrays/buffers e faça pooling somente após medir. Não use pooling para mascarar vazamentos ou complicar ownership.
- Tire parsing, geração, pathfinding e compressão da main thread com Web Workers quando o custo de mensagens/cópias for menor que o ganho.
- Pause renderização quando o canvas estiver fora da viewport ou a aba estiver oculta, exceto quando uma conexão/telemetria precisar continuar.
- Adapte resolução interna, sombras, partículas, pós-processamento, LOD, distância de visão, número de entidades e frequência de efeitos ao dispositivo.
- Evite `devicePixelRatio` ilimitado em mobile; defina teto e permita opção de qualidade. Reserve memória para o sistema e para o navegador.
- Não compile todos os shaders no primeiro frame; pré-aqueça o caminho crítico, mostre loading e compile o restante progressivamente quando possível.
- Meça cold start e warm start, rede 3G/4G/5G/Wi-Fi, CPU baixa/média/alta, iOS Safari, Android Chrome, Firefox, Chromium desktop e Safari macOS.

### Compatibilidade e fallback

- Defina uma matriz suportada por navegador, versão, sistema, GPU, orientação, input e modo offline; use feature detection, não apenas user-agent.
- Teste pelo menos Chromium/Chrome/Edge, Firefox e Safari em desktop e mobile real ou BrowserStack/Sauce Labs. Inclua WebView relevante se a distribuição usar wrapper.
- Valide `Canvas 2D`, WebGL2, WebGPU, Web Audio, Gamepad, Pointer Lock, Web Workers, IndexedDB, service worker, fullscreen e APIs de orientação individualmente.
- Considere limites de autoplay, suspensão de contexto, perda de foco, memory pressure, thermal throttling, modo economia de energia, tela de alta densidade, viewport dinâmico e gestos do navegador.
- Tenha telas de diagnóstico: navegador, backend gráfico escolhido, versão do jogo, qualidade, seed/replay ID quando apropriado e instruções de atualização. Não exponha informações sensíveis.

---

## PWA, cache e deploy/CDN

- Use **PWA** quando instalação, offline, ícone, launch experience ou retorno frequente trouxerem valor real; não adicione service worker apenas por checklist.
- Defina `manifest.webmanifest` com nome, ícones, `start_url`, `display`, orientação e cores coerentes. Valide instalação e atualização em Android, desktop e Safari conforme o suporte necessário.
- Faça precache apenas do shell mínimo. Use estratégias separadas para código versionado, assets imutáveis, dados de sessão, saves e conteúdo online; nunca cacheie tokens ou dados sensíveis indiscriminadamente.
- Versione o service worker e mostre atualização pendente de forma segura. Não substitua o jogo durante uma partida sem preservar o save/estado; ofereça reload em momento seguro.
- Use CDN para JS, WASM, texturas, áudio, modelos e manifests. Sirva assets com nomes hashados, `Cache-Control: public, max-age=31536000, immutable` quando imutáveis e headers corretos para `.wasm` e fontes.
- Configure HTTPS, HTTP/2 ou HTTP/3, Brotli/gzip, `Content-Type`, `Cross-Origin-Resource-Policy` e CORS conforme a arquitetura. Evite bloquear assets do jogo por headers incompatíveis.
- Use deploy atômico: manifest aponta para uma versão consistente de assets; não publique HTML novo que referencia hashes ainda ausentes na CDN.
- Tenha rollback, purge seletivo, health check, smoke test pós-deploy, source maps protegidos, monitoramento de erro e alerta para falha de boot, asset 404, contexto gráfico, áudio, instalação e reconexão.
- Saves locais devem usar IndexedDB ou mecanismo adequado, com schema versionado, migração, limite de espaço, export/import opcional e fallback quando storage estiver indisponível. Não confie em `localStorage` para dados grandes ou críticos.

---

## Segurança

- Trate o cliente como não confiável. O bundle, código WASM, seed local, regras visuais e chamadas de rede podem ser inspecionados e alterados.
- Nunca coloque API keys privadas, secrets de matchmaking, credenciais de banco ou assinatura de conteúdo sensível no frontend.
- Faça validação de input, output encoding, CSP, SRI quando aplicável, dependências fixadas/auditadas, CORS mínimo, cookies seguros e proteção contra XSS/CSRF conforme [`sec-code-pt.md`](./sec-code-pt.md).
- Em jogos competitivos, mantenha pontuação, inventário, economia, matchmaking, cooldown, dano e RNG relevante no servidor; anti-cheat no cliente é apenas sinal, não autoridade.
- Valide pacotes, manifests, saves importados, mods e arquivos de usuário por schema, tamanho, profundidade, tipos e limites de tempo. Não deserialize objetos executáveis.
- Evite logs com tokens, identificadores pessoais, conteúdo de chat ou localização precisa. Defina retenção e consentimento para telemetria.
- Use rate limiting, quotas, heartbeat, timeouts, backpressure e limites de salas/conexões para reduzir abuso e negação de serviço.
- Atualize engines, loaders, parsers e bibliotecas WASM; trate arquivos de terceiros como superfície de ataque.

---

## Testes, CI e qualidade

### Pirâmide de testes

- **Unitários**: regras de movimento, dano, progressão, serialização, PRNG, derivação de seeds, constraints, comandos e reducers. Use Vitest para TypeScript/Vite ou `node:test` quando uma dependência mínima for prioridade.
- **Property-based**: geração procedural, física em limites, invariantes de estado, comandos idempotentes, migrações, protocolos e round-trip de serialização. Use uma biblioteca compatível, como `fast-check`, quando o projeto já aceitar essa dependência.
- **Integração**: renderer adapter, loaders, Web Audio, IndexedDB, Web Workers, engine, física, WebSockets/WebRTC e WASM. Use fakes controlados e testes reais em suites específicas.
- **E2E/smoke**: boot, primeira interação, pause/resume, troca de cena, fallback de renderização, mute, remapeamento, save/load, instalação PWA e fluxo multiplayer mínimo. Use Playwright em Chromium, Firefox e WebKit quando possível.
- **Visual/regressão**: screenshots de HUD, menus, cena base e fallback em viewports fixos; controle diferenças de GPU, fontes e animações antes de comparar pixels.
- **Performance**: benchmarks de geração e simulação; budgets de bundle/assets; Lighthouse CI para a casca web; profiling em dispositivos representativos. Não trate FPS de um único computador como prova.
- **Acessibilidade**: `axe-core` na camada DOM semântica, seguido de smoke manual de teclado, tecnologia assistiva, zoom e fluxo de jogo; a automação não prova conformidade.

### Determinismo e replays

- Use clock, PRNG, input e transporte injetáveis; fixe seed e inputs em testes.
- Grave comandos/ticks, não apenas frames, para replays reproduzíveis. Versione formato, algoritmo e dados.
- Rode a mesma seed em diferentes navegadores e compare invariantes/estado serializado conforme o nível de determinismo exigido.
- Não use timers reais, sleeps ou dependência de ordem de testes. Controle `requestAnimationFrame`, `AudioContext`, rede e visibilidade com fakes.

### Pipeline de CI

Em cada push/PR, conforme o projeto:

```bash
npm ci
npm run lint
npm run format -- --check
npm run typecheck
npm run test -- --run
npm run build
```

Inclua quando aplicável:

- validação de schemas e de todos os campos do manifest — incluindo hash, origem/proveniência, licença e atribuição —, nomes/hash de assets, geração de notices e confirmação de que esses notices acompanham cada distribuição;
- testes de geração com seeds fixas e property-based com limite de tempo;
- `npm run test:e2e` com Playwright em browsers instalados;
- análise de bundle, tamanho de WASM, orçamento de assets e Lighthouse CI;
- `cargo test`/`cargo clippy` para Rust, testes C++ e build `emcc`/Emscripten quando houver módulo nativo;
- smoke test servido via HTTPS, pois service workers, `SharedArrayBuffer` e algumas APIs não funcionam corretamente em `file://`;
- artefatos de cobertura, screenshots, replay mínimo e relatório de compatibilidade sem publicar secrets.

Falhas de browser/engine não disponíveis no runner devem ser cobertas por jobs específicos, BrowserStack/Sauce Labs ou runners próprios; não desative o teste silenciosamente.

---

## Template para `CLAUDE.md` / `AGENTS.md`

Copie e adapte este bloco para o repositório do game:

```markdown
# Instruções para o game web

## Stack e escopo
- Tipo: [2D/3D], câmera [top-down/platformer/first-person/etc.], single-player/multiplayer.
- Runtime: [Canvas 2D/Phaser/PixiJS/Three.js/Babylon.js/PlayCanvas/Godot Web].
- Build: TypeScript + Vite; comandos oficiais estão em `package.json`.
- Backends gráficos: [WebGPU -> WebGL2 -> Canvas 2D/tela de compatibilidade], conforme detecção em runtime.
- Navegadores/dispositivos suportados: [preencher matriz].

## Regras de arquitetura
- Mantenha domínio/simulação independente de DOM, Canvas, engine, áudio e rede.
- Use game loop com [passo fixo/contrato documentado], clock injetável, limites de delta e `maxStepsPerFrame`; ao atingir o teto, registre `slow_frame` e aplique recovery local ou ressincronização autoritativa, sem catch-up ilimitado.
- Use ECS/data-oriented apenas onde o volume de entidades e o profiling justificarem.
- Input vira comandos de domínio; não espalhe listeners pela gameplay.
- O servidor é autoridade para [pontuação/dano/inventário/loot/movimento], quando multiplayer.

## Procedural e data-driven — obrigatório quando fizer sentido
- Não use `Math.random()` dentro da simulação. Injete PRNG e documente o algoritmo.
- Toda geração recebe `seed`, `algorithmVersion`, versão de dados e configuração.
- Derive streams independentes por sistema/chunk; não deixe uma rolagem incidental mudar o mundo inteiro.
- Gere em etapas: macroestrutura, conectividade, constraints, conteúdo, apresentação e validação.
- Use chunks/streaming para mundos grandes, com bordas determinísticas, cancelamento e persistência de deltas.
- Valide reachability, colisão, dificuldade, acessibilidade, limites de custo e serialização.
- Use property-based tests, seeds de regressão e casos reduzidos quando uma propriedade falhar.
- Use conteúdo manual para narrativa, UX e momentos críticos; permita overrides por ID e fallback determinístico.
- Versione seeds, algoritmos, schemas, tabelas e prefabs. Nunca mude resultados de saves silenciosamente.

## Assets, áudio e acessibilidade
- Assets vêm de manifest validado, com hash, origem/proveniência, licença, atribuição, tamanho, dependências e fallback; CI valida todos os campos e notices acompanham a distribuição.
- Web Audio deve respeitar gesto do usuário, mute, mixer, limites de vozes e alternativa visual/legendas.
- Suporte remapeamento, teclado/Gamepad/toque, pause, contraste, tamanho de HUD, redução de movimento/flash e DOM acessível para UI. Use `axe-core` apenas no DOM e complete com smoke manual de teclado, tecnologia assistiva, zoom e fluxo de jogo; automação não prova conformidade.
- Pointer Lock e fullscreen só após ação explícita e sempre com alternativa e saída clara.

## Qualidade e comandos
- Antes de concluir uma mudança, rode: `npm run lint`, `npm run typecheck`, `npm run test -- --run` e `npm run build`.
- Para mudanças visuais, rode smoke/E2E e compare screenshots em viewports definidos.
- Para geração/estado, adicione ou atualize testes determinísticos e property-based.
- Para performance, registre baseline, cenário, métrica e resultado; não faça otimização especulativa.
- Não adicione dependência, engine ou API externa sem justificar bundle, compatibilidade, licença e fallback.

## Segurança
- Nunca coloque secrets no cliente.
- Valide no servidor comandos, payloads, saves, economia, permissões e rate limits.
- Não registre tokens, PII ou payloads sensíveis; consulte [`sec-code-pt.md`](./sec-code-pt.md).
```

---

## Checklist de revisão antes de publicar

### Arquitetura e stack

- [ ] A stack é a menor que resolve o jogo e cada engine/biblioteca tem uma justificativa registrada.
- [ ] O domínio/simulação pode ser testado sem DOM, renderer, áudio ou rede.
- [ ] O loop, timestep, ordem dos sistemas, pausa e comportamento em background estão definidos.
- [ ] `maxStepsPerFrame`, telemetria de `slow_frame` e a política de recovery/ressincronização ao atingir o teto estão definidos; não há catch-up ilimitado.
- [ ] A matriz de navegadores, dispositivos, APIs e fallback está documentada.

### Procedural/data-driven

- [ ] Geração procedural foi usada onde há variação/volume; conteúdo autoral, UX crítica e narrativa dirigida têm composição manual ou overrides.
- [ ] Seed, PRNG injetável, algoritmo e streams derivados são determinísticos e reproduzíveis.
- [ ] A geração está dividida em etapas com regras, constraints, limites e erros explícitos.
- [ ] Chunks têm fronteiras consistentes, streaming cancelável e política de persistência de alterações.
- [ ] Resultado passa por validação de conectividade, acessibilidade, dificuldade, colisão, orçamento e serialização.
- [ ] Seeds, algoritmos, schemas, dados, prefabs e replays têm versionamento/migração.
- [ ] Há property-based tests, seeds de regressão e fallback determinístico para conteúdo crítico.

### Runtime e UX

- [ ] WebGPU falha para WebGL2 e depois Canvas 2D/tela de compatibilidade de forma controlada.
- [ ] Perda de contexto gráfico, falha de asset, falha de áudio e ausência de API não travam o jogo inteiro.
- [ ] Teclado, mouse, toque, Gamepad e Pointer Lock têm normalização, remapeamento e fallback quando aplicável.
- [ ] Há pause, resume, perda de foco, orientação, safe areas e controles mobile testados.
- [ ] Web Audio respeita autoplay, tem mixer, mute, limite de vozes e alternativa visual/legendas.
- [ ] UI/HUD crítica existe em DOM acessível; `axe-core` foi aplicado somente a essa camada e smoke manual de foco, teclado, tecnologia assistiva, zoom e fluxo de jogo foi executado. A automação não foi tratada como prova de conformidade.
- [ ] `prefers-reduced-motion`, redução de flash/tremor/partículas e escala de texto funcionam.

### Multiplayer e segurança

- [ ] Transporte, protocolo, versão, tamanho máximo, timeout, heartbeat e backpressure estão definidos.
- [ ] Servidor valida comandos, transições, pontuação, dano, inventário, seeds competitivas e rate limits.
- [ ] Reconexão, jitter, perda, duplicação, reorder, rollback/reconciliation e versão incompatível foram testados.
- [ ] Não existem secrets no bundle, nem logs de tokens/PII; HTTPS/WSS, CSP, CORS e dependências foram revisados.

### Performance, testes e publicação

- [ ] Budgets de frame time, startup, bundle, assets, memória, entidades e rede foram medidos em hardware realista.
- [ ] Parsing/generation/pathfinding pesados não bloqueiam a main thread sem justificativa medida.
- [ ] Há testes unitários, integração, property-based, E2E/smoke, visual e performance na proporção adequada.
- [ ] CI roda lint, format check, typecheck, testes, build, validação de todos os campos de assets (hash, origem, licença e atribuição), geração de notices distribuídos com o jogo e smoke test.
- [ ] PWA/service worker têm precache mínimo, atualização segura, cache versionado e suporte a rollback.
- [ ] CDN usa HTTPS, hashes, headers corretos, compressão, MIME de WASM e deploy atômico.
- [ ] Saves têm schema versionado, migração, limite de espaço e fallback para storage indisponível.
- [ ] Telemetria amostrada mede boot, erros, contexto gráfico, assets, áudio, performance e conexão sem dados desnecessários.

---

## Fontes e Referências

- MDN — Canvas API: https://developer.mozilla.org/docs/Web/API/Canvas_API
- MDN — WebGL API: https://developer.mozilla.org/docs/Web/API/WebGL_API
- MDN — WebGPU API: https://developer.mozilla.org/docs/Web/API/WebGPU_API
- WebGPU specification: https://www.w3.org/TR/webgpu/
- Web Audio API specification: https://www.w3.org/TR/webaudio/
- Gamepad API: https://developer.mozilla.org/docs/Web/API/Gamepad_API
- Pointer Lock API: https://developer.mozilla.org/docs/Web/API/Pointer_Lock_API
- WebSockets API: https://developer.mozilla.org/docs/Web/API/WebSockets_API
- WebRTC API: https://developer.mozilla.org/docs/Web/API/WebRTC_API
- WebAssembly: https://webassembly.org/
- Rust and WebAssembly: https://rustwasm.github.io/docs/book/
- Emscripten Documentation: https://emscripten.org/docs/
- Phaser: https://phaser.io/
- PixiJS: https://pixijs.com/
- Three.js: https://threejs.org/
- Babylon.js: https://www.babylonjs.com/
- PlayCanvas: https://playcanvas.com/
- Godot — Exporting for the Web: https://docs.godotengine.org/en/latest/tutorials/export/exporting_for_web.html
- TypeScript: https://www.typescriptlang.org/docs/
- Vite: https://vite.dev/guide/
- Web.dev — Progressive Web Apps: https://web.dev/explore/progressive-web-apps
- web.dev — Learn Performance: https://web.dev/learn/performance
- web.dev — Ready Player Web: https://web.dev/articles/ready-player-web
- W3C Web Accessibility Initiative: https://www.w3.org/WAI/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Game Accessibility Guidelines (orientação complementar da comunidade; não é norma e não substitui a WCAG): https://gameaccessibilityguidelines.com/
- Playwright: https://playwright.dev/
- Vitest: https://vitest.dev/
- fast-check: https://fast-check.dev/
- MDN — Service Worker API: https://developer.mozilla.org/docs/Web/API/Service_Worker_API
- MDN — Web performance: https://developer.mozilla.org/docs/Web/Performance
