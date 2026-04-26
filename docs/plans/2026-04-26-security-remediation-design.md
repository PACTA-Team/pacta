# PACTA Security Remediation Design

**Date:** 2026-04-26  
**Audit Reference:** `docs/security/SECURITY_AUDIT_CSO.md`  
**Status:** Approved — Implementation pending  
**Author:** Kilo (AI Security Analyst)  
**Reviewers:** —  
**Deployment Context:** Dual-mode (VPS+Caddy + Localhost individual)

---

## 1. Executive Summary

PACTA requires urgent security hardening across **3 severity tiers**:

- **Critical/High (48h):** 8 vulnerabilities requiring immediate code changes (SQL injection pattern, CSP weakness, CSRF CVE, user enumeration, hardcoded credentials, etc.)
- **Infrastructure Hardening (1 week):** Network binding, rate limiting, IP logging, path validation, environment config standardization
- **Operational Compliance (2–4 weeks):** Security policy, automated scanning, session management, documentation

**Total affected files:** ~15 Go files, 2 TypeScript files, 3 configuration files  
**Risk reduction:** From **MEDIUM-HIGH** to **LOW-MEDIUM** post-remediation

---

## 2. Context & Constraints

### Deployment Topologies

| Mode | Description | Security Implications |
|------|-------------|----------------------|
| **Local (Individual)** | Go server binds `127.0.0.1:3000`, browser connects directly. No reverse proxy. | Network exposure minimal (localhost only). HTTPS not required. CSP and code vulnerabilities remain exploitable. |
| **VPS + Caddy** | Caddy reverse-proxies to Go backend on `127.0.0.1:3000`. Caddy provides TLS, HTTPS, HSTS. | Backend should bind localhost only. X-Forwarded-For present. Must trust proxy headers. HTTPS enforced externally. |

**Decision:** Solutions must work identically in both modes. No mode-specific code branches.

### Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | Go (Chi router) | 1.23+ |
| Frontend | React + Vite | 19.x |
| Database | SQLite (modernc.org/sqlite) | v1.34.5 |
| CSRF | gorilla/csrf | v1.7.3 (CVE-2025-47909) |
| Auth | bcrypt + sessions | custom |

---

## 3. Remediation Phases

### Phase 1 — Critical & High Code Vulnerabilities (0–48h)

**Goal:** Remove immediately exploitable attack vectors present in the code itself.

#### 1.1 SQL Injection in `EnforceOwnership()` (CS-001)

**File:** `internal/server/rls.go:25-29`  
**Severity:** CRITICAL (if reachable)  
**Current code:**

```go
func EnforceOwnership(db *sql.DB, companyID int, resourceID int, table string) error {
    query := fmt.Sprintf(`
        SELECT COUNT(*) FROM %s
        WHERE id = ? AND company_id = ? AND deleted_at IS NULL
    `, table)  // ← direct interpolation, no validation
    ...
}
```

**Root cause:** Table name interpolated without allowlist validation.

**Fix options:**
- **Option A:** Remove function entirely if unused (dead code elimination).
- **Option B:** Validate `table` parameter against allowlist of known tables.

**Decision:** Option B — preserves potential future use while eliminating injection vector.

**Implementation:**

```go
var allowedTables = map[string]bool{
    "contracts": true,
    "clients": true,
    "suppliers": true,
    "documents": true,
    "users": true,
    "companies": true,
    "user_companies": true,
    "pending_approvals": true,
    "audit_logs": true,
}

func EnforceOwnership(db *sql.DB, companyID int, resourceID int, table string) error {
    if !allowedTables[table] {
        return fmt.Errorf("invalid table: %s", table)
    }
    query := fmt.Sprintf(`
        SELECT COUNT(*) FROM %s
        WHERE id = ? AND company_id = ? AND deleted_at IS NULL
    `, table)
    ...
}
```

**Validation:** Unit test calling `EnforceOwnership` with `table="users; DROP TABLE users;--"` must return error.

---

#### 1.2 CSP: Remove `unsafe-inline` & `unsafe-eval` (CS-002, CS-011)

**File:** `internal/server/middleware/security_headers.go:16`  
**Severity:** HIGH (XSS bypass)  
**Current CSP:**

