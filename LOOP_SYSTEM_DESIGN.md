# Arquitetura do Loop Universal de Projeto

Status: implementado e validado em `2026-08-08`.

## Objetivo

Transformar esta coleção em um kit portátil de instruções para projetos futuros. Depois de copiar o kit para um repositório, qualquer pedido recebido por um agente compatível deve entrar em um ciclo de descoberta, seleção de guias, execução, verificação e correção.

O sistema deve aproveitar todos os guias que forem úteis para a tarefa sem carregar documentos irrelevantes, duplicar PT-BR e inglês no mesmo contexto ou substituir instruções específicas do projeto por defaults genéricos.

## Decisões principais

- O pacote será universal para Codex, Claude Code, Cursor e GitHub Copilot.
- A implementação inicial será baseada em Markdown e nos mecanismos nativos de instrução de cada agente; não exigirá CLI, runtime ou dependência.
- O português será o idioma operacional padrão. O perfil do projeto ou o pedido do usuário poderá selecionar inglês.
- Somente uma variante linguística de cada guia será carregada durante uma tarefa.
- O agente deverá usar todos os guias aplicáveis, não todos os arquivos indiscriminadamente.
- O perfil persistente armazenará somente fatos verificáveis do projeto e nunca secrets, tokens ou credenciais.
- O loop continuará enquanto houver progresso seguro. Repetições sem nova evidência provocarão reavaliação da hipótese ou declaração de bloqueio, não tentativas infinitas.

## Alternativas consideradas

### Arquivo único

Unir loop, roteamento e conteúdo técnico em um arquivo grande facilitaria a cópia, mas aumentaria o consumo de contexto, duplicaria os guias e dificultaria manutenção e paridade. Não será adotado.

### Adaptadores com roteamento seletivo

Manter entradas pequenas para cada agente, um loop central, um roteador e os guias especializados preserva modularidade e permite selecionar somente o contexto necessário. Esta é a abordagem escolhida.

### Gerador ou CLI

Uma ferramenta poderia detectar a stack e gerar instruções automaticamente, porém acrescentaria instalação, compatibilidade e manutenção antes de existir necessidade comprovada. Poderá ser uma evolução posterior, mas não integra a primeira versão.

## Arquitetura

```text
Pedido do usuário
       |
       v
Adaptador do agente
       |
       v
LOOP_ENGINEERING.md
       |
       +--> PROJECT_PROFILE.md
       |
       +--> GUIDE_ROUTER.md
                |
                +--> PT-BR/*.md ou ENG/*.md
       |
       v
Executar -> verificar -> diagnosticar -> corrigir
       |
       v
Resultado final com evidências e limitações
```

## Componentes

### `AGENTS.md`

Entrada principal para Codex e agentes que reconhecem instruções de repositório. Deve ser curto e ordenar a leitura do loop, do perfil e do roteador antes da execução.

### `CLAUDE.md`

Adaptador para Claude Code. Deve apontar para a mesma fonte canônica e não repetir as regras do loop.

### `.github/copilot-instructions.md`

Adaptador do GitHub Copilot. Deve ativar o mesmo contrato operacional e preservar instruções específicas já existentes no projeto de destino.

### `.cursor/rules/project-loop.mdc`

Adaptador sempre aplicável do Cursor. O conteúdo será mínimo e delegará as decisões ao loop e ao roteador.

### `LOOP_ENGINEERING.md`

Fonte canônica do ciclo operacional, adaptada do protocolo fornecido pelo usuário. Deverá definir:

- descoberta e leitura de contexto;
- transformação do pedido em contrato de execução;
- planejamento proporcional ao risco;
- execução em mudanças pequenas;
- verificação específica por tipo de entrega;
- diagnóstico por evidência e correção da causa raiz;
- regressão final;
- critérios de sucesso e parada;
- tratamento de ações destrutivas e autoridade externa;
- formato conciso da entrega final.

### `GUIDE_ROUTER.md`

Mapa canônico entre sinais do pedido/projeto e os guias aplicáveis. Deve registrar para cada rota:

- gatilhos;
- guia principal;
- guias complementares;
- seções que normalmente devem ser consultadas;
- verificações esperadas;
- condições que desativam a rota.

### `PROJECT_PROFILE.md`

Contexto durável do projeto de destino. Será criado como template e preenchido na primeira descoberta, contendo:

- objetivo e tipo de produto;
- stack e plataformas confirmadas;
- comandos oficiais de desenvolvimento e qualidade;
- arquitetura e diretórios relevantes;
- serviços externos e superfícies de risco;
- plataformas e navegadores suportados;
- idioma preferido dos guias;
- restrições, decisões e itens ainda não verificados;
- fontes de cada fato relevante.

O perfil só será atualizado quando a descoberta revelar mudança real. Ele não funcionará como diário de tarefas.

No repositório-fonte, `profile-mode: template` preserva o arquivo como modelo. Ao ser copiado para um projeto com código ou manifests, o primeiro ciclo altera o modo para `project` e preenche somente os fatos confirmados.

### Guias existentes

Os 8 pares atuais continuam sendo as fontes especializadas:

- sites premium;
- código limpo;
- testes;
- segurança;
- design;
- performance;
- acessibilidade;
- games web.

Os arquivos PT-BR serão usados por padrão. As contrapartes em inglês serão selecionadas quando o projeto ou o usuário solicitar inglês.

## Roteamento inicial

