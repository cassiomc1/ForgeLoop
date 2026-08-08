---
name: premium-sites-studio-pt
language: pt-BR
counterpart: ../ENG/premium-sites-studio-eng.md
description: "Processo completo para criar sites premium no padrão de grandes estúdios de design."
version: "2026.08"
last-reviewed: "2026-08-08"
---

# Sites Premium em Nível de Estúdio — Processo Completo

> Este guia define o processo de produção. Para regras visuais detalhadas, use também [`design-code-pt.md`](./design-code-pt.md). Para acessibilidade, qualidade de código, testes, segurança e performance, consulte os documentos relacionados ao final. Um site de alto nível não é apenas uma interface bonita: é uma experiência coerente, útil, rápida, acessível, mensurável e sustentável.
>
> **Política de ferramentas**: identifique a stack, a etapa e os checks aplicáveis; prefira um equivalente já disponível que produza evidência compatível. Antes de instalar uma ferramenta ou alterar o ambiente, peça autorização. Se não houver equivalente seguro, registre o check necessário como bloqueado e nunca afirme que ele passou. Não instale recursos meramente opcionais.

## 1. Padrão de qualidade

Um site só pode ser considerado pronto quando atende simultaneamente a estes critérios:

- **Clareza:** em poucos segundos, a pessoa entende o que é, para quem é e qual ação pode tomar.
- **Intenção:** cada seção, imagem, animação e palavra tem uma função de negócio ou de experiência.
- **Coerência:** marca, conteúdo, interface, motion, responsividade e comportamento formam um sistema único.
- **Distinção:** a solução tem uma ideia visual e narrativa própria; não é um template com outra cor.
- **Inclusão:** teclado, leitor de tela, zoom, contraste, redução de movimento e diferentes dispositivos são considerados desde o início.
- **Performance:** a experiência é rápida no dispositivo e na rede reais do público, não apenas no computador do desenvolvedor.
- **Confiabilidade:** estados de erro, carregamento, ausência de conteúdo, consentimento, formulários e integrações funcionam de forma previsível.
- **Operação:** alguém consegue atualizar conteúdo, medir resultados, corrigir problemas e evoluir o site depois do lançamento.

## 2. Como usar este guia

Siga os gates na ordem. Não pule para o código antes de fechar a decisão anterior.

1. **Brief e estratégia:** objetivo, público, posicionamento, oferta, restrições e métricas.
2. **Conteúdo e arquitetura:** inventário de conteúdo, sitemap, navegação, jornadas e modelo de dados.
3. **Direção criativa:** conceito, referências, tom, imagem, tipografia, cor, composição e motion.
4. **Sistema de design:** tokens, componentes, estados, breakpoints, regras de uso e decisões registradas.
5. **Protótipo e validação:** testar hierarquia, compreensão, navegação e conversão antes da implementação completa.
6. **Implementação:** construir com HTML semântico, componentes previsíveis, dados reais ou representativos e progressive enhancement.
7. **Qualidade:** executar acessibilidade, performance, segurança, SEO, compatibilidade, testes funcionais e regressão visual.
8. **Lançamento e operação:** publicar com observabilidade, plano de rollback, analytics, documentação e dono definido.

Cada gate deve ter uma saída verificável. Se uma decisão continuar ambígua, registre a hipótese, o risco, o responsável e o próximo teste; não esconda a incerteza atrás de estética.

## 3. Gate 1 — Brief, estratégia e sucesso

Antes de escolher cores ou componentes, produza um brief curto contendo:

```md
# Brief do site

## Contexto
- Marca/produto:
- Problema de negócio:
- Por que este site existe agora:

## Público
- Público primário:
- Públicos secundários:
- Conhecimento prévio:
- Necessidades e objeções:

## Resultado esperado
- Ação principal:
- Ações secundárias:
- Métrica primária:
- Métricas de qualidade:

## Restrições
- Conteúdo disponível:
- Tecnologia/CMS:
- Idiomas e regiões:
- Prazo e equipe:
- Requisitos legais, de acessibilidade e segurança:

## Não objetivos
- O que o site não precisa resolver:
```

Regras:

- Não invente posicionamento, depoimentos, números, clientes, prêmios ou claims para preencher a página.
- Diferencie **objetivo**, **hipótese** e **métrica**. “Parecer premium” não é métrica suficiente.
- Defina a ação principal por página. Se tudo é prioridade, nada é prioridade.
- Identifique o que precisa ser validado com o cliente, usuário ou área jurídica antes de escrever a interface.
- Defina público, dispositivo, velocidade de rede, idioma, localização e tecnologia como parte do contexto — não como detalhes para o fim.

