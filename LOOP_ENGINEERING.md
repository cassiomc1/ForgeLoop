# Loop Engineering — Protocolo Universal de Execução

> Fonte canônica do ciclo operacional deste kit. Os adaptadores dos agentes apenas apontam para este arquivo; as regras técnicas especializadas permanecem nos guias selecionados por [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md).

## Princípio central

Nunca trate o pedido como uma instrução isolada nem considere a primeira solução plausível como conclusão.

```text
RECEBER PEDIDO
      ↓
DESCOBRIR CONTEXTO
      ↓
DEFINIR CONTRATO
      ↓
SELECIONAR GUIAS
      ↓
PLANEJAR → EXECUTAR → VERIFICAR
                         ↓
              ┌──────────┴──────────┐
              │                     │
            PASSOU                FALHOU
              │                     │
     REGRESSÃO PROPORCIONAL   DIAGNOSTICAR CAUSA
              │                     │
          CONCLUIR          CORRIGIR E VERIFICAR
```

O objetivo do loop é produzir feedback real até satisfazer critérios objetivos. Ele não autoriza execução infinita, expansão de escopo ou ações externas não solicitadas.

## Contrato de execução

Antes de alterar arquivos, transforme internamente o pedido em um contrato proporcional à tarefa:

```text
OBJETIVO
Estado observável que precisa existir ao final.

CONTEXTO
Arquivos, módulos, serviços, dados, dependências e regras relevantes.

ENTREGÁVEIS
Mudanças, artefatos ou respostas esperadas.

RESTRIÇÕES
O que não pode ser quebrado, removido, publicado ou assumido.

RISCOS
Regressões, segurança, dados, compatibilidade e efeitos externos.

VERIFICAÇÃO
Checks capazes de demonstrar o resultado.

SUCESSO
Condições objetivas que devem ser verdadeiras.

PARADA
Sucesso verificado ou bloqueio externo genuíno.
```

Não interrompa o usuário para perguntar algo que possa ser descoberto com segurança no projeto. Peça decisão quando alternativas legítimas produzirem resultados materialmente diferentes, quando faltar autoridade ou quando a ação for destrutiva.

### Classifique o pedido

- **Responder, explicar ou revisar:** inspecione e entregue evidências; não faça alterações implícitas.
- **Diagnosticar:** reproduza e determine a causa; só implemente a correção quando ela estiver no escopo.
- **Criar ou alterar:** implemente, teste e documente em proporção ao risco.
- **Publicar ou operar sistemas externos:** confirme o alvo e a autorização antes da mudança.
- **Excluir ou sobrescrever:** resolva exatamente o alvo, prefira alternativa recuperável e valide o resultado.

A instrução explícita mais recente do usuário substitui pedidos anteriores incompatíveis, mas não amplia silenciosamente o escopo.

## Descoberta do projeto

Leia primeiro as instruções mais próximas do diretório em escopo. Depois procure somente o que existir e for relevante:

```text
AGENTS.md
CLAUDE.md
README.md
CONTRIBUTING.md
PROJECT_PROFILE.md
package.json
pyproject.toml
requirements.txt
Cargo.toml
go.mod
Makefile
docker-compose.yml
Dockerfile
.github/workflows/
docs/
src/
tests/
```

Descubra antes de inferir:

- produto, stack, plataformas e arquitetura;
- comandos oficiais de desenvolvimento, lint, teste, typecheck e build;
- CI, release, deploy e ambientes;
- estado do Git e alterações preexistentes;
- serviços externos, persistência e superfícies de segurança;
- navegadores, dispositivos e requisitos de acessibilidade;
- decisões específicas do projeto.

Pesquisa textual por uma tecnologia não prova que ela está ativa. Confirme por manifests, imports, configuração, execução ou documentação autoritativa.

### Perfil persistente

Use [`PROJECT_PROFILE.md`](./PROJECT_PROFILE.md) como cache de fatos duráveis:

1. verifique a fonte antes de registrar ou alterar um fato;
2. mantenha fatos desconhecidos como não verificados;
3. cite caminho, comando ou evidência;
4. nunca grave secrets ou credenciais;
5. não transforme o perfil em diário de tarefas;
6. preserve decisões explícitas até evidência mais recente substituí-las.

Se o perfil e o repositório divergirem, o estado verificável atual prevalece e o perfil deve ser corrigido no menor escopo possível.

## Seleção de guias

Leia [`GUIDE_ROUTER.md`](./GUIDE_ROUTER.md) depois da descoberta e antes do plano.

Regras obrigatórias:

- selecione todos os guias aplicáveis à intenção, às superfícies alteradas e aos riscos;
- não carregue todos os arquivos por precaução;
- use somente PT-BR ou somente English durante a mesma execução;
- use o idioma pedido pelo usuário; na ausência dele, use o perfil; sem perfil verificado, use PT-BR;
- leia primeiro títulos e seções localizadas com `rg`; carregue o documento inteiro apenas quando a tarefa realmente atravessar todo o domínio;
- anuncie brevemente os guias selecionados e o motivo;
- trate referências opcionais como opções, nunca como instalação automática.

Um guia fornece defaults especializados. Ele não substitui requisitos explícitos do produto, instruções mais próximas, evidência do código ou regras superiores do agente hospedeiro.

## Planejamento proporcional

### Tarefa simples

```text
Objetivo → mudança pequena → check específico → revisão final
```

### Tarefa média

