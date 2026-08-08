---
name: clean-code-pt
language: pt-BR
counterpart: ../ENG/clean-code-eng.md
description: "Práticas de código legível, observável, seguro e operável por agentes de IA."
version: "2026.08"
last-reviewed: "2026-08-08"
---

# Clean Code para Agentes de IA

> Síntese operacional original influenciada pelo artigo "Clean Code for AI Agents", de Fabio Akita. Não é tradução, reprodução ou obra oficialmente associada ao autor.
>
> **Documentos relacionados**: para frameworks e ferramentas de teste por linguagem, ver [`test-code-pt.md`](./test-code-pt.md). Para segurança, ver [`sec-code-pt.md`](./sec-code-pt.md), a referência canônica para secrets, autorização, criptografia e redação de dados sensíveis. Para diretrizes visuais/UX, ver [`design-code-pt.md`](./design-code-pt.md). Para vídeo e motion baseados em HTML, consulte o [HyperFrames](https://hyperframes.heygen.com). Este guia foca em qualidade, estrutura e operação do código.
>
> **Política de ferramentas**: identifique a stack, a etapa e os checks aplicáveis; prefira um equivalente já disponível que produza evidência compatível. Antes de instalar uma ferramenta ou alterar o ambiente, peça autorização. Se não houver equivalente seguro, registre o check necessário como bloqueado e nunca afirme que ele passou. Não instale recursos meramente opcionais.

## Contexto

Código limpo é infraestrutura para pessoas e agentes de IA. Em ambos os casos, o leitor precisa localizar intenção, validar uma mudança e compreender consequências sem depender de conhecimento tácito. As práticas abaixo favorecem unidades coesas, fronteiras explícitas, evidência de execução e operação segura.

## Restrições reais dos agentes de IA

- **Leitura parcial**: agentes leem arquivos em blocos; arquivos extensos ou multifuncionais tornam a recuperação de contexto menos confiável.
- **Atenção e latência**: contexto maior não elimina a degradação de atenção; saídas de teste e logs concisos reduzem custo e ambiguidade.
- **Busca orientada por nomes**: nomes específicos e consistentes tornam `rg` e ferramentas equivalentes úteis para encontrar a unidade certa.
- **Evidência operacional**: comandos previsíveis, testes automatizados e observabilidade estruturada permitem verificar hipóteses em vez de completar lacunas por suposição.

## Práticas prioritárias

### 1. Funções e arquivos coesos

Faça uma função expressar uma responsabilidade compreensível e mantenha o arquivo navegável. Faixas como 4–20 linhas para funções, 200–300 linhas para arquivos e 500 linhas como teto são **sinais para revisar**, não regras mecânicas. Divida quando a coesão, o vocabulário do domínio ou a leitura melhorarem; mantenha uma exceção documentada quando separar piorar esses critérios.

### 2. Responsabilidade única

Cada módulo deve ter uma razão clara para mudar. Separe regras de negócio, coordenação de caso de uso, integração e apresentação para que uma alteração localizada não imponha leitura ou testes desnecessários sobre o resto do sistema.

### 3. Nomes significativos e buscáveis

Prefira nomes que revelem intenção e pertençam ao vocabulário do domínio. `InvoiceLineItemTotal` comunica mais do que `process`; se uma busca pelo nome retorna muitos resultados irrelevantes, trate isso como sinal de revisão, não como uma meta numérica absoluta.

### 4. Comentários com contexto, não ruído

Registre o porquê, uma restrição externa, uma decisão ou a proveniência de um comportamento não óbvio. Atualize ou remova comentários obsoletos: preservar um comentário apenas porque existe propaga contexto incorreto. Evite descrever sintaxe que o código já deixa evidente.

### 5. Tipos e contratos explícitos

Tipos, esquemas e pré-condições tornam entradas, saídas e estados inválidos visíveis. Explicite contratos nas fronteiras e valide dados externos; não use anotações apenas para satisfazer uma ferramenta se elas obscurecerem o domínio.

### 6. DRY com intenção

Extraia lógica realmente repetida quando as cópias compartilham a mesma regra e evoluirão juntas. Não una trechos apenas porque parecem parecidos: uma abstração prematura pode esconder diferenças importantes do domínio.

### 7. Testes que o agente consegue executar

Mantenha um comando documentado, repetível e autocontido. Toda mudança de comportamento deve ter testes adequados ao risco: unitários para regras, integração para fronteiras e testes de regressão para falhas reais. Consulte [`test-code-pt.md`](./test-code-pt.md) para escolhas por linguagem.

### 8. Estrutura previsível

Use convenções da stack quando elas facilitarem localizar responsabilidades, mas não force uma estrutura de framework em um projeto que não a utiliza. A previsibilidade deve servir à navegação e às fronteiras, não à aparência de conformidade.

### 9. Dependências proporcionais ao risco

Introduza interfaces ou wrappers próprios para I/O, SDKs voláteis, integrações caras, dependências com efeitos colaterais ou quando um fake torna o teste mais claro. Import direto é aceitável para bibliotecas estáveis, puras e bem compreendidas. Não crie uma camada de abstração sem consumidor ou decisão explícita.

### 10. Fluxo simples

Prefira guard clauses, retornos antecipados e decomposição quando reduzirem estados implícitos. Dois níveis de indentação são um sinal útil para revisar, não uma proibição: preserve um bloco maior quando ele torna a regra de negócio mais legível.

### 11. Erros seguros e acionáveis

Use códigos estáveis para permitir tratamento programático e inclua somente contexto seguro para diagnosticar. Nunca inclua valores brutos, secrets, senhas, tokens, PII, números de cartão ou payloads completos em mensagens de erro, traces ou logs. Para classificação, retenção, acesso e redação, siga [`sec-code-pt.md`](./sec-code-pt.md).

### 12. Formatação automática

Use o formatador aceito pela stack e aplique-o de forma consistente. A ferramenta resolve estilo repetitivo; revisões humanas e de agentes devem concentrar-se em intenção, segurança, comportamento e contratos.

### 13. Comentários óbvios são dívida

Remova comentários que apenas repetem o código e reescreva os que perderam validade. Um comentário curto e correto sobre uma decisão vale mais do que um histórico longo e impreciso.

## Arquitetura e fronteiras

Separe o sistema em três papéis claros:

- **Domínio** contém regras, tipos e invariantes que não dependem de rede, disco, relógio ou SDK.
- **Aplicação** coordena casos de uso, transações, autorização de fluxo e portas necessárias.
- **Infraestrutura** implementa I/O, persistência, mensageria, relógio, SDKs e adaptadores nas bordas.

Mantenha I/O nas bordas e faça o domínio depender de contratos, não de detalhes de infraestrutura. Teste contratos nas duas extremidades da fronteira e registre decisões arquiteturais relevantes — contexto, decisão, alternativas e consequência — em um ADR ou registro equivalente. A separação deve ser ajustada ao tamanho do sistema; o objetivo é tornar dependências e efeitos observáveis, não impor uma arquitetura de moda.

## Async, concorrência e efeitos externos

- Propague cancelamento até cada operação que possa bloquear e defina timeout explícito para cada chamada externa.
- Faça retry apenas de falhas transitórias, com número limitado de tentativas, backoff e jitter. Não repita operações não idempotentes sem uma chave ou estratégia de idempotência.
- Limite a concorrência para proteger dependências e recursos locais; faça cleanup de arquivos, conexões, tarefas e locks em sucesso, falha e cancelamento.
- Defina o que pode ser repetido sem alterar o resultado e persista a evidência necessária para detectar duplicatas.
- Teste timeout, cancelamento, cleanup e condições de corrida com relógio, scheduler ou dependências controláveis; não dependa de esperas arbitrárias.

## Observabilidade segura

Emita eventos estruturados com, no mínimo, `event`, `level`, `request_id` ou correlation ID, duração, resultado e campos já redigidos. Estabeleça nomes estáveis para eventos e resultados para que alertas e consultas não dependam de texto livre.

- Use **logs** para eventos discretos e contexto de diagnóstico seguro.
- Use **métricas** para volume, latência, erros e capacidade agregados.
- Use **traces** para acompanhar uma solicitação entre fronteiras e dependências.
- Defina retenção, acesso e descarte conforme necessidade operacional, custo e política de segurança; menor retenção não substitui redação.

Nunca trate logs, métricas ou traces como lugar para dados sensíveis. A referência canônica de redação e tratamento desses dados é [`sec-code-pt.md`](./sec-code-pt.md).

## Debugging orientado por evidência

Se a causa raiz não estiver clara, formule uma hipótese e adicione instrumentação temporária mínima em ambiente controlado e não produtivo. Aplique redaction/masking antes de emitir qualquer dado, reproduza o problema, compare a evidência com a hipótese e só então altere o comportamento. Confirme a remoção da instrumentação temporária após a investigação; mantenha apenas eventos estruturados que sejam úteis permanentemente.

## Exemplos independentes de framework

### Erro seguro com código estável

```text
return error(
  code = "ACCOUNT_ID_INVALID",
  message = "account identifier is invalid",
  safe_context = { field = "account_id" }
)
```

O cliente pode reagir a `ACCOUNT_ID_INVALID`; o detalhe interno fica em canal protegido e já redigido, não no texto devolvido.

### Evento estruturado com campos redigidos

```json
{
  "event": "invoice.fetch.completed",
  "level": "info",
  "request_id": "req-7f3c",
  "duration_ms": 84,
  "result": "success",
  "customer_reference": "[REDACTED]"
}
```

O evento preserva correlação e resultado sem registrar payload, token, cartão ou PII em texto claro.

### Timeout e cancelamento propagados

```text
result = fetch_invoice(
  invoice_id,
  timeout = 1500ms,
  cancellation = request.cancellation
)
```

O chamador trata timeout e cancelamento como resultados esperados, libera recursos e não inicia retry cego.

### Dependência injetável para uma borda de I/O

```text
interface InvoiceStore:
  load(invoice_id, cancellation) -> Invoice

class InvoiceService(store: InvoiceStore):
  get(invoice_id, cancellation) -> Invoice:
    return store.load(invoice_id, cancellation)
```

`InvoiceStore` é uma porta justificável porque representa I/O; uma função matemática pura pode ser importada diretamente.

### Retry idempotente e limitado

```text
retry(
  operation = send_receipt(idempotency_key),
  attempts = 3,
  backoff = exponential_with_jitter
)
```

O retry é limitado e só é seguro porque a operação recebe uma chave de idempotência verificável.

## Template para `CLAUDE.md` / `AGENTS.md`

Adapte este bloco ao repositório e à linguagem:

```text
## Código e arquitetura

- Use funções e arquivos coesos; trate limites de tamanho e indentação como sinais de revisão.
- Preserve domínio, aplicação e infraestrutura separados; I/O fica nas bordas.
- Crie wrappers para I/O, SDKs voláteis, integrações caras ou fakes úteis; importe diretamente bibliotecas estáveis e puras.
- Atualize ou remova comentários obsoletos. Documente exceções de coesão ou decisões arquiteturais relevantes.

## Erros, async e observabilidade

- Use códigos de erro estáveis e contexto seguro. Nunca registre valores brutos, secrets, tokens, PII, cartões ou payloads completos.
- Propague cancelamento e configure timeout. Faça retry somente de falhas transitórias, com tentativas limitadas, backoff, jitter e idempotência antes de repetir efeitos externos.
- Limite a concorrência para proteger dependências e faça cleanup de recursos em sucesso, falha e cancelamento.
- Emita eventos estruturados com event, level, request_id, duração, resultado e campos redigidos.
- Use logs para diagnóstico seguro, métricas para agregados e traces para atravessar fronteiras. Defina retenção e acesso.

## Debugging e testes

- Investigue por hipótese e evidência em ambiente não produtivo controlado; aplique redação e remova a instrumentação temporária confirmadamente.
- Teste regras, contratos, timeout, cancelamento, cleanup e condições de corrida conforme o risco.
```

## Definition of Done

- [ ] As funções, arquivos e abstrações foram revisados por coesão, legibilidade e vocabulário do domínio; exceções relevantes estão documentadas.
- [ ] Domínio, aplicação e infraestrutura têm fronteiras explícitas; I/O está nas bordas e contratos de integração foram testados.
- [ ] Erros expõem código estável e contexto seguro; mensagens, logs e traces não contêm valores brutos, secrets, tokens, PII, cartões nem payloads completos.
- [ ] Chamadas externas têm timeout, propagam cancelamento, fazem cleanup e usam retry limitado com backoff/jitter somente quando a idempotência permite.
- [ ] Limites de concorrência e riscos de duplicação foram definidos e testados, inclusive timeout, cancelamento e condições de corrida relevantes.
- [ ] Eventos estruturados incluem `event`, `level`, `request_id`, duração, resultado e campos redigidos; logs, métricas, traces, acesso e retenção têm propósito definido.
- [ ] A investigação temporária ocorreu apenas em ambiente controlado, produziu evidência redigida e teve sua instrumentação removida ou promovida intencionalmente.

## Resumo

Código limpo para agentes é código que revela intenção, delimita efeitos e produz evidência segura. Métricas de tamanho ajudam a iniciar uma conversa de revisão, mas coesão e clareza decidem; observabilidade, cancelamento e fronteiras tornam o sistema verificável em operação.

---

Fonte de influência: [Clean Code for AI Agents, Fabio Akita](https://akitaonrails.com/en/2026/04/20/clean-code-for-ai-agents/).