## 4. Gate 2 — Conteúdo, arquitetura e jornadas

### Inventário de conteúdo

Antes do layout final, organize uma tabela com:

| Página/seção | Objetivo | Conteúdo real | Fonte/dono | Estado | CTA | Requisito de mídia |
| --- | --- | --- | --- | --- | --- | --- |
| Home/hero | Explicar proposta | Headline, apoio, prova | Marketing | aprovado | Conhecer produto | vídeo/imagem |

Estados válidos: `rascunho`, `em revisão`, `aprovado`, `bloqueado`, `desatualizado`. Conteúdo placeholder não pode ser tratado como pronto para QA visual ou de conversão.

### Arquitetura da informação

- Crie sitemap, navegação primária, navegação secundária, footer e caminhos de retorno.
- Organize por intenção do usuário, não pela estrutura interna da empresa.
- Dê a cada página um título, uma promessa, uma ação principal e um estado de sucesso.
- Evite navegação dependente apenas de hover, gestos, scroll horizontal ou animação.
- Planeje URLs legíveis, títulos, descriptions, headings, breadcrumbs e compartilhamento social desde a arquitetura.
- Para sites com CMS, modele conteúdo como dados reutilizáveis; não grave o mesmo texto em vários componentes.
- Para sites multilíngues, trate tradução, expansão de texto, locale, moeda, data, SEO e fallback como requisitos de primeira classe.

### Jornadas críticas

Mapeie pelo menos:

- primeira visita → compreensão → exploração → ação principal;
- busca/navegação → página de detalhe → conversão;
- formulário → validação → envio → confirmação → recuperação de erro;
- mobile lento → conteúdo prioritário → interação essencial;
- usuário que retorna → atualização, suporte ou próxima ação.

## 5. Gate 3 — Direção criativa

Produza uma direção criativa antes de multiplicar telas. Ela deve responder:

- Qual é a ideia central da experiência?
- Que sensação deve permanecer depois da visita?
- Qual é o contraste visual que diferencia a marca?
- O que é estrutural e o que é decoração?
- Quais referências são de linguagem e quais são apenas cópias visuais proibidas?
- Como a ideia funciona sem imagem, sem áudio, sem hover e com movimento reduzido?

Entregáveis recomendados:

- moodboard com referências comentadas, não apenas uma colagem;
- direção de fotografia/ilustração/3D e regras de corte;
- tipografia principal e de apoio com licença e fallback;
- paleta semântica e exemplos de contraste;
- princípios de composição, ritmo e densidade;
- storyboard para momentos de motion e vídeo;
- lista explícita de anti-padrões que não pertencem à marca.

O [guia visual premium](./design-code-pt.md) fornece paletas, tipografia, layout, componentes e motion. Use-o como sistema de execução, não como substituto da direção estratégica.

## 6. Gate 4 — Design system de produção

### Tokens

Defina tokens antes dos componentes:

- cor de marca, superfícies, texto, borda, foco, sucesso, aviso, erro e informação;
- tipografia por função: display, heading, body, label, caption e código;
- escala de espaço, container, grid, raios, bordas, sombras e elevação;
- breakpoints por comportamento, não por dispositivos específicos;
- motion: duração, easing, distância, stagger e regra de redução;
- z-index, camadas, opacidade e estados de interação.

Use tokens semânticos (`color.text.primary`) em vez de espalhar valores crus (`#111111`) por todos os componentes. O tema e o modo escuro devem trocar tokens, não exigir cópia da interface.

### Componentes

Cada componente de produção deve ter:

