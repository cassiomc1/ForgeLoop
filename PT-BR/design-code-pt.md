---
name: web-design-premium-v2
description: 'Guia premium para direção visual, UX, motion e performance em experiências digitais sofisticadas — web desktop, web mobile, apps nativos iOS/Android e apps desktop Windows/macOS. Use SEMPRE que for criar, redesenhar ou revisar uma landing page, site institucional, produto digital ou aplicativo que precise parecer premium/high-end.'
---

# Web Design Premium v2 — Diretrizes Práticas

> Este guia é uma RECEITA, não uma sugestão. Onde houver um valor numérico, uma paleta ou um snippet, USE exatamente o que está aqui, a menos que o usuário peça explicitamente algo diferente. Não invente valores "no olho". Isso existe para que qualquer execução (mesmo sem julgamento estético refinado) resulte em algo premium.

> **Documentos relacionados**: para o processo completo de produção de sites em nível de estúdio, ver [`premium-sites-studio-pt.md`](./premium-sites-studio-pt.md). Para qualidade/estrutura do código que implementa este design, ver [`clean-code-pt.md`](./clean-code-pt.md). Para testes de acessibilidade/visual/E2E, ver [`test-code-pt.md`](./test-code-pt.md). Para segurança de formulários, autenticação e armazenamento no cliente, ver [`sec-code-pt.md`](./sec-code-pt.md). Para transformar direção visual em vídeo HTML, consulte o [HyperFrames](https://hyperframes.heygen.com). Este arquivo foca exclusivamente em UI/UX/visual — não repete regras de código, teste ou segurança.

> **Ferramentas obrigatórias**: se qualquer ferramenta, dependência, runtime, CLI ou utilitário necessário para executar este guia (linter, formatter, framework de teste, scanner, profiler, engine, etc.) não estiver instalado no ambiente, **solicite a instalação ao usuário imediatamente** (ou instale com aprovação, conforme a política do ambiente). Nenhuma etapa, verificação ou entrega pode ser pulada, adiada ou substituída por "a ferramenta não está instalada" — a tarefa só está completa quando todas as verificações exigidas foram de fato executadas.

## Como usar este guia (processo obrigatório)

Siga esta ordem sempre que criar uma página do zero:

1. **Escolher 1 paleta pronta** da seção "Paletas Prontas" (não misturar paletas).
2. **Escolher 1 combinação tipográfica pronta** da seção "Combinações Tipográficas".
3. **Definir a lista de seções** da página usando a "Anatomia de Página Premium".
4. **Aplicar o grid e os espaçamentos** exatos da seção "Layout & Espaçamento".
5. **Aplicar componentes** (botões, cards, nav) com os specs exatos da seção "Componentes".
6. **Adicionar motion** apenas conforme os snippets da seção "Motion" — nunca motion "criativo" fora do padrão.
7. **Rodar o Checklist Anti-Slop** antes de considerar pronto.
8. **Auditar e polir a interface inteira com Impeccable**: executar `/impeccable audit` para identificar problemas de qualidade e `/impeccable polish` para aplicar melhorias. Avaliar a interface completa, não apenas um componente, preservar o design system existente e repetir a auditoria após os ajustes.

Nunca pule a etapa 1 e 2. A maior causa de resultado "amador" é misturar paletas/fontes aleatórias ou usar defaults do framework (ex.: azul Bootstrap, Inter em tudo, sombra genérica `box-shadow: 0 0 10px rgba(0,0,0,0.1)`).

> **Este guia cobre 3 contextos.** Para site/produto web (desktop e mobile), siga o fluxo acima normalmente. Para **apps nativos mobile** (iOS/Android), vá direto para a seção "Apps Mobile Premium". Para **apps desktop nativos** (Windows/macOS), vá para "Apps Desktop Premium". Nesses dois últimos casos, as paletas e tipografia deste guia ainda servem de referência de tom, mas as diretrizes de plataforma (HIG, Material Design, Fluent) têm prioridade sobre os valores genéricos definidos aqui.

---

## Princípios (Anti-Slop)

- Menos elementos, mais intenção: cada bloco deve ter função clara.
- Evitar aparência de template: variar composição, ritmo e hierarquia entre seções (nunca repetir o mesmo layout de seção 2x seguidas).
- Consistência visual acima de efeitos: motion e 3D devem reforçar narrativa, não distrair.
- Acabamento premium = detalhe refinado em tipografia, espaçamento, contraste e microinterações — não em quantidade de elementos.
- **Regra de ouro do espaço em branco**: se está em dúvida se tem espaço demais, tem espaço de menos. Sites premium respiram.

---

## Paletas Prontas (escolha 1, não misture)

Cada paleta tem: fundo, texto, primária, neutra de apoio, acento (uso raro, <5% da UI).

**A. Editorial Escuro (moda, arquitetura, luxo)**

- Fundo: `#0B0B0C` | Fundo alt: `#141416`
- Texto: `#F5F4F1` | Texto secundário: `#A8A7A3`
- Primária: `#C9A876` (dourado fosco)
- Borda/divisor: `#2A2A2C`
- Acento (uso raro): `#D14F3E`

**B. Clean Corporativo Claro (SaaS, fintech premium)**

- Fundo: `#FAFAF8` | Fundo alt: `#F0EFEB`
- Texto: `#141414` | Texto secundário: `#5C5C5C`
- Primária: `#1F3D2B` (verde profundo)
- Borda/divisor: `#E3E1DB`
- Acento (uso raro): `#C4623A`

**C. Neutro Quente Minimal (estúdios, portfólio, branding)**

- Fundo: `#F7F5F2` | Fundo alt: `#EDEAE4`
- Texto: `#1C1B19` | Texto secundário: `#726F68`
- Primária: `#3D3A34` (marrom quase preto)
- Borda/divisor: `#DEDAD2`
- Acento (uso raro): `#8A6E4B`

**D. Tech Escuro Vibrante (produto digital, IA, dev tools)**

- Fundo: `#08090C` | Fundo alt: `#101218`
- Texto: `#EDEEF0` | Texto secundário: `#8A8F98`
- Primária: `#6E6AF5` (índigo)
- Borda/divisor: `#1F2128`
- Acento (uso raro): `#3EDBB8`

Regras de uso de cor:

- Primária: usada em CTAs, links ativos, ícones-chave. Máx. 10% da área visível.
- Acento: usado 1–2 vezes por página inteira (ex.: um único badge, um único highlight).
- Nunca usar mais de 4 cores distintas na paleta total (contando neutros).
- Nunca usar gradiente com mais de 2 cores; opacidade do gradiente sempre entre 5%–20% quando sobre fundo sólido.

---

## Combinações Tipográficas Prontas (escolha 1)

Formato: Display (headings) + Texto (body). Todas via Google Fonts, gratuitas.

1. **Editorial clássico**: `Fraunces` (display, serif, pesos 400/600) + `Inter` (body).
2. **Luxo moderno**: `Playfair Display` (display) + `Manrope` (body).
3. **Tech/produto**: `General Sans` ou `Space Grotesk` (display) + `Inter` (body).
4. **Minimal quente**: `Instrument Serif` (display, só para títulos grandes) + `Sans` neutra tipo `Public Sans` (body).
5. **Bold contemporâneo**: `Clash Display` (display) + `Satoshi` (body).

Regras:

- Nunca usar mais de 2 famílias tipográficas na página inteira.
- Nunca usar a fonte display para parágrafos longos (só H1/H2/blocos curtos de destaque).
- Escala tipográfica (rem, base 16px):
  - H1: `clamp(2.75rem, 5vw, 5rem)`, line-height `1.05`, letter-spacing `-0.02em`
  - H2: `clamp(2rem, 3.5vw, 3rem)`, line-height `1.1`, letter-spacing `-0.01em`
  - H3: `clamp(1.5rem, 2.2vw, 2rem)`, line-height `1.2`
  - Body: `1.125rem` (18px), line-height `1.6`
  - Small/legenda: `0.875rem`, line-height `1.5`
- Largura máxima de texto corrido: `65ch`.
- Peso de fonte: títulos 500–700, body 400–450 (nunca 300 para corpo, prejudica legibilidade).

---

## Layout & Espaçamento (valores exatos)

- Container máximo: `1280px`, centralizado, padding lateral `clamp(24px, 6vw, 96px)`.
- Grid: 12 colunas, gap `24px` desktop / `16px` mobile.
- Escala de espaçamento (usar SEMPRE múltiplos desta escala, nunca valores arbitrários):
  `4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192px`
- Espaçamento vertical entre seções: mínimo `96px` mobile, `160px` desktop.
- Espaçamento interno de seção (padding top/bottom): `64px` mobile, `120px` desktop.
- Breakpoints: mobile `< 640px`, tablet `640–1024px`, desktop `> 1024px`.
- Ritmo: alternar entre seções "densas" (texto + imagem + CTA) e seções "vazias" (uma frase grande centralizada, muito espaço). Regra prática: a cada 2 seções densas, 1 seção de respiro.
- Border-radius consistente: escolher 1 valor de escala e usar em tudo — `8px` (sóbrio/corporativo) ou `16px` (suave/produto) ou `2px` (editorial/luxo). Nunca misturar radius diferentes no mesmo projeto.
- Sombra padrão (usar só 1 receita por projeto, aplicada com consistência):
  - Sutil: `0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)`
  - Elevada (modais/dropdowns): `0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)`

---

## Web Mobile — Especificidades (não é só "encolher o desktop")

Um site premium em mobile não é o layout desktop reduzido — a hierarquia, a densidade e a interação mudam.

- **Viewport**: sempre `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- **Safe areas**: usar `env(safe-area-inset-top/bottom/left/right)` em elementos fixos (nav, CTA sticky) para respeitar notch/ilha dinâmica/home indicator.
- **Toque, não hover**: todo elemento interativo com área mínima `44x44px` de toque real, mesmo que o elemento visual seja menor (usar padding invisível para compensar).
- **Nunca depender de hover** para revelar informação ou interação essencial (tooltips, menus dropdown) — sempre ter equivalente por toque/clique.
- **Nav mobile**: preferir menu hambúnguer fullscreen (ver seção Componentes) ou bottom nav fixo para apps web/PWA com poucas seções (3–5 itens).
- **CTA sticky**: em páginas de conversão longas, considerar CTA fixo no rodapé da viewport mobile (barra com 1 botão, altura `56–64px`, sombra sutil para cima), com `env(safe-area-inset-bottom)` no padding.
- **Densidade de conteúdo**: reduzir para 1 coluna, headline menor que a escala desktop mas ainda dominante (usar `clamp()` já definido — nunca fixar `px` fixo que ignore o clamp).
- **Formulários**: inputs com `font-size` mínimo `16px` (evita zoom automático do iOS Safari), `inputmode`/`type` corretos (`email`, `tel`, `numeric`) para teclado contextual.
- **Performance mobile-first**: testar sempre em throttle de rede 4G/3G simulada; imagens no mobile devem ser variantes menores via `srcset`, nunca a mesma imagem do desktop redimensionada por CSS.
- **Gestos**: swipe em carrosséis/galerias deve ter fallback de dots/setas visíveis; nunca depender só do gesto sem indicação visual de que existe mais conteúdo.

---

## Anatomia de Página Premium (ordem recomendada)

Use como esqueleto padrão para landing pages; adapte conforme o produto, mas mantenha a lógica de "abrir forte → provar → converter".

1. **Nav**: logo esquerda, 3–5 links no centro/direita, 1 CTA destacado. Fixa ou com fundo transparente que ganha blur ao rolar.
2. **Hero**: 1 headline forte (máx. 8–10 palavras), 1 subheadline (1–2 frases), 1 CTA primário + 1 secundário (texto/link). Nunca mais de 2 CTAs no hero.
3. **Prova social leve**: logos de clientes/imprensa em escala de cinza, linha única, sem enfeite.
4. **Seção de valor (2–3 blocos)**: cada bloco = 1 ideia, ícone ou imagem simples, título curto, 1–2 linhas de texto.
5. **Seção de produto/demonstração**: screenshot real, mockup ou vídeo curto — nunca ilustração genérica de banco de imagens.
6. **Depoimentos ou dados/números**: 2–4 depoimentos reais OU 3–4 métricas grandes com números.
7. **CTA de conversão intermediária**: seção de respiro, frase grande centralizada + 1 botão.
8. **FAQ** (se aplicável): acordeão simples, 4–6 perguntas.
9. **CTA final**: repetir a proposta de valor central + botão primário.
10. **Footer**: colunas de links organizadas, redes sociais, copyright. Sem excesso de colunas (máx. 4).

Regra: nunca repetir o mesmo padrão de "imagem esquerda + texto direita" em 2 seções consecutivas — alternar lado, ou trocar por layout centralizado.

---

## Cor, Contraste e Profundidade

- Contraste mínimo AA: texto normal ≥ 4.5:1, texto grande (≥24px) ≥ 3:1.
- Fundos suaves e gradientes discretos (opacidade 5–20%, sem banding).
- Profundidade construída com camadas leves: blur (`8–24px`), sombra sutil, sobreposição controlada — nunca sombras duras (`0 0 20px black`).

---

## Motion (GSAP / ScrollTrigger)

Usar SEMPRE este padrão base de reveal (não inventar variações):

```js
gsap.registerPlugin(ScrollTrigger);

gsap.utils.toArray('[data-reveal]').forEach((el) => {
  gsap.from(el, {
    y: 24,
    opacity: 0,
    duration: 0.8,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: el,
      start: 'top 85%',
      toggleActions: 'play none none none',
    },
  });
});
```

### Motion para vídeo com HyperFrames (opcional)

Quando o destino for um vídeo, trailer, demonstração ou motion graphic renderizado a partir de HTML, CSS e JavaScript, considere o [HyperFrames](https://hyperframes.heygen.com). Ele complementa — não substitui — as regras visuais deste guia.

- Preserve os tokens de marca (paleta, tipografia, espaçamento e raio) ao adaptar a interface para o frame; evite simplesmente capturar a página inteira.
- Prefira animações determinísticas e controláveis por frame, com timeline pausada/seekable, para que preview, testes e render reproduzam o mesmo resultado.
- Mantenha texto grande o bastante para o formato de saída, contraste AA, área segura e leitura sem depender de áudio ou movimento.
- Respeite `prefers-reduced-motion` no preview interativo e ofereça uma versão estática ou reduzida para pessoas que optarem por menos movimento.
- Comece pelo [quickstart oficial](https://hyperframes.heygen.com/quickstart) e use `npx hyperframes preview`, `npx hyperframes lint` e `npx hyperframes render` no ciclo de qualidade quando o projeto usar a CLI.

Regras de motion:

- Deslocamento vertical: `16–32px` (nunca mais que isso — evita efeito "voando").
- Duração: `0.6–0.9s` para reveals, `0.2–0.35s` para hover/microinterações.
- Easing: `power3.out` ou `expo.out` para entradas; `power2.inOut` para transições de estado.
- Stagger entre elementos de uma lista: `0.06–0.1s`.
- Nunca: bounce, elastic, rotação exagerada, parallax agressivo (>30% da velocidade de scroll), auto-play de vídeo com som, loops decorativos infinitos que competem com o conteúdo.
- Sempre envolver toda a lógica de motion em:

```js
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // inicializar animações
}
```

---

## 3D e Interatividade (Three.js) — opcional, só se justificado

- Usar apenas se reforça o produto/narrativa (ex.: produto físico, dado técnico, marca de tecnologia). Se não tem certeza que ajuda, não usar.
- Manter elementos sutis: partículas leves, formas simples, iluminação suave.
- Sempre fornecer fallback 2D (imagem estática) para navegadores sem WebGL e para `prefers-reduced-motion`.
- Limitar: <5000 partículas, sem pós-processamento pesado (bloom pode ficar, SSAO/motion blur evitar).
- Pausar renderização quando o canvas sair da viewport (`IntersectionObserver`).

Para efeitos Canvas UI e WebGL, forneça fallback funcional quando o recurso não estiver disponível, respeite `prefers-reduced-motion`, pause o trabalho fora da viewport e teste em navegadores e dispositivos modestos. A interface deve continuar compreensível e utilizável sem o efeito.

---

## Componentes Premium (specs exatos)

**Botão primário**

- Padding: `14px 28px` (mobile `12px 24px`)
- Border-radius: igual ao radius escolhido no projeto
- Font-weight: 500–600, font-size `1rem`
- Transição: `all 0.2s ease` (cor de fundo + leve `translateY(-1px)` no hover)
- Área mínima de toque: `44x44px`
- Estado de foco: outline visível (`2px solid`, cor primária, offset `2px`) — nunca `outline: none` sem substituto.

**Cards**

- Padding interno: `32px` (mobile `24px`)
- Borda: `1px solid` cor de borda da paleta, OU sombra sutil — escolher 1 dos dois, não ambos.
- Radius: igual ao padrão do projeto.
- Hover (se clicável): elevação sutil (sombra elevada) + `translateY(-2px)`, transição `0.25s ease`.

**Navegação**

- Altura: `72–88px` desktop, `64px` mobile.
- Item ativo: sublinhado sutil ou cor primária — nunca fundo colorido cheio.
- Menu mobile: fullscreen overlay, transição de fade+slide `0.3s`.

**Imagens**

- Sempre `object-fit: cover` com `aspect-ratio` fixo por contexto (ex.: `16/10` para cards, `1/1` para avatares).
- `border-radius` consistente com o resto da UI.
- Nunca esticar/distorcer imagem.

**Efeitos canvas/WebGL opcionais**

- Para momentos de alto impacto — como hero, revelações e interações especiais — consulte [Canvas UI](https://canvasui.dev/) como fonte de componentes canvas/WebGL copiáveis e adaptáveis.
- Use o efeito somente quando ele reforçar a narrativa; adapte tokens, composição e comportamento à identidade do projeto em vez de copiar o resultado padrão.
- Mantenha texto, navegação, controles e qualquer ação essencial como HTML semântico e acessível; o canvas é aprimoramento progressivo, nunca o único canal de comunicação.

**Bibliotecas de UI e visualização de dados**

- Para componentes web acessíveis, composáveis e customizáveis, consulte [shadcn/ui](https://ui.shadcn.com/); adapte tokens, estados e composição ao sistema visual do projeto em vez de copiar defaults sem intenção.
- Para gráficos e visualizações de dados, consulte [TanStack Charts](https://github.com/TanStack/charts); preserve responsividade, contraste, leitura por teclado e não dependa apenas de cor para comunicar séries ou estados.
- Para sons de interação sutis, consulte [Cuelume](https://cuelume-site.pages.dev/); ofereça controle de volume/silêncio e nunca dependa de áudio para comunicar informação essencial.

---

## UX, Acessibilidade e Qualidade

- Navegação por teclado 100% funcional, foco sempre visível, sem armadilhas de interação.
- Contraste AA mínimo (ver seção Cor).
- Nunca comunicar estado só por cor (adicionar ícone, texto ou padrão).
- Testar em zoom 200% e em telas de 360px de largura.
- Todo `<img>` com `alt` descritivo; ícones decorativos com `aria-hidden="true"`.

---

## Performance

- Animar apenas `transform` e `opacity`; usar `will-change` com parcimônia (remover após a animação).
- Imagens em `WebP`/`AVIF`, `srcset` + `loading="lazy"` (exceto imagem do hero, que deve ser eager/preload).
- Fontes: `font-display: swap`, preload só da fonte crítica do hero (1–2 arquivos, no máx.).
- Orçamento de performance: LCP < 2.5s, CLS < 0.1, JS de motion/3D não deve bloquear o carregamento inicial (carregar via `defer`/lazy-init após interação ou scroll).

---

## Lista Negra — Anti-Padrões (nunca fazer)

- Azul genérico de framework (`#007BFF`, `#3B82F6` default) como cor primária sem intenção.
- Sombra genérica `box-shadow: 0 0 10px rgba(0,0,0,0.1)` em tudo.
- `Inter` ou `Roboto` como única fonte do site inteiro sem fonte display.
- Ícones de banco de stock genéricos (setas 3D, emojis de foguete, "lightbulb").
- Textos centralizados em blocos longos de parágrafo.
- Mais de 3 fontes ou mais de 4 cores.
- Seções todas com o mesmo padrão de grid/alinhamento (visual de "template clonado").
- Animação de "fade in" idêntica aplicada indiscriminadamente a TUDO sem hierarquia de timing.
- Botões sem estado de hover/focus perceptível.
- Excesso de badges, tags e "glassmorphism" decorativo sem função.
- Rodapé com 6+ colunas de links irrelevantes só para preencher espaço.

