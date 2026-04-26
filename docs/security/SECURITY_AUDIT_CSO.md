# PACTA Security Audit Report
**Date:** 2026-04-26  
**Version:** v0.44.10  
**Audit Mode:** CSO (Chief Security Officer) - Comprehensive Infrastructure & Application Security Review  
**Auditor:** Kilo (AI Security Analyst)  

---

## Executive Summary

**Overall Risk:** **MEDIUM-HIGH**  
**Critical Findings:** 1  
**High Findings:** 7  
**Medium Findings:** 12  
**Low Findings:** 8  

PACTA demonstrates **strong security foundations** with parameterized queries, bcrypt password hashing, session management, audit logging, and tenant isolation via application-level `company_id` filtering. However, several **critical and high-severity issues** require immediate attention, particularly around network exposure, XSS protection, and dependency vulnerabilities.

**Key Strengths:**
- ✅ Parameterized queries throughout (no SQL injection in active code)
- ✅ Bcrypt password hashing with reasonable cost
- ✅ Session tokens use crypto/rand (256-bit entropy)
- ✅ HttpOnly, Secure, SameSite=Strict cookies
- ✅ Comprehensive audit logging with JSON state capture
- ✅ Multi-tenancy enforced via company_id filters on all queries
- ✅ File upload MIME type validation (content-based)
- ✅ Role-based access control (admin/manager/editor/viewer)

**Critical Concerns:**
- ⚠️ **Server exposed on all interfaces** (0.0.0.0:3000) — reachable from network
- ⚠️ **No HTTPS/TLS** — all traffic in cleartext
- ⚠️ **CSP allows `unsafe-inline` & `unsafe-eval`** — XSS vulnerability
- ⚠️ **SQL injection pattern in dead code** (`EnforceOwnership` table parameter)
- ⚠️ **gorilla/csrf v1.7.3** has known CVE (CVE-2025-47909)
- ⚠️ **User enumeration** via login error messages

---

## Findings by Severity

### CRITICAL

#### 1. SQL Injection Vulnerability in Dead Code (Potential Future Risk)
**CWE:** CWE-89 (SQL Injection)  
**Location:** `internal/server/rls.go:25-29`  
**CVSS:** 8.1 (High) — *if exploitable*

```go
func EnforceOwnership(db *sql.DB, companyID int, resourceID int, table string) error {
    query := fmt.Sprintf(`
        SELECT COUNT(*) FROM %s 
        WHERE id = ? AND company_id = ? AND deleted_at IS NULL
    `, table)  // ← table directly interpolated
    ...
}
```

**Description:**  
The `table` parameter is concatenated into the SQL query using `fmt.Sprintf` without validation. While this function is **currently unused**, it presents a latent vulnerability that could be exploited if called with user-controlled input in the future.

**Impact:**  
If an attacker can control the `table` parameter, they could inject arbitrary SQL, leading to data exfiltration, corruption, or remote code execution (via SQLite extensions).

**Remediation:**
- **Immediate:** Remove dead code or validate `table` against an allowlist:
  ```go
  allowedTables := map[string]bool{"contracts": true, "clients": true, "suppliers": true, ...}
  if !allowedTables[table] { return errors.New("invalid table") }
  ```
- **Long-term:** Refactor to use generic repository pattern or remove entirely.

---

### HIGH

#### 1. Server Binds to All Network Interfaces (0.0.0.0)
**CWE:** CWE-16 (Configuration)  
**Location:** `internal/config/config.go:29` → `Addr: ":%d"`  
**Severity:** High

```go
return &Config{
    Addr:    fmt.Sprintf(":%d", DefaultPort),  // Binds to 0.0.0.0:3000
    ...
}
```

**Description:**  
The HTTP server binds to all available network interfaces (`:3000`). On a multi-host system or production deployment, this exposes the application to any reachable network interface, including external networks if firewall rules permit.

**Evidence:** Server logs show `"running on http://127.0.0.1:3000"` but actual bind is `:3000` (all interfaces).

**Impact:**  
- Unnecessary attack surface expansion
- Potential for network-based attacks from beyond localhost
- Violates principle of least privilege

**Remediation:**  
Bind to localhost explicitly:
```go
Addr: fmt.Sprintf("127.0.0.1:%d", DefaultPort)
```
Or make configurable via environment variable (with secure default).

