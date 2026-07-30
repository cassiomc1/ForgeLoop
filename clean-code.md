# Clean Code para Agentes de IA

> Tradução e adaptação das dicas do artigo "Clean Code for AI Agents" de Fabio Akita (akitaonrails.com), organizadas como instruções práticas para orientar agentes de IA (Claude Code, Cursor, Copilot, etc.) a escrever código de melhor qualidade.

> **Documentos relacionados**: para frameworks/ferramentas de teste por linguagem, ver `test-code.md`. Para boas práticas de segurança, ver `sec-code.md`. Para diretrizes visuais/UX, ver `design-code.md`. Este arquivo foca em qualidade e estrutura de código, não repete o conteúdo detalhado dos demais.

## Contexto

Em 2008, Robert C. Martin (Uncle Bob) publicou o livro *Clean Code*, estabelecendo que código deveria ser escrito para ser lido por humanos. Em 2026, o principal "leitor" do código passou a ser um agente de IA. Isso muda a importância relativa de várias práticas: algumas se tornaram ainda mais críticas, outras mudaram de peso, e surgiram exigências novas que Uncle Bob não previu.

## Restrições reais dos agentes de IA

- **Truncamento de arquivos**: agentes leem arquivos em blocos limitados (ex.: ~2000 linhas por vez). Arquivos grandes não cabem em uma única leitura.
- **Atenção degrada com o contexto**: mesmo com janelas de contexto grandes, a qualidade de recuperação de informação cai bem antes do limite técnico.
- **Grep é mais barato que leitura completa**: agentes preferem buscar por padrões (`rg`, `grep`) a carregar arquivos inteiros. Nomes únicos e específicos tornam essa busca eficaz.
- **Cada chamada de ferramenta custa tokens**: arquivos curtos, logs concisos e saídas de teste enxutas mantêm o agente produtivo e barato.
- **Latência importa**: arquivos grandes e lentos de processar geram atrito perceptível durante a sessão.
- **Inconsistência visual prejudica a busca**: indentação mista, estilos de chave variados etc. custam tokens extras para o agente "entender" a bagunça.

## Ranking de práticas (da mais para a menos importante)

### 1. Funções e arquivos pequenos
Funções devem fazer **uma coisa só**, bem feita. Tamanho ideal: 4 a 20 linhas. Arquivos devem ficar abaixo de 500 linhas, idealmente 200-300. Isso permite que o agente carregue a unidade completa de significado em uma única chamada de ferramenta, evitando truncamento e fragmentação do raciocínio.

### 2. Princípio da Responsabilidade Única (SRP)
Cada módulo deve ter uma única responsabilidade e um único motivo para mudar. Isso permite ao agente isolar a unidade de código, rodar testes focados e editar sem medo de efeitos colaterais. Uma classe de 800 linhas fazendo três coisas é pior do que três classes de 250 linhas.

### 3. Nomes significativos e únicos
Nomes devem revelar intenção e, principalmente, ser **buscáveis** (searchable). Nomes genéricos (`data`, `process`, `handler`, `Manager`, `Service`) geram dezenas de resultados de busca irrelevantes. Nomes distintos (`UserRegistrationValidator`, `InvoiceLineItemTotal`) levam o agente direto ao alvo. Regra prática: se um grep pelo nome retorna muita coisa irrelevante, o nome é ruim para o agente.

### 4. Comentários com contexto e proveniência
Ao contrário do Clean Code original, que via comentários como sinal de código ruim, agentes de IA **gostam e se beneficiam de comentários**. O agente já entende sintaxe perfeitamente, mas não sabe o "porquê": por que essa abordagem foi escolhida, qual bug motivou essa lógica estranha, qual restrição de negócio força essa ordem específica, qual issue/commit está relacionado. Docstrings com intenção e exemplos de uso ajudam muito.
**Não remova comentários escritos pelo próprio agente** durante revisões — eles carregam contexto que o próprio agente vai querer reler depois. Apenas remova comentários redundantes e óbvios (ver item 13).

