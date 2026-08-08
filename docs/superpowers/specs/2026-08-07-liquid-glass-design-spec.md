# Especificação: integração profunda de Liquid Glass nos guias de design

## Status do registro

- **Status:** concluído
- **Data:** 2026-08-07
- **Evidência final:** `6e88768`
- **Nota de escopo:** a proibição original de editar `README.md` valia apenas para o patch inicial; a consolidação posterior atualizou o índice do repositório.

## Objetivo

Atualizar os guias bilíngues de design web com os aprendizados úteis de [Liquid Glass Design](https://liquidglassdesign.com/), distinguindo glassmorphism estático de Liquid Glass refrativo e transformando a referência visual em regras práticas de uso responsável, acessibilidade, fallback, compatibilidade e desempenho.

## Escopo

- Atualizar `PT-BR/design-code-pt.md`.
- Atualizar `ENG/design-code-eng.md`.
- Não alterar `README.md`, outros guias ou código executável.
- Não adicionar dependências nem recomendar os projetos vinculados como dependências obrigatórias.

## Princípios de conteúdo

1. **Precisão conceitual:** `backdrop-filter: blur()` com borda e sombra é glassmorphism; Liquid Glass é uma linguagem/material dinâmico que tenta simular refração, realces especulares, tonalidade, sombra e deformação responsivas. Não chamar blur CSS de refração real.
2. **Uso semântico:** reservar transparência/refração para uma ou duas superfícies flutuantes de baixa densidade, como navegação contextual, toolbar, tab bar, sheet, popover ou controle pontual. Corpo de texto, formulários extensos, preços, estados críticos, decisões e CTAs essenciais permanecem em superfícies sólidas ou previsíveis.
3. **Aprimoramento progressivo:** conteúdo, navegação, foco e ações continuam em HTML semântico. A ausência de WebGL, SVG displacement, filtros, JavaScript ou capacidade do navegador produz uma superfície opaca/CSS funcional com os mesmos estados e ações.
4. **Acessibilidade:** validar contraste no fundo mais complexo possível, oferecer variante opaca/menos transparente para baixa legibilidade, `prefers-reduced-motion`, redução de transparência/alto contraste quando a plataforma expuser essas preferências, e nunca usar brilho, cor, transparência ou movimento como único indicador.
5. **Desempenho:** detectar capacidade antes de ativar shaders, limitar resolução/DPR, filtros multipasse e superfícies animadas, inicializar sob demanda, pausar fora da viewport e quando a página não estiver visível, simplificar ou desativar em dispositivos modestos e medir com fundos de imagem/vídeo.
6. **Direitos e proveniência:** Liquid Glass Design é uma galeria independente de inspiração. Não copiar ou redistribuir imagens, prompts ou obras; para código externo, revisar licença, dependências, manutenção, compatibilidade e créditos individualmente.
7. **Plataformas nativas:** em iOS/iPadOS/macOS, preferir APIs nativas de Liquid Glass somente quando o SDK e o deployment target suportarem o material; respeitar HIG, Reduce Transparency e Increase Contrast. Usar fallback convencional em versões anteriores e não transportar automaticamente a estética para Windows/Android.

## Alterações planejadas nos dois guias

As versões PT-BR e EN terão estrutura equivalente:

- Na seção de cor, contraste e profundidade, inserir a distinção entre glassmorphism e Liquid Glass, a regra de 1–2 camadas e a validação contra o pior fundo.
- Na seção de 3D/interatividade, consolidar o contrato de fallback e performance para efeitos Canvas/WebGL/SVG/Liquid Glass.
- Na seção de componentes, explicar quando uma superfície Liquid Glass é adequada e preservar estados nativos de foco, teclado, toque e fallback.
- Na seção de motion, reforçar que deformação, elasticidade, brilho e pointer tracking são acabamento opcional, de curta duração, pausável e nunca requisito para compreensão.
- Na blacklist Anti-Slop, proibir glass sobre glass, texto longo sobre fundo móvel/refratado, aberração cromática em conteúdo legível, vídeo decorativo atrás de controles e “Liquid Glass” simulado apenas com blur apresentado como refração.
- No checklist web, adicionar validação no pior fundo e em zoom 200%, operação sem efeito/transparência, no máximo duas camadas translúcidas concorrentes e fallback de estados/ações.
- Nas orientações nativas, condicionar APIs modernas da Apple ao SDK/deployment target e preservar alternativas para versões anteriores.
- Nas referências, incluir a galeria, o guia, a central de recursos e o guia oficial da Apple; classificar implementações externas como experimentais/opcionais.

## Critérios de aceitação

- Os dois guias distinguem explicitamente glassmorphism de Liquid Glass e não tratam `backdrop-filter` como refração real.
- O material translúcido é limitado a superfícies de controle/foco contextual; conteúdo e ações críticas permanecem acessíveis em HTML/superfícies previsíveis.
- O contrato de fallback inclui superfície opaca funcional, estados equivalentes, `prefers-reduced-motion`, contraste, compatibilidade sem WebGL/SVG displacement e pausa fora da viewport/aba não visível.
- Há requisitos de orçamento de performance e testes em Safari, Firefox, fundos claros/escuros, fundos de alta complexidade e dispositivos modestos.
- A galeria é descrita como inspiração independente, sem transferência de direitos sobre imagens, prompts ou obras.
- APIs nativas Apple são condicionais a SDK/deployment target e não são recomendadas como regra para plataformas não Apple.
- PT-BR e EN têm conteúdo, estrutura e links equivalentes.
- A alteração não modifica `README.md`, outros guias, dependências ou código executável.

## Validação

- Buscar termos-chave e todos os links novos nos dois arquivos.
- Comparar a estrutura das inserções PT-BR/EN.
- Executar `git diff --check` e validar fences Markdown.
- Inspecionar o diff para confirmar que somente os dois guias foram alterados.
