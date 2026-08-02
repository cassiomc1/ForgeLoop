# Guia de Segurança para Desenvolvimento Web, Mobile e Desktop

> Instruções práticas de segurança (secure coding) para as principais linguagens e tecnologias usadas no desenvolvimento moderno — web, mobile (iOS/Android) e desktop (Windows/macOS). Use este documento como referência para orientar agentes de IA e desenvolvedores sobre riscos comuns e como mitigá-los em cada stack. Baseado no OWASP Top 10:2025 (web), OWASP Mobile Top 10:2024 e OWASP MASVS.

> **Documentos relacionados**: para qualidade/estrutura geral de código, ver `clean-code.md`. Para frameworks e ferramentas de teste (incluindo SAST/DAST como parte do pipeline), ver `test-code.md`. Este arquivo é a referência canônica de segurança; regras de secrets, autorização, criptografia e OWASP vivem aqui, não nos outros arquivos.

## Princípios gerais (válidos para qualquer plataforma)

- **Secure by design**: pense em segurança na fase de design, não como "revisão" no final. Modele ameaças (threat modeling) para funcionalidades sensíveis (login, pagamento, upload de arquivo).
- **Menor privilégio (least privilege)**: usuários, processos, chaves de API e credenciais de banco devem ter apenas as permissões estritamente necessárias.
- **Defesa em profundidade**: nunca confie em uma única camada de proteção (ex.: validação só no frontend). Toda validação/autorização crítica deve ser repetida no backend.
- **Nunca confie no cliente**: dados vindos do navegador, app mobile ou app desktop podem ser manipulados. Toda decisão de segurança (autenticação, autorização, preço, permissão) é feita no servidor.
- **Fail secure / secure by default**: em caso de erro ou configuração ausente, o sistema deve negar acesso por padrão, nunca liberar.
- **Segredos nunca em código-fonte**: chaves de API, senhas, tokens e certificados vão em variáveis de ambiente ou serviços de secret management (Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager) — nunca commitados no git.
- **Atualize dependências continuamente**: use scanners automatizados (Dependabot, Renovate, Snyk, `npm audit`, `pip-audit`, `bundler-audit`) e trate vulnerabilidades críticas como bugs de prioridade alta.
- **Logue eventos de segurança, nunca dados sensíveis**: registre tentativas de login, falhas de autorização e mudanças de permissão; nunca logue senhas, tokens completos, números de cartão ou dados pessoais em texto claro.
- **Criptografia**: use bibliotecas/algoritmos padrão do mercado (AES-256, RSA-2048+, Argon2/bcrypt/scrypt para senhas). Nunca implemente seu próprio algoritmo de criptografia ou hashing.

---

## OWASP Top 10:2025 (Web) — visão geral e mitigação

1. **A01 – Broken Access Control (Controle de acesso quebrado)**: valide autorização em toda rota/endpoint, no servidor, para todo recurso (inclusive por ID direto/IDOR). Nunca confie em `role` enviado pelo cliente. Aplique deny-by-default.
2. **A02 – Security Misconfiguration**: remova contas/serviços padrão, desative stack traces e mensagens de erro detalhadas em produção, configure headers de segurança (ver seção HTTP), mantenha ambientes dev/staging/prod com hardening consistente.
3. **A03 – Software Supply Chain Failures**: audite dependências, use lockfiles (`package-lock.json`, `poetry.lock`), gere SBOM (Software Bill of Materials), valide integridade de pacotes (checksums/assinaturas), restrinja permissões de CI/CD e tokens de publish.
4. **A04 – Cryptographic Failures**: use HTTPS/TLS 1.2+ em tudo, nunca armazene senha em texto claro (use Argon2/bcrypt), não use algoritmos obsoletos (MD5, SHA1, DES), gerencie chaves de criptografia fora do código.
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

### .NET / C#
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

- **Content Security Policy (CSP)**: defina uma política restritiva (`default-src 'self'`), evite `unsafe-inline`/`unsafe-eval`; use nonces/hashes para scripts inline necessários.
- **XSS**: nunca insira HTML não sanitizado via `innerHTML`/`dangerouslySetInnerHTML`/`v-html` com dados de usuário. Frameworks modernos (React, Vue, Angular) já escapam por padrão — não burle esse comportamento sem sanitização (`DOMPurify`).
- **CSRF**: use tokens anti-CSRF em formulários/state-changing requests, ou cookies `SameSite=Lax/Strict` combinados com verificação de origem (`Origin`/`Referer`) para APIs.
- **Cookies de sessão**: sempre `HttpOnly` (inacessível via JS), `Secure` (só HTTPS), `SameSite=Lax` ou `Strict`.
- **Clickjacking**: header `X-Frame-Options: DENY` ou `frame-ancestors 'none'` na CSP.
- **CORS**: nunca usar `Access-Control-Allow-Origin: *` em endpoints autenticados; especifique origens explícitas e `Access-Control-Allow-Credentials` com cuidado.
- **Subresource Integrity (SRI)**: use atributo `integrity` em `<script>`/`<link>` de CDNs externos.
- **Armazenamento no cliente**: nunca guarde tokens de sessão sensíveis em `localStorage` (acessível via XSS) quando possível — prefira cookies `HttpOnly`. Se precisar de `localStorage`/`sessionStorage`, assuma que qualquer XSS expõe o conteúdo.
- **Dependências de terceiros (npm/CDN)**: cada script de terceiro é superfície de ataque; audite scripts de analytics/tags de marketing.