### 5. Tipagem explícita
Código com tipos explícitos (TypeScript em vez de JavaScript puro, type hints em Python, RBS em Ruby) dá ao agente um "gabarito" imediato: o que entra, o que sai, quais estados são válidos. Código dinâmico sem anotações força o agente a inferir tipos pelo uso, o que custa raciocínio e gera erros.

### 6. DRY (Não se repita)
Duplicação é pior para agentes do que para humanos: quando uma mudança é necessária, o agente pode atualizar uma cópia e esquecer as outras, já que não há "gravidade natural" de atenção puxando para as cópias espalhadas. Fatorar lógica repetida em função/módulo reutilizável é segurança para refatoração automatizada.

### 7. Testes que o agente consegue executar
Testes devem seguir F.I.R.S.T. (Rápidos, Independentes, Repetíveis, Auto-validáveis, Oportunos) e, além disso, **rodar sem intervenção manual**: comando de execução documentado no README/CLAUDE.md, saída em formato previsível, sem depender de seed manual de banco de dados ou credenciais secretas fora do repositório. TDD deixou de ser filosofia e virou obrigação técnica: o agente escreve código, roda testes, lê a saída, ajusta e repete. Sem testes, o agente entrega código plausível que quebra coisas silenciosamente.

### 8. Estrutura de diretórios previsível
Convenções fortes de framework (Rails, Django, Next.js, Laravel) ajudam o agente a antecipar caminhos de arquivos sem precisar listar diretórios. Projetos sem convenção fazem o agente perder tempo explorando com `find`.

### 9. Injeção de dependência e testabilidade
Código com dependências injetadas (não instanciadas internamente) é mais fácil de testar isoladamente. O agente pode trocar uma dependência real por um fake em teste sem tocar na lógica. Isolamento de configuração (ex.: centralizar nome de modelo de LLM em uma única constante) evita que uma mudança simples exija editar dezenas de arquivos.

### 10. Evitar aninhamento profundo
Cada nível de indentação exige mais atenção do modelo para rastrear estado. Prefira retornos antecipados (early return), guard clauses e lógica "achatada" em vez de `if` dentro de `for` dentro de `if` dentro de `try`.

### 11. Erros com contexto
Mensagens de erro vagas (`"invalid input"`) obrigam o agente a gastar uma rodada extra investigando o problema. Prefira mensagens detalhadas, incluindo o valor recebido e o formato esperado (ex.: `"invalid input: recebido {valor}, esperado string não vazia de dígitos"`).

### 12. Formatação e estilo
Use o formatador padrão/mais popular da linguagem (`cargo fmt`, `gofmt`, `prettier`, `black`/`ruff`, `rubocop -A`) e configure para rodar automaticamente (pre-commit, ao salvar). Não perca tempo discutindo estilo manualmente — deixe a ferramenta decidir.

### 13. Comentários que descrevem o óbvio
Ainda são ruins, e agora ainda piores: custam tokens (dinheiro) sem agregar valor. Evite comentários como `// incrementa i em 1` acima de `i++`.

## O que Uncle Bob não podia prever

- **Arquivos de meta-documentação para agentes** (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, `.github/copilot-instructions.md`): lidos pelo agente antes de qualquer ação, devem ser curtos, diretos, imperativos e focados em ação — sem prosa filosófica.
- **README com arquitetura de alto nível**: diagramas simples (ASCII ou Mermaid) ajudam o agente a entender rapidamente a forma do projeto.
- **Logging estruturado**: logs em JSON com campos nomeados são muito mais úteis para o agente do que logs em texto livre, pois podem ser parseados e filtrados facilmente.
- **Comandos de observabilidade acessíveis**: `pnpm test`, `make lint`, `cargo check` etc. — comandos previsíveis que o agente pode invocar para validar mudanças.
- **Scripts de setup idempotentes**: o agente precisa conseguir rodar `bin/setup` ou `scripts/bootstrap.sh` em uma máquina limpa e chegar a um estado funcional, sem depender de conhecimento tácito de alguém.

## Debugging: aumentar o log antes de desistir

