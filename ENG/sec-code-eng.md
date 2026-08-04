# Security Guide for Web, Mobile, and Desktop Development

> Practical security instructions (secure coding) for the main languages and technologies used in modern development — web, mobile (iOS/Android), and desktop (Windows/macOS). Use this document as a reference to guide AI agents and developers on common risks and how to mitigate them in each stack. Based on OWASP Top 10:2025 (web), OWASP Mobile Top 10:2024, and OWASP MASVS.

> **Related documents**: for general code quality/structure, see [`clean-code-eng.md`](./clean-code-eng.md). For testing frameworks and tools (including SAST/DAST as part of the pipeline), see [`test-code-eng.md`](./test-code-eng.md). For video and HTML compositions, see [HyperFrames](https://hyperframes.heygen.com) and treat scripts, assets, and external URLs as an attack surface. This file is the canonical security reference; secrets, authorization, cryptography, and OWASP rules live here, not in the other files.

> **Mandatory tooling**: if any tool, dependency, runtime, CLI or utility required to execute this guide (linter, formatter, test framework, scanner, profiler, engine, etc.) is not installed in the environment, **request its installation from the user immediately** (or install it with approval, per the environment's policy). No step, check or deliverable may be skipped, postponed or replaced because "the tool is not installed" — the task is only complete when all required checks have actually been executed.

## General principles (valid for any platform)

- **Secure by design**: think about security during the design phase, not as a "review" at the end. Perform threat modeling for sensitive features (login, payment, file upload).
- **Least privilege**: users, processes, API keys, and database credentials must have only the permissions strictly necessary.
- **Defense in depth**: never rely on a single layer of protection (e.g., validation only on the frontend). Every critical validation/authorization must be repeated in the backend.
- **Never trust the client**: data coming from the browser, mobile app, or desktop app can be manipulated. Every security decision (authentication, authorization, price, permission) is made on the server.
- **Fail secure / secure by default**: in case of an error or missing configuration, the system must deny access by default, never grant it.
- **Secrets never in source code**: API keys, passwords, tokens, and certificates belong in environment variables or secret management services (Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager) — never committed to git.
- **Compositions and media are inputs too**: validate generated HTML/JS, manifests, URLs, formats, sizes, and media origins; pin dependencies where possible and never embed secrets in a composition or video bundle.
- **Continuously update dependencies**: use automated scanners (Dependabot, Renovate, Snyk, `npm audit`, `pip-audit`, `bundler-audit`) and treat critical vulnerabilities as high-priority bugs.
- **Log security events, never sensitive data**: record login attempts, authorization failures, and permission changes; never log passwords, complete tokens, card numbers, or personal data in plain text.
- **Cryptography**: use industry-standard libraries/algorithms (AES-256, RSA-2048+, Argon2/bcrypt/scrypt for passwords). Never implement your own encryption or hashing algorithm.

---

## OWASP Top 10:2025 (Web) — overview and mitigation

1. **A01 – Broken Access Control (Broken access control)**: validate authorization on every route/endpoint, on the server, for every resource (including direct ID/IDOR). Never trust a `role` sent by the client. Apply deny-by-default.
2. **A02 – Security Misconfiguration**: remove default accounts/services, disable stack traces and detailed error messages in production, configure security headers (see HTTP section), and keep dev/staging/prod environments consistently hardened.
3. **A03 – Software Supply Chain Failures**: audit dependencies, use lockfiles (`package-lock.json`, `poetry.lock`), generate an SBOM (Software Bill of Materials), validate package integrity (checksums/signatures), and restrict CI/CD and publish-token permissions.
4. **A04 – Cryptographic Failures**: use HTTPS/TLS 1.2+ everywhere, never store passwords in plain text (use Argon2/bcrypt), do not use obsolete algorithms (MD5, SHA1, DES), and manage encryption keys outside the code.
5. **A05 – Injection**: use parameterized queries/ORMs (never concatenate SQL), validate and sanitize all input, escape output in templates (protection against XSS), and avoid `eval`/`exec` with external data.
6. **A06 – Insecure Design**: apply threat modeling, and review critical flows (password recovery, upload, payment) with a focus on abuse, not just the "happy path."
7. **A07 – Authentication Failures**: require MFA for sensitive accounts, apply rate limiting to login, block/delay after failed attempts, use session tokens with expiration and rotation, and never reveal whether the "user exists" in login error messages.
8. **A08 – Software or Data Integrity Failures**: validate update/package signatures, use CI/CD with protected pipelines (branch protection, commit signing), and never deserialize untrusted data without schema validation.
9. **A09 – Security Logging and Alerting Failures**: ensure security event logs (login, authorization failure, permission change) with automatic alerts for anomalies (multiple failures, access outside the usual pattern).
10. **A10 – Mishandling of Exceptional Conditions**: explicitly handle exceptions and resource limits (timeouts, quotas, payload/upload size limits), never expose a stack trace to the end user, and always "fail closed" on unexpected errors.

---

## Web — Backend by language/technology

### Node.js / JavaScript / TypeScript
- **Helmet** (Express) or equivalent middleware to configure security headers automatically.
- Input validation with **Zod**, **Joi**, or **Yup** — never trust `req.body` without a schema.
- ORMs with parameterized queries (**Prisma**, **Drizzle**, **TypeORM**) instead of manually concatenated SQL.
- `npm audit` / **Snyk** / **Socket.dev** for dependencies; beware of *supply chain attacks* through malicious npm packages/typosquatting.
- Never use `eval()`, `new Function()`, or `child_process.exec()` with unsanitized input.
- Rate limiting with **express-rate-limit** or at the gateway/CDN (Cloudflare, etc.).

### Python
- ORMs with parameterized queries (**Django ORM**, **SQLAlchemy**) — never `cursor.execute(f"...{var}...")`.
- Schema validation with **Pydantic** (FastAPI already uses it natively).
- `pip-audit` / **Safety** / **Bandit** (static SAST for Python) in CI.
- Django: keep `DEBUG = False` in production, keep `SECRET_KEY` outside the code, restrict `ALLOWED_HOSTS`, and use `django-csp` for Content-Security-Policy.
- Never use `pickle` to deserialize data from an untrusted source (arbitrary code execution).

### .NET / C#
- Use **Entity Framework** with LINQ/parameters (never `SqlCommand` with string concatenation).
- **ASP.NET Core Identity** or **Duende IdentityServer**/**Microsoft.Identity.Web** for authentication/OAuth2/OIDC.
- Data Protection API for encrypting data at rest and tokens.
- `dotnet list package --vulnerable` to check for vulnerable dependencies; enable **NuGet Audit**.
- Configure `[ValidateAntiForgeryToken]` on forms; use `HttpOnly`/`Secure`/`SameSite` on session cookies.

### Java
- **Prepared Statements**/parameterized JPA (never `Statement` with concatenation).
- **Spring Security** for declarative authentication/authorization; **OWASP Dependency-Check** or **Snyk** integrated with Maven/Gradle.
- Avoid insecure deserialization of Java objects (`ObjectInputStream` from untrusted sources) — use JSON with a validated schema instead of Java binary serialization whenever possible.
- Disable external entity resolution in XML parsers (protection against XXE): `setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)`.

### PHP
- **PDO with prepared statements** (never `mysqli_query` with concatenation).
- Modern frameworks (Laravel, Symfony) already perform automatic escaping in templates (Blade/Twig) — avoid `{!! !!}`/`|raw` without sanitization.
- `composer audit` for vulnerable dependencies.
- Configure `session.cookie_httponly`, `session.cookie_secure`, `session.cookie_samesite` in `php.ini`.

### Ruby / Rails
- ActiveRecord with parameters (never `where("... #{var}")`).
- **Brakeman** (SAST specific to Rails) in CI.
- `bundler-audit` for vulnerable gems.
- Rails protects against CSRF by default (`protect_from_forgery`) — never disable it without a justified need.

### Go
- `database/sql` with parameters (`?`/`$1`) — never use `fmt.Sprintf` to build SQL.
- **govulncheck** to check for known vulnerabilities in dependencies and the stdlib.
- Use `context.Context` with a timeout in every external call to avoid resource exhaustion.

---

## Web — Frontend / Browser

- **Content Security Policy (CSP)**: define a restrictive policy (`default-src 'self'`), avoid `unsafe-inline`/`unsafe-eval`; use nonces/hashes for necessary inline scripts.
- **XSS**: never insert unsanitized HTML through `innerHTML`/`dangerouslySetInnerHTML`/`v-html` with user data. Modern frameworks (React, Vue, Angular) escape by default — do not bypass this behavior without sanitization (`DOMPurify`).
- **CSRF**: use anti-CSRF tokens in forms/state-changing requests, or `SameSite=Lax/Strict` cookies combined with origin verification (`Origin`/`Referer`) for APIs.
- **Session cookies**: always use `HttpOnly` (inaccessible through JS), `Secure` (HTTPS only), and `SameSite=Lax` or `Strict`.
- **Clickjacking**: use the `X-Frame-Options: DENY` header or `frame-ancestors 'none'` in the CSP.
- **CORS**: never use `Access-Control-Allow-Origin: *` on authenticated endpoints; specify explicit origins and use `Access-Control-Allow-Credentials` carefully.
- **Subresource Integrity (SRI)**: use the `integrity` attribute on `<script>`/`<link>` elements from external CDNs.
- **Client-side storage**: never store sensitive session tokens in `localStorage` (accessible through XSS) when possible — prefer `HttpOnly` cookies. If you need `localStorage`/`sessionStorage`, assume that any XSS exposes their contents.
- **Third-party dependencies (npm/CDN)**: every third-party script is an attack surface; audit analytics/marketing-tag scripts.

### Recommended HTTP security headers
```
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

---

## REST / GraphQL APIs / Authentication

- **Authentication**: OAuth2/OIDC for identity delegation (e.g., Auth0, Keycloak, Okta, Cognito); JWT with short expiration (`exp`) + rotating refresh token; always validate the JWT signature and `iss`/`aud` on the server.
- **Authorization**: RBAC (Role-Based) or ABAC (Attribute-Based) applied in the backend for every operation — never only by hiding buttons in the frontend.
- **Rate limiting and throttling**: limit by IP/user/API key to mitigate brute-force attacks and abuse (429 Too Many Requests).
- **Schema validation**: validate input payloads against OpenAPI/JSON Schema before processing.
- **GraphQL**: limit query depth (`query depth limiting`) and complexity (`cost analysis`) to prevent DoS through nested queries; disable introspection in production if the API is not public.
- **API keys**: never embed them in mobile/frontend apps without a restricted scope; rotate them periodically; use an API Gateway to centralize authentication/rate limiting.
- **mTLS** or request signing for sensitive server-to-server communication (webhooks, financial integrations).

---

## Database

- Always use **parameterized queries/prepared statements** — never concatenate strings with user input (protection against SQL Injection).
- **Least privilege**: the application user in the database must not have `DROP`/`ALTER` permission or access to unused schemas; the migration user is separate from the runtime user.
- **Encryption at rest** for sensitive data (PII, payment data) through native database encryption (TDE) or at the column/field level.
- **Encrypted backups** tested periodically (restore drill).
- **Connection secrets** (connection string, password) outside the code, through a secret manager or an environment variable injected at runtime.
- Audit access to sensitive tables (logs of who accessed customer data).

---

## Infrastructure, DevOps, and CI/CD

- **Secrets management**: Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager, or at least GitHub/GitLab Secrets — never a committed `.env` file.
- **SAST** (Static Application Security Testing): SonarQube, Semgrep, CodeQL, integrated into the PR pipeline.
- **DAST** (Dynamic Application Security Testing): OWASP ZAP, Burp Suite (automated scans against a staging environment).
- **Dependency scanning / SCA**: Dependabot, Snyk, Renovate — block the merge if there is a critical vulnerability without a justified exception.
- **Container security**: minimal base images (`distroless`, `alpine`), image scanning (**Trivy**, **Grype**), never run a container as `root`, and use `.dockerignore` to avoid copying secrets/`.git` into the image.
- **IaC scanning**: **Checkov**, **tfsec**, **Terrascan** to validate Terraform/CloudFormation before `apply`.
- **Least privilege in the cloud**: IAM roles/policies specific to each service, never administrator credentials in deployment pipelines.
- **Artifact signing**: sign container images (**cosign**/Sigstore) and validate the signature during deployment.
- **Branch protection**: require review + green CI before merging into `main`; never allow direct pushes to production without a pipeline.

---

## Mobile — OWASP Mobile Top 10:2024 and best practices

1. **M1 – Improper Credential Usage**: never hardcode API keys/secrets in the app binary (they can be extracted through reverse engineering); use the backend as a proxy for calls that require a secret.
2. **M2 – Inadequate Supply Chain Security**: audit third-party SDKs (analytics, ads) for permissions and collected data; pin dependency versions (lockfiles).
3. **M3 – Insecure Authentication/Authorization**: every authorization decision belongs in the backend; tokens with short expiration; biometrics (Face ID/Touch ID, BiometricPrompt) only as a *convenience* for accessing an already protected secret, never as the sole authentication factor for the backend.
4. **M4 – Insufficient Input/Output Validation**: validate all input (deep links, intents, forms) both in the app and in the backend.
5. **M5 – Insecure Communication**: HTTPS is mandatory (App Transport Security on iOS, `usesCleartextTraffic=false` on Android); **certificate pinning** for highly sensitive apps (banking, healthcare).
6. **M6 – Inadequate Privacy Controls**: request only the necessary permissions (camera, location, contacts), explain the reason (App Tracking Transparency on iOS), and minimize personal-data collection.
7. **M7 – Insufficient Binary Protections**: code obfuscation (ProGuard/R8 on Android, symbol obfuscation on iOS), jailbreak/root detection for sensitive apps, and binary integrity verification.
8. **M8 – Security Misconfiguration**: disable debug/verbose logs in production builds, and remove test/staging endpoints from the published app.
9. **M9 – Insecure Data Storage**: never save sensitive data in plain text in `SharedPreferences`/`UserDefaults`/flat files; use **Keychain** (iOS) and **Android Keystore/EncryptedSharedPreferences** (Android).
10. **M10 – Insufficient Cryptography**: use the platform's native cryptographic APIs (CryptoKit on iOS, Jetpack Security/Tink on Android); never implement your own cipher.

### iOS — specific
- **Keychain Services** for tokens, passwords, and keys — never `UserDefaults` for sensitive data.
- **App Transport Security (ATS)** enabled (blocks insecure HTTP by default); exceptions only with documented justification.
- **Certificate/SSL Pinning** through `URLSessionDelegate` for high-risk apps.
- Review `Info.plist` permissions (`NSCameraUsageDescription`, etc.) — request only what is necessary, with a clear description for the user.
- Use **Data Protection** (`NSFileProtectionComplete`) for sensitive files on disk.

### Android — specific
- **Android Keystore System** for generating/storing hardware-protected cryptographic keys (StrongBox when available).
- **Network Security Config** (`network_security_config.xml`) to enforce HTTPS and configure pinning declaratively.
- **ProGuard/R8** for obfuscation and removal of unused code in release builds.
- Be careful with **implicit Intents** and **Deep Links** — validate the origin and sanitize data received through `Intent`/`Deep Link`; never trust them as a secure source.
- `android:exported="false"` on components (Activities/Services/Receivers) that do not need to be accessed by other apps.
- Check **runtime permissions** with the minimum necessary and an explanation for the user.

---

## Desktop — Windows and macOS

### Windows
- **DPAPI (Data Protection API)** or **Windows Credential Manager** to store local secrets (never in plain-text configuration files).
- **Code signing** with a valid certificate — unsigned builds trigger SmartScreen/Defender alerts.
- Run with the lowest possible privilege; avoid requiring administrator elevation unless strictly necessary (UAC).
- Validate update integrity (digital signature) before applying updates — never download/execute a binary without verification.
- Sandboxing where possible (**AppContainer**, MSIX with restricted capabilities).

### macOS
- **Keychain Services** (the same conceptual API as iOS) to store credentials and keys.
- **Apple notarization** and **code signing (codesign)** required for distribution outside the App Store without triggering Gatekeeper blocking.
- **App Sandbox** and **Hardened Runtime** enabled, requesting only the necessary *entitlements* (network, camera, file access).
- Never disable **App Transport Security**/TLS validation to "make" production debugging easier.
- Validate the integrity of auto-updates (e.g., **Sparkle** framework) with an EdDSA signature before installing.

### Common rules (Windows + macOS)
- Never store passwords, tokens, or API keys in plain-text configuration files (`.ini`, `.json`, `.xml`) in the user directory — use the OS's native credential vault.
- Every auto-update channel must use HTTPS + package signature verification before installation.
- Minimize permissions requested from the OS (file, network, automation access) and explain the reason to the user.
- Treat the user's machine as an untrusted environment: any secret embedded in the binary can be extracted by a user with local privileges.

---

## Cross-cutting: Hybrid and cross-platform apps (Electron, React Native, Flutter, .NET MAUI)

- **Electron**: keep `nodeIntegration: false` and `contextIsolation: true` in `BrowserWindow`; use `preload` scripts with explicitly exposed APIs (`contextBridge`); update Electron/Chromium frequently (browser vulnerabilities affect the entire app).
- **React Native**: follow the same secure-storage rules as native mobile (use `react-native-keychain`, not plain `AsyncStorage` for secrets); validate deep links.
- **Flutter**: use `flutter_secure_storage` (which uses Keychain/Keystore underneath) instead of `shared_preferences` for sensitive data.
- In all cases: sensitive business logic and API secrets must never live only on the client — always have a backend performing validation/authorization.

---

## Instruction template for inclusion in CLAUDE.md / AGENTS.md

```
## Security

- Never commit secrets (keys, passwords, tokens, certificates). Use
  environment variables or a secret manager. Check before every commit.
- All user input is untrusted: validate and sanitize in the backend,
  even if it has already been validated in the frontend/app.
- Every database query uses parameters/prepared statements or an ORM.
  Never concatenate SQL strings.
- Every authorization decision is made on the server. Never trust
  roles/permissions sent by the client.
- Passwords: hash with Argon2/bcrypt/scrypt. Never plain text, never MD5/SHA1.
- Session cookies: HttpOnly + Secure + SameSite=Lax/Strict.
- Configure security headers (CSP, HSTS, X-Content-Type-Options,
  X-Frame-Options) on every HTTP response.
- Dependencies: run vulnerability audits (npm audit, pip-audit,
  govulncheck, dotnet list package --vulnerable) and resolve high-severity
  issues before merging.
- Mobile: sensitive data only in Keychain (iOS) / Keystore-EncryptedSharedPreferences
  (Android). Never in plain UserDefaults/SharedPreferences.
- Desktop: secrets only in the OS's native credential vault (DPAPI/Credential
  Manager on Windows, Keychain on macOS). Never in a flat config file.
- Logs never contain passwords, complete tokens, card data, or PII in
  plain text.
- Every new feature that handles sensitive data (login, payment,
  upload, permissions) receives a threat review before implementation.
```

---

## Security Review Checklist

- [ ] No secrets hardcoded in the code or git history.
- [ ] Every query uses parameters/an ORM, with no SQL concatenation.
- [ ] Authorization validated on the server for every sensitive endpoint.
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options, etc.).
- [ ] Session cookies use `HttpOnly`, `Secure`, `SameSite`.
- [ ] Dependencies scanned and free of open critical vulnerabilities.
- [ ] Sensitive data on mobile/desktop stored through Keychain/Keystore/DPAPI, never in plain text.
- [ ] HTTPS/TLS mandatory for all communication (web, API, mobile, auto-update).
- [ ] Rate limiting on authentication endpoints and public APIs.
- [ ] Security logs present, with no sensitive data exposed.
- [ ] CI pipeline with SAST/dependency scanning blocking merges on critical failures.

---

## Sources and References

- OWASP Top 10:2025 (Web): https://owasp.org/Top10/2025/
- OWASP Mobile Top 10:2024: https://owasp.org/www-project-mobile-top-10/
- OWASP Mobile Application Security Verification Standard (MASVS) / MASTG: https://owasp.org/www-project-mobile-app-security/
- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/
- Apple Platform Security Guide: https://support.apple.com/guide/security/
- Microsoft Security Development Lifecycle (SDL): https://www.microsoft.com/sdl