---

## Checklist de Revisão (antes de publicar)

- [ ] Escolhi 1 paleta pronta e não misturei cores fora dela.
- [ ] Usei no máximo 2 famílias tipográficas, seguindo a escala definida.
- [ ] O espaçamento entre seções segue a escala (mínimo 96–160px).
- [ ] Nenhuma seção repete o mesmo layout da anterior.
- [ ] Cada seção tem 1 propósito e (quando aplicável) 1 CTA claro.
- [ ] Motion segue os snippets/padrões definidos, respeita `prefers-reduced-motion`.
- [ ] Contraste de texto passa AA.
- [ ] Botões/links têm foco visível e hover perceptível.
- [ ] Página funciona (visualmente e funcionalmente) sem JS de motion/3D.
- [ ] Nenhum item da "Lista Negra" está presente.
- [ ] Testado em mobile (360px) e desktop (1440px).
- [ ] Executei `/impeccable audit` e `/impeccable polish` na interface inteira e corrigi os achados aplicáveis.

---

## Apps Mobile Premium (iOS & Android)

> Apps nativos NÃO seguem as diretrizes de paleta/tipografia web deste guia à risca. A prioridade é a linguagem de design da plataforma (Apple HIG / Material Design 3), garantindo que o app pareça "nativo premium", não um site empacotado.

