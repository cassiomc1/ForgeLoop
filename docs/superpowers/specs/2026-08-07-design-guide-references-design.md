# Especificação: referências de UI e visualização nos guias de design

## Objetivo

Registrar nos guias de design web as referências oficiais do [shadcn/ui](https://ui.shadcn.com/) e do [TanStack Charts](https://github.com/TanStack/charts), explicando também quando cada recurso é apropriado.

## Escopo

- Atualizar `PT-BR/design-code-pt.md`.
- Atualizar `ENG/design-code-eng.md`.
- Não alterar o `README.md`.
- Não adicionar dependências nem código executável.

## Decisão de design

As referências serão incluídas em dois pontos complementares de cada guia:

1. Na seção de componentes, uma orientação curta e prática indicará o shadcn/ui como base de componentes web acessíveis, composáveis e customizáveis, e o TanStack Charts para visualização de dados responsiva e acessível.
2. Na seção existente de fontes e referências, os dois links serão listados com seus nomes e papéis para facilitar a descoberta posterior.

O texto em português e inglês manterá o mesmo significado e a mesma estrutura, respeitando o idioma de cada guia.

## Critérios de aceitação

- Cada URL aparece pelo menos uma vez no guia em português e uma vez no guia em inglês.
- As orientações não tratam as ferramentas como dependências obrigatórias nem recomendam copiar defaults visuais sem adaptação.
- A recomendação de visualização de dados preserva as regras existentes de contraste, acessibilidade e coerência com a paleta escolhida.
- O Markdown permanece válido e não há alterações fora do escopo.

## Validação

- Buscar as duas URLs nos arquivos alterados.
- Revisar o diff e confirmar que apenas a especificação e os dois guias foram modificados.
