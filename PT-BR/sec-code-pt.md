---
name: sec-code-pt
language: pt-BR
counterpart: ../ENG/sec-code-eng.md
description: "Segurança verificável para desenvolvimento web, mobile, desktop, APIs e supply chain."
version: "2026.08"
last-reviewed: "2026-08-08"
---

# Guia de Segurança para Desenvolvimento Web, Mobile e Desktop

Instruções práticas de segurança (secure coding) para desenvolvimento web,
mobile (iOS/Android) e desktop (Windows/macOS). Use este documento para
transformar riscos em controles testáveis, evidências e decisões registradas.

**Documentos relacionados**: para qualidade/estrutura geral de código, ver
[`clean-code-pt.md`](./clean-code-pt.md). Para frameworks e ferramentas de
teste (incluindo SAST/DAST como parte do pipeline), ver
[`test-code-pt.md`](./test-code-pt.md). Para vídeos e composições HTML,
consulte o [HyperFrames](https://hyperframes.heygen.com) e trate scripts,
assets e URLs externas como superfície de ataque. Este arquivo é a referência
canônica de segurança; regras de secrets, autorização, criptografia e OWASP
vivem aqui, não nos outros arquivos.

**Política de ferramentas**: identifique a stack, a etapa e os checks
aplicáveis; prefira um equivalente já disponível que produza evidência
compatível. Antes de instalar uma ferramenta ou alterar o ambiente, peça
autorização. Se não houver equivalente seguro, registre o check necessário
como bloqueado e nunca afirme que ele passou. Não instale recursos meramente
opcionais.

## Princípios gerais (válidos para qualquer plataforma)

- **Secure by design**: pense em segurança na fase de design, não como "revisão" no final. Modele ameaças (threat modeling) para funcionalidades sensíveis (login, pagamento, upload de arquivo).
- **Menor privilégio (least privilege)**: usuários, processos, chaves de API e credenciais de banco devem ter apenas as permissões estritamente necessárias.
- **Defesa em profundidade**: nunca confie em uma única camada de proteção (ex.: validação só no frontend). Toda validação/autorização crítica deve ser repetida no backend.
- **Nunca confie no cliente**: dados vindos do navegador, app mobile ou app desktop podem ser manipulados. Toda decisão de segurança (autenticação, autorização, preço, permissão) é feita no servidor.
- **Fail secure / secure by default**: em caso de erro ou configuração ausente, o sistema deve negar acesso por padrão, nunca liberar.
- **Segredos nunca em código-fonte**: chaves de API, senhas, tokens e certificados vão em variáveis de ambiente ou serviços de secret management (Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager) — nunca commitados no git.
- **Composições e mídia também são entrada**: valide HTML/JS gerado, manifests, URLs, formatos, tamanho e origem de mídia; fixe dependências quando possível e nunca embuta secrets em uma composição ou no bundle de vídeo.
- **Atualize dependências continuamente**: use scanners automatizados (Dependabot, Renovate, Snyk, `npm audit`, `pip-audit`, `bundler-audit`) e trate vulnerabilidades críticas como bugs de prioridade alta.
- **Logue eventos de segurança, nunca dados sensíveis**: registre tentativas de login, falhas de autorização e mudanças de permissão; nunca logue senhas, tokens completos, números de cartão ou dados pessoais em texto claro.
- **Criptografia**: use biblioteca de alto nível e implementação validada;
  escolha algoritmo, modo, tamanho de chave e parâmetros conforme o caso de
  uso e mantenha inventário e caminho de migração. Nunca implemente primitivas
  próprias nem transforme um nome de algoritmo em garantia de segurança.

---

## Baseline verificável: OWASP ASVS 5.0

- Adote o **OWASP ASVS 5.0.0 Nível 1 (L1)** como baseline mínimo para
  aplicações web e APIs. Adote **L2** para aplicações sensíveis, inclusive as
  que tratam autenticação relevante, saúde, finanças, dados regulados ou
  operações de alto impacto. L3 exige análise especializada e não é inferido
  automaticamente.
- Use o OWASP Top 10 para conscientização e priorização de riscos, não como
  checklist de verificação suficiente. Registre o nível ASVS, requisitos
  aplicáveis, exceções, responsável, evidência e data da verificação.
- Cite requisitos com versão completa, por exemplo
  `v5.0.0-1.2.4`; IDs sem versão podem mudar. Não declare conformidade apenas
  porque um scanner passou: cada requisito aplicável precisa de evidência
  reproduzível, revisão manual ou justificativa de não aplicabilidade.
- Para mobile, complemente com MASVS/MASTG; para controles web do backend e da
  API usados pelo app, ASVS continua aplicável.

### Mapa mínimo de evidências

| Controle | Referências ASVS 5.0.0 confirmadas | Evidência esperada |
| --- | --- | --- |
| Validação e autorização no servidor | `v5.0.0-2.2.2`, `v5.0.0-8.3.1` | testes negativos por operação e recurso |
| SQL parametrizado | `v5.0.0-1.2.4` | teste/revisão sem concatenação de entrada |
| Cookies e headers | capítulos V3.3 e V3.4 | respostas capturadas e testes de navegador |
| Upload | capítulos V5.1 a V5.4 | corpus válido, inválido, comprimido e malicioso |
| Sessão | capítulos V7.2 a V7.4 | rotação, expiração e invalidação verificadas |
| OAuth/OIDC e tokens | capítulos V9 e V10 | casos de assinatura, claims, replay e redirect |
| Segredos e dependências | capítulos V13.3 e V15.1/V15.2 | scans, inventário, SBOM e trilha de rotação |

---

## Contratos de entrada de alto risco

### Requisições de saída e SSRF

Antes de permitir que entrada não confiável influencie uma requisição de
saída, defina e teste este contrato (`v5.0.0-1.3.6`,
`v5.0.0-13.2.4`, `v5.0.0-15.3.2`):

- aceite somente schemes necessários, normalmente `https`; faça parse e
  canonicalização com uma biblioteca de URL, rejeite credenciais embutidas,
  fragmentos e sintaxe ambígua, e compare scheme, host e porta com uma
  allowlist exata de destinos de negócio;
- resolva todos os registros A e AAAA e rejeite qualquer resultado não
  global: redes privadas, loopback, link-local, multicast, endereços
  reservados e endpoints de metadata de cloud. Aplique a mesma política no
  firewall/proxy de egress;
- previna **DNS rebinding**: valide todas as respostas DNS imediatamente antes
  da conexão, conecte somente ao endereço validado e preserve a validação TLS
  do hostname esperado. Não confie apenas na validação textual do domínio;
- desative redirects por padrão. Se forem requisito, limite o número de hops
  e repita parse, allowlist, resolução DNS e bloqueio de IP em **cada** destino;
- não encaminhe cookies, tokens ou headers internos ao destino. Defina
  timeout de conexão e total, limite de resposta, concorrência, retries e
  largura de banda; falhe fechado e registre o motivo sem incluir secrets;
- teste URLs alternativas e IPv4/IPv6, redirects, mudança de DNS, destinos
  internos, `169.254.169.254`/metadata e respostas lentas ou grandes.

Se o produto realmente precisa acessar destinos arbitrários, isole o fetcher
sem credenciais, aplique proxy de egress e denylist de endereços especiais
como defesa adicional; não apresente denylist como substituta da allowlist.

### Upload, processamento e download de arquivos

Todo fluxo de arquivo deve documentar tipos e limites antes da implementação
e atender, conforme o nível, aos capítulos V5.1 a V5.4 do ASVS 5.0.0:

- permita somente extensões necessárias e verifique extensão, assinatura
  (*magic bytes*) e conteúdo com parser especializado; nunca confie no
  `Content-Type` enviado pelo cliente;
- gere o nome/ID no servidor, preserve o nome original apenas como metadado
  saneado e não use entrada do usuário para construir caminhos;
- limite bytes recebidos, dimensões/complexidade, quantidade por usuário,
  quantidade de itens em arquivos e **limites pós-descompressão** antes de
  extrair (`v5.0.0-5.1.1`, `v5.0.0-5.2.1` a `v5.0.0-5.2.3`);
- armazene em serviço privado ou fora do webroot, sem permissão de execução e
  com tipo de conteúdo fixado pelo servidor. Isole parsers e conversores;
- aplique antivírus/sandbox e CDR para formatos compatíveis quando o risco
  exigir. Mantenha o arquivo em quarentena até o resultado e defina o que
  ocorre em timeout ou falha do scanner;
- sirva download somente após autenticação e autorização por objeto, por um
  handler que mapeia ID interno, com `Content-Disposition: attachment` e nome
  saneado; nunca exponha caminho real nem permita execução ativa;
- teste extensão dupla, MIME falso, path traversal, zip slip, symlink, bomba
  ZIP/XML, arquivo poliglota, parser indisponível e acesso horizontal.

---

## OWASP Top 10:2025 (Web) — visão geral e mitigação

1. **A01 – Broken Access Control (Controle de acesso quebrado)**: valide autorização em toda rota/endpoint, no servidor, para todo recurso (inclusive por ID direto/IDOR). Nunca confie em `role` enviado pelo cliente. Aplique deny-by-default.
2. **A02 – Security Misconfiguration**: remova contas/serviços padrão, desative stack traces e mensagens de erro detalhadas em produção, configure headers de segurança (ver seção HTTP), mantenha ambientes dev/staging/prod com hardening consistente.
3. **A03 – Software Supply Chain Failures**: audite dependências, use lockfiles (`package-lock.json`, `poetry.lock`), gere SBOM (Software Bill of Materials), valide integridade de pacotes (checksums/assinaturas), restrinja permissões de CI/CD e tokens de publish.
4. **A04 – Cryptographic Failures**: use HTTPS/TLS moderno, hash de senha
   calibrado e AEAD por biblioteca de alto nível; mantenha chaves fora do
   código, inventário criptográfico e plano de migração.
5. **A05 – Injection**: use queries parametrizadas/ORMs (nunca concatenar SQL), valide e sanitize toda entrada, escape saída em templates (proteção contra XSS), evite `eval`/`exec` com dados externos.
6. **A06 – Insecure Design**: aplique threat modeling, revise fluxos críticos (recuperação de senha, upload, pagamento) com foco em abuso, não só em "caminho feliz".
7. **A07 – Authentication Failures**: exija MFA para contas sensíveis, rate-limit em login, bloqueie/atrase após tentativas falhas, use tokens de sessão com expiração e rotação, nunca exponha se o "usuário existe" em mensagens de erro de login.
8. **A08 – Software or Data Integrity Failures**: valide assinaturas de updates/pacotes, use CI/CD com pipelines protegidos (branch protection, assinatura de commits), nunca desserialize dados não confiáveis sem validação de schema.
9. **A09 – Security Logging and Alerting Failures**: garanta logs de eventos de segurança (login, falha de autorização, mudança de permissão) com alertas automáticos para anomalias (múltiplas falhas, acesso fora do padrão).
10. **A10 – Mishandling of Exceptional Conditions**: trate exceções e limites de recursos explicitamente (timeouts, quotas, limites de tamanho de payload/upload), nunca exponha stack trace ao usuário final, sempre "fail closed" em erro inesperado.

---

## Web — Backend por linguagem/tecnologia

### Node.js / JavaScript / TypeScript

- **Helmet** (Express) ou middlewares equivalentes para configurar headers de segurança automaticamente.
- Validação de entrada com **Zod**, **Joi** ou **Yup** — nunca confiar em `req.body` sem schema.
- ORMs com queries parametrizadas (**Prisma**, **Drizzle**, **TypeORM**) em vez de SQL manual concatenado.
- `npm audit` / **Snyk** / **Socket.dev** para dependências; atenção a *supply chain attacks* via pacotes npm maliciosos/typosquatting.
- Nunca usar `eval()`, `new Function()` ou `child_process.exec()` com input não sanitizado.
- Rate limiting com **express-rate-limit** ou no gateway/CDN (Cloudflare, etc.).

### Python

- ORMs com queries parametrizadas (**Django ORM**, **SQLAlchemy**) — nunca `cursor.execute(f"...{var}...")`.
- Validação de schema com **Pydantic** (FastAPI já usa nativamente).
- `pip-audit` / **Safety** / **Bandit** (SAST estático para Python) em CI.
- Django: manter `DEBUG = False` em produção, `SECRET_KEY` fora do código, `ALLOWED_HOSTS` restrito, usar `django-csp` para Content-Security-Policy.
- Nunca usar `pickle` para desserializar dados de origem não confiável (execução arbitrária de código).

### .NET / C\#

- Usar **Entity Framework** com LINQ/parâmetros (nunca `SqlCommand` com concatenação de string).
- **ASP.NET Core Identity** ou **Duende IdentityServer**/**Microsoft.Identity.Web** para autenticação/OAuth2/OIDC.
- Data Protection API para criptografia de dados em repouso e tokens.
- `dotnet list package --vulnerable` para checar dependências vulneráveis; habilitar **NuGet Audit**.
- Configurar `[ValidateAntiForgeryToken]` em formulários; usar `HttpOnly`/`Secure`/`SameSite` em cookies de sessão.

### Java

- **Prepared Statements**/JPA parametrizado (nunca `Statement` com concatenação).
- **Spring Security** para autenticação/autorização declarativa; **OWASP Dependency-Check** ou **Snyk** integrado ao Maven/Gradle.
- Evitar desserialização insegura de objetos Java (`ObjectInputStream` de fontes não confiáveis) — usar JSON com schema validado em vez de serialização binária Java quando possível.
- Desabilitar resolução de entidades externas em parsers XML (proteção contra XXE): `setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)`.

### PHP

- **PDO com prepared statements** (nunca `mysqli_query` com concatenação).
- Frameworks modernos (Laravel, Symfony) já fazem escaping automático em templates (Blade/Twig) — evitar `{!! !!}`/`|raw` sem sanitização.
- `composer audit` para dependências vulneráveis.
- Configurar `session.cookie_httponly`, `session.cookie_secure`, `session.cookie_samesite` no `php.ini`.

### Ruby / Rails

- ActiveRecord com parâmetros (nunca `where("... #{var}")`).
- **Brakeman** (SAST específico para Rails) em CI.
- `bundler-audit` para gems vulneráveis.
- Rails já protege contra CSRF por padrão (`protect_from_forgery`) — nunca desabilitar sem necessidade justificada.

### Go

- `database/sql` com parâmetros (`?`/`$1`) — nunca `fmt.Sprintf` para montar SQL.
- **govulncheck** para checar vulnerabilidades conhecidas em dependências e na stdlib.
- Usar `context.Context` com timeout em toda chamada externa para evitar exhaustion de recursos.

---

## Web — Frontend / Navegador

- **XSS**: nunca insira HTML não sanitizado via `innerHTML`,
  `dangerouslySetInnerHTML` ou `v-html` com dados de usuário. Frameworks
  modernos escapam por padrão; não burle esse comportamento sem sanitização
  contextual com biblioteca mantida.
- **CSRF**: use token anti-CSRF em operações com mudança de estado e valide
  `Origin`/`Referer` quando aplicável. `SameSite` ajuda, mas não substitui um
  controle anti-CSRF quando o fluxo permite requisições cross-site.
- **Clickjacking**: use `frame-ancestors` na CSP. `X-Frame-Options: DENY` pode
  permanecer para clientes legados, mas não é o controle primário
  (`v5.0.0-3.4.6`).
- **Subresource Integrity (SRI)**: use `integrity` e `crossorigin` para assets
  estáticos e versionados de CDN; prefira hospedagem própria quando o recurso
  muda sem versionamento.
- **Armazenamento no cliente**: não guarde tokens ou dados sensíveis em
  `localStorage`, `sessionStorage` ou IndexedDB quando um cookie de sessão
  `HttpOnly` atende ao fluxo. Assuma que XSS lê todo armazenamento acessível a
  JavaScript.
- **Terceiros**: cada script, tag, widget e SDK executado no browser é parte da
  supply chain; minimize, inventarie, fixe versões e revise os dados enviados.

### CSP com rollout e reporting

Comece com `Content-Security-Policy-Report-Only`, corrija violações legítimas e
só então promova a mesma política testada para `Content-Security-Policy`.
Nonces devem ser aleatórios, imprevisíveis e novos em cada resposta; nunca
copie literalmente o placeholder abaixo. O endpoint de relatórios deve ter
limite de taxa, retenção e redaction, pois o payload pode conter dados da URL.

```http
Reporting-Endpoints: csp="https://example.com/security/csp-reports"
Content-Security-Policy-Report-Only: default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'nonce-{RANDOM_PER_RESPONSE}'; report-to csp
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

`object-src 'none'` e `base-uri 'none'` são o mínimo do
`v5.0.0-3.4.3`; ajuste `frame-ancestors`, `form-action`, `connect-src`,
`img-src`, `style-src` e demais diretivas à arquitetura. Evite
`unsafe-inline`, `unsafe-eval`, wildcards amplos e hosts não necessários.
Colete e teste reports, mas não trate `Report-Only` como bloqueio.

### CORS por origem exata

- Compare uma origem canonicalizada pela tupla **scheme + host + port** com
  uma allowlist explícita (`v5.0.0-3.4.2`). Rejeite `Origin: null`, curingas de
  subdomínio e regex permissivas; `example.com.attacker.tld` não pertence a
  `example.com`.
- Se a resposta refletir uma origem allowlisted, devolva exatamente essa
  origem e inclua `Vary: Origin` para impedir que caches compartilhem a
  variante errada. Não reflita o header antes da comparação.
- Use `Access-Control-Allow-Credentials: true` somente para origens de
  confiança e com necessidade documentada. `*` serve apenas a resposta
  realmente pública, sem credenciais nem dados sensíveis.
- Restrinja métodos e headers, valide preflight e mantenha autenticação e
  autorização no endpoint: CORS é uma política do browser, não um controle de
  acesso para clientes não-browser.

### HSTS em estágios

HSTS só é enviado por HTTPS. Comece em ambiente controlado com `max-age`
curto, monitore falhas e aumente gradualmente até pelo menos um ano
(`v5.0.0-3.4.1`). Adicione `includeSubDomains` somente após inventariar
**todos** os subdomínios atuais e futuros e confirmar HTTPS válido em cada um.

```http
Strict-Transport-Security: max-age=300
```

O exemplo é a fase inicial e ainda não satisfaz a verificação ASVS. Após o
rollout validado, o alvo L1 é `max-age=31536000` ou maior; em L2+, a política
também precisa cobrir todos os subdomínios.

Preload é uma decisão explícita L3 (`v5.0.0-3.7.4`), com impacto difícil de
reverter. Só use `max-age=63072000; includeSubDomains; preload` depois do
inventário, aprovação do proprietário do domínio, plano de recuperação e
atendimento aos requisitos da lista de preload. Escrever a diretiva não
submete o domínio automaticamente.

### Cookies e ciclo de sessão

Use `SameSite=Strict` ou `Lax` por padrão. `SameSite=None` é exceção para um
fluxo cross-site documentado e exige `Secure` e proteção CSRF compatível.
Prefira o prefixo `__Host-`, que exige `Secure`, `Path=/` e ausência de
`Domain`; tokens de sessão também usam `HttpOnly` (`v5.0.0-3.3.1` a
`v5.0.0-3.3.4`).

```http
Set-Cookie: __Host-Session=<opaque>; Path=/; Secure; HttpOnly; SameSite=Lax
```

Gere identificador opaco com CSPRNG, rotacione-o no login, reautenticação e
mudança de privilégio e invalide o anterior (`v5.0.0-7.2.3`,
`v5.0.0-7.2.4`). Defina e imponha no servidor timeouts **idle** e **absolute**
conforme o risco (`v5.0.0-7.3.1`, `v5.0.0-7.3.2`). Logout, expiração,
desativação da conta e revogação devem impedir reutilização, não apenas apagar
o cookie do browser.

---

## APIs REST / GraphQL / Identidade

- **Autorização**: aplique RBAC/ABAC no backend em toda operação, objeto e
  campo; negar por padrão e testar acesso horizontal e vertical. Esconder
  botões não é autorização.
- **Rate limiting e schema**: limite por usuário, credencial e operação, não
  apenas por IP; valide payload contra OpenAPI/JSON Schema e imponha limites
  de tamanho, profundidade, paginação e tempo.
- **Comunicação serviço a serviço**: use identidades de workload, tokens
  curtos ou certificados com menor privilégio. Evite credenciais estáticas
  compartilhadas (`v5.0.0-13.2.1`). Use mTLS ou assinatura de mensagem quando
  a análise de risco exigir.

### OAuth 2.0 e OpenID Connect

- Use **Authorization Code + PKCE** com `S256` para clientes públicos e
  confidenciais. Vincule `code_verifier`, `state` e, em OIDC, `nonce` à
  transação e sessão que a iniciou; cada valor é imprevisível e de uso único
  (`v5.0.0-10.1.2`, `v5.0.0-10.2.1`, `v5.0.0-10.5.1`).
- Compare redirect URIs com a allowlist registrada por string exata; não use
  wildcards, prefixos ou open redirectors (`v5.0.0-10.4.1`). Valide o issuer
  esperado e defenda clientes multi-issuer contra mix-up.
- Não use implicit grant (`response_type=token`) nem Resource Owner Password
  Credentials/password grant. Tokens saem pelo token endpoint, nunca por URL
  de front channel. Restrinja scopes e audiences ao mínimo necessário.

### JWT, revogação e refresh tokens

- Allowliste algoritmos por contexto e rejeite `none`; valide assinatura/MAC
  antes das claims e obtenha chaves apenas de issuer/configuração confiável
  (`v5.0.0-9.1.1` a `v5.0.0-9.1.3`). Nunca derive o algoritmo aceito apenas do
  header recebido.
- Valide tipo e finalidade do token, `iss`, `aud`, `exp` e `nbf`, com
  tolerância de relógio mínima e explícita (`v5.0.0-9.2.1` a
  `v5.0.0-9.2.3`). Não use ID Token como access token.
- Para operações suscetíveis a replay, valide identificador único/`jti` e
  estado de uso ou adote token sender-constrained (mTLS/DPoP). Expiração curta
  reduz a janela, mas não detecta replay sozinha.
- Planeje revogação: reference tokens podem usar **token introspection**;
  JWTs autocontidos exigem denylist, chave/versão por usuário ou corte por
  instante. Em logout, incidente ou perda de autorização, invalide o estado
  correspondente (`v5.0.0-7.4.1`).
- Refresh tokens são rotativos e armazenados com proteção equivalente a uma
  credencial. A cada troca, invalide o anterior; reutilização de um token já
  rotacionado revoga a família, encerra a sessão e gera alerta. Para clientes
  públicos, use rotação ou sender constraint conforme RFC 9700.

### GraphQL

Imponha autorização em cada resolver/operação/campo, valide entrada, limite
profundidade, quantidade, batching e custo (`v5.0.0-4.3.1`) e aplique timeout
e rate limit. Desabilitar ou restringir **introspection** pode reduzir a
exposição de schema quando ele não é público (`v5.0.0-4.3.2`), mas é somente
hardening opcional: não substitui autorização nem controles antiabuso, e os
campos ainda podem ser descobertos por tentativa. Mantenha-a quando o contrato
público exigir e proteja dados independentemente dessa escolha.

---

## Banco de Dados

- Sempre **queries parametrizadas/prepared statements** — nunca concatenação de string com input do usuário (proteção contra SQL Injection).
- **Least privilege**: usuário de aplicação no banco não deve ter permissão de `DROP`/`ALTER`/acesso a schemas não usados; usuário de migração é separado do usuário de runtime.
- **Criptografia em repouso** para dados sensíveis (PII, dados de pagamento) via criptografia nativa do banco (TDE) ou a nível de coluna/campo.
- **Backups criptografados** e testados periodicamente (restore drill).
- **Segredos de conexão** (connection string, senha) fora do código, via secret manager ou variável de ambiente injetada em runtime.
- Auditoria de acesso a tabelas sensíveis (logs de quem acessou dados de clientes).

---

## Criptografia e senhas

- **Senhas**: use **Argon2id** como primeira opção e calibre memória, iterações
  e paralelismo no hardware de produção para manter o custo defensivo sem
  causar DoS. Se indisponível, use scrypt; mantenha bcrypt apenas para legado,
  considerando seu limite de entrada; use PBKDF2 quando FIPS exigir. Grave
  algoritmo e parâmetros junto ao hash e rehash após autenticação quando a
  política evoluir (`v5.0.0-11.4.2`).
- **Dados em repouso**: prefira AEAD, como AES-GCM ou
  **ChaCha20-Poly1305**, por API de alto nível. Nunca reutilize nonce com a
  mesma chave; autentique metadados relevantes como AAD e trate falha de tag
  como rejeição fechada. Não use ECB, cifra sem autenticação ou chave derivada
  por hash rápido (`v5.0.0-11.3.1` a `v5.0.0-11.3.3`). Evidência específica
  de geração e unicidade de nonce é L3 (`v5.0.0-11.3.4`).
- **Chaves**: gere em CSPRNG, separe por ambiente e finalidade, armazene em
  KMS/HSM/Keystore apropriado, limite acesso e documente geração, ativação,
  rotação, revogação, backup e destruição. Nunca registre chave ou plaintext.
- **Agilidade algorítmica**: mantenha inventário de algoritmos, chaves e
  certificados, formato versionado e caminho testado para troca de algoritmo,
  parâmetros, chave e recriptografia (`v5.0.0-11.1.2`,
  `v5.0.0-11.2.1`, `v5.0.0-11.2.2`). Agilidade não significa aceitar
  algoritmos escolhidos pelo atacante.

---

## Infraestrutura, DevOps e CI/CD

### Segredos e identidades de workload

- Centralize secrets em serviço apropriado; separe dev/test/staging/prod,
  aplique menor privilégio e prefira identidades de workload, federação OIDC,
  certificados ou credenciais dinâmicas de vida curta a chaves estáticas
  (`v5.0.0-13.2.1`, `v5.0.0-13.3.1`).
- Faça secret scanning no IDE ou **pre-commit**, bloqueie no CI/PR e examine
  periodicamente todo o histórico Git, artefatos, imagens e logs. Use valores
  falsos reconhecíveis em exemplos e testes; não dependa só de regex ou
  redaction de logs.
- Mantenha proprietário, consumidores, ambiente, finalidade, expiração e
  agenda de rotação. Audite leitura, alteração, falha e uso anômalo sem logar
  o valor; teste rotação e revogação sem indisponibilidade.
- Em exposição, trate como incidente: contenha, **revogue primeiro**, rotacione
  todos os dependentes, investigue logs/artefatos/clones, notifique os
  responsáveis e documente a causa. Apagar o arquivo ou fazer novo commit não
  invalida o segredo.
- Remova o valor do histórico Git apenas após revogação e análise coordenada;
  reescrita afeta SHAs, branches, forks e clones e exige comunicação e
  prevenção de reintrodução. Considere o segredo comprometido mesmo depois da
  limpeza.

### Supply chain e promoção

- Use lockfiles e registries/proxies confiáveis com allowlist. Reserve
  namespaces e nomes internos, configure escopo explícito e verifique origem
  de dependências diretas e transitivas para prevenir **dependency confusion**
  (`v5.0.0-15.1.2`, `v5.0.0-15.2.4`).
- Fixe GitHub Actions e workflows reutilizáveis por commit completo; fixe
  plugins e ferramentas por versão imutável ou digest verificado, conforme o
  ecossistema, e imagens/artefatos por digest. Tags e branches mutáveis não são
  evidência de identidade. Automatize propostas de atualização, mas exija
  revisão e execute com token mínimo.
- Gere SBOM e provenance/attestations no builder isolado; assine quando
  aplicável e verifique identidade do builder, fonte, commit e digest antes
  do deploy. Checksum vindo do mesmo canal comprometido não basta.
- Construa uma vez e promova o **mesmo artefato imutável** entre ambientes;
  não recompile para produção. Registre aprovações e associe release, SBOM,
  attestation, testes e configuração ao digest.
- Faça rollout gradual (canary/percentual), monitore indicadores técnicos e
  de segurança, tenha abort automático e rollback para um digest anterior
  também verificado. Nunca “corrija” produção modificando o artefato em uso.

### Verificações de pipeline

- Integre SAST, SCA, secret scanning, IaC scanning, scan de container e DAST
  conforme a arquitetura; falhas críticas bloqueiam merge/deploy ou recebem
  exceção temporal, responsável e risco documentado.
- Use runners efêmeros, branch protection, revisão obrigatória de workflows,
  permissões mínimas e ambientes com aprovação. Não disponibilize secrets de
  produção a builds de pull requests não confiáveis.
- Imagens base devem ser mínimas, não executar como `root` e ser reconstruídas
  de forma controlada quando houver correção; valide assinatura/attestation no
  admission/deploy, não apenas no build.

---

## Mobile — OWASP Mobile Top 10:2024 e boas práticas

1. **M1 – Improper Credential Usage**: nunca hardcode chaves de API/segredos no binário do app (são extraíveis via reverse engineering); use backend como proxy para chamadas que exigem segredo.
2. **M2 – Inadequate Supply Chain Security**: audite SDKs de terceiros (analytics, ads) quanto a permissões e dados coletados; trave versões de dependências (lockfiles).
3. **M3 – Insecure Authentication/Authorization**: toda decisão de autorização no backend; tokens com expiração curta; biometria (Face ID/Touch ID, BiometricPrompt) apenas como *conveniência* de acesso a um segredo já protegido, nunca como único fator de autenticação do backend.
4. **M4 – Insufficient Input/Output Validation**: valide toda entrada (deep links, intents, formulários) tanto no app quanto no backend.
5. **M5 – Insecure Communication**: HTTPS obrigatório (App Transport Security
   no iOS, `usesCleartextTraffic=false` no Android); use validação TLS da
   plataforma. Pinning depende de threat model e plano operacional.
6. **M6 – Inadequate Privacy Controls**: solicite apenas as permissões necessárias (câmera, localização, contatos), explique o motivo (App Tracking Transparency no iOS), minimize coleta de dados pessoais.
7. **M7 – Insufficient Binary Protections**: obfuscação de código (ProGuard/R8 no Android, ofuscação de símbolos no iOS), detecção de jailbreak/root para apps sensíveis, verificação de integridade do binário.
8. **M8 – Security Misconfiguration**: desabilite logs de debug/verbose em builds de produção, remova endpoints de teste/staging do app publicado.
9. **M9 – Insecure Data Storage**: nunca salve dados sensíveis em texto claro
   em `SharedPreferences`, `UserDefaults` ou arquivos planos; use **Keychain**
   no iOS e chaves no **Android Keystore**, com armazenamento criptografado
   adequado ao dado.
10. **M10 – Insufficient Cryptography**: use APIs criptográficas nativas ou
    biblioteca de alto nível mantida, com criptografia autenticada; nunca
    implemente cifra própria.

### iOS — específico

- **Keychain Services** para tokens, senhas e chaves — nunca `UserDefaults` para dados sensíveis.
- **App Transport Security (ATS)** habilitado (bloqueia HTTP não seguro por padrão); exceções só com justificativa documentada.
- Prefira a validação TLS da plataforma; só adote pinning após threat model,
  com pins de backup, expiração, telemetria e recuperação testada.
- Revisar permissões do `Info.plist` (`NSCameraUsageDescription`, etc.) — pedir só o necessário, com descrição clara ao usuário.
- Usar **Data Protection** (`NSFileProtectionComplete`) para arquivos sensíveis em disco.

### Android — específico

- **Android Keystore System** para gerar e manter chaves não exportáveis,
  protegidas por hardware/StrongBox quando disponível e necessário. Cifre os
  dados com AEAD e guarde apenas o ciphertext em arquivo/banco; Keystore guarda
  a chave, não dados arbitrários.
- Prefira TLS e Certificate Transparency da plataforma. Android não recomenda
  certificate pinning por padrão; use-o somente quando o threat model superar
  o risco de indisponibilidade, com múltiplos backup pins (ao menos um sob seu
  controle), expiração curta, telemetria, recuperação e atualização testadas.
  Nunca implemente `TrustManager` que aceite qualquer certificado.
- `EncryptedSharedPreferences` está deprecated. Mantenha-o somente durante
  legado/migração com plano de retirada e regras de backup verificadas; não o
  recomende para código novo e nunca coloque secrets em `SharedPreferences`
  puro.
- Use **Network Security Config** para política de cleartext e CAs confiáveis.
  Certificate Transparency não existe até API 35; na API 36 é opt-in, e na
  API 37+ fica ativa por padrão, salvo exceção configurada. Só configure pins
  quando excepcionalmente aprovados.
- **ProGuard/R8** para obfuscação e remoção de código não usado em builds de release.
- Cuidado com **Intents implícitos** e **Deep Links** — validar origem e sanitizar dados recebidos via `Intent`/`Deep Link`, nunca confiar neles como fonte segura.
- `android:exported="false"` em componentes (Activities/Services/Receivers) que não precisam ser acessados por outros apps.
- Verificar **permissões em tempo de execução** (runtime permissions) com o mínimo necessário e explicação ao usuário.

---

## Desktop — Windows e macOS

### Windows

- **DPAPI (Data Protection API)** ou **Windows Credential Manager** para armazenar segredos locais (nunca em arquivos de config em texto claro).
- **Assinatura de código (code signing)** com certificado válido — builds não assinados disparam alertas do SmartScreen/Defender.
- Rodar com o menor privilégio possível; evitar exigir elevação de administrador salvo quando estritamente necessário (UAC).
- Validar integridade de updates (assinatura digital) antes de aplicar — nunca baixar/executar binário sem verificação.
- Sandboxing quando possível (**AppContainer**, MSIX com capacidades restritas).

### macOS

- **Keychain Services** (mesma API conceitual do iOS) para armazenar credenciais e chaves.
- **Notarização da Apple** e **assinatura de código (codesign)** obrigatórios para distribuição fora da App Store sem gerar bloqueio do Gatekeeper.
- **App Sandbox** e **Hardened Runtime** habilitados, solicitando apenas os *entitlements* necessários (acesso a rede, câmera, arquivos).
- Nunca desabilitar o **App Transport Security**/validação de TLS para "facilitar" debug em produção.
- Validar integridade de auto-updates (ex.: framework **Sparkle**) com assinatura EdDSA antes de instalar.

### Regras comuns (Windows + macOS)

- Nunca armazene senhas, tokens ou chaves de API em arquivos de configuração em texto claro (`.ini`, `.json`, `.xml`) no diretório do usuário — use o cofre de credenciais nativo do SO.
- Todo canal de auto-update deve ser HTTPS + verificação de assinatura do pacote antes da instalação.
- Minimize permissões solicitadas ao SO (acesso a arquivos, rede, automação) e explique o motivo ao usuário.
- Trate a máquina do usuário como ambiente não confiável: qualquer segredo embutido no binário pode ser extraído por um usuário com privilégios locais.

---

## Cross-cutting: Apps híbridos e multiplataforma (Electron, React Native, Flutter, .NET MAUI)

- **Electron**: mantenha `nodeIntegration: false` e `contextIsolation: true` em `BrowserWindow`; use `preload` scripts com APIs expostas explicitamente (`contextBridge`); atualize o Electron/Chromium com frequência (vulnerabilidades de navegador afetam o app inteiro).
- **React Native**: mesmas regras de armazenamento seguro do mobile nativo (use `react-native-keychain`, não `AsyncStorage` puro para segredos); valide deep links.
- **Flutter**: use `flutter_secure_storage` (que usa Keychain/Keystore por baixo) em vez de `shared_preferences` para dados sensíveis.
- Em todos os casos: a lógica de negócio sensível e segredos de API nunca devem viver só no cliente — sempre ter um backend validando/autorizando.

---

## Template de instruções para incluir em CLAUDE.md / AGENTS.md

```
## Segurança

- Baseline web/API: OWASP ASVS 5.0.0 L1; usar L2 para aplicação sensível.
  Registrar requisito, evidência e exceção, não apenas resultado de scanner.
- Nunca commitar segredos (chaves, senhas, tokens, certificados). Usar
  secret manager e identidade curta. Escanear pre-commit, CI e histórico.
- Toda entrada de usuário é não confiável: validar e sanitizar no backend,
  mesmo que já validada no frontend/app.
- Toda URL de saída usa allowlist exata, bloqueia redes não globais/metadata,
  DNS rebinding e revalida redirects; aplicar timeout e limites.
- Upload usa nome gerado, valida tipo/conteúdo e tamanho pós-descompressão,
  fica fora do webroot e só é baixado após autorização.
- Toda query a banco de dados usa parâmetros/prepared statements ou ORM.
  Nunca concatenar strings SQL.
- Toda decisão de autorização é feita no servidor. Nunca confiar em
  papéis/permissões enviados pelo cliente.
- Senhas: Argon2id calibrado; scrypt fallback, bcrypt legado e PBKDF2/FIPS.
  Dados: AEAD AES-GCM/ChaCha20-Poly1305 por biblioteca de alto nível.
- Cookies: __Host- + Path=/ + HttpOnly + Secure + SameSite=Lax/Strict;
  documentar SameSite=None. Aplicar timeout idle/absolute e rotação.
- Implantar CSP com Report-Only/reporting. HSTS em estágios; nunca ativar
  includeSubDomains/preload sem inventário e decisão explícita.
- OAuth/OIDC: Authorization Code + PKCE S256, state, nonce e redirect exato;
  proibir implicit/password. JWT valida algoritmo, assinatura e claims.
- Dependências: rodar audit de vulnerabilidades (npm audit, pip-audit,
  govulncheck, dotnet list package --vulnerable) e resolver criticidades
  altas; fixar actions por commit e plugins/artefatos por versão/digest.
- Mobile: dados sensíveis só em Keychain (iOS) ou cifrados com chave no
  Keystore (Android). EncryptedSharedPreferences é apenas legado/migração.
- Desktop: segredos só no cofre de credenciais nativo do SO (DPAPI/Credential
  Manager no Windows, Keychain no macOS). Nunca em arquivo de config plano.
- Logs nunca contêm senhas, tokens completos, dados de cartão ou PII em
  texto claro.
- Toda funcionalidade nova que lida com dados sensíveis (login, pagamento,
  upload, permissões) recebe uma revisão de ameaças antes de implementar.
```

---

## Checklist de Revisão de Segurança

- [ ] Escopo, nível ASVS 5.0.0 (L1 ou L2), exceções e evidências estão
  registrados; Top 10 não foi usado como checklist substituto.
- [ ] Entrada e autorização são impostas no servidor; SQL está parametrizado
  (`v5.0.0-2.2.2`, `v5.0.0-8.3.1`, `v5.0.0-1.2.4`).
- [ ] Casos SSRF cobrem allowlist, IPs não globais/metadata, DNS rebinding,
  redirects, timeout e limites (`v5.0.0-1.3.6`).
- [ ] Upload cobre nome gerado, tipo/conteúdo, limites pós-descompressão,
  storage privado, AV/CDR aplicável e download autorizado (ASVS 5.0.0,
  V5.1–V5.4).
- [ ] CSP passou por `Report-Only`, CORS compara origem exata e envia
  `Vary: Origin`, e HSTS foi implantado sem preload automático (ASVS 5.0.0,
  V3.4).
- [ ] Cookie `__Host-` e ciclo de sessão foram testados para SameSite,
  rotação, idle/absolute timeout, logout e revogação (ASVS 5.0.0, V3.3 e V7).
- [ ] OAuth/OIDC usa Code + PKCE, `state`, `nonce` e redirects exatos; JWT e
  refresh tokens têm validação, replay, rotação e revogação testados (ASVS
  5.0.0, V9/V10).
- [ ] Secret scanning cobre pre-commit, CI e histórico; exposição tem playbook
  de revogação, rotação, auditoria e remediação Git (ASVS 5.0.0, V13.3).
- [ ] Dependências vêm de registry confiável; actions estão em commit completo,
  plugins/artefatos em versão ou digest imutável, provenance foi verificada e
  dependency confusion foi testada.
- [ ] Senhas usam Argon2id/scrypt ou exceção documentada; dados usam AEAD e há
  inventário/agilidade criptográfica (ASVS 5.0.0, V11).
- [ ] Android usa Keystore e TLS da plataforma; qualquer pinning tem threat
  model, backups, expiração, telemetria e recuperação. Legado
  `EncryptedSharedPreferences` tem migração.
- [ ] GraphQL impõe autorização e antiabuso independentemente de introspection
  (`v5.0.0-4.3.1`, `v5.0.0-4.3.2`).
- [ ] Logs e alertas comprovam eventos de segurança sem expor secrets ou PII;
  scans de código, dependências, IaC, imagens e runtime têm política de falha.

---

## Fontes e Referências

- OWASP ASVS 5.0.0: https://owasp.org/www-project-application-security-verification-standard/
- OWASP ASVS 5.0.0 CSV oficial: https://github.com/OWASP/ASVS/raw/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.csv
- OWASP Top 10:2025 (Web): https://owasp.org/Top10/2025/
- OWASP Mobile Top 10:2024: https://owasp.org/www-project-mobile-top-10/
- OWASP Mobile Application Security Verification Standard (MASVS) / MASTG: https://owasp.org/www-project-mobile-app-security/
- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/
- OWASP SSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP File Upload: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- OWASP Content Security Policy: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- OWASP HTTP Strict Transport Security: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html
- OWASP HTTP Headers: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP Password Storage: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP Cryptographic Storage: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- OWASP OAuth2: https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html
- OWASP GraphQL: https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html
- OWASP Secrets Management: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- OWASP Software Supply Chain Security: https://cheatsheetseries.owasp.org/cheatsheets/Software_Supply_Chain_Security_Cheat_Sheet.html
- OWASP GitHub Actions Security: https://cheatsheetseries.owasp.org/cheatsheets/GitHub_Actions_Security_Cheat_Sheet.html
- Android TLS e certificate pinning: https://developer.android.com/privacy-and-security/security-ssl
- Android Network Security Config e Certificate Transparency: https://developer.android.com/privacy-and-security/security-config
- Android cryptography e Keystore: https://developer.android.com/privacy-and-security/cryptography
- Android `EncryptedSharedPreferences` (deprecated): https://developer.android.com/reference/androidx/security/crypto/EncryptedSharedPreferences
- OAuth 2.0 Security Best Current Practice, RFC 9700: https://www.rfc-editor.org/rfc/rfc9700
- JWT Best Current Practices, RFC 8725: https://www.rfc-editor.org/rfc/rfc8725
- Web Origin, RFC 6454: https://www.rfc-editor.org/rfc/rfc6454
- OAuth 2.0 Token Introspection, RFC 7662: https://www.rfc-editor.org/rfc/rfc7662
- ChaCha20-Poly1305, RFC 8439: https://www.rfc-editor.org/rfc/rfc8439
- GitHub Actions: usar commit SHA completo: https://docs.github.com/en/actions/reference/security/secure-use
- GitHub artifact attestations: https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations
- Apple Platform Security Guide: https://support.apple.com/guide/security/
- Microsoft Security Development Lifecycle (SDL): https://www.microsoft.com/sdl