```
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; ...
```

**Impact:** Any injected script executes. CSP provides zero XSS protection.

**Fix approach:** Nonce-based CSP.

**Design:**

1. Middleware `SecurityHeaders()` generates random nonce per request:
   ```go
   nonce := make([]byte, 16)
   rand.Read(nonce)
   nonceEnc := base64.StdEncoding.EncodeToString(nonce)
   ctx := context.WithValue(r.Context(), "csp-nonce", nonceEnc)
   ```

2. CSP header:
   ```
   script-src 'self' 'nonce-{nonceEnc}'; style-src 'self' 'nonce-{nonceEnc}';
   ```
   Remove `'unsafe-eval'` completely.

3. Inject nonce into SPA HTML response.  
   **Challenge:** Frontend built by Vite produces static `index.html`.  
   **Solution:** Serve `index.html` through a Go handler that:
   - Reads `index.html` from embedded FS (or disk)
   - Injects `<script nonce="{{.Nonce}}">` before `</head>` or into existing script tag
   - Returns modified HTML

   Alternatively, use CSP hash if script content is static (hash of inline script). Nonce preferred for dynamic tokens.

**Validation:** After deploy, browser console should show CSP violations if any inline script lacks nonce. Test XSS payload `<script>alert(1)</script>` in any input field → blocked.

---

#### 1.3 Upgrade gorilla/csrf (CS-003)

**File:** `go.mod:8`, `internal/server/middleware/csrf.go`  
**CVE:** CVE-2025-47909 (TrustedOrigins bypass)  
**Current:** `github.com/gorilla/csrf v1.7.3`

**Fix:** Replace with official backport:
```bash
go get filippo.io/csrf/gorilla@latest
```

**Code changes:** None required — API is compatible. Re-run `go mod tidy`.

**Validation:** CSRF protection must still work on state-changing endpoints (POST/PUT/DELETE). Test form submissions without token → 403.

---

#### 1.4 User Enumeration (CS-004)

**File:** `internal/handlers/auth.go:129-137`, also registration response at line 60  
**Severity:** HIGH (information disclosure)

**Current behavior:**
- Login, err != nil → `err.Error()` sent to client (differentiates "user not found" vs "invalid password")
- `status == "pending_email"` returns specific message

**Fix:** Generic error message and consistent timing.

**Implementation:**

```go
func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request) {
    var req LoginRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.Error(w, http.StatusBadRequest, "invalid request")
        return
    }

    user, err := auth.Authenticate(h.DB, req.Email, req.Password)
    if err != nil {
        // Constant-time delay to prevent timing attacks (optional but recommended)
        time.Sleep(50 * time.Millisecond)
        h.Error(w, http.StatusUnauthorized, "Invalid credentials or account not yet approved.")
        return
    }

    // Generic response for any non-active status
    if user.Status != "active" {
        // Same delay and message for any pending state
        time.Sleep(30 * time.Millisecond)
        h.Error(w, http.StatusForbidden, "Invalid credentials or account not yet approved.")
        return
    }

    // ... continue with active user
}
```

**Also:** Modify registration conflict response from `"a user with this email already exists"` → same generic message (but keep 409 status internally, message generic).

**Validation:** Use Burp Suite or curl to test login with existing/non-existing emails; response body identical.

---

#### 1.5 Remove Hardcoded Default Password (CS-005)

**File:** `pacta_appweb/src/lib/storage.ts:92-106`  
**Severity:** HIGH (backdoor if ever used)

**Fix:** Delete entire `initializeDefaultUser()` function. It is dead code — backend creates first admin on setup.

**Additional:** Search codebase for other hardcoded secrets:
```bash
git grep -i "password.*=" -- pacta_appweb/src/
git grep -i "secret" -- pacta_appweb/src/
git grep -i "api[_-]?key" -- pacta_appweb/src/
```

Remove any findings.

**Validation:** Build frontend (`npm run build`) and inspect bundle for string `pacta123` — should not appear.

---

#### 1.6 React Dependency Update (CS-006)

