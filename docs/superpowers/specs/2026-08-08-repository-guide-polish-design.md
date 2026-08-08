# Especificação: polimento integral dos guias

## Status

- Aprovada pelo usuário em 2026-08-08 pela instrução “execute tudo”.
- Escopo: toda a coleção documental, mantendo equivalência entre PT-BR e inglês.

## Objetivo

Transformar a coleção em uma referência operacional mais segura, atual, verificável e fácil de manter. O trabalho preservará a intenção dos guias existentes, corrigirá recomendações imprecisas ou desatualizadas, sincronizará cada par de idiomas e adicionará controles automáticos de qualidade documental.

## Abordagem escolhida

Aplicar uma revisão temática por pares de guias, seguida de uma consolidação transversal. Cada alteração temática será revisável em um commit próprio. O resultado final terá metadados uniformes, uma política comum de ferramentas, fontes oficiais próximas das recomendações, histórico de planos claramente arquivado e CI para Markdown e links.

Não haverá adição de aplicação, framework de runtime ou dependência instalada no repositório. As únicas automações novas serão arquivos de configuração e um workflow de documentação.

## Regras transversais

### Paridade de idiomas

- Os oito pares PT-BR/ENG devem transmitir as mesmas regras, limites, exceções, exemplos e referências, ainda que a redação idiomática não seja uma tradução literal.
- Links internos devem apontar para o arquivo do mesmo idioma.
- Números devem respeitar a notação do idioma: vírgula decimal em PT-BR e ponto decimal em inglês.

### Metadados

Todos os 16 guias receberão frontmatter YAML com este contrato:

- `name`: identificador único igual ao nome do arquivo sem `.md`;
- `description`: resumo localizado, em uma linha;
- `language`: `pt-BR` ou `en`;
- `version`: `"2026.08"`;
- `last-reviewed`: `"2026-08-08"`;
- `counterpart`: caminho relativo para a contraparte no outro idioma.

### Política de ferramentas

Substituir a exigência de instalar imediatamente toda ferramenta mencionada por uma política proporcional:

1. identificar a stack, o estágio do trabalho e as verificações realmente aplicáveis;
2. reutilizar ferramenta equivalente já disponível quando ela produzir evidência compatível;
3. solicitar autorização antes de instalar ou alterar o ambiente, conforme a política vigente;
4. se uma verificação necessária não puder ser executada e não houver equivalente seguro, registrar o bloqueio e nunca afirmar que ela passou;
5. não instalar ferramentas que sejam apenas referências opcionais.

### Linguagem normativa

- Regras de segurança, acessibilidade, preservação funcional e validação continuam obrigatórias.
- Receitas visuais, ferramentas específicas e números heurísticos devem ser apresentados como defaults fortes, sinais de revisão ou escolhas condicionadas à stack, salvo quando o requisito do produto ou do usuário exigir valor exato.
- Alegações de certificação, conformidade legal, popularidade ou superioridade não podem exceder a evidência citada.

### Proveniência e licenças

- Criar `THIRD_PARTY_NOTICES.md` para registrar fontes, licenças conhecidas e limites de reutilização.
- A coleção não declarará uma licença global nova sem escolha explícita do titular.
- O material A11Y deve manter atribuição e referência à licença MIT do projeto de origem.
- O artigo de Fabio Akita deve ser citado como influência; o guia será descrito como síntese operacional original, sem afirmar direitos de tradução ou reprodução.
- Canvas UI e Liquid Glass Design são referências para estudo e adaptação; ativos, textos, imagens e código só podem ser reutilizados após conferir licença, autoria e obrigações.

## Mudanças por guia

### Código limpo