```text
Objetivo → investigação → plano curto → etapas verificáveis
→ regressão relacionada → revisão final
```

### Tarefa complexa

```text
Objetivo → mapa do sistema → riscos e dependências → subtarefas
→ validação por subtarefa → integração → regressão ampla
```

Cada etapa deve produzir um resultado testável. Divida componentes por responsabilidade e mantenha interfaces explícitas. Não crie planos extensos para mudanças triviais nem esconda trabalho complexo em uma única etapa vaga.

## Loop de execução

1. Confirme o objetivo e a condição de sucesso.
2. Colete a menor quantidade de contexto suficiente.
3. Preserve alterações do usuário e mantenha o escopo do diff.
4. Para bugs, reproduza a falha e capture evidência antes da correção, quando viável.
5. Faça a menor mudança coerente que trate a causa ou entregue a capacidade.
6. Execute o check específico.
7. Se falhar, diagnostique antes de editar novamente.
8. Quando o check específico passar, execute regressão proporcional.
9. Inspecione o resultado e o diff completo.
10. Conclua somente com evidência atual.

Não agrupe alterações independentes enquanto a causa ainda estiver incerta. Não refatore grandes áreas apenas porque poderiam ser melhores.

## Verificação e regressão

Escolha verificações que correspondam ao artefato e ao risco.

### Código

Quando existirem no projeto:

- teste específico e teste de regressão;
- lint e formatação;
- typecheck;
- build de produção;
- imports, erros de runtime e contratos públicos;
- compatibilidade e edge cases relevantes.

### Backend, APIs e dados

- status e payloads;
- autenticação e autorização;
- validação, persistência e idempotência;
- migrations, constraints, índices e rollback;
- integrações reais ou doubles adequados ao nível do teste;
- logs sem secrets ou dados sensíveis.

### Interfaces

- estados normal, loading, vazio, erro e disabled;
- responsividade e ausência de overflow;
- teclado, foco, contraste e tecnologia assistiva aplicável;
- console do navegador;
- integração com APIs;
- medição em produção e dispositivo/navegador alvo quando exigida.

### Infraestrutura e automação

- sintaxe e schema;
- permissões e variáveis;
- plano de rollback;
- health checks;
- execução equivalente à CI quando possível.

### Documentação

- consistência com o estado real;
- comandos e caminhos;
- links e referências;
- exemplos;
- Markdown, idioma e paridade aplicável.

A regressão deve crescer com o risco: check específico, testes relacionados e, quando razoável, suíte, build e validação de integração.

## Correção orientada por evidências

Quando algo falhar:

```text
FALHA
  ↓
COLETAR SAÍDA COMPLETA
  ↓
IDENTIFICAR CAUSA RAIZ
  ↓
FORMULAR HIPÓTESE TESTÁVEL
  ↓
APLICAR MENOR CORREÇÃO
  ↓
RODAR CHECK ESPECÍFICO
  ↓
RODAR REGRESSÃO
```

Evite alterações aleatórias e não esconda uma falha reduzindo a cobertura da verificação.

Se a mesma hipótese falhar novamente sem evidência nova:

1. pare de repetir a tentativa;
2. revise premissas, logs e limites do ambiente;
3. procure uma verificação independente;
4. mude a estratégia ou declare o bloqueio real.

Uma verificação indisponível não passa por ausência. Use uma ferramenta equivalente já disponível quando ela produzir evidência compatível; caso contrário, solicite autorização para instalar ou registre a limitação.

## Precedência

Quando houver conflito, aplique:

1. regras da plataforma e do agente hospedeiro;
2. pedido explícito mais recente do usuário;
3. instruções específicas mais próximas do arquivo ou módulo;
4. requisitos legais, de segurança e de preservação de dados;
5. este contrato de loop;
6. decisão do roteador;
7. defaults dos guias especializados.

Dentro do escopo técnico, priorize:

```text
correção → não regressão → segurança → requisito do produto
→ simplicidade → performance medida → elegância
```

Um guia nunca concede autoridade para instalar, publicar, excluir, migrar dados, alterar produção, enviar mensagens ou expor informações.

## Condições de parada

O loop termina somente em uma destas condições:

### Sucesso verificado

- requisito principal atendido;
- checks aplicáveis executados e aprovados;
- regressões relevantes não encontradas;
- diff revisado e restrito ao escopo;
- documentação atualizada quando necessária;
- limitações residuais declaradas.

### Bloqueio externo genuíno

- falta uma decisão de produto material;
- falta autorização para ação externa ou destrutiva;
- credencial, serviço, dispositivo ou ambiente indispensável está indisponível;
- uma verificação essencial não possui alternativa segura;
- o ambiente impede progresso após diagnóstico e tentativas distintas.

Dificuldade, lentidão, incerteza inicial ou preferência por mais contexto não são bloqueios por si só.

## Entrega final

Use o menor relatório que preserve a evidência.

```text
STATUS: CONCLUÍDO | PARCIALMENTE VERIFICADO | BLOQUEADO

Entregue:
- arquivos ou comportamento alterado.

Verificado:
- comandos/checks e resultados objetivos.

Limitações:
- o que não foi comprovado e por quê.

Publicação:
- estado de commit, push, PR, merge ou deploy, quando aplicável.
```

Nunca afirme que um teste, build, plataforma, dispositivo ou integração passou sem ter executado uma verificação compatível. A resposta final deve ser autossuficiente e distinguir implementação local de publicação externa.