### iOS (Human Interface Guidelines)

- **Tipografia**: fonte do sistema `SF Pro` (Display para títulos grandes, Text para corpo). Usar os estilos dinâmicos do sistema (Dynamic Type) em vez de tamanhos fixos, para suportar acessibilidade:
  - Large Title `34pt`, Title 1 `28pt`, Title 2 `22pt`, Title 3 `20pt`
  - Headline `17pt` (semibold), Body `17pt`, Callout `16pt`, Subhead `15pt`
  - Footnote `13pt`, Caption `12pt`
- **Espaçamento**: grid de `8pt`. Margens seguras de tela: `16–20pt`. Respeitar sempre as *safe areas* (notch, Dynamic Island, home indicator) via `safeAreaInsets`.
- **Navegação**: Tab Bar inferior para até 5 destinos principais; Navigation Bar superior com Large Title que colapsa ao rolar. Evitar navegação em gaveta lateral (drawer) — não é padrão iOS.
- **Componentes**: usar controles nativos (`UIButton`, `UISwitch`, `UISegmentedControl` ou equivalentes SwiftUI) e ícones `SF Symbols` (nunca ícones customizados quando um SF Symbol equivalente existir).
- **Área de toque mínima**: `44x44pt`.
- **Cor**: definir cores semânticas (`label`, `secondaryLabel`, `systemBackground`) que se adaptam automaticamente a Light/Dark Mode — nunca hardcode de cor absoluta em elementos de sistema.
- **Motion**: usar curvas de mola (spring) nativas do UIKit/SwiftUI, duração `0.3–0.35s` para transições de tela, `0.2s` para microinterações. Usar haptics (`UIImpactFeedbackGenerator`) com moderação, só em ações significativas (confirmação, erro, sucesso).
- **Modais e sheets**: usar `sheet`/`.presentationDetents` (bottom sheet nativo) em vez de modais customizados sempre que possível.