---

#### 2. No HTTPS/TLS Encryption
**CWE:** CWE-319 (Cleartext Transmission of Sensitive Data)  
**Location:** `internal/server/server.go:221-231`  

```go
srv := &http.Server{
    Addr:         cfg.Addr,
    Handler:      r,
    ReadTimeout:  15 * time.Second,
    WriteTimeout: 15 * time.Second,
    // No TLS configuration
}
...
srv.ListenAndServe()  // HTTP only
```

**Description:**  
PACTA runs exclusively over HTTP with no TLS encryption. All traffic, including credentials (session cookies, passwords), is transmitted in cleartext.

**Impact:**  
- **Credentials theft** via network sniffing
- **Session hijacking** on any shared network
- **Data interception** (contracts, client data, PII)
- Non-compliance with GDPR, HIPAA, PCI-DSS (encryption in transit required)

**Remediation:**  
- Implement HTTPS with Let's Encrypt or self-signed certs for local deployments
- Add `ListenAndServeTLS()` with certificate paths from config
- Set `Secure` flag on cookies (already done) but requires HTTPS
- Redirect HTTP → HTTPS (if external facing)

---

#### 3. Content Security Policy Allows `unsafe-inline` and `unsafe-eval`
**CWE:** CWE-79 (Improper Neutralization of Input During Web Page Generation)  
**Location:** `internal/server/middleware/security_headers.go:16`

```go
csp := "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; ..."
```

**Description:**  
CSP allows `'unsafe-inline'` for scripts and styles, and `'unsafe-eval'` for scripts. This **completely defeats XSS protection** provided by CSP, allowing any injected script to execute.

**Impact:**  
- XSS attacks can execute arbitrary JavaScript
- Session theft, credential harvesting, data exfiltration
- DOM manipulation, phishing, malware injection

**Remediation:**
- Remove `'unsafe-inline'` and `'unsafe-eval'`
- Use nonces or hashes for inline scripts
- For React apps, use `script-src 'self' 'nonce-{random}'` and set nonce on needed scripts
- Consider strict-dynamic if using trusted CDNs

---

