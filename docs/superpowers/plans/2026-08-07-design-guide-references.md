# Design Guide References Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar shadcn/ui, TanStack Charts, Cuelume e Impeccable nos dois guias de design web, com contexto de uso, links oficiais e uma etapa obrigatória de auditoria visual.

**Architecture:** A alteração será somente documental. Cada guia receberá uma orientação contextual na seção de componentes, uma etapa obrigatória de auditoria/polimento no processo, um item de checklist e entradas na seção já existente de fontes e referências, mantendo paralelismo entre português e inglês.

**Tech Stack:** Markdown, Git, `rg` e `git diff --check`.

## Global Constraints

- Modificar apenas `PT-BR/design-code-pt.md` e `ENG/design-code-eng.md` durante a implementação.
- Não alterar o `README.md`.
- Não adicionar dependências nem código executável.
- Cada URL deve aparecer pelo menos uma vez em cada guia.
- Não tratar as ferramentas como dependências obrigatórias nem recomendar copiar defaults visuais sem adaptação.
- Preservar contraste, acessibilidade e coerência com a paleta escolhida.
- Antes da publicação, executar `/impeccable audit` e `/impeccable polish` na interface inteira; repetir a auditoria após os ajustes.
- Se o Impeccable não estiver instalado, solicitar sua instalação conforme a regra existente de ferramentas obrigatórias.

---

### Task 1: Atualizar o guia em português

**Files:**
- Modify: `PT-BR/design-code-pt.md`, na seção `Componentes Premium` e na seção `Fontes e Referências (Skills Base)`.

**Interfaces:**
- Consumes: a especificação `docs/superpowers/specs/2026-08-07-design-guide-references-design.md`.
- Produces: orientação em português e links oficiais para uso posterior por agentes e desenvolvedores.

- [ ] **Step 1: Adicionar orientação contextual na seção de componentes**

Inserir após o bloco de imagens:

```markdown
**Bibliotecas de UI e visualização de dados**

- Para componentes web acessíveis, composáveis e customizáveis, consulte [shadcn/ui](https://ui.shadcn.com/); adapte tokens, estados e composição ao sistema visual do projeto em vez de copiar defaults sem intenção.
- Para gráficos e visualizações de dados, consulte [TanStack Charts](https://github.com/TanStack/charts); preserve responsividade, contraste, leitura por teclado e não dependa apenas de cor para comunicar séries ou estados.
- Para sons de interação sutis, consulte [Cuelume](https://cuelume-site.pages.dev/); ofereça controle de volume/silêncio e nunca dependa de áudio para comunicar informação essencial.
```

- [ ] **Step 2: Adicionar as duas referências na lista final**

Inserir no final de `Fontes e Referências (Skills Base)`:

```markdown
- shadcn/ui (componentes web acessíveis e composáveis): https://ui.shadcn.com/
- TanStack Charts (visualização de dados): https://github.com/TanStack/charts
- Cuelume (sons de interação para web): https://cuelume-site.pages.dev/
```

- [ ] **Step 3: Validar o guia em português**

Run: `rg -n 'https://ui\.shadcn\.com/|https://github\.com/TanStack/charts|https://cuelume-site\.pages\.dev/' PT-BR/design-code-pt.md`

Expected: as três URLs aparecem no arquivo.

### Task 2: Atualizar o guia em inglês

**Files:**
- Modify: `ENG/design-code-eng.md`, na seção `Premium Components` e na seção `Sources and References (Base Skills)`.

**Interfaces:**
- Consumes: a estrutura atualizada do guia em português e a especificação aprovada.
- Produces: orientação equivalente em inglês e links oficiais para uso posterior por agentes e desenvolvedores.

- [ ] **Step 1: Adicionar orientação contextual na seção de componentes**

Inserir após o bloco de imagens:

```markdown
**UI libraries and data visualization**

- For accessible, composable, and customizable web components, consult [shadcn/ui](https://ui.shadcn.com/); adapt tokens, states, and composition to the project's visual system instead of copying defaults without intent.
- For charts and data visualization, consult [TanStack Charts](https://github.com/TanStack/charts); preserve responsiveness, contrast, keyboard readability, and never rely on color alone to communicate series or states.
- For subtle interaction sounds, consult [Cuelume](https://cuelume-site.pages.dev/); provide volume/mute controls and never rely on audio to communicate essential information.
```

