---
name: acessibilidade-code-pt
language: pt-BR
counterpart: ../ENG/accessibility-eng.md
description: "Protocolo prático de acessibilidade orientado à WCAG 2.2 para web, mobile e desktop."
version: "2026.08"
last-reviewed: "2026-08-08"
---

# Acessibilidade como Linha de Base (A11Y)

> Instruções de acessibilidade adaptadas do projeto [A11Y.md](https://github.com/fecarrico/A11Y.md) (Felipe A. Carriço, licença MIT) — um protocolo de validação e contexto persistente para desenvolver software acessível desde a primeira linha de código, alinhado a **WCAG 2.2 AA**, **ISO 9241-171**, **ADA** e **EAA**.

> **Documentos relacionados**: para direção visual/UX (paletas, tipografia, motion), ver [`design-code-pt.md`](./design-code-pt.md). Para ferramentas de teste automatizado (axe-core, Lighthouse, regressão visual), ver [`test-code-pt.md`](./test-code-pt.md). Para qualidade/estrutura de código, ver [`clean-code-pt.md`](./clean-code-pt.md). Para vídeo e motion HTML, ver também o [HyperFrames](https://hyperframes.heygen.com). Este arquivo é a referência canônica de **regras de acessibilidade** (WCAG, ARIA, teclado, foco, leitores de tela) — não repete o conteúdo dos demais.

> **Política de ferramentas**: identifique a stack, a etapa e os checks aplicáveis; prefira um equivalente já disponível que produza evidência compatível. Antes de instalar uma ferramenta ou alterar o ambiente, peça autorização. Se não houver equivalente seguro, registre o check necessário como bloqueado e nunca afirme que ele passou. Não instale recursos meramente opcionais.

## 0. Princípio Zero: acessibilidade como pré-condição

- Acessibilidade não é uma funcionalidade ou melhoria incremental; é uma **pré-condição para o uso**.
- Se um usuário não consegue completar uma tarefa devido a uma barreira de acessibilidade, a funcionalidade é considerada **tecnicamente quebrada**.
- O sucesso da **conclusão de tarefa** (task completion) é a métrica principal de qualidade.

## 0.1. Perfis de conformidade

O padrão deste documento é **Standard (AA)**. Ao gerar ou revisar código de interface, o agente **deve perguntar** qual perfil aplicar, caso não tenha sido especificado:

| Perfil | Alvo | Contraste (texto / UI) | Fonte mín.† | Alvo mín. | Caso de uso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **🛡️ Shield (AAA)** | WCAG AAA | 7:1 / 3:1 (SC 1.4.6, 1.4.11) | 14px† | 44×44px (SC 2.5.5) · 48×48px† recomendado | Indústrias reguladas, saúde, governo |
| **⚖️ Standard (AA)** | WCAG AA | 4.5:1 / 3:1 (SC 1.4.3, 1.4.11) | 12px† | 24×24px (SC 2.5.8) · 44×44px† recomendado | Padrão. Apps em produção, web pública |
| **🚀 Launchpad (A)** | WCAG A | 3:1† (piso da casa) | 10px† | 24×24px† | MVPs, ferramentas internas, protótipos |

*† = **Regra da Casa**, não-normativa: política ergonômica deste padrão onde a WCAG exige menos — ou nada — naquele nível. A WCAG não define fonte mínima em nenhum nível; o Nível A não define critérios de contraste nem de tamanho de alvo; os alvos de 44–48px vêm da Apple HIG / Material Design. Pular um **SC da WCAG** no nível-alvo DEVE ser registrado em `EXCEPTIONS.md`; flexibilizar uma **Regra da Casa** é decisão de produto — registrar em `A11Y-DECISIONS.md`.*

*O perfil Launchpad exige adicionalmente documentação explícita em `EXCEPTIONS.md` para cada critério flexibilizado abaixo do AA.*

> ⚠️ O perfil **Launchpad (A)** NÃO flexibiliza regras CRÍTICAS (Seção 1). Operabilidade por teclado, gerenciamento de foco e HTML semântico permanecem obrigatórios em TODOS os níveis — são requisitos Nível A.

## 1. Modelo de severidade e impacto

Avalie o impacto de qualquer decisão de design ou implementação seguindo estes níveis:

- 🔴 **CRÍTICA:** falhas de **operação**. Bloqueiam a conclusão de tarefa ou tornam a função inutilizável (ex.: navegação por teclado quebrada, clique em `div`/`span`, modal sem gerenciamento de foco). **CORREÇÃO OBRIGATÓRIA.**
- 🟠 **ALTA:** falhas de **percepção e legibilidade**. Aumentam significativamente a taxa de erro ou abandono (ex.: contraste insuficiente, fontes < 12px em textos críticos, falta de feedback dinâmico). **CORREÇÃO OBRIGATÓRIA.**
- 🟡 **MÉDIA:** reduzem **eficiência e satisfação** (ex.: falta de atalhos de teclado opcionais, falta de rótulos redundantes). **DEVE-SE CORRIGIR.**
- 🔵 **BAIXA:** impacto **cosmético ou de polimento** (ex.: microinterações sem `aria-label`, melhorias em indicadores de foco já visíveis). **PODE-SE CORRIGIR.**

## 2. Contrato de comportamento do agente de IA

Para garantir integridade técnica, qualquer IA interagindo com o projeto **DEVE**:

- **Sem inferência:** nunca presumir acessibilidade sem evidência direta no código ou na especificação.
- **Referência APG:** priorizar padrões do [WAI-ARIA Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/).
- **Protocolo para ambiguidade:** seguir o *Protocolo de Componentes Complexos* (Seção 5) em caso de incerteza.
- **Explicar trade-offs:** explicar impactos em Acessibilidade vs UX vs Negócio ao sugerir alterações.
- **Interrogação de componentes de UI:** antes de adicionar `onClick` a elementos não-semânticos, **propor a substituição** por elementos nativos ou padrões ARIA completos.
- **Adaptação de framework:** os exemplos usam sintaxe React/TSX. Em frameworks **web**, transpor os padrões para o framework ativo do projeto preservando a equivalência semântica.
- **Consciência de plataforma:** identificar a plataforma-alvo **antes** de aplicar referências técnicas. A camada normativa (Princípio Zero, POUR, perfis, severidade, governança) é agnóstica de plataforma; as referências técnicas são web-first. Em plataformas nativas (iOS, Android, React Native, Flutter), ler referências web como **intenção semântica a traduzir — nunca implementação a copiar**: nada de atributos ARIA ou pixels CSS fora da web.
- **Reuso de componentes:** antes de gerar qualquer componente interativo, verificar se já existe implementação no projeto ou no design system e estendê-la. Gerar implementação paralela de um padrão existente é uma violação.
- **Memória de decisões:** escolhas entre alternativas igualmente conformes (ex.: `alertdialog` vs `dialog` para confirmação destrutiva) devem ser registradas em `A11Y-DECISIONS.md` — indexadas por padrão, nunca por tela — e reutilizadas nos turnos seguintes.
- **Consciência de modo:** ao gerar código novo, aplicar todas as regras proativamente. Ao revisar código existente, identificar violações, classificar por severidade (Seção 1) e sugerir correções pontuais — não propor reescritas completas a menos que o dano estrutural seja CRÍTICO. Se existir um `EXCEPTIONS.md`, consultá-lo: uma entrada lá é dispensa legítima, mas entrada com validade vencida deve ser sinalizada como débito técnico 🟠 ALTO.

## 3. Padrões técnicos (framework POUR)

### Perceptível (Perceivable)

- **Contraste (SC 1.4.3, 1.4.11):** texto **DEVE** ter 4.5:1; componentes de UI e gráficos significativos **DEVEM** ter 3:1. Priorizar **diferença de luminância** real (claro vs escuro) além do matiz.
- **Texto alternativo (SC 1.1.1):** imagens informativas **DEVEM** ter descrição funcional em `alt`; imagens decorativas usam `alt=""` ou `aria-hidden="true"`.
- **Redundância semântica:** **NÃO** transmitir estado apenas pela cor. O uso de **ícone + texto + cor** (ex.: 🔴 Erro) é o padrão obrigatório.
- **Padrões visuais:** gráficos e dashboards **DEVEM** usar texturas ou estilos de linha diferenciados para garantir distinção sem cor.

### Operável (Operable)

- **Teclado (SC 2.1.1):** 100% das funcionalidades **DEVEM** ser operáveis sem mouse. Evitar listeners puramente baseados em ponteiro sem equivalentes de teclado (`onKeyDown`).
- **Foco (SC 2.4.7, 2.4.11):** o foco **DEVE** ser visível, nunca totalmente encoberto por conteúdo do autor (ex.: headers/footers sticky), persistente e nunca suprimido via CSS (`outline: none` sem fallback é proibido).
- **Roteamento SPA:** após mudanças de rota client-side, o foco **DEVE** ser gerenciado e resetado apropriadamente (ex.: enviar foco ao topo ou a um `h1`). Evitar foco perdido na tela.
- **Alvos (SC 2.5.8):** elementos interativos **DEVEM** ter tamanho mínimo de **24×24 pixels CSS** — o piso normativo da WCAG 2.2 AA — exceto quando existe alvo equivalente maior, o espaçamento ao redor evita ativação acidental, ou o alvo está inline no texto.
  **Regra da Casa†:** projetar para **44×44px** (48×48 no Shield), o piso ergonômico compartilhado por Apple HIG e Material Design. No Shield, 44×44 é normativo (SC 2.5.5 AAA).
- **Movimento (SC 2.3.3 AAA — aplicada como Regra da Casa† em todos os perfis):** **DEVE-SE** respeitar a media query `@media (prefers-reduced-motion)`. Evitar animações pesadas de estado durante transições cruciais se a preferência estiver ativa.

### Compreensível (Understandable)

- **Rótulos (SC 1.3.1, 3.3.2):** formulários **DEVEM** ter rótulos explícitos conectados via `id`/`for` ou por envelopamento de tag. Evitar reinvenções que quebrem eventos nativos do navegador.
- **Previsibilidade:** o comportamento de navegação **DEVE** ser consistente; interações não devem causar mudanças estruturais repentinas não anunciadas.
- **Feedback dinâmico (SC 4.1.3):** eventos dinâmicos baseados em estado (toasts, loading, sucesso de formulário via AJAX/fetch) **DEVEM** ser anunciados ativamente por regiões `aria-live` ou equivalentes modernos (`role="status"`, `role="alert"`).

### Robusto (Robust)

- **HTML semântico:** **preferir** sempre elementos nativos (HTML5) a componentes customizados.
- **Interoperabilidade:** o código **DEVE** ser compatível com tecnologias assistivas atuais (ISO 9241-171).

## 4. Diretrizes visuais (critérios rígidos de UI)

Para garantir certificação, estas diretrizes visuais são inegociáveis:

- **Indicador de foco (Regra da Casa† — inspirada no SC 2.4.13 AAA):** o anel de foco **DEVE** ter espessura mínima de 2px e contraste de pelo menos 3:1 contra o fundo. (O piso AA: foco visível — SC 2.4.7 — e não totalmente encoberto por conteúdo do autor — SC 2.4.11.)
- **Tipografia (Regra da Casa† — a WCAG não define fonte mínima em nenhum nível):** o texto **NÃO DEVE** ser menor que a fonte mínima do perfil ativo (Seção 0.1); 12px no padrão Standard (AA).
  - *Exceção de densidade:* em dashboards complexos ou metadados secundários (badges), permite-se **mín. 10px**, desde que o contraste seja elevado para **7:1** como mitigação — trade-off definido pela política deste padrão, não pela WCAG — e a flexibilização seja documentada em `EXCEPTIONS.md`.
- **Espaçamento e área de clique:** ver *Seção 3 — Alvos* para a regra de tamanho mínimo e exceções. Em UIs densas (ex.: tabelas), se o tamanho visual for menor que 44px, a **hit area** (área clicável invisível) **DEVE** ser expandida via CSS/padding. Alvos adjacentes **DEVERIAM** ter 8px de espaçamento.

## 5. Protocolo de componentes complexos

Ao identificar um componente não mapeado ou de alta complexidade (ex.: gráficos, grids dinâmicos):

1. **Identificar:** buscar padrão similar no [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/).
2. **Validar:** solicitar validação humana com leitor de tela — a IA **NÃO DEVE** alegar que executou esse teste, nem fabricar seus resultados.
3. **Documentar:** documentar o comportamento esperado (teclado e anúncios).
4. **Escalar:** registrar o padrão resolvido em `A11Y-DECISIONS.md` para que componentes futuros o reutilizem em vez de re-derivá-lo.

## 6. Antipadrões (NÃO fazer)

- **Divs clicáveis:** **NÃO** usar `div` ou `span` para ações de clique. Preferir botões nativos. Se forçado a usar, replicar manualmente o comportamento de um `<button>` (`role`, `tabindex="0"`, listeners de Enter e Space).
- **Focus traps vazados:** **NÃO** criar modais sem gerenciar o foco. Quando um modal estiver aberto:
  - o foco **DEVE** ser movido para dentro do modal;
  - o foco **DEVE** ficar preso (trapped) dentro do modal;
  - o foco **DEVE** retornar ao elemento acionador quando fechado;
  - o conteúdo de fundo **NÃO DEVE** ser interativo nem alcançável via teclado.
- **Placeholder como rótulo:** **NÃO** usar `placeholder` como única forma de rótulo. Instruções cruciais (como formatos de data) **DEVEM** estar visíveis fora do campo para não desaparecer durante o preenchimento.
- **Sopa de ARIA:** **NÃO** adicionar ARIA onde o HTML nativo já fornece a semântica — nenhum ARIA é melhor que ARIA ruim. Proibido por padrão: roles redundantes (`role="button"` num `<button>`), `aria-label` duplicando texto visível (inofensivo hoje, mas vira falha da SC 2.5.3 quando o texto muda) e estados ARIA estáticos nunca atualizados (`aria-expanded` fixo no código — falha da SC 4.1.2). ARIA é o fallback para lacunas da semântica nativa ([Primeira Regra do Uso de ARIA](https://www.w3.org/TR/using-aria/#rule1)), não um tempero. A quantidade de atributos ARIA não é evidência de acessibilidade: valide comportamento, semântica e suporte assistivo.
- **Reinventar a roda complexa:** para componentes complexos (selects com autocomplete, treeviews, datepickers), é fortemente recomendado usar bibliotecas robustas e acessíveis (ex.: Headless UI) em vez de criar lógica proprietária do zero.

## 7. Fluxo de verificação (Definition of Done)

- [ ] **Checagem técnica:** código limpo, testável via linter integrado (`eslint-plugin-jsx-a11y` ou similar) e passando sem violações críticas por motores como `Axe` (ver [`test-code-pt.md`](./test-code-pt.md) para setup das ferramentas).
- [ ] **Ordem de Tab:** caminho da tecla `Tab` validado manualmente (garante ausência de becos sem saída no frontend).
- [ ] **Fluxo do usuário:** interações dinâmicas (SPAs) testadas quanto a feedbacks via `aria-live` em cenários de erro e sucesso, sem uso do mouse.
- [ ] **Zoom e reflow:** texto redimensiona até 200% sem perda de conteúdo ou função (SC 1.4.4); conteúdo refaz o fluxo a 320 CSS px de largura — equivalente a 400% de zoom num viewport de 1280px — sem rolagem bidimensional (SC 1.4.10). Preservar flexibilidade com unidades relativas (rem/em).
- [ ] **Cor e percepção:** sem perda funcional ao perder o uso exclusivo de cores (simuladores de deficiência de visão).
- [ ] **Auditoria de exceções:** `EXCEPTIONS.md` revisado — toda entrada ativa tem dono do risco, aprovador, issue de rastreio e validade; nenhuma entrada vencida sem tratamento.

---

## Referências

- Projeto original: https://github.com/fecarrico/A11Y.md (licença MIT — Felipe A. Carriço)
- WAI-ARIA Authoring Practices Guide (APG): https://www.w3.org/WAI/ARIA/apg/
- eBay MIND Patterns: https://ebay.github.io/mindpatterns/
- Deque Axe Core: https://github.com/dequelabs/axe-core
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Templates opcionais do projeto original: relatório de acessibilidade (`REPORT.md`), registro de exceções (`EXCEPTIONS.md`) e registro de decisões (`A11Y-DECISIONS.md`) — disponíveis em `docs/*/templates/` no repositório original.