Quando um erro de execução acontece ou o usuário reporta um bug e a causa raiz não é óbvia a partir do erro/stack trace disponível, o agente não deve ficar adivinhando nem tentar correções especulativas à toa. O próximo passo correto é **aumentar temporariamente o nível de log/debug no trecho relevante do código** (ex.: mudar `LOG_LEVEL` para `debug`/`trace`, adicionar `console.log`/`print`/`logger.debug` pontuais nas variáveis e no fluxo suspeito, habilitar modo verboso da ferramenta), reproduzir o erro de novo, ler a saída, e só aí formular a hipótese da causa. Depois de identificar e corrigir a causa raiz, remover os logs temporários adicionados só para investigação (manter apenas o que for logging estruturado útil permanentemente).

Isso evita duas falhas comuns de agentes de IA: (1) aplicar uma "correção" plausível sem confirmar a causa real, gerando retrabalho; (2) desistir ou pedir mais informação ao usuário quando a própria aplicação poderia revelar a causa com mais instrumentação.

## Template de instruções para incluir em CLAUDE.md / AGENTS.md

Nenhum modelo de IA segue essas práticas por padrão — é preciso **instruir explicitamente**. Use algo como o template abaixo como ponto de partida (adapte à linguagem e ao projeto):

```
## Estilo de código

- Funções: 4-20 linhas. Divida se for maior.
- Arquivos: menos de 500 linhas. Divida por responsabilidade.
- Uma coisa por função, uma responsabilidade por módulo (SRP).
- Nomes: específicos e únicos. Evite `data`, `handler`, `Manager`.
  Prefira nomes que retornem menos de 5 resultados de grep no projeto.
- Tipos: explícitos. Sem `any`, sem `Dict` genérico, sem funções sem tipo.
- Sem duplicação de código. Extraia lógica compartilhada em função/módulo.
- Prefira retornos antecipados a ifs aninhados. Máximo de 2 níveis de indentação.
- Mensagens de exceção devem incluir o valor problemático e o formato esperado.

## Comentários

- Mantenha os comentários que você mesmo escrever — não os remova em refatorações.
  Eles carregam intenção e contexto.
- Escreva o PORQUÊ, não o QUÊ. Evite `// incrementa o contador` acima de `i++`.
- Docstrings em funções públicas: intenção + um exemplo de uso.
- Referencie números de issue / commits quando uma linha existir por causa
  de um bug específico ou restrição externa.

## Testes

- Ver regras detalhadas de framework/ferramenta por linguagem em `test-code.md`.
- Regra mínima aqui: testes rodam com um único comando documentado, toda
  função nova e toda correção de bug recebem teste correspondente.

## Dependências

- Injete dependências via construtor/parâmetro, não via import/global.
- Encapsule bibliotecas de terceiros atrás de uma interface fina própria do projeto.

## Estrutura

- Siga a convenção do framework (Rails, Django, Next.js, etc.).
- Prefira módulos pequenos e focados a arquivos "deus".
- Caminhos previsíveis: controller/model/view, src/lib/test, etc.

## Formatação

- Use o formatador padrão da linguagem (`cargo fmt`, `gofmt`, `prettier`,
  `black`, `rubocop -A`). Não discuta estilo além disso.

## Logging

- JSON estruturado para logs de depuração/observabilidade.
- Texto simples apenas para saída de CLI voltada ao usuário final.

## Debugging

- Se um erro de execução ou bug reportado pelo usuário não tiver causa raiz
  clara a partir do log/stack trace atual, NÃO adivinhe a correção.
  Primeiro aumente o nível de log/debug (env var de log level, prints/logger.debug
  pontuais nas variáveis e no fluxo suspeito, modo verboso da ferramenta),
  reproduza o erro de novo, leia a saída, e só depois corrija.
- Remova os logs temporários de investigação depois de corrigir o problema.
```

## Resumo

O código limpo nunca foi modismo — virou infraestrutura. A maioria das práticas do Clean Code original ainda vale, mas algumas recomendações que antes eram opinião ("um arquivo deveria ter N linhas") viraram restrições técnicas mensuráveis ("um arquivo com X linhas faz o agente performar pior"). Quem escreve código limpo pensando no agente economiza dinheiro em tokens, tempo de sessão, e reduz alucinações na saída.

---

Fonte original: https://akitaonrails.com/en/2026/04/20/clean-code-for-ai-agents/