**File:** `pacta_appweb/package.json`  
**Current:** `"react": "^19", "react-dom": "^19"` (may resolve to vulnerable 19.2.3 or below)

**Check:**
```bash
cd pacta_appweb && npm list react react-dom
```

If version < `19.2.4`, update:

```json
"react": "19.2.4",
"react-dom": "19.2.4"
```

Pin exact versions (remove `^`). Run `npm install`.

**Validation:** `npm list react react-dom` should show `19.2.4`. Run `npm audit` — no high/critical vulnerabilities related to React.

---

### Phase 2 — Infrastructure Hardening (Days 3–10)

#### 2.1 Bind to Localhost by Default (CS-007)

**File:** `internal/config/config.go:29`  
**Current:** `Addr: fmt.Sprintf(":%d", DefaultPort)` → binds `0.0.0.0:3000`

**Fix:** Default to `127.0.0.1:3000`. Allow override via `BIND_ADDRESS` env var for VPS deployments (where Caddy proxies locally).

```go
func Default() *Config {
    addr := os.Getenv("BIND_ADDRESS")
    if addr == "" {
        addr = fmt.Sprintf("127.0.0.1:%d", DefaultPort)
    }
    return &Config{
        Addr:    addr,
        DataDir: dataDir,
        Version: AppVersion,
    }
}
```

**Deployment note:** On VPS, set `BIND_ADDRESS=127.0.0.1:3000` (Caddy connects to localhost). No need to expose backend directly.

**Validation:** Start server without env var; `netstat -tlnp` should show `127.0.0.1:3000`.

---

#### 2.2 Per-Endpoint Rate Limiting (CS-008)

**File:** `internal/server/middleware/rate_limit.go`, `internal/server/server.go`

Current: Global `100 req/min` applies to all endpoints.

**Fix:** Stricter limits on authentication paths.

**Implementation:**

1. Define critical endpoint limiter:
```go
var authLimit = RateLimitConfig{Requests: 5, Window: time.Minute}
```

2. Apply in `server.go` before global limit:
```go
// Auth endpoints: stricter
r.Route("/api/auth", func(r chi.Router) {
    r.Use(middleware.RateLimitByEndpoint(authLimit.Requests, authLimit.Window))
    r.Post("/login", h.HandleLogin)
    r.Post("/register", h.HandleRegister)
    r.Post("/logout", h.HandleLogout)
    r.Post("/verify-code", h.HandleVerifyCode)
})

// Rest of API: standard limit
r.Use(middleware.RateLimit())
```

**Validation:** Use `ab` or `wrk` to send 20 login requests/min → expect HTTP 429 after 5th.

---

#### 2.3 IP Logging with X-Forwarded-For (CS-009)

**Files:** `internal/handlers/audit.go`, `internal/server/middleware/rate_limit_redis.go` (if used)

**Current:** `ip := r.RemoteAddr` — easily spoofed.

**Fix:** When behind trusted proxy (Caddy → `RemoteAddr == 127.0.0.1`), trust `X-Forwarded-For`. Otherwise use `RemoteAddr`.

Create middleware:

