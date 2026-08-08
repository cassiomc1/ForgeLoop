# Especificação: referências de UI e visualização nos guias de design

## Status do registro

- **Status:** concluído
- **Data:** 2026-08-07
- **Evidência final:** `6e88768`
- **Nota de escopo:** a proibição original de editar `README.md` valia apenas para o patch inicial; a consolidação posterior atualizou o índice do repositório.

## Objetivo

Registrar nos guias de design web as referências oficiais do [shadcn/ui](https://ui.shadcn.com/), do [TanStack Charts](https://github.com/TanStack/charts), do [Cuelume](https://cuelume-site.pages.dev/) e do [Impeccable](https://impeccable.style/), explicando também quando cada recurso é apropriado.

## Escopo

- Atualizar `PT-BR/design-code-pt.md`.
- Atualizar `ENG/design-code-eng.md`.
- Não alterar o `README.md`.
- Não adicionar dependências nem código executável.

## Decisão de design

As referências serão incluídas em pontos complementares de cada guia:

1. Na seção de componentes, uma orientação curta e prática indicará o shadcn/ui como base de componentes web acessíveis, composáveis e customizáveis; o TanStack Charts para visualização de dados responsiva e acessível; e o Cuelume para sons de interação sutis, com controle de volume/silêncio e sem depender de áudio para comunicar informação essencial.
2. No processo obrigatório e no checklist de revisão, o Impeccable será um requisito para auditar e polir a interface inteira com `/impeccable audit` e `/impeccable polish`, repetindo a verificação após os ajustes.
3. Na seção existente de fontes e referências, os quatro links serão listados com seus nomes e papéis para facilitar a descoberta posterior.

O texto em português e inglês manterá o mesmo significado e a mesma estrutura, respeitando o idioma de cada guia.

## Critérios de aceitação

- Cada URL aparece pelo menos uma vez no guia em português e uma vez no guia em inglês.
- O processo exige auditoria e polimento da interface inteira com Impeccable antes da publicação; se a ferramenta não estiver instalada, aplica-se a regra existente de ferramentas obrigatórias.
- As orientações não tratam as ferramentas como dependências obrigatórias nem recomendam copiar defaults visuais sem adaptação.
- A recomendação de visualização de dados preserva as regras existentes de contraste, acessibilidade e coerência com a paleta escolhida.
- O Markdown permanece válido e não há alterações fora do escopo.

## Validação

- Buscar as quatro URLs nos arquivos alterados.
- Revisar o diff e confirmar que apenas a especificação e os dois guias foram modificados.
