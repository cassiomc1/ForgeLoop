# Canvas UI Design Guide Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar o Canvas UI nos guias de design web em português e inglês como referência opcional para efeitos canvas/WebGL, com salvaguardas de acessibilidade, compatibilidade e desempenho.

**Architecture:** A alteração será somente documental e manterá os dois guias paralelos. Cada guia receberá uma orientação na seção de componentes, regras complementares na seção de 3D/interatividade e uma referência oficial na lista de fontes.

**Tech Stack:** Markdown, Git, `rg`, `git diff --check`.

## Global Constraints

- Modificar somente `PT-BR/design-code-pt.md` e `ENG/design-code-eng.md` durante a implementação.
- Não alterar o `README.md`, guias premium ou guias de games.
- Não adicionar dependências, configurações ou código executável.
- Usar `https://canvasui.dev/` pelo menos uma vez em cada guia.
- Manter significado e estrutura equivalentes nos textos em português e inglês.
- Tratar Canvas UI como opcional; não torná-lo biblioteca genérica de interface ou requisito do projeto.
- Manter conteúdo, navegação e ações essenciais em HTML semântico e acessível.
- Exigir fallback funcional, `prefers-reduced-motion`, teste entre navegadores e avaliação em dispositivos modestos.

---

### Task 1: Atualizar o guia em português

**Files:**
- Modify: `PT-BR/design-code-pt.md`, seções `Premium Components`, `3D e Interatividade` e `Fontes e Referências (Skills Base)`.

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-08-07-canvas-ui-design-spec.md` e a estrutura existente do guia.
- Produces: orientação em português sobre uso criterioso do Canvas UI e sua referência oficial.

- [ ] **Step 1: Adicionar orientação contextual na seção de componentes**

Inserir após o bloco `**Images**` (ou equivalente):

```markdown
**Efeitos canvas/WebGL opcionais**

- Para momentos de alto impacto — como hero, revelações e interações especiais — consulte [Canvas UI](https://canvasui.dev/) como fonte de componentes canvas/WebGL copiáveis e adaptáveis.
- Use o efeito somente quando ele reforçar a narrativa; adapte tokens, composição e comportamento à identidade do projeto em vez de copiar o resultado padrão.
- Mantenha texto, navegação, controles e qualquer ação essencial como HTML semântico e acessível; o canvas é aprimoramento progressivo, nunca o único canal de comunicação.
```

- [ ] **Step 2: Complementar as regras de 3D e interatividade**

Adicionar ao final da seção existente:

```markdown
Para efeitos Canvas UI e WebGL, forneça fallback funcional quando o recurso não estiver disponível, respeite `prefers-reduced-motion`, pause o trabalho fora da viewport e teste em navegadores e dispositivos modestos. A interface deve continuar compreensível e utilizável sem o efeito.
```

- [ ] **Step 3: Adicionar a referência oficial**

Adicionar à lista de fontes:

```markdown
- Canvas UI (efeitos canvas/WebGL criativos e agnósticos de framework): https://canvasui.dev/
```

- [ ] **Step 4: Revisar o texto em português**

Confirmar que a URL aparece na orientação e na lista final, que o fallback é explícito e que nenhuma regra transforma a biblioteca em dependência obrigatória.

### Task 2: Atualizar o guia em inglês

**Files:**
- Modify: `ENG/design-code-eng.md`, sections `Premium Components`, `3D and Interactivity`, and `Sources and References (Base Skills)`.

**Interfaces:**
- Consumes: a orientação aprovada em português, a especificação e a estrutura existente do guia em inglês.
- Produces: orientação equivalente em inglês sobre uso criterioso do Canvas UI e sua referência oficial.

- [ ] **Step 1: Add contextual guidance in the components section**

Insert after the `**Images**` block (or equivalent):

```markdown
**Optional canvas/WebGL effects**

- For high-impact moments — such as heroes, reveals, and special interactions — consult [Canvas UI](https://canvasui.dev/) as a source of copyable, adaptable canvas/WebGL components.
- Use an effect only when it reinforces the narrative; adapt tokens, composition, and behavior to the project's identity instead of copying the default result.
- Keep text, navigation, controls, and every essential action as semantic, accessible HTML; canvas is progressive enhancement, never the only communication channel.
```

- [ ] **Step 2: Complement the 3D and interactivity rules**

Add to the end of the existing section:

```markdown
For Canvas UI and WebGL effects, provide a functional fallback when the capability is unavailable, respect `prefers-reduced-motion`, pause work outside the viewport, and test across browsers and modest devices. The interface must remain understandable and usable without the effect.
```

- [ ] **Step 3: Add the official reference**

Add to the sources list:

```markdown
- Canvas UI (creative, framework-agnostic canvas/WebGL effects): https://canvasui.dev/
```

- [ ] **Step 4: Review the English text**

Confirm that the URL appears in the guidance and final list, the fallback is explicit, and no rule makes the library a required dependency.

### Task 3: Validar escopo e paridade bilíngue

**Files:**
- Test: `PT-BR/design-code-pt.md`, `ENG/design-code-eng.md`.

**Interfaces:**
- Consumes: os dois guias editados.
- Produces: diff limpo e evidência de que todos os critérios de aceitação foram cobertos.

- [ ] **Step 1: Verificar URL oficial e salvaguardas**

Run:

```bash
rg -n 'https://canvasui\.dev/|fallback|prefers-reduced-motion|semantic|semântico|dispositivos modestos|modest devices' PT-BR/design-code-pt.md ENG/design-code-eng.md
```

Expected: ambos os guias contêm URL oficial, fallback, movimento reduzido, HTML semântico e orientação para dispositivos modestos/desempenho.

- [ ] **Step 2: Verificar whitespace e inspecionar o diff completo**

Run:

```bash
git diff --check
git diff -- PT-BR/design-code-pt.md ENG/design-code-eng.md
```

Expected: `git diff --check` termina com sucesso, e o diff contém somente as adições planejadas nos dois guias.

- [ ] **Step 3: Confirmar escopo do repositório**

Run:

```bash
git status --short
git diff --name-only
```

Expected: somente `PT-BR/design-code-pt.md` e `ENG/design-code-eng.md` estão modificados para a implementação.

- [ ] **Step 4: Commitar as alterações documentais**

Run:

```bash
git add PT-BR/design-code-pt.md ENG/design-code-eng.md
git commit -m "docs: adicionar referencia do Canvas UI"
```

Expected: um commit é criado contendo apenas os dois guias de design.