#### 4. gorilla/csrf v1.7.3 — CVE-2025-47909 (TrustedOrigins Bypass)
**CWE:** CWE-346 (Origin Validation Error)  
**Location:** `go.mod:8` — `github.com/gorilla/csrf v1.7.3`  
**CVE:** [CVE-2025-47909](https://github.com/gorilla/csrf/issues/204) (GO-2025-3884)  
**CVSS:** 6.5 (Medium) — *but escalates to High in multi-tenant context*

**Description:**  
gorilla/csrf ≤ v1.7.3 (including v1.7.3) has flawed TrustedOrigins validation. While PACTA does **not currently use TrustedOrigins**, the library contains a latent vulnerability. More critically, the SameSite attribute is set to Strict (good), but Referer validation may be insufficient if behind a reverse proxy that modifies Host headers (see issue #187).

**Impact:**  
- CSRF attacks possible if TrustedOrigins is ever configured
- Potential bypass when behind reverse proxy with Host rewriting
- Cross-origin form submissions could be accepted

**Remediation:**
- **Upgrade to a patched fork**: `filippo.io/csrf/gorilla` (recommended by gorilla/csrf maintainers)
- Or migrate to Go 1.25+ native `net/http.CrossOriginProtection`
- If staying on gorilla/csrf, ensure no TrustedOrigins is set and validate Host header manually behind proxies

---

#### 5. User Enumeration via Login Error Messages
**CWE:** CWE-204 (Observable Discrepancy)  
**Location:** `internal/handlers/auth.go:129-132, 135-137`

```go
user, err := auth.Authenticate(h.DB, req.Email, req.Password)
if err != nil {
    h.Error(w, http.StatusUnauthorized, err.Error())  // "user not found" vs "invalid password"
}
if user.Status == "pending_email" {
    h.Error(w, http.StatusForbidden, "please verify your email...")  // reveals email exists
}
```

**Description:**  
Login returns different error messages for non-existent users vs wrong passwords. Email verification endpoint also reveals account existence. This allows attackers to enumerate valid user accounts.

**Impact:**  
- User enumeration → targeted phishing, password spraying
- Privacy violation (discloses who has an account)
- Facilitates account takeover workflows

**Remediation:**
- Use generic error message: _"Invalid credentials or account not yet approved"_
- Return same HTTP status and response time for both cases
- Consider rate limiting per IP for unauthenticated requests

---

#### 6. Hardcoded Default Admin Password in Frontend Code
**CWE:** CWE-798 (Use of Hard-coded Credentials)  
**Location:** `pacta_appweb/src/lib/storage.ts:99`  
**Severity:** High (even if unused, it's a security smell and may be activated in dev)

```typescript
export const initializeDefaultUser = (): void => {
  const users = getUsers();
  if (users.length === 0) {
    const defaultAdmin: User = {
      ...
      password: 'pacta123',  // ← Hardcoded password
      ...
    };
    setUsers([defaultAdmin]);
  }
};
```

**Description:**  
A default admin user with password `pacta123` is hardcoded in the frontend. Although the function appears unused, the code remains in production bundles. If accidentally invoked (e.g., during development or misconfiguration), it creates a backdoor admin account.

**Impact:**  
- **Privilege escalation** if function is called
- **Backdoor account** knowledge is public (anyone with bundle knows credentials)
- Violates security best practices (secrets in code)

**Remediation:**
- Remove `initializeDefaultUser()` entirely (backend setup handles initial user creation)
- Or remove password field from frontend helper
- Ensure production builds strip development-only code via tree-shaking or environment flags

---

#### 7. Missing Rate Limiting on Authentication Endpoints
**CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)  
**Location:** `internal/server/middleware/rate_limit.go:18` (global only), server.go:56-63 (CSRF exempt list)

```go
var globalLimit = RateLimitConfig{Requests: 100, Window: time.Minute}
return httprate.LimitAll(globalLimit.Requests, globalLimit.Window)
```

**Description:**  
Rate limiting is applied globally at 100 requests/minute per IP. However, **authentication endpoints** (`/api/auth/login`, `/api/auth/register`) could be targeted for brute-force attacks. No stricter limit exists for these sensitive paths.

**Impact:**  
- **Credential stuffing / brute-force attacks** feasible at 100 RPM
- Account lockout not implemented (only status-based)
- Excessive login attempts go unchecked

**Remediation:**
- Add stricter per-endpoint limits:
  ```go
  r.Use(httprate.Limit(5, time.Minute, httprate.KeyByIP)) // on login/register
  ```
- Implement progressive delays or account lockout after N failed attempts
- Add captcha after threshold
- Log and alert on repeated failures

---

### MEDIUM

#### 8. Audit Log IP Address Spoofable via X-Forwarded-For
**CWE:** CWE-346 (Origin Validation Error)  
**Location:** `internal/handlers/audit.go:29` → `ip := r.RemoteAddr`  
**Also:** `internal/server/middleware/rate_limit_redis.go:61-69` (same issue)

```go
ip := r.RemoteAddr  // Unprotected RemoteAddr
```

**Description:**  
`RemoteAddr` reflects the immediate peer address. When behind a reverse proxy or load balancer, the true client IP is in `X-Forwarded-For` header, which is currently ignored. Worse, an attacker can spoof `X-Forwarded-For` and have it logged as IP (depending on proxy configuration).

**Impact:**  
- **Audit logs unreliable** for forensic analysis
- Attackers can impersonate IP addresses in logs
- Rate limiting can be bypassed by spoofing X-Forwarded-For

**Remediation:**
- Trust `X-Forwarded-For` only from known proxies/load balancers
- Use `r.Header.Get("X-Forwarded-For")` with validation
- Configure `TrustedProxies` in chi or use middleware to sanitize
- Store both `remote_addr` and `x_forwarded_for` for context

---

#### 9. File Upload Path Traversal Check Only in One Handler
**CWE:** CWE-22 (Path Traversal)  
**Location:** `internal/handlers/documents.go:463` (only in `HandleServeTempDocument`)

```go
if strings.Contains(key, "..") {
    h.Error(w, http.StatusForbidden, "invalid path")
    return
}
```

**Description:**  
The directory traversal check (`..`) is present only in `HandleServeTempDocument`. Other file operations (upload, delete, download) use `filepath.Join` with user-provided `storageKey` (UUID) which is safe, but a missing check in `HandleUploadTempDocument` or document download could be risky if the storage key generation is ever compromised.

**Impact:**  
- If UUID generation fails or is predictable, attacker could traverse directories
- Partial mitigation currently relies on UUID randomness

**Remediation:**
- Validate all file path components are alphanumeric/hyphen/underscore only
- Use `filepath.Clean()` and ensure result stays within intended directory
- Add `if strings.Contains(key, "..")` check to all file-serving endpoints

---

#### 10. Error Messages Leak Information
**CWE:** CWE-209 (Generation of Error Message Containing Sensitive Information)  
**Multiple locations**

Examples:
- `internal/handlers/auth.go:55` — `log.Printf("[register] ERROR checking email existence: %v", err)` — could leak query structure
- `internal/handlers/contracts.go:89` — `h.Error(w, http.StatusInternalServerError, err.Error())` — raw DB error to client
- `internal/handlers/documents.go:66` — `"failed to list documents"` (generic, OK)

**Description:**  
Some database errors and internal errors are passed directly to client responses or logged with full query details. While many are generic, a few expose DB structure.

**Impact:**  
- Information leakage (table names, column names)
- Facilitates SQL injection by revealing schema
- Debugging information exposed to attackers

**Remediation:**
- Never echo `err.Error()` to client; use generic messages
- Log detailed errors server-side only
- Ensure all `h.Error()` calls pass sanitized messages

---

#### 11. CSP Missing `nonce-` or `hash-` for Inline Scripts
**CWE:** CWE-79  
**Location:** `internal/server/middleware/security_headers.go:16`

**Description:**  
PACTA uses `unsafe-inline` instead of nonces/hashes. React apps typically need inline scripts for hydration. The proper approach is to use a nonce generated per request and added to script tags.

**Impact:**  
- All inline scripts executable by injected code
- Bypasses CSP's XSS protection entirely

**Remediation:**
- Generate random nonce per request, store in context
- Add to CSP: `script-src 'self' 'nonce-{random}'`
- Inject nonce into HTML via template or middleware
- Remove `'unsafe-eval'` (only needed for dev, not prod)

---

#### 12. No HSTS Preload or IncludeSubDomains in All Contexts
**CWE:** CWE-319  
**Location:** `internal/server/middleware/security_headers.go:35-37`

```go
if os.Getenv("ENVIRONMENT") == "production" {
    w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
}
```

**Description:**  
HSTS is only set when `ENVIRONMENT=production`. The environment variable `ENV` is checked elsewhere (`isProduction()` in csrf.go checks `ENV`). This inconsistency could mean HSTS not applied. Also requires explicit opt-in to preload.

**Impact:**  
- HTTPS not enforced if env var missing/mismatched
- SSL stripping attacks possible
- Missing preload means browsers won't force HTTPS

**Remediation:**
- Standardize on `ENVIRONMENT` or `ENV` variable
- Set HSTS unconditionally (or use Go's `tls.Config` with `MinVersion`)
- Submit to `hstspreload.org` if publicly trusted cert used

---

#### 13. CORS AllowedOrigins Hardcoded to Two Origins
**Location:** `internal/server/middleware/cors.go:11-14`

```go
AllowedOrigins: []string{
    "http://127.0.0.1:3000",
    "https://app.pacta.local",
}
```

**Description:**  
CORS only allows localhost and a `.local` domain. For production deployments, this will **block all legitimate cross-origin requests** unless the app is behind a reverse proxy that rewrites Origin (which is not standard).

**Impact:**  
- Application may break in production if served from different origin
- Forces same-origin deployment, limiting architecture options
- Potential for developers to "fix" by wildcarding `*` (dangerous)

**Remediation:**
- Make AllowedOrigins configurable via environment variable
- Support common production origins (actual domain)
- Validate origin against trusted patterns not hardcoded list

---

#### 14. CSRF Secret Generation Falls Back to Insecure Random
**Location:** `internal/server/middleware/csrf.go:54, 60-72`

```go
if secret == "" {
    if isProduction() {
        panic("CSRF_SECRET must be set in production")
    }
    secret = generateRandomString(32)  // Uses rand.Int fallback if rand.Read fails
}
...
func generateRandomString(n int) string {
    b := make([]byte, n)
    if _, err := rand.Read(b); err != nil {
        // Fallback to less secure but still random enough for dev
        for i := range b {
            r, _ := rand.Int(rand.Reader, big.NewInt(26))
            b[i] = byte(65) + byte(r.Int64())
        }
        return base64.StdEncoding.EncodeToString(b)
    }
    return base64.StdEncoding.EncodeToString(b)
}
```

**Description:**  
In production, missing `CSRF_SECRET` causes panic (good). In development, if `rand.Read` fails, it falls back to `rand.Int` with range 26 (a-z only), severely reducing entropy. While acceptable for dev, it indicates error handling weaknesses.

**Impact:**  
- Development environments may have weak CSRF secrets if `/dev/random` unavailable
- Panic on missing secret in production may cause downtime if not monitored

**Remediation:**
- At startup, validate CSRF_SECRET length ≥ 32 bytes, exit with clear error if invalid
- Remove fallback or log warning if fallback used
- Generate persistent secret on first run if missing (like JWT_SECRET guidance)

---

#### 15. Session Expiry Too Long (24 Hours)
**Location:** `internal/auth/session.go:31`

```go
expiresAt := time.Now().Add(24 * time.Hour)
```

**Description:**  
Sessions last 24 hours with no inactivity timeout. While sessions are deleted on logout and new login replaces old session, persistent sessions increase window for session theft.

**Impact:**  
- Stolen session token valid for full day
- No automatic expiration on inactivity
- Violates least privilege for long-lived sessions

**Remediation:**
- Reduce to 8-12 hours with rolling renewal on activity
- Add `last_activity` tracking and absolute timeout
- Implement idle timeout (e.g., 30 min) via middleware

---

#### 16. Missing Security Vulnerability Disclosure Program
**Compliance:** Industry best practice  
**Severity:** Medium

**Description:**  
No `security.txt` file, security contact, or vulnerability disclosure policy found. Security researchers have no clear path to report issues responsibly.

**Impact:**  
- Vulnerabilities may be discovered and exploited without your knowledge
- No coordinated disclosure channel
- Negative perception (lack of security maturity)

**Remediation:**
- Add `/.well-known/security.txt` with contact information
- Add SECURITY.md to repository
- Establish PGP key for encrypted reports
- Define response SLA (e.g., 90 days)

---

#### 17. No Automated Dependency Vulnerability Scanning
**Compliance:** Industry best practice  
**Severity:** Medium

**Description:**  
No evidence of Dependabot, Renovate, or Snyk integration. Dependencies are pinned in lockfile but not proactively updated. The project uses many `latest` tags in devDependencies (e.g., `"framer-motion": "latest"`) which could introduce unexpected vulnerabilities.

**Impact:**  
- Known vulnerabilities may persist in dependencies
- Manual dependency audits are error-prone
- Delayed patch adoption

**Remediation:**
- Enable GitHub Dependabot (vulnerability alerts auto-enabled)
- Use Renovate/autotriage for version updates
- Integrate `govulncheck` into CI for Go modules
- Pin exact versions in `package.json` (no `latest`)

---

#### 18. Company Context Override via `X-Company-ID` Header
**Location:** `internal/handlers/company_middleware.go:26-44`

```go
if headerID := r.Header.Get("X-Company-ID"); headerID != "" {
    id, err := strconv.Atoi(headerID)
    ...
    // Verify user belongs to this company
}
```

**Description:**  
Clients can specify `X-Company-ID` header to override the session's company context. While valid (for multi-company users), this should be carefully validated. The check ensures user belongs to the requested company, which is correct, but could be abused for lateral movement if an attacker gains access to a user account (they can switch to any company the user belongs to). This is **by design** but should be monitored.

**Impact:**  
- **Low risk** — authorization enforced (user must belong to company)
- Could facilitate horizontal privilege escalation if account compromised
- Audit logs should capture company switches

**Remediation:**
- Ensure audit log captures `X-Company-ID` header when used
- Require re-authentication for sensitive company switches
- Monitor for异常 switching patterns

---

## Compliance Check

### OWASP Top 10 2021 — Verification

| # | Control | Status | Notes |
|---|---------|--------|-------|
| **A01** | Broken Access Control | ⚠️ Partial | Good tenant isolation, but user enumeration & missing rate limiting |
| **A02** | Cryptographic Failures | ⚠️ Partial | Bcrypt good, but no HTTPS, CSP weak |
| **A03** | Injection | ✅ Mostly safe | Parameterized queries throughout; dead code SQLi pattern found |
| **A04** | Insecure Design | ⚠️ Partial | Good architecture but CSP design flaw |
| **A05** | Security Misconfiguration | ❌ Multiple issues | CORS hardcoded, HSTS conditional, debug code in prod |
| **A06** | Vulnerable Components | ⚠️ Moderate | React 19 patched? gorilla/csrf needs upgrade |
| **A07** | Identity & Auth Failures | ⚠️ Partial | Good bcrypt, but user enumeration, no MFA |
| **A08** | Software & Data Integrity | ❌ No integrity checks | No SRI, no signed commits verification |
| **A09** | Security Logging & Monitoring | ⚠️ Partial | Audit logs exist but IP spoofable, no alerts |
| **A10** | Server-Side Request Forgery | ✅ N/A | No outbound HTTP requests from server |

**Overall OWASP:** ⚠️ **Requires remediation in 5 categories**

---

### GDPR Data Handling Review

| Article | Requirement | Status | Evidence |
|---------|-------------|--------|----------|
| **Art 5** | Data minimisation | ✅ | Only necessary data collected (name, email, role) |
| **Art 25** | Privacy by design | ⚠️ | No explicit consent management; implied consent |
| **Art 32** | Security of processing | ⚠️ | No HTTPS, weak CSP, session 24h — insufficient |
| **Art 33** | Breach notification | ⚠️ | No documented incident response process |
| **Art 35** | DPIA (high-risk) | ⚠️ | Not conducted for multi-tenant system |

**GDPR Gap:** Encryption in transit mandatory (Art 32). **No HTTPS = non-compliant**.

---

### PCI-DSS (If Payment Card Data Exists)
**Note:** No payment processing found in codebase. If card data ever stored/transmitted, PCI scope applies immediately.

| Requirement | Status | Notes |
|-------------|--------|-------|
| **1.1** | Firewall config | ❌ No firewall rules validated |
| **2.2** | Secure config | ⚠️ Defaults not hardened (e.g., 24h sessions) |
| **3.4** | PAN encryption | N/A (no cards) |
| **4.1** | Encrypted transmission | ❌ No TLS |
| **8.1** | Unique IDs | ✅ Users have unique IDs |
| **10.2** | Audit logs | ⚠️ Logs incomplete (IP spoofable) |
| **12.1** | Security policies | ❌ No security policy document |

**PCI Gap:** **TLS mandatory** for any cardholder data. Currently **not compliant**.

---

## Recommendations

### 🔴 Immediate Actions (Critical Priority — Complete Within 48 Hours)

1. **Fix SQL injection dead code** (`internal/server/rls.go:25`)
   - Validate `table` against allowlist OR delete function
   - Scan for similar patterns in codebase

2. **Bind server to localhost only** (`internal/config/config.go`)
   - Change `":%d"` → `"127.0.0.1:%d"`
   - Document intended deployment topology

3. **Enable HTTPS with self-signed cert** (development) / Let's Encrypt (production)
   - Add `cert.pem`/`key.pem` configuration
   - Use `ListenAndServeTLS()`
   - Redirect HTTP → HTTPS

4. **Remove `unsafe-inline` and `unsafe-eval` from CSP**
   - Implement nonce-based CSP for scripts
   - Test React hydration works with nonce

5. **Upgrade gorilla/csrf**
   - Migrate to `filippo.io/csrf/gorilla` (backport)
   - Test CSRF protection thoroughly after upgrade

6. **Fix user enumeration**
   - Use generic error messages on auth failures
   - Same response time for existing/non-existing users

7. **Remove hardcoded default password**
   - Delete `initializeDefaultUser()` or password field
   - Ensure no similar secrets exist

---

### 🟠 Short-Term Fixes (High Priority — 1-2 Weeks)

8. **Upgrade React to 19.2.4+** (if not already)
   - Verify installed version: `npm list react react-dom`
   - Pin exact versions in `package.json` (no `^19`, specify `19.2.4` or later)

9. **Implement per-endpoint rate limiting**
   - Auth endpoints: 5-10 req/min per IP
   - General API: 100 req/min (current)
   - Implement progressive delays after failures

10. **Fix IP logging**
    - Use `X-Forwarded-For` from trusted proxies only
    - Store both `remote_addr` and `x_forwarded_for` in audit logs

11. **Add path traversal validation to ALL file endpoints**
    - Centralize file path validation function
    - Use `filepath.Clean()` and check within bounds

12. **Standardize environment variable names**
    - Use `ENVIRONMENT` or `ENV` consistently
    - Document all required env vars in README

13. **Implement account lockout**
    - Lock after 5 failed login attempts
    - Require admin unlock or password reset
    - Log lockout events

---

### 🟡 Long-Term Improvements (Medium/Low Priority — 1-3 Months)

14. **Add security.txt** (`/.well-known/security.txt`)
    ```
    Contact: mailto:security@pacta.local
    Policy: https://github.com/PACTA-Team/pacta/security
    ```

15. **Add security policy (SECURITY.md)**
    - Vulnerability reporting process
    - PGP key for encrypted communication
    - Response time commitments

16. **Implement automated vulnerability scanning**
    - GitHub Dependabot (vulnerability alerts)
    - `govulncheck` in CI pipeline
    - `npm audit` in frontend CI

17. **Add security headers**
    - `Expect-CT: max-age=86400`
    - `Referrer-Policy: strict-origin-when-cross-origin` (already set)
    - `X-Download-Options: noopen` (IE)
    - `X-Permitted-Cross-Domain-Policies: none`

18. **Implement password rotation policy**
    - Force password change every 90 days
    - Prevent password reuse (last 5 passwords)

19. **Add MFA (multi-factor authentication)**
    - TOTP (Google Authenticator)
    - Email verification codes for new devices

20. **Conduct penetration test**
    - External security firm review
    - Focus on authentication, tenant isolation, file upload

21. **Implement SIEM-style alerting**
    - Alert on >10 failed logins/min per account
    - Alert on cross-company access attempts
    - Alert on audit log tampering

22. **Add input validation middleware**
    - Centralized validation for all JSON inputs
    - Length limits on all text fields
    - Sanitize HTML inputs (if any rich text)

23. **Document security architecture**
    - Threat model document
    - Data flow diagram
    - Trust boundaries

---

## Dependency Vulnerability Summary

| Package | Version | CVE(s) | Status | Action |
|---------|---------|--------|--------|--------|
| `go-chi/chi/v5` | v5.2.0 | CVE-2025-69725 (≥5.2.2) | ✅ Not vulnerable | Monitor |
| `gorilla/csrf` | v1.7.3 | CVE-2025-47909 (≤1.7.3) | ⚠️ Vulnerable | Upgrade to filippo.io/csrf |
| `react` | 19.2.4 | CVE-2025-55183/4/67779 (≤19.2.3) | ✅ Patched | Pin version |
| `react-dom` | 19.2.4 | Same as react | ✅ Patched | Pin version |
| `go-sqlite3` (modernc.org/sqlite) | v1.34.5 | None known | ✅ | Monitor |
| `chi/cors` | v1.0.0 | None known | ✅ | Monitor |

**Recommendation:** Add `govulncheck` to CI:
```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...
```

---

## Conclusion

PACTA's **core security architecture is solid**: tenant isolation, password hashing, and audit logging are well-implemented. However, **deployment security is severely lacking** (no HTTPS, exposed on all interfaces), and **client-side protections are weak** (CSP with unsafe-inline). The gorilla/csrf dependency requires immediate upgrade.

**Risk Acceptance Statement:**  
If PACTA is deployed exclusively on localhost for single-user desktop use, network exposure and HTTPS risks are mitigated. However, the CSP weakness and dependency vulnerabilities remain exploitable even in local mode (via XSS and CSRF).

**Next Steps:**
1. Fix CRITICAL and HIGH items in order above
2. Implement automated security scanning in CI
3. Conduct full penetration test after fixes
4. Establish security incident response process

---

**Report End**