### Headers de segurança HTTP recomendados
```
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

---

## APIs REST / GraphQL / Autenticação

- **Autenticação**: OAuth2/OIDC para delegação de identidade (ex.: Auth0, Keycloak, Okta, Cognito); JWT com expiração curta (`exp`) + refresh token rotativo; sempre validar assinatura e `iss`/`aud` do JWT no servidor.
- **Autorização**: RBAC (Role-Based) ou ABAC (Attribute-Based) aplicado no backend em toda operação — nunca apenas escondendo botões no frontend.
- **Rate limiting e throttling**: limite por IP/usuário/API key para mitigar brute-force e abuso (429 Too Many Requests).
- **Validação de schema**: valide payloads de entrada contra OpenAPI/JSON Schema antes de processar.
- **GraphQL**: limite profundidade de query (`query depth limiting`) e complexidade (`cost analysis`) para evitar DoS via queries aninhadas; desabilite introspection em produção se a API não for pública.
- **Chaves de API**: nunca embutir em apps mobile/frontend sem escopo restrito; rotacione periodicamente; use API Gateway para centralizar autenticação/rate limit.
- **mTLS** ou assinatura de requisição para comunicação servidor-a-servidor sensível (webhooks, integrações financeiras).

---

## Banco de Dados

- Sempre **queries parametrizadas/prepared statements** — nunca concatenação de string com input do usuário (proteção contra SQL Injection).
- **Least privilege**: usuário de aplicação no banco não deve ter permissão de `DROP`/`ALTER`/acesso a schemas não usados; usuário de migração é separado do usuário de runtime.
- **Criptografia em repouso** para dados sensíveis (PII, dados de pagamento) via criptografia nativa do banco (TDE) ou a nível de coluna/campo.
- **Backups criptografados** e testados periodicamente (restore drill).
- **Segredos de conexão** (connection string, senha) fora do código, via secret manager ou variável de ambiente injetada em runtime.
- Auditoria de acesso a tabelas sensíveis (logs de quem acessou dados de clientes).

---

## Infraestrutura, DevOps e CI/CD

- **Secrets management**: Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager, ou ao menos GitHub/GitLab Secrets — nunca `.env` commitado.
- **SAST** (Static Application Security Testing): SonarQube, Semgrep, CodeQL, integrados ao pipeline de PR.
- **DAST** (Dynamic Application Security Testing): OWASP ZAP, Burp Suite (scans automatizados contra ambiente de staging).
- **Dependency scanning / SCA**: Dependabot, Snyk, Renovate — bloquear merge se houver vulnerabilidade crítica sem exceção justificada.
- **Container security**: imagens base mínimas (`distroless`, `alpine`), scan de imagem (**Trivy**, **Grype**), nunca rodar container como `root`, `.dockerignore` para não copiar segredos/`.git` para a imagem.
- **IaC scanning**: **Checkov**, **tfsec**, **Terrascan** para validar Terraform/CloudFormation antes do `apply`.
- **Least privilege em cloud**: IAM roles/policies específicas por serviço, nunca credenciais de administrador em pipelines de deploy.
- **Assinatura de artefatos**: assine imagens de container (**cosign**/Sigstore) e valide a assinatura no deploy.
- **Branch protection**: exigir review + CI verde antes de merge em `main`; nunca permitir push direto em produção sem pipeline.

---

## Mobile — OWASP Mobile Top 10:2024 e boas práticas

1. **M1 – Improper Credential Usage**: nunca hardcode chaves de API/segredos no binário do app (são extraíveis via reverse engineering); use backend como proxy para chamadas que exigem segredo.
2. **M2 – Inadequate Supply Chain Security**: audite SDKs de terceiros (analytics, ads) quanto a permissões e dados coletados; trave versões de dependências (lockfiles).
3. **M3 – Insecure Authentication/Authorization**: toda decisão de autorização no backend; tokens com expiração curta; biometria (Face ID/Touch ID, BiometricPrompt) apenas como *conveniência* de acesso a um segredo já protegido, nunca como único fator de autenticação do backend.
4. **M4 – Insufficient Input/Output Validation**: valide toda entrada (deep links, intents, formulários) tanto no app quanto no backend.
5. **M5 – Insecure Communication**: HTTPS obrigatório (App Transport Security no iOS, `usesCleartextTraffic=false` no Android); **certificate pinning** para apps de alta sensibilidade (bancos, saúde).
6. **M6 – Inadequate Privacy Controls**: solicite apenas as permissões necessárias (câmera, localização, contatos), explique o motivo (App Tracking Transparency no iOS), minimize coleta de dados pessoais.
7. **M7 – Insufficient Binary Protections**: obfuscação de código (ProGuard/R8 no Android, ofuscação de símbolos no iOS), detecção de jailbreak/root para apps sensíveis, verificação de integridade do binário.
8. **M8 – Security Misconfiguration**: desabilite logs de debug/verbose em builds de produção, remova endpoints de teste/staging do app publicado.
9. **M9 – Insecure Data Storage**: nunca salve dados sensíveis em texto claro em `SharedPreferences`/`UserDefaults`/arquivos planos; use **Keychain** (iOS) e **Android Keystore/EncryptedSharedPreferences** (Android).
10. **M10 – Insufficient Cryptography**: use APIs criptográficas nativas da plataforma (CryptoKit no iOS, Jetpack Security/Tink no Android); nunca implemente cifra própria.

### iOS — específico
- **Keychain Services** para tokens, senhas e chaves — nunca `UserDefaults` para dados sensíveis.
- **App Transport Security (ATS)** habilitado (bloqueia HTTP não seguro por padrão); exceções só com justificativa documentada.
- **Certificate/SSL Pinning** via `URLSessionDelegate` para apps de alto risco.
- Revisar permissões do `Info.plist` (`NSCameraUsageDescription`, etc.) — pedir só o necessário, com descrição clara ao usuário.
- Usar **Data Protection** (`NSFileProtectionComplete`) para arquivos sensíveis em disco.

### Android — específico
- **Android Keystore System** para geração/armazenamento de chaves criptográficas protegidas por hardware (StrongBox quando disponível).
- **Network Security Config** (`network_security_config.xml`) para forçar HTTPS e configurar pinning declarativamente.
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

- Nunca commitar segredos (chaves, senhas, tokens, certificados). Usar
  variáveis de ambiente ou secret manager. Verificar antes de cada commit.
- Toda entrada de usuário é não confiável: validar e sanitizar no backend,
  mesmo que já validada no frontend/app.
- Toda query a banco de dados usa parâmetros/prepared statements ou ORM.
  Nunca concatenar strings SQL.
- Toda decisão de autorização é feita no servidor. Nunca confiar em
  papéis/permissões enviados pelo cliente.
- Senhas: hash com Argon2/bcrypt/scrypt. Nunca texto claro, nunca MD5/SHA1.
- Cookies de sessão: HttpOnly + Secure + SameSite=Lax/Strict.
- Configurar headers de segurança (CSP, HSTS, X-Content-Type-Options,
  X-Frame-Options) em toda resposta HTTP.
- Dependências: rodar audit de vulnerabilidades (npm audit, pip-audit,
  govulncheck, dotnet list package --vulnerable) e resolver criticidades
  altas antes de mergear.
- Mobile: dados sensíveis só em Keychain (iOS) / Keystore-EncryptedSharedPreferences
  (Android). Nunca em UserDefaults/SharedPreferences puro.
- Desktop: segredos só no cofre de credenciais nativo do SO (DPAPI/Credential
  Manager no Windows, Keychain no macOS). Nunca em arquivo de config plano.
- Logs nunca contêm senhas, tokens completos, dados de cartão ou PII em
  texto claro.
- Toda funcionalidade nova que lida com dados sensíveis (login, pagamento,
  upload, permissões) recebe uma revisão de ameaças antes de implementar.
```