```go
func ClientIPMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ip := r.RemoteAddr
        // If request came from localhost (trusted proxy), use X-Forwarded-For
        if strings.HasPrefix(r.RemoteAddr, "127.0.0.1") || strings.HasPrefix(r.RemoteAddr, "::1") {
            if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
                // X-Forwarded-For may contain multiple IPs; take first (client)
                parts := strings.Split(xff, ",")
                ip = strings.TrimSpace(parts[0])
            }
        }
        // Store in context for handlers
        ctx := context.WithValue(r.Context(), "client-ip", ip)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

Use in handlers: `h.GetClientIP(r)`. Update audit log insertion to store this IP.

**Validation:** Check audit_logs table after request through Caddy — IP should be real client, not `127.0.0.1`.

---

#### 2.4 Path Traversal Validation (CS-010)

**File:** `internal/handlers/documents.go` (all file-serving handlers)

**Current:** Only `HandleServeTempDocument` checks `strings.Contains(key, "..")`. Others rely on `filepath.Join` but don't validate result.

**Fix:** Central validator:

```go
func validateStorageKey(key string) error {
    if key == "" {
        return errors.New("empty key")
    }
    // Must not contain path separators or ..
    if strings.Contains(key, "..") || strings.ContainsAny(key, "/\\") {
        return errors.New("invalid key")
    }
    // Optionally: must match UUID pattern if that's how keys are generated
    return nil
}
```

Apply to:
- `HandleUploadTempDocument` (key generation is random UUID but validate before use anyway)
- `HandleServeTempDocument`
- `HandleDeleteDocument` (if applicable)
- Any other endpoint that receives `storageKey` from client

**Validation:** Try sending `storageKey="../../../etc/passwd"` → must reject.

---

#### 2.5 Unify Environment Variables (CS-012)

**Files:** `internal/server/middleware/csrf.go:92` uses `ENV`; `security_headers.go:35` uses `ENVIRONMENT`.

**Fix:** Choose one (`ENVIRONMENT`) and update all references.

```bash
grep -r "os.Getenv" internal/server/middleware/ internal/config/ internal/auth/
```

Replace `os.Getenv("ENV")` with `os.Getenv("ENVIRONMENT")` consistently.

**Also:** Ensure HSTS set when `ENVIRONMENT=production` AND HTTPS is on. Since Caddy terminates TLS, Go sees HTTP locally. Need to detect behind-proxy:

```go
func isProduction() bool {
    env := os.Getenv("ENVIRONMENT")
    // When behind Caddy, X-Forwarded-Proto header indicates original scheme
    return env == "production"
}

func isSecure(r *http.Request) bool {
    if r.TLS != nil {
        return true
    }
    // Behind proxy?
    return r.Header.Get("X-Forwarded-Proto") == "https"
}
```

Modify SecurityHeaders to set HSTS if `isProduction() && isSecure(r)`.

**Validation:** In production-like env, response headers include `strict-transport-security`.

---

#### 2.6 Make CORS Origins Configurable (CS-013)

**File:** `internal/server/middleware/cors.go:11-14`

**Fix:** Read from env:

```go
func NewCORS() func(http.Handler) http.Handler {
    originsEnv := os.Getenv("ALLOWED_ORIGINS")
    var origins []string
    if originsEnv != "" {
        origins = strings.Split(originsEnv, ",")
        // Trim spaces
        for i := range origins {
            origins[i] = strings.TrimSpace(origins[i])
        }
    } else {
        // Default dev origins
        origins = []string{
            "http://127.0.0.1:3000",
            "https://app.pacta.local",
        }
    }
    c := cors.New(cors.Options{
        AllowedOrigins: origins,
        ...
    })
    return c.Handler
}
```

**Validation:** Deploy with `ALLOWED_ORIGINS=https://app.pacta.com` and verify CORS headers allow that origin.

---

#### 2.7 Session Timeout Reduction (CS-015)

**File:** `internal/auth/session.go:31`  
**Current:** `expiresAt := time.Now().Add(24 * time.Hour)`

**Fix:** Change to 8 hours. Add sliding expiration: if session exists and last activity < 1h ago, extend expiry.

**Schema change needed?** Check `sessions` table — likely has `expires_at`. If no `last_activity` column, add via migration:

```sql
ALTER TABLE sessions ADD COLUMN last_activity DATETIME;
```

Update `CreateSession` to set both `expires_at` and `last_activity` to `NOW()`.  
Create middleware `RefreshSession()` that updates `last_activity` on each request if `time.Since(last_activity) < 1h`.

**Validation:** Login, wait 9h, try using session → should be expired. Within 8h with activity → remains valid.

---

### Phase 3 — Operational & Compliance Improvements (Weeks 3–6)

#### 3.1 Security Disclosure (CS-016, CS-017)

- Add `docs/SECURITY.md` with reporting process
- Add `./well-known/security.txt` (handler):
  ```
  Contact: mailto:security@pacta.local
  Policy: https://github.com/PACTA-Team/pacta/security
  ```

#### 3.2 Automated Scanning (CS-018)

- Enable GitHub Dependabot (`.github/dependabot.yml`)
- Add `govulncheck` to CI workflow (`.github/workflows/build.yml`):
  ```yaml
  - name: Check Go vulnerabilities
    run: |
      go install golang.org/x/vuln/cmd/govulncheck@latest
      govulncheck ./...
  ```
