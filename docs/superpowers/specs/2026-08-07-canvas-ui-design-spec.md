# Especificação: Canvas UI nos guias de design

## Status do registro

- **Status:** concluído
- **Data:** 2026-08-07
- **Evidência final:** `6e88768`
- **Nota de escopo:** a proibição original de editar `README.md` valia apenas para o patch inicial; a consolidação posterior atualizou o índice do repositório.

## Objetivo

Incorporar o [Canvas UI](https://canvasui.dev/) aos guias bilíngues de design web como uma referência opcional para efeitos criativos baseados em canvas e WebGL, com critérios claros de uso, adaptação visual, compatibilidade, acessibilidade e desempenho.

## Escopo

- Atualizar `PT-BR/design-code-pt.md`.
- Atualizar `ENG/design-code-eng.md`.
- Não alterar o `README.md`, os guias premium ou os guias de games.
- Não adicionar dependências, configurações nem código executável.

## Decisão de design

O Canvas UI será integrado de forma contextual e simétrica nos dois idiomas:

1. Na seção de componentes, uma orientação apresentará a biblioteca como fonte opcional de efeitos canvas/WebGL para momentos de alto impacto, como heros, revelações e interações especiais. A orientação exigirá adaptar tokens, composição e comportamento ao sistema visual do projeto, em vez de copiar o resultado padrão sem intenção.
2. Na seção de 3D e interatividade, as regras existentes serão complementadas com requisitos específicos: manter conteúdo e ações essenciais em HTML acessível, fornecer fallback funcional, respeitar `prefers-reduced-motion`, testar navegadores e dispositivos modestos e preservar a experiência quando o efeito estiver indisponível.
3. Na seção de fontes e referências, o link oficial será registrado com uma descrição curta de seu papel.

O guia não tratará Canvas UI como requisito, biblioteca genérica de interface ou substituto para semântica HTML. Recursos que dependam de capacidades experimentais do navegador só poderão ser usados como aprimoramento progressivo.

## Critérios de aceitação

- `https://canvasui.dev/` aparece pelo menos uma vez em cada guia.
- Os textos em português e inglês possuem o mesmo significado e estrutura equivalente.
- A recomendação explica quando Canvas UI é apropriado e evita uso decorativo indiscriminado.
- Conteúdo, navegação e ações essenciais continuam disponíveis como HTML semântico e acessível.
- Há orientação explícita sobre fallback, compatibilidade entre navegadores, movimento reduzido e desempenho em dispositivos modestos.
- A biblioteca permanece opcional e não é adicionada como dependência do repositório.
- Apenas os dois guias definidos no escopo são alterados durante a implementação.

## Validação

- Buscar a URL oficial e os termos de salvaguarda nos dois arquivos.
- Executar `git diff --check`.
- Revisar o diff dos dois guias para confirmar equivalência bilíngue e ausência de mudanças fora do escopo.