- Erros e logs usarão códigos estáveis e contexto seguro; não incluirão valores brutos, segredos, tokens, dados pessoais, cartões ou payloads completos.
- Debug detalhado ficará restrito a ambiente controlado e não produtivo, com remoção confirmada da instrumentação temporária.
- A seção assíncrona cobrirá cancelamento, timeout, retries limitados com backoff/jitter, limites de concorrência, cleanup, idempotência e testes de race conditions.
- Observabilidade definirá esquema de evento, severidade, correlação, duração/resultado, redação, métricas, traces e retenção.
- Separação de domínio, aplicação e infraestrutura manterá I/O nas bordas e decisões arquiteturais registradas.
- Comentários obsoletos serão atualizados ou removidos. Injeção/wrappers serão recomendados para I/O, SDKs voláteis, integrações caras e fakes úteis; imports diretos continuam aceitáveis para bibliotecas estáveis e puras.
- Limites de linhas, níveis e ocorrências serão heurísticas justificáveis, não leis universais.

### Acessibilidade

- O critério WCAG 2.2 SC 2.4.13 será descrito corretamente: área equivalente ao perímetro de 2 CSS px e contraste de pelo menos 3:1 entre os mesmos pixels nos estados focado e não focado.
- Incluir SC 2.5.7, 3.2.6, 3.3.7 e 3.3.8 com checklist e testes.
- Elementos nativos, especialmente `<button>`, serão obrigatórios salvo impossibilidade documentada; o fallback customizado seguirá APG completo, nome acessível, estados, foco, teclado e teste com tecnologia assistiva.
- O texto indicará que o guia apoia implementação orientada à WCAG; certificação ou conformidade legal exige avaliação por escopo e jurisdição.
- Cor não será o único canal, mas texto, ícone ou padrão só serão exigidos conforme a informação e a semântica programática necessárias.
- Live regions já existirão no DOM; `status`/polite servirá mensagens não urgentes e `alert` erros urgentes, com teste em combinações suportadas de navegador e tecnologia assistiva.

### Segurança

- OWASP ASVS 5.0 será o padrão verificável: L1 como baseline e L2 para aplicações sensíveis; Top 10 servirá conscientização.
- Incluir controles executáveis de SSRF, upload de arquivos, OAuth/OIDC/JWT, ciclo de vida de segredos, supply chain, CSP, CORS, sessões e cookies.
- HSTS será implantado em etapas; `includeSubDomains` e preload só após inventário, teste e decisão explícita.
- Android usará Keystore e criptografia autenticada; Jetpack Security/`EncryptedSharedPreferences` aparecerão apenas em contexto legado/migração. Pinning será exceção baseada em threat model, com recuperação.
- Senhas e criptografia seguirão Argon2id calibrado, alternativas documentadas, AEAD e bibliotecas de alto nível, com agilidade algorítmica.
- Introspection de GraphQL será tratada como redução de exposição, nunca como controle de autorização.

### Testes

- Comparações de ferramentas usarão matriz de capacidade, compatibilidade, manutenção, runtime, projeto existente e restrições de CI; não usarão rankings temporais sem fonte e data.
- Cobertura será orientada a risco, baseline do projeto, mudanças, branches e caminhos críticos; mutation testing complementará, sem meta universal por função nem regra 80/90.
- Automação de acessibilidade será descrita como parcial e complementada por WCAG 2.2 manual, teclado, tecnologia assistiva, zoom/reflow, foco, contraste e testes nativos.
- Para desktop, Appium Windows driver será o caminho mantido; WinAppDriver direto ficará como compatibilidade legada. Tauri usará WebdriverIO com `@wdio/tauri-service`/`tauri-driver`, não Playwright anexado à janela.
- Performance/E2E cobrirá SLOs, percentis, throughput, erros, warm-up, soak/spike, budgets, jornadas críticas, degradação/offline, permissões, lifecycle e matriz real de dispositivos/SO.
- Cassettes serão saneados; testes flaky terão owner e prazo; snapshots de CSS gerado não serão oráculo primário; migrações seguirão expand-migrate-contract e roll-forward.

### Performance

