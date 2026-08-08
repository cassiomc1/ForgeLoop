# Liquid Glass Design Guide Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar nos guias PT-BR e EN as distinções, limites e salvaguardas úteis de Liquid Glass Design sem transformar a estética em requisito ou dependência.

**Architecture:** A mudança será exclusivamente documental e manterá os guias como espelhos editoriais. Cada idioma receberá a mesma estrutura: distinção conceitual em cor/profundidade, contrato técnico em 3D/interatividade, orientação de componentes e motion, blacklist/checklist, orientação condicional para Apple e referências oficiais/experimentais.

**Tech Stack:** Markdown, Git, `rg`, `git diff --check`, validação de fences.

## Global Constraints

- Atualizar somente `PT-BR/design-code-pt.md` e `ENG/design-code-eng.md`.
- Não alterar `README.md`, outros guias ou código executável.
- Não adicionar dependências nem recomendar projetos vinculados como dependências obrigatórias.
- Distinguir glassmorphism (`backdrop-filter` estático) de Liquid Glass refrativo; não chamar blur CSS de refração real.
- Limitar material translúcido a uma ou duas superfícies flutuantes de baixa densidade.
- Manter corpo de texto, formulários extensos, preços, estados críticos, decisões e CTAs essenciais em superfícies sólidas/previsíveis e HTML semântico.
- Exigir fallback opaco funcional com os mesmos estados e ações quando WebGL, SVG displacement, filtros, JavaScript ou capacidade do navegador faltarem.
- Respeitar `prefers-reduced-motion`, redução de transparência/alto contraste quando disponível, pausa fora da viewport/aba não visível e medição em dispositivos modestos.
- Tratar Liquid Glass Design como galeria independente de inspiração; não copiar ou redistribuir imagens, prompts ou obras.
- Condicionar APIs nativas Apple a SDK/deployment target e preservar fallback para versões anteriores; não transportar a estética automaticamente para Windows/Android.
- Manter estrutura, significado e links equivalentes entre PT-BR e EN.

---

### Task 1: Atualizar o guia em português

**Files:**
- Modify: `PT-BR/design-code-pt.md`, seções visuais, 3D/interatividade, componentes, motion, Anti-Slop, checklist web, orientação Apple e referências.

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-08-07-liquid-glass-design-design.md` e findings dos agentes.
- Produces: regras PT-BR acionáveis sobre Liquid Glass, sem duplicar o contrato técnico existente.

- [ ] **Step 1: Inserir a distinção conceitual após as regras de profundidade**

```markdown
### Liquid Glass, glassmorphism e translucidez

- **Glassmorphism** é uma aproximação estática: transparência, `backdrop-filter: blur()`, borda sutil e sombra. **Liquid Glass** descreve um material dinâmico que tenta simular refração, realces especulares, tonalidade, sombra e deformação responsivas ao conteúdo ou movimento.
- Não chame blur CSS de refração real. Na web, refração mais fiel exige displacement via SVG ou shaders/WebGL; ambos são aprimoramentos opcionais, mais caros e sujeitos a fallback.
- Reserve transparência/refração para uma ou duas superfícies flutuantes de baixa densidade — navegação contextual, toolbar, tab bar, sheet, popover ou controle pontual. Corpo de texto, formulários extensos, preços, estados críticos, decisões e CTAs essenciais ficam em superfícies sólidas ou de contraste previsível.
- Valide cada estado contra o fundo mais complexo que pode passar atrás da superfície. Vidro sobre vidro, texto longo sobre fundo móvel/refratado e transparência em todas as camadas transformam profundidade em ruído.
```

- [ ] **Step 2: Substituir o parágrafo genérico de Canvas/WebGL por um contrato único**

```markdown
Para efeitos Canvas, WebGL, SVG displacement ou Liquid Glass, detecte a capacidade antes de carregar shaders, limite resolução/DPR, filtros multipasse e superfícies animadas, inicialize sob demanda, pause fora da viewport e quando a página não estiver visível, e simplifique/desative em dispositivos modestos. Sem o efeito, renderize uma superfície HTML/CSS opaca com o mesmo conteúdo, foco, hover, pressed, disabled, erro, sucesso, seleção e ação.
```

- [ ] **Step 3: Adicionar a superfície opcional e as regras de motion**

```markdown
**Superfície Liquid Glass (opcional)**