- finalidade, anatomia e regras de uso;
- variantes necessárias, sem criar variantes cosméticas infinitas;
- estados `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `error` e `success` quando aplicável;
- comportamento em mobile, teclado, zoom, conteúdo longo e ausência de mídia;
- semântica HTML e contrato de acessibilidade;
- dados de exemplo realistas e limites conhecidos;
- teste ou critério de aceitação;
- decisão registrada quando houver trade-off relevante.

Não transforme cada seção em um componente único e descartável. Componentize padrões que realmente se repetem e preserve liberdade para composições especiais.

### Critério de maturidade

Um componente não está pronto por existir no Figma. Está pronto quando pode ser usado por outra pessoa sem perguntar ao autor como ele deve se comportar.

## 7. Gate 5 — UX, protótipo e validação

- Prototipe primeiro a hierarquia, a navegação e os estados críticos; detalhe visual vem depois.
- Teste o protótipo com conteúdo próximo do real, incluindo títulos longos, ausência de imagem, erro e tela pequena.
- Valide cinco perguntas: “o que é?”, “isso é para mim?”, “por que confiar?”, “o que faço agora?” e “o que acontece depois?”.
- Observe onde a pessoa hesita, não apenas se ela consegue clicar.
- Registre decisões e problemas por severidade: bloqueador, alto, médio, baixo.
- Não aceite “funciona no meu viewport” como validação.

## 8. Gate 6 — Implementação premium

### Arquitetura

- Separe conteúdo, dados, componentes, layout, tokens, integrações e mídia.
- Mantenha componentes pequenos, nomeados e pesquisáveis; siga [`clean-code-pt.md`](./clean-code-pt.md).
- Use HTML semântico antes de ARIA e progressive enhancement para o conteúdo essencial.
- Defina uma estratégia de renderização (estática, server-side, híbrida ou client-side) pela necessidade real de conteúdo, SEO, personalização e interação.
- Não adicione framework, biblioteca de animação, 3D ou CMS apenas por moda.
- Trate dependências, fontes, imagens e scripts externos como decisões de produto e segurança.
- Mantenha uma fonte única para tokens e conteúdo; evite divergência entre Figma, código e CMS.

### Conteúdo e mídia

- Use imagens e vídeos com licença, atribuição e finalidade documentadas.
- Defina `alt`, legendas, transcrição, poster, proporção, foco de enquadramento e fallback.
- Reserve espaço para mídia antes do carregamento para evitar layout shift.
- Não use vídeo, 3D, cursor customizado ou parallax para esconder uma proposta fraca.
- Todo conteúdo essencial precisa continuar compreensível com mídia bloqueada ou indisponível.

### Motion

- Motion deve explicar mudança, hierarquia, relação espacial ou feedback; não deve existir apenas para impressionar.
- Use entrada, continuidade, saída e estado de erro de forma consistente.
- Prefira `transform` e `opacity`, pause trabalho fora da viewport e respeite `prefers-reduced-motion`.
- Toda interação essencial deve existir sem hover, pointer lock, áudio ou gesto complexo.
- Para trailers, demos e motion graphics HTML, use o [HyperFrames](https://hyperframes.heygen.com) e siga o [quickstart oficial](https://hyperframes.heygen.com/quickstart). Preserve tokens de marca e valide o render como produto audiovisual separado.

## 9. Gate 7 — Qualidade técnica

Este guia orquestra os guias especializados; não os duplica.

| Área | Gate mínimo | Referência |
| --- | --- | --- |
| Código | lint, format, tipagem, revisão de arquitetura e dependências | [`clean-code-pt.md`](./clean-code-pt.md) |
| Acessibilidade | teclado, foco, semântica, contraste, zoom/reflow, leitor de tela e `prefers-reduced-motion` | [`acessibilidade-code-pt.md`](./acessibilidade-code-pt.md) |
| Testes | unitário, integração, E2E, acessibilidade e regressão visual | [`test-code-pt.md`](./test-code-pt.md) |
| Performance | baseline, budgets, Web Vitals, rede/dispositivo real e regressão | [`perf-code-pt.md`](./perf-code-pt.md) |
| Segurança | secrets, headers, dependências, forms, uploads, CSP e terceiros | [`sec-code-pt.md`](./sec-code-pt.md) |
| Design | tokens, componentes, responsividade, conteúdo real e Anti-Slop | [`design-code-pt.md`](./design-code-pt.md) |

### Matriz mínima de QA

Teste os fluxos críticos em uma matriz documentada que inclua:

- desktop largo, desktop menor, tablet e mobile;
- Chromium/Chrome, Firefox e Safari quando fizerem parte do público;
- teclado, touch, mouse/trackpad e leitor de tela quando aplicável;
- zoom de 200%, reflow, modo escuro, alto contraste e movimento reduzido;
- rede rápida, rede limitada, cache frio e dispositivo de baixo desempenho;
- conteúdo curto, longo, traduzido, ausente, inválido e carregando;
- cookies/consentimento, bloqueio de terceiros e falha de API/CMS.

Registre navegador, dispositivo, versão, passos, evidência, severidade, responsável e status. Uma captura bonita não substitui um teste reproduzível.

## 10. SEO, descoberta e confiança

- Cada página deve ter intenção de busca ou uma razão clara para não ser indexada.
- Use uma hierarquia de headings coerente, title/description únicos, canonical, sitemap, robots e dados estruturados quando apropriado.
- Escreva para pessoas; não sacrifique clareza por palavras-chave.
- Garanta links rastreáveis, estados de erro indexáveis quando necessário, Open Graph, favicon, manifest e compartilhamento correto.
- Não publique claims, reviews, logos de clientes ou dados estruturados sem fonte e autorização.
- Valide acessibilidade, performance, privacidade e SEO juntos: uma técnica de crescimento que prejudica confiança é uma regressão.

## 11. Lançamento e operação

Antes do deploy, confirme:

- ambiente de produção, variáveis e secrets separados;
- domínio, TLS, redirects, cache, CDN e headers corretos;
- analytics com consentimento, eventos nomeados e plano de privacidade;
- monitoramento de erro, uptime, Web Vitals, conversão e formulários;
- backup/export do CMS e plano de rollback;
- documentação de edição, responsáveis, dependências e validade de conteúdo;
- smoke test pós-deploy em páginas e jornadas críticas;
- plano para atualizar fontes, bibliotecas, conteúdo, consentimento e dependências.

O lançamento é uma etapa de transição, não o fim do projeto. Defina uma revisão após dados reais, correções de estabilização e uma fila de evolução baseada em evidência.

## 12. Anti-padrões de estúdio

- Começar pelo hero antes de entender objetivo, conteúdo e público.
- Usar lorem ipsum, números inventados ou imagens sem licença.
- Copiar referência visual sem entender a lógica que a torna boa.
- Criar um design system enorme sem produto suficiente para justificar suas partes.
- Fazer cada página com tokens, espaçamentos e componentes diferentes.
- Usar animação para atrasar acesso ao conteúdo ou impedir navegação.
- Tratar desktop como única versão e “responsivo” como redução automática.
- Fazer QA somente no final, em um navegador e em um computador.
- Medir apenas Lighthouse local ou apenas conversão, ignorando acessibilidade e qualidade.
- Entregar um site que só o autor consegue manter.

## 13. Template para `CLAUDE.md` / `AGENTS.md`

```md
## Site premium em nível de estúdio