---

## Checklist de Revisão de Segurança

- [ ] Nenhum segredo hardcoded no código ou histórico do git.
- [ ] Toda query usa parâmetros/ORM, nenhuma concatenação de SQL.
- [ ] Autorização validada no servidor em todo endpoint sensível.
- [ ] Headers de segurança configurados (CSP, HSTS, X-Frame-Options etc.).
- [ ] Cookies de sessão com `HttpOnly`, `Secure`, `SameSite`.
- [ ] Dependências escaneadas e sem vulnerabilidades críticas abertas.
- [ ] Dados sensíveis em mobile/desktop armazenados via Keychain/Keystore/DPAPI, nunca em texto claro.
- [ ] HTTPS/TLS obrigatório em toda comunicação (web, API, mobile, auto-update).
- [ ] Rate limiting em endpoints de autenticação e APIs públicas.
- [ ] Logs de segurança presentes, sem dados sensíveis expostos.
- [ ] Pipeline de CI com SAST/dependency scanning bloqueando merge em falha crítica.

---

## Fontes e Referências

- OWASP Top 10:2025 (Web): https://owasp.org/Top10/2025/
- OWASP Mobile Top 10:2024: https://owasp.org/www-project-mobile-top-10/
- OWASP Mobile Application Security Verification Standard (MASVS) / MASTG: https://owasp.org/www-project-mobile-app-security/
- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/
- Apple Platform Security Guide: https://support.apple.com/guide/security/
- Microsoft Security Development Lifecycle (SDL): https://www.microsoft.com/sdl