- [ ] **Step 2: Adicionar as duas referências na lista final**

Inserir no final de `Sources and References (Base Skills)`:

```markdown
- shadcn/ui (accessible, composable web components): https://ui.shadcn.com/
- TanStack Charts (data visualization): https://github.com/TanStack/charts
- Cuelume (web interaction sounds): https://cuelume-site.pages.dev/
```

- [ ] **Step 3: Validar o guia em inglês**

Run: `rg -n 'https://ui\.shadcn\.com/|https://github\.com/TanStack/charts|https://cuelume-site\.pages\.dev/' ENG/design-code-eng.md`

Expected: as três URLs aparecem no arquivo.

### Task 3: Tornar o Impeccable requisito de revisão da interface

**Files:**
- Modify: `PT-BR/design-code-pt.md`, na seção `Como usar este guia` e no `Checklist de Revisão`.
- Modify: `ENG/design-code-eng.md`, na seção `How to use this guide` e no `Review Checklist`.

**Interfaces:**
- Consumes: a regra existente de ferramentas obrigatórias e a referência oficial `https://impeccable.style/`.
- Produces: requisito explícito para auditar e polir a interface inteira antes da publicação.

- [ ] **Step 1: Adicionar o requisito no processo em português**

Adicionar como etapa 8, após o Checklist Anti-Slop:

```markdown
8. **Auditar e polir a interface inteira com Impeccable**: executar `/impeccable audit` para identificar problemas de qualidade e `/impeccable polish` para aplicar melhorias. Avaliar a interface completa, não apenas um componente, preservar o design system existente e repetir a auditoria após os ajustes.
```

- [ ] **Step 2: Adicionar o requisito no processo em inglês**

Adicionar como step 8, após o Anti-Slop Checklist:

```markdown
8. **Audit and polish the entire interface with Impeccable**: run `/impeccable audit` to identify quality issues and `/impeccable polish` to apply improvements. Evaluate the complete interface, not only one component, preserve the existing design system, and repeat the audit after the changes.
```

- [ ] **Step 3: Adicionar o item ao checklist dos dois idiomas**

Adicionar ao checklist de cada guia:

```markdown
- [ ] Executei `/impeccable audit` e `/impeccable polish` na interface inteira e corrigi os achados aplicáveis.
- [ ] Ran `/impeccable audit` and `/impeccable polish` across the entire interface and addressed applicable findings.
```

- [ ] **Step 4: Validar o requisito e a referência**

Run: `rg -n 'impeccable\.style|/impeccable audit|/impeccable polish|interface inteira|entire interface' PT-BR/design-code-pt.md ENG/design-code-eng.md`

Expected: cada guia contém o link oficial, os dois comandos e a exigência de avaliar a interface completa.

### Task 4: Revisar escopo e qualidade do Markdown

**Files:**
- Test: `PT-BR/design-code-pt.md`, `ENG/design-code-eng.md`.

**Interfaces:**
- Consumes: os dois guias modificados.
- Produces: diff limpo, sem alterações fora do escopo e sem erros de whitespace.

- [ ] **Step 1: Verificar whitespace e estrutura do diff**

Run: `git diff --check && git diff -- PT-BR/design-code-pt.md ENG/design-code-eng.md`

Expected: `git diff --check` termina sem saída de erro e o diff contém apenas os dois guias.

- [ ] **Step 2: Confirmar URLs e escopo final**

Run: `rg -l 'https://ui\.shadcn\.com/|https://github\.com/TanStack/charts|https://cuelume-site\.pages\.dev/|https://impeccable\.style/' PT-BR/design-code-pt.md ENG/design-code-eng.md && git status -sb`

Expected: os dois arquivos são listados, e nenhum terceiro arquivo de implementação aparece como modificado.

- [ ] **Step 3: Commitar a implementação documental**

```bash
git add PT-BR/design-code-pt.md ENG/design-code-eng.md
git commit -m "docs: adicionar referencias de UI e charts"
```