- Core Web Vitals usarão limites “good” atuais, dados de campo/RUM ou CrUX no p75 e segmentação mobile/desktop e por URL/grupo; Lighthouse será diagnóstico de laboratório.
- Imagens AVIF/WebP terão fallback em `<picture>` ou negociação de CDN validada.
- React Native indicará React Native DevTools e profilers do Android Studio/Xcode; Flipper ficará como opção legada/manual para versões antigas.
- O guia inglês usará `2.5 s` e `0.1`, não vírgulas decimais.

### Design

- Diferenciar tokens semânticos de cor e acentos decorativos para resolver a contradição entre paletas de sete tokens e limite de quatro cores.
- Separar fontes disponíveis no Google Fonts de fontes externas e exigir origem, licença e fallback de sistema.
- `object-fit: cover` será reservado a imagens decorativas/editoriais; logos, gráficos, screenshots e conteúdo informativo usarão `contain` ou proporção intrínseca quando necessário.
- Canvas UI será referência adaptável condicionada à licença e proveniência, não biblioteca “copiável”.
- Consolidar as regras de progressive enhancement sem perder fallback HTML, reduced motion, pausa fora da viewport, compatibilidade e orçamento de performance.
- Preservar as salvaguardas de Liquid Glass e condicionar orientação nativa da Apple ao contexto de plataforma.

### Games web

- Unir o melhor conteúdo dos dois idiomas sem remover regras existentes.
- O loop de passo fixo terá `maxStepsPerFrame`, evento de frame lento e política intencional de recuperação/resincronização.
- O manifest de assets conterá licença, atribuição e origem, com validação em CI e geração de notices.
- Os dois idiomas apontarão para design e acessibilidade; PT-BR ganhará teste automatizado com axe-core mais smoke manual.
- Remover os links quebrados `https://web.dev/games/` e `https://www.w3.org/WAI/gaming/`; usar referências ativas e específicas.

### Sites premium

- Aplicar os metadados e a política transversal de ferramentas.
- Preservar o processo de estúdio e suas exigências de estratégia, conteúdo, acessibilidade, performance, segurança e QA.

## Repositório e manutenção

- `README.md` terá um único H1, hierarquia coerente, conteúdo bilíngue simétrico e tabela de manutenção/paridade.
- O workflow HyperFrames seguirá o quickstart oficial vigente e distinguirá instalação, inicialização, preview, validação e render.
- `.gitignore` incluirá `.commandcode/` e `.worktrees/`; o diretório local `.commandcode/` não será removido nem versionado.
- Criar `docs/superpowers/README.md` com índice. Os seis documentos históricos de 2026-08-07 receberão status concluído, evidência de commits e aviso de que são registros, não instruções pendentes; checkboxes de planos concluídos serão marcadas.
- Criar `.markdownlint-cli2.jsonc`, `.lychee.toml` e `.github/workflows/docs-quality.yml`. Actions de terceiros serão fixadas em SHA completo; o workflow executará Markdown lint, verificação de links e validações estruturais da coleção.

## Validação

O trabalho só poderá ser considerado concluído quando houver evidência fresca de:

- `git diff --check` sem erros;
- Markdown lint sem erros;
- links internos resolvidos e links externos sem falhas não justificadas;
- frontmatter YAML válido, nomes únicos e contrapartes existentes;
- cercas de código balanceadas;
- ausência dos dois URLs quebrados conhecidos e das recomendações obsoletas identificadas;
- paridade semântica dos oito pares de guias;
- revisão independente por tarefa e revisão final de toda a branch sem achados Critical ou Important.

## Fora de escopo

- Escolher ou conceder uma licença global para a coleção.
- Copiar ativos, imagens, textos ou código de Canvas UI, Liquid Glass Design ou outras galerias.
- Adicionar uma aplicação executável, package manager, framework web ou dependências locais permanentes.
- Publicar, abrir pull request ou mesclar no GitHub sem uma solicitação posterior explícita.