- Leia `premium-sites-studio-pt.md` antes de criar ou revisar páginas.
- Feche brief, conteúdo, arquitetura e direção antes da implementação completa.
- Use `design-code-pt.md` para tokens, layout, componentes e motion.
- Use conteúdo real ou representativo; não invente claims, logos, métricas ou depoimentos.
- Mantenha conteúdo, tokens, componentes, integrações e mídia separados.
- Preserve HTML semântico, teclado, foco, contraste, zoom, reflow e movimento reduzido.
- Valide desktop, mobile, Safari/Firefox/Chromium, rede limitada e conteúdo longo.
- Rode lint, format, testes, auditoria de acessibilidade, performance, segurança e regressão visual.
- Documente decisões, riscos, exceções, responsáveis e próximos testes.
- Antes do deploy, valide SEO, analytics/consentimento, headers, TLS, rollback e smoke tests.
- Se o projeto tiver vídeo ou motion HTML, consulte HyperFrames e valide preview/render.
```

## 14. Checklist final

- [ ] Brief aprovado com objetivo, público, ação principal, métricas e não objetivos.
- [ ] Conteúdo real inventariado, revisado, licenciado e com dono definido.
- [ ] Sitemap, jornadas, URLs e modelo de conteúdo definidos.
- [ ] Direção criativa documentada e distinta de referências copiadas.
- [ ] Tokens, componentes, variantes, estados e decisões registrados.
- [ ] Protótipo validado com conteúdo longo, erro, loading, mobile e movimento reduzido.
- [ ] Implementação sem dependências ou efeitos não justificados.
- [ ] Acessibilidade, testes, performance e segurança aprovados.
- [ ] SEO técnico, compartilhamento, analytics e consentimento revisados.
- [ ] QA executado em matriz documentada, com evidências e severidades.
- [ ] Deploy, rollback, monitoramento, CMS e responsáveis documentados.
- [ ] Revisão pós-lançamento agendada com base em dados reais.

## Documentos relacionados e referências

- [Design premium](./design-code-pt.md)
- [Acessibilidade](./acessibilidade-code-pt.md)
- [Clean Code](./clean-code-pt.md)
- [Testes](./test-code-pt.md)
- [Performance](./perf-code-pt.md)
- [Segurança](./sec-code-pt.md)
- [HyperFrames](https://hyperframes.heygen.com)
- [Web Content Accessibility Guidelines (WCAG)](https://www.w3.org/TR/WCAG22/)
- [Web Vitals](https://web.dev/articles/vitals)
- [Google Search — SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