### Android (Material Design 3 / Material You)

- **Tipografia**: `Roboto` (ou fonte de marca registrada no tema) seguindo a escala de tipo M3: Display, Headline, Title, Body, Label (cada uma com variante Large/Medium/Small).
- **Espaçamento**: grid de `8dp`, margens de tela `16dp` (`24dp` em telas grandes/tablet).
- **Navegação**: Bottom Navigation Bar (3–5 destinos) em telefones; Navigation Rail ou Navigation Drawer em tablets/telas grandes. Top App Bar com título e ações contextuais.
- **Componentes**: usar componentes Material 3 (`FilledButton`, `FAB`, `Card`, `Chip`, `NavigationBar`) com *tonal elevation* (superfícies com camadas de cor, não só sombra). Considerar cor dinâmica (Material You) quando fizer sentido para o produto.
- **Área de toque mínima**: `48x48dp`.
- **Tema escuro**: obrigatório suportar (`isSystemInDarkTheme()` / `DayNight` theme), não é opcional em produtos premium Android.
- **Motion**: usar curvas de easing M3 (`emphasized`, `standard`), durações `200–500ms` conforme o tamanho da transição (pequena → rápida, tela inteira → mais longa). Transições de containers (`Container Transform`) para navegação entre card e detalhe.
- **Ícones**: `Material Symbols` (outlined por padrão, filled para estado ativo/selecionado). Para busca e descoberta de ícones web/app, consulte também [Koboyo Icons](https://koboyo.com/icons).

### Regras comuns a ambas as plataformas

- Nunca clonar 100% o visual de uma plataforma na outra (ex.: Tab Bar estilo iOS dentro do app Android). Adaptar a mesma marca/paleta à linguagem nativa de cada SO.
- Onboarding: máximo 3–4 telas, sempre com opção de pular.
- Estados vazios, de erro e de carregamento (skeleton screens) são obrigatórios em toda tela com dados assíncronos — nunca deixar tela em branco durante loading.
- Testar em pelo menos 1 device pequeno (ex.: iPhone SE / Android compacto) e 1 grande (Pro Max / tablet Android).
- Gestos do sistema (voltar por swipe, notification shade) nunca podem ser bloqueados por overlays do app.
- Ícone do app e splash screen seguem os grids oficiais de cada plataforma (App Icon grid da Apple; Adaptive Icon do Android com camadas foreground/background).

**Checklist rápido — Apps Mobile**

- [ ] Usei componentes/navegação nativos da plataforma (Tab Bar no iOS, Bottom Nav/Rail no Android), não um híbrido genérico.
- [ ] Dynamic Type (iOS) / escala de fonte do sistema (Android) funcionam sem quebrar layout.
- [ ] Dark Mode implementado e testado em ambas plataformas.
- [ ] Áreas de toque ≥ 44pt (iOS) / 48dp (Android).
- [ ] Estados de loading, vazio e erro cobertos em todas as telas com dados.
- [ ] Safe areas respeitadas (notch, gestos do sistema, home indicator).

---

## Apps Desktop Premium (Windows & macOS)

> Assim como mobile, apps desktop nativos devem seguir a linguagem visual do sistema operacional. Um app "premium" em desktop parece parte do SO, não uma janela de site redimensionada.

### Windows (Fluent Design / WinUI 3)

- **Tipografia**: `Segoe UI Variable` (Display para títulos, Text para corpo), seguindo a Type Ramp do Fluent (Display, Title Large, Title, Subtitle, Body Large, Body, Caption).
- **Espaçamento**: grid de `4px`/`8px`. Padding de conteúdo padrão `24px` em painéis principais.
- **Navegação**: `NavigationView` com rail/painel esquerdo recolhível para apps com múltiplas seções; barra de título customizada opcional, mas sempre com os controles padrão (minimizar/maximizar/fechar) no canto correto.
- **Materiais**: usar `Mica` (janela principal) ou `Acrylic` (painéis flutuantes, flyouts) para profundidade translúcida sutil — não abusar, aplicar só em 1–2 camadas por tela.
- **Componentes**: controles Fluent nativos (`Button`, `ToggleSwitch`, `NavigationView`, `InfoBar`), radius `4–8px`, respeitando o tema claro/escuro do sistema (`Windows.UI.ViewManagement`).
- **Teclado e acessibilidade**: navegação 100% via `Tab`/setas, atalhos com aceleradores (`Alt` sublinha a letra do menu), tooltips em todo controle sem texto visível.
- **Escala**: testar em 100%, 125%, 150% e 200% de escala do Windows (DPI scaling) sem cortar texto/ícones.

### macOS (Human Interface Guidelines)

- **Tipografia**: `SF Pro` (Display/Text), respeitando os tamanhos de texto do sistema; suportar preferências de tamanho de texto do usuário quando aplicável.
- **Espaçamento**: grid de `8pt`, margens generosas (macOS tende a ter mais respiro que Windows). Padding de conteúdo `20–24pt`.
- **Navegação**: `NSSplitView`/sidebar à esquerda + toolbar superior contextual; menu bar do sistema (topo da tela) deve conter todos os comandos principais do app, não só atalhos escondidos na UI.
- **Janela**: respeitar os controles semáforo (fechar/minimizar/maximizar) nativos, cantos arredondados do sistema, e suportar tela cheia nativa (`Full Screen` do macOS) e Split View do sistema.
- **Materiais**: `vibrancy`/blur (`NSVisualEffectView`) em sidebars e painéis flutuantes, com moderação.
- **Componentes**: controles nativos AppKit/SwiftUI para macOS (não reaproveitar componentes de iOS sem adaptação — macOS tem densidade e affordances diferentes, ex.: uso de mouse/trackpad, hover states existem aqui ao contrário do mobile).
- **Atalhos de teclado**: todo comando relevante deve ter atalho `Cmd+`, exibido no próprio menu. Suporte total a navegação por teclado.
- **Cor de destaque (Accent Color)**: respeitar a cor de destaque escolhida pelo usuário no sistema quando fizer sentido para o produto, em vez de forçar sempre a cor de marca em todos os controles nativos.

### Regras comuns a ambas as plataformas

- Suportar redimensionamento de janela com um layout mínimo definido (nunca permitir que a UI quebre abaixo de um tamanho mínimo razoável, ex. `960x600px`).
- Persistir preferências do usuário (tamanho/posição de janela, tema, painéis abertos) entre sessões.
- Dark Mode e Light Mode obrigatórios, seguindo a preferência do sistema por padrão, com opção de override manual.
- Feedback visual imediato para toda ação (hover, pressed, disabled, loading) — em desktop, hover é uma affordance válida e esperada, ao contrário do mobile.
- Menus contextuais (clique direito) devem expor as ações mais usadas daquele elemento.
- Nunca usar apenas modais customizados quando o padrão do SO (diálogos nativos de arquivo, alertas do sistema) resolve com mais familiaridade para o usuário.

**Checklist rápido — Apps Desktop**

- [ ] Layout, tipografia e materiais seguem a linguagem nativa (Fluent no Windows, HIG no macOS), não um híbrido genérico entre os dois.
- [ ] Janela é redimensionável com mínimo definido e sem quebra de layout.
- [ ] Dark Mode e Light Mode funcionam seguindo a preferência do sistema.
- [ ] Navegação 100% por teclado, com atalhos visíveis nos menus.
- [ ] Estados de hover/pressed/disabled/loading implementados (desktop tem cursor/hover).
- [ ] Testado em pelo menos 2 escalas de DPI (Windows) ou 2 tamanhos de tela (macOS).

---

## Fontes e Referências (Skills Base)

- TasteSkill / Anti-Slop: https://github.com/Leonxlnx/taste-skill | https://www.tasteskill.dev/
- Emil Kowalski (Design Engineering / Motion): https://github.com/emilkowalski/skills
- GSAP: https://github.com/greensock/gsap-skills
- ScrollWorld: https://github.com/oso95/scroll-world
- Three.js: https://threejs.org/
- HyperFrames (vídeo e motion HTML): https://hyperframes.heygen.com/ | https://github.com/heygen-com/hyperframes
- Koboyo Icons (Busca e Referência de Ícones): https://koboyo.com/icons
- Apple Human Interface Guidelines (iOS/macOS): https://developer.apple.com/design/human-interface-guidelines/
- Material Design 3 (Android): https://m3.material.io/
- Microsoft Fluent Design / WinUI 3 (Windows): https://learn.microsoft.com/windows/apps/design/
- shadcn/ui (componentes web acessíveis e composáveis): https://ui.shadcn.com/
- TanStack Charts (visualização de dados): https://github.com/TanStack/charts
- Cuelume (sons de interação para web): https://cuelume-site.pages.dev/
- Canvas UI (efeitos canvas/WebGL criativos e agnósticos de framework): https://canvasui.dev/
- Impeccable (auditoria e polimento de interfaces): https://impeccable.style/