- Use em controles ou navegação contextual com conteúdo curto; mantenha o elemento real, focável e acionável em HTML.
- Prefira forma simples, tint/blur/realce discretos e estados de foco convencionais. Deformação, elasticidade, brilho e pointer tracking são acabamento, não affordance nem requisito de interação.
- Não aplique aberração cromática, distorção ou reflexão sobre texto legível, ícones essenciais, campos, tabelas ou mensagens de estado.
```

```markdown
Em superfícies Liquid Glass, reduza elasticidade, morphing, brilho e reação ao cursor/toque a movimentos curtos e pausáveis. Com `prefers-reduced-motion: reduce`, use uma superfície estática; compreensão, foco e ação devem permanecer idênticos.
```

- [ ] **Step 4: Reforçar blacklist e checklist web**

Adicionar à blacklist: glass sobre glass; mais de duas camadas translúcidas sem função semântica; texto longo sobre fundo móvel/refratado; aberração cromática em conteúdo legível; vídeo decorativo atrás de controles; blur-only apresentado como refração; dependência de brilho, transparência, movimento ou mouse para comunicar estado.

Adicionar ao checklist:

```markdown
- [ ] Validei contraste e legibilidade no pior fundo possível e em zoom de 200%.
- [ ] A interface preserva conteúdo, foco, estados e ações sem WebGL, SVG displacement, transparência ou motion.
- [ ] Há no máximo duas camadas translúcidas concorrendo na mesma tela e cada uma tem função contextual clara.
```

- [ ] **Step 5: Condicionar Apple e registrar fontes**

Adicionar às orientações nativas: quando SDK e deployment target suportarem o material atual da Apple, preferir APIs nativas e respeitar HIG, Reduce Transparency e Increase Contrast; em versões anteriores usar superfícies convencionais legíveis; não impor o material a Windows/Android.

Adicionar às fontes:

```markdown
- Liquid Glass Design (galeria e guia conceitual; inspiração, não especificação nem banco de assets): https://liquidglassdesign.com/
- Liquid Glass Design — guia sobre material, glassmorphism e implementação web: https://liquidglassdesign.com/what-is-liquid-glass
- Liquid Glass Design — recursos de design e desenvolvimento: https://liquidglassdesign.com/resources
- Apple — Adopting Liquid Glass (referência normativa para plataformas Apple): https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass
- Liquid Glass React, SVG e Studio (implementações experimentais; avaliar licença, compatibilidade, peso e manutenção): https://github.com/rdev/liquid-glass-react | https://github.com/shuding/liquid-glass | https://github.com/iyinchao/liquid-glass-studio
```

- [ ] **Step 6: Revisar o guia PT-BR**

Confirmar que não há promessa de suporte universal, uso da galeria como banco de assets ou obrigação de adotar Liquid Glass.

### Task 2: Atualizar o guia em inglês

**Files:**
- Modify: `ENG/design-code-eng.md`, as seções equivalentes às da Task 1.

**Interfaces:**
- Consumes: a estrutura final da Task 1, a especificação e os mesmos findings de pesquisa.
- Produces: regras EN equivalentes às do guia PT-BR.

- [ ] **Step 1: Add the conceptual distinction**

Add the equivalent English block after the depth rules, explicitly stating that glassmorphism is static `backdrop-filter` blur, Liquid Glass attempts dynamic refraction, and CSS blur must not be called real refraction. Limit it to one or two low-density floating surfaces and keep body copy, long forms, prices, critical states, decisions, and essential CTAs on solid/predictable surfaces.

- [ ] **Step 2: Replace the generic Canvas/WebGL paragraph**

Add the equivalent English contract requiring capability detection before shaders, resolution/DPR and multipass limits, on-demand initialization, pause when offscreen/hidden, simplification on modest devices, and an opaque HTML/CSS fallback with identical content and interaction states.

- [ ] **Step 3: Add the optional component and motion rules**

Add the equivalent English component block: short contextual controls in real focusable HTML, restrained tint/blur/highlights, conventional focus, and no chromatic aberration/distortion/reflection on readable content. State that elasticity, morphing, glare, and pointer tracking are optional, short, pausable finish and become static under reduced motion.

- [ ] **Step 4: Add blacklist and checklist items**

Add the equivalent English prohibitions and the three web checklist lines for worst-background/200% validation, operation without effects, and no more than two competing translucent layers.

- [ ] **Step 5: Add conditional Apple guidance and equivalent references**

Add the equivalent English Apple caveat and the same five URLs/implementation caveats as Task 1.

- [ ] **Step 6: Review the English guide**

Confirm no universal-support promise, asset-source interpretation, or mandatory Liquid Glass adoption.

### Task 3: Validate bilingual parity and scope

**Files:**
- Test: `PT-BR/design-code-pt.md`, `ENG/design-code-eng.md`.

**Interfaces:**
- Consumes: the two edited guides.
- Produces: evidence that all specification criteria are covered and no unrelated file changed.

- [ ] **Step 1: Verify concepts, safeguards, and links**

Run:

```bash
rg -n 'Liquid Glass|glassmorphism|backdrop-filter|SVG displacement|WebGL|prefers-reduced-motion|200%|liquidglassdesign\\.com|adopting-liquid-glass|rdev/liquid-glass-react|shuding/liquid-glass|iyinchao/liquid-glass-studio' PT-BR/design-code-pt.md ENG/design-code-eng.md
```

Expected: both guides contain the distinction, limits, fallback/performance/accessibility rules, checklist additions, Apple caveat, and all reference URLs.

- [ ] **Step 2: Verify Markdown and whitespace**

```bash
git diff --check
for f in PT-BR/design-code-pt.md ENG/design-code-eng.md; do n=$(awk '/^```/{c++} END{print c+0}' "$f"); test $((n % 2)) -eq 0; done
```

Expected: no whitespace errors and balanced fences in both guides.

- [ ] **Step 3: Verify scope and parity**

```bash
git diff --name-only
git diff --stat
```

Expected: only `PT-BR/design-code-pt.md` and `ENG/design-code-eng.md` are modified, with equivalent insertion blocks and no README/spec/plan edits during implementation.

- [ ] **Step 4: Commit the guide changes**

```bash
git add PT-BR/design-code-pt.md ENG/design-code-eng.md
git commit -m "docs: aprofundar orientação de Liquid Glass"
```

Expected: one commit contains only the two design guides.