- Add `npm audit --audit-level=high` to frontend CI

#### 3.3 Additional Security Headers (CS-019)

Add:
- `Expect-CT: max-age=86400`
- `X-Download-Options: noopen`
- `X-Permitted-Cross-Domain-Policies: none`

---

#### 3.4 Error Sanitization (CS-020)

Audit all `h.Error(w, status, err.Error())` calls. Replace with generic messages. Log detailed errors server-side only.

**Files to check:**
- `internal/handlers/*.go`
- Ensure no stack traces or SQL errors leak.

---

#### 3.5 Threat Model Documentation

Create `docs/security/THREAT_MODEL.md` covering:
- Data flow diagram
- Trust boundaries
- Assets (user data, contracts, documents)
- Threats per STRIDE
- Mitigations status

---

## 4. Testing & Validation Strategy

### Automated Tests (Unit/Integration)

1. **CSP nonce injection** — test that HTML response contains nonce attribute on script tag
2. **Allowlist enforcement** — test `EnforceOwnership` with invalid table names
3. **Auth timing** — measure response times for existing vs non-existing users (should be within threshold)
4. **Rate limiting** — simulate >5 login requests → expect 429
5. **Path validation** — malicious storage keys rejected

### Manual QA (Post-Deploy)

- [ ] Login/logout works, CSRF tokens present in forms
- [ ] File upload/download works, path traversal attempts blocked
- [ ] Audit log entries show correct client IP (not 127.0.0.1 when behind Caddy)
- [ ] CSP violations logged in browser console (no XSS possible)
- [ ] HTTPS redirects work (VPS), HSTS header present
- [ ] No `pacta123` or other passwords in built JS bundle

### Security Scanning

```bash
# Go vulnerabilities
govulncheck ./...

# Frontend
npm audit --audit-level=high

# SQLi static scan (if available)
goss / internal/server/rls.go
```

---

## 5. Rollout & Rollback Plan

### Phase 1 Rollout (Critical/High)

1. Branch: `security/remediation-2026-04-26`
2. Commits: One per fix (atomic)
3. PR with full diff → review → merge to main
4. Deploy to staging (if exists) or directly to production with monitoring
5. Monitor: audit logs, error rates, CSRF failures, login success rate

**Rollback:** Revert commit(s) if auth breaks or CSP breaks SPA.

### Phase 2 & 3

Less risky; can be rolled out incrementally with feature flags if needed (e.g., new rate limiter can be gradual).

---

## 6. Open Risks & Acceptance

| Risk | Mitigation | Acceptance |
|------|------------|------------|
| CSP nonce breaks React hydration | Test thoroughly in dev before deploy; fallback to hash-based if needed | Low |
| Rate limiting too aggressive → DoS self | Monitor after deploy; adjust thresholds | Medium |
| X-Forwarded-For misconfiguration → wrong IPs | Log both remote_addr and x_forwarded_for initially | Low |
| Session timeout reduction affects UX | Notify users of new session duration; implement "remember me" future | Low |

---

## 7. Documentation Deliverables

- [x] `docs/security/README.md` (created)
- [ ] `docs/plans/2026-04-26-security-remediation-design.md` (this doc)
- [ ] `docs/security/CHECKLIST_REMEDIATION.md` (task checklist)
- [ ] `SECURITY.md` (root)
- [ ] `.well-known/security.txt` (handler + route)
- [ ] `docs/security/THREAT_MODEL.md`

---

## 8. Success Criteria

- [ ] All CRITICAL and HIGH findings resolved per audit
- [ ] No regression in existing functionality (auth, file upload, company switching)
- [ ] CSP does not break React SPA (console clean of CSP violations)
- [ ] Audit logging records accurate client IP
- [ ] Rate limiting demonstrably throttles auth endpoints
- [ ] Dependencies updated to non-vulnerable versions
- [ ] Security disclosure channels established

---

**Next Action:** Invoke `writing-plans` skill to generate implementation plan with granular tasks, file-by-file changes, and test steps.