| Tipo de trabalho | Guias normalmente ativados |
| --- | --- |
| Documentação | domínio relacionado e validações de documentação |
| Código geral ou correção de bug | código limpo e testes; segurança/performance conforme a superfície alterada |
| Backend, API, autenticação ou dados | código limpo, testes e segurança; performance para caminhos críticos |
| Interface web, mobile ou desktop | código limpo, testes, design e acessibilidade; segurança e performance conforme o produto |
| Site ou landing page completos | sites premium, design, acessibilidade, código limpo, testes, segurança e performance |
| Game web | games web, código limpo, testes, segurança, performance e acessibilidade; design quando houver UI ou direção visual |
| Vídeo ou motion HTML | design, acessibilidade, performance, testes e segurança; HyperFrames apenas quando solicitado ou disponível |
| Infraestrutura ou CI/CD | segurança, testes e performance quando aplicável |

O roteador deverá usar a intenção e os arquivos realmente alterados. Uma palavra isolada no repositório não será suficiente para ativar uma stack ou um guia.

## Fluxo de execução

1. Ler o adaptador do agente e as instruções mais próximas do diretório em escopo.
2. Inspecionar manifests, configuração, documentação, testes, CI e estado do Git.
3. Criar ou atualizar o perfil somente com fatos confirmados.
4. Converter o pedido em objetivo, entregáveis, restrições, riscos, verificações e condição de parada.
5. Consultar o roteador e declarar os guias selecionados e o motivo.
6. Ler somente o idioma e as seções necessários de cada guia.
7. Planejar de forma proporcional ao tamanho e ao risco da tarefa.
8. Executar a menor mudança coerente com o objetivo.
9. Rodar primeiro a verificação específica e depois a regressão proporcional.
10. Se houver falha, coletar evidência, identificar a causa raiz e repetir com uma correção direcionada.
11. Concluir apenas com evidências atuais, limitações explícitas e nenhuma mudança não relacionada.

## Precedência e conflitos

O sistema respeitará a seguinte ordem:

1. regras da plataforma e do agente hospedeiro;
2. pedido explícito mais recente do usuário;
3. instruções específicas e mais próximas do projeto/diretório;
4. requisitos legais, de segurança e de preservação de dados aplicáveis;
5. contrato do loop;
6. decisão do roteador;
7. defaults dos guias especializados.

Um guia nunca autoriza instalação, publicação, exclusão, migração ou mudança externa que o usuário não tenha colocado em escopo.

## Falhas e condições de parada

- Ferramenta ausente: usar equivalente já disponível quando a evidência for compatível; caso contrário, solicitar autorização ou registrar a verificação como não executada.
- Guia ausente ou link inválido: continuar somente com defaults seguros e declarar a limitação.
- Perfil desatualizado: verificar novamente os manifests e corrigir somente os fatos afetados.
- Instruções conflitantes: aplicar a precedência, escolher a interpretação mais conservadora e registrar a decisão material.
- Falha repetida sem evidência nova: interromper a repetição, reavaliar a hipótese e buscar outra forma de diagnóstico.
- Bloqueio externo: concluir como bloqueado ou parcialmente verificado, sem alegar sucesso.

## Validação do próprio sistema

O workflow documental deverá verificar:

- existência de todos os arquivos referenciados pelos adaptadores;
- links relativos contidos no repositório;
- presença dos 8 pares no roteador;
- ausência de referências simultâneas a PT-BR e inglês em uma mesma rota operacional;
- consistência dos nomes e contrapartes dos guias;
- Markdown e frontmatter válidos;
- ausência de secrets e placeholders acidentais nos templates.

Também serão exercitados cenários de roteamento:

1. landing page premium;
2. API com autenticação;
3. correção de bug sem interface;
4. app mobile com UI;
5. game web multiplayer;
6. alteração apenas documental.

## Distribuição

A primeira versão não terá instalador. O usuário poderá baixar o repositório ou um arquivo de release e copiar os adaptadores, o loop, o roteador, o perfil e as pastas de guias preservando a estrutura relativa.

O README deverá explicar:

- quais arquivos copiar;
- como escolher o idioma;
- como preencher o perfil;
- como confirmar que o agente carregou o loop;
- como atualizar o kit sem sobrescrever decisões específicas do projeto.

Um instalador poderá ser criado futuramente se a cópia manual demonstrar atrito real.

## Fora do escopo inicial

- serviço remoto ou banco de dados de prompts;
- telemetria de tarefas;
- execução infinita ou autônoma fora dos limites do agente;
- instalação automática de ferramentas;
- modificação automática de arquivos globais do computador;
- duplicação integral dos guias dentro dos adaptadores;
- criação de logs versionados para cada pedido.

## Critérios de aceitação

- Um novo projeto consegue ativar o loop somente copiando os arquivos documentados.
- Codex, Claude Code, Cursor e Copilot possuem entradas finas para a mesma fonte canônica.
- O roteador seleciona todos os guias relevantes e exclui os irrelevantes nos seis cenários definidos.
- Somente um idioma de cada guia é usado por execução.
- O perfil contém fatos verificáveis, fontes e comandos reais, sem secrets.
- O loop exige evidência antes de afirmar conclusão e possui saída segura para bloqueios.
- As validações documentais e estruturais passam no CI.
- O pacote não altera comandos, dependências ou comportamento do projeto de destino sem necessidade e autorização aplicável.
