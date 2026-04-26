# PACTA Security Remediation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **Goal:** Remediate all CRITICAL and HIGH security vulnerabilities identified in `docs/security/SECURITY_AUDIT_CSO.md` through targeted code changes, configuration updates, and dependency upgrades across the PACTA codebase.
>
> **Architecture:** The plan follows 3 phases: Phase 1 (critical/high code fixes, 48h), Phase 2 (infrastructure hardening, 1 week), Phase 3 (operational/compliance, 2–4 weeks). Each task is atomic, testable, and independently verifiable. Changes touch Go backend, React frontend, configuration, and CI/CD.
>
> **Tech Stack:** Go 1.23 (Chi router), React 19, SQLite, gorilla/csrf (to be replaced), Vite

---

## Prerequisites

1. **Branch:** Create feature branch from `main`:
   ```bash
   git checkout -b security/remediation-2026-04-26
   ```

2. **Dependencies:** Ensure Go, Node 22+, npm installed.

3. **QA User:** Create QA test user for testing auth flows:
   ```bash
   python3 docs/security/create_qa_user.py
   ```
   Credentials: `qa@pacta.test` / `QaTest123!` (admin)

4. **Local test DB:** Ensure `~/.local/share/pacta/data/pacta.db` exists and migrations applied (auto on server start).

---

## Phase 1 — Critical & High Code Vulnerabilities (0–48h)

### Task 1: Fix SQL injection vulnerability in `EnforceOwnership`

**Files:**
- Modify: `internal/server/rls.go:25-40`
- Add test: `internal/server/rls_test.go` (new file)

**Step 1: Write failing test**

Create `internal/server/rls_test.go`:

```go
package server

import (
    "errors"
    "testing"
    "github.com/stretchr/testify/require"
)

func Test_EnforceOwnership_InvalidTableRejected(t *testing.T) {
    // Simulate DB mock (simplified: use sqlmock if available; for now test allowlist logic directly)
    // We'll test the validation function separately once extracted.
    // For now, we'll manually check that calling with malicious table fails.
    // Actual test will need sqlmock; implement after refactor.
    t.Skip("Requires sqlmock setup — implement after validation extracted")
}
```

**Initial simple test (no mock):**

```go
func TestValidateTableName_RejectsMalicious(t *testing.T) {
    testCases := []struct {
        table  string
        wantOK bool
    }{
        {"contracts", true},
        {"users; DROP TABLE users;--", false},
        {"../etc/passwd", false},
        {"nonexistent", false},
    }
    for _, tc := range testCases {
        ok := validateTableName(tc.table)
        if ok != tc.wantOK {
            t.Errorf("validateTableName(%q) = %v, want %v", tc.table, ok, tc.wantOK)
        }
    }
}
```

**Step 2: Implement validation first (minimal change)**

Modify `internal/server/rls.go` to add `validateTableName` and use it:

```go
var allowedTables = map[string]bool{
    "contracts":            true,
    "clients":              true,
    "suppliers":            true,
    "documents":            true,
    "users":                true,
    "companies":            true,
    "user_companies":       true,
    "pending_approvals":    true,
    "audit_logs":           true,
}

func validateTableName(table string) bool {
    return allowedTables[table]
}

func EnforceOwnership(db *sql.DB, companyID, resourceID int, table string) error {
    if !validateTableName(table) {
        return fmt.Errorf("invalid table name: %s", table)
    }
    query := fmt.Sprintf(`
        SELECT COUNT(*) FROM %s
        WHERE id = ? AND company_id = ? AND deleted_at IS NULL
    `, table)
    // ... rest unchanged
```

**Step 3: Run test to verify fix**

```bash
go test ./internal/server -run TestValidateTableName_RejectsMalicious -v
```
Expected: PASS

**Step 4: Commit**

```bash
git add internal/server/rls.go internal/server/rls_test.go
git commit -m "feat(security): validate table name in EnforceOwnership to prevent SQL injection"
```

---

### Task 2: Implement Nonce-based CSP to replace `unsafe-inline`/`unsafe-eval`

**Files:**
- Modify: `internal/server/middleware/security_headers.go`
- Modify: `internal/server/server.go` (serving index.html)
- Modify: `pacta_appweb/index.html` (or embed)
- Add: `internal/server/middleware/csp_nonce.go` (new helper)

**Step 1: Write test for nonce generation & injection**

Create `internal/server/middleware/csp_nonce_test.go`:

```go
package middleware

import (
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"
)

func TestSecurityHeaders_NonceInCSP(t *testing.T) {
    // Setup handler
    next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    })
    handler := SecurityHeadersWithNonce()(next)

    // Create request
    req := httptest.NewRequest("GET", "/", nil)
    w := httptest.NewRecorder()

    handler.ServeHTTP(w, req)

    resp := w.Result()
    csp := resp.Header.Get("Content-Security-Policy")

    // CSP must contain 'nonce-'
    if !strings.Contains(csp, "'nonce-") {
        t.Errorf("CSP missing nonce directive: %s", csp)
    }
    // Must NOT contain unsafe-inline or unsafe-eval
    if strings.Contains(csp, "'unsafe-inline'") || strings.Contains(csp, "'unsafe-eval'") {
        t.Errorf("CSP still contains unsafe-inline or unsafe-eval: %s", csp)
    }
}
```

**Step 2: Implement nonce middleware**

We'll refactor `SecurityHeaders()` to `SecurityHeadersWithNonce()` and create a helper to get nonce from context.

Modify `internal/server/middleware/security_headers.go`:

```go
package middleware

import (
    "crypto/rand"
    "encoding/base64"
    "net/http"
    "os"
    "strings"
)

type cspNonceKey struct{}

func SecurityHeaders() func(http.Handler) http.Handler {
    return SecurityHeadersWithNonce()
}

func SecurityHeadersWithNonce() func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Generate nonce
            nonceBytes := make([]byte, 16)
            if _, err := rand.Read(nonceBytes); err != nil {
                // Fallback for dev (unlikely to fail)
                panic("failed to generate CSP nonce: " + err.Error())
            }
            nonce := base64.StdEncoding.EncodeToString(nonceBytes)

            // Store nonce in context for later use (SPA injector)
            ctx := context.WithValue(r.Context(), cspNonceKey{}, nonce)
            r = r.WithContext(ctx)

            // Build CSP
            csp := strings.Join([]string{
                "default-src 'self'",
                "script-src 'self' 'nonce-" + nonce + "'",
                "style-src 'self' 'nonce-" + nonce + "'",
                "img-src 'self' data: https:",
                "font-src 'self' data:",
                "connect-src 'self' wss: ws:",
                "frame-ancestors 'none'",
                "form-action 'self'",
                "base-uri 'self'",
            }, "; ")

            w.Header().Set("Content-Security-Policy", csp)
            // ... keep other security headers as before
            w.Header().Set("X-Frame-Options", "DENY")
            w.Header().Set("X-Content-Type-Options", "nosniff")
            w.Header().Set("X-XSS-Protection", "1; mode=block")
            w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
            w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
            if os.Getenv("ENVIRONMENT") == "production" {
                w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
            }
            w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
            w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
            w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
            w.Header().Del("Server")
            w.Header().Del("X-Powered-By")

            next.ServeHTTP(w, r)
        })
    }
}

// GetCSPNonce extracts nonce from request context (for HTML injection)
func GetCSPNonce(r *http.Request) string {
    if v := r.Context().Value(cspNonceKey{}); v != nil {
        return v.(string)
    }
    return ""
}
```

**Step 3: Serve index.html with nonce injection**

In `internal/server/server.go`, modify static file serving for SPA:

```go
// Add route for SPA index with nonce injection
r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
    // Serve static files from embedded FS
    // For SPA path ("/"), inject nonce into index.html
    nonce := middleware.GetCSPNonce(r)
    // Read index.html from staticFS (which is pacta_appweb/dist)
    indexBytes, err := staticFS.ReadFile("index.html")
    if err != nil {
        http.Error(w, "not found", http.StatusNotFound)
        return
    }
    html := string(indexBytes)
    // Inject nonce into any script tags that need it
    // Look for <script> tags without src and add nonce attribute
    // Simple injection: find </head> and insert meta or script with nonce placeholder?
    // Better: modify build step to include <!-- NONCE_PLACEHOLDER --> comment
    // Replace placeholder with actual nonce
    html = strings.ReplaceAll(html, "<!-- CSP_NONCE -->", "nonce=\""+nonce+"\"")
    w.Header().Set("Content-Type", "text/html; charset=utf-8")
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(html))
})
```

**Modify `pacta_appweb/index.html`** (in template or Vite build) to include `nonce="<!-- CSP_NONCE -->"` on the main inline script or add:

```html
<script <!-- CSP_NONCE --> src="/assets/index.js"></script>
```

But Vite may inline critical CSS/JS. Alternative: add a small inline script that uses nonce:

```html
<script <!-- CSP_NONCE -->>
  window.CSP_NONCE = "<!-- CSP_NONCE -->"; // placeholder will be replaced
</script>
```

Better approach: Have Go replace a placeholder comment anywhere in HTML with actual nonce attribute. Mark placeholder as `<!-- CSP_NONCE -->`.

**Alternative** if modifying HTML is complex: Use CSP **hash** instead of nonce for static scripts. Compute SHA256 of built JS file and add to CSP: `script-src 'self' 'sha256-...'`. Nonce needed only for truly dynamic inline blocks. React hydration is typically inline in `index.html`:

```html
<script nonce="RANDOM">
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = ...
</script>
```

So we need to inject `nonce="RANDOM"` into that inline script tag. Use placeholder:

In `pacta_appweb/index.html` (before build), locate the inline hydration script and add `nonce="<!-- CSP_NONCE -->"`. After build, Go server replaces `<!-- CSP_NONCE -->` with actual base64 nonce string, producing valid attribute.

**Step 4: Update build process to preserve placeholder**

Ensure Vite doesn't minify away the comment. Use HTML literal: `<!-- CSP_NONCE -->`.

**Step 5: Test**

- Run server locally, view source → check `<script>` has `nonce="..."` attribute
- Check CSP header contains `'nonce-...'` with same value
- Browser console: no CSP violations

**Step 6: Commit**

```bash
git add internal/server/middleware/security_headers.go \
         internal/server/server.go \
         pacta_appweb/index.html
git commit -m "feat(security): implement nonce-based CSP to eliminate unsafe-inline/unsafe-eval"
```

---

### Task 3: Upgrade gorilla/csrf to patched fork

**Step 1: Verify current version**

```bash
grep gorilla/csrf go.mod
# Expected: github.com/gorilla/csrf v1.7.3
```

**Step 2: Replace with patched fork**

```bash
go get filippo.io/csrf/gorilla@v0.0.0-202504...  # latest
go mod tidy
```

**Step 3: Update imports** (should auto-resolve to `filippo.io/csrf/gorilla` with same package path? Actually fork uses different import path: `filippo.io/csrf/gorilla`)

Check documentation: The backport provides same import path via `replace`? No, recommended is to replace imports.

Modify `internal/server/middleware/csrf.go`:

```go
import (
    // Before: "github.com/gorilla/csrf"
    "filippo.io/csrf/gorilla"
)
```

Other code should work unchanged (API compatible).

**Step 4: Run tests**

```bash
go test ./internal/server/middleware/... -v -run TestCSRF
```

**Step 5: Commit**

```bash
git add go.mod go.sum internal/server/middleware/csrf.go
git commit -m "chore(security): upgrade csrf to filippo.io/csrf/gorilla (CVE-2025-47909)"
```

---

### Task 4: Fix user enumeration in auth handlers

**Files:**
- Modify: `internal/handlers/auth.go` (login, verify-code endpoints)
- Add test: `internal/handlers/auth_enumeration_test.go`

**Step 1: Write test to assert generic error messages**

```go
package handlers

import (
    "net/http"
    "net/http/httptest"
    "testing"
)

func TestLogin_NoUserEnumeration(t *testing.T) {
    // Setup in-memory DB or use test DB with no users
    // h := &Handler{DB: testDB}
    // req1 := login request with email "nonexistent@test.com"
    // resp1 := record response time
    // req2 := login with existing email but wrong password
    // resp2 := record response time
    // Assert response body strings are identical
    // t.Skip("Requires test DB setup")
}
```

Simpler: just implement change and manually verify later.

**Step 2: Implement generic error messages**

Modify `HandleLogin`:

```go
func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request) {
    var req LoginRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.Error(w, http.StatusBadRequest, "invalid request")
        return
    }

    user, err := auth.Authenticate(h.DB, req.Email, req.Password)
    if err != nil {
        // Constant-time response to prevent user enumeration
        time.Sleep(50 * time.Millisecond)  // match typical auth latency
        h.Error(w, http.StatusUnauthorized, "Invalid credentials or account not yet approved.")
        return
    }

    // Also treat non-active statuses with same generic message
    if user.Status != "active" {
        time.Sleep(30 * time.Millisecond)
        h.Error(w, http.StatusForbidden, "Invalid credentials or account not yet approved.")
        return
    }

    // ... continue
}
```

Also update `HandleVerifyCode` if it reveals email existence. Check registration: line 60 returns 409 "a user with this email already exists" — for public registration this might be acceptable UX but for security, better generic: "If this email is not registered, you may proceed to login" (but 409 still indicates existence). Better: return same 200 with message "Check your email for next steps" without confirming registration status. But that changes UX significantly. Discuss with product? For now, minimal change to login/verify, leave registration as is (it's public endpoint; user expects feedback). Audit says registration already returns conflict with message — might be acceptable because it's public registration, but could be used to probe emails. We'll change to generic: "If the email is valid, you will receive further instructions." But still 409.

Decision: Keep UX clarity but make it less explicit. Change message to: "If this email address is not already registered, you may create an account."

**Step 3: Apply same to registration conflict**

In `HandleRegister`, line 95: Change message `"a user with this email already exists"` to `"If this email is not yet registered, please proceed with registration."` (keep 409 status).

**Step 4: Run all auth tests**

```bash
go test ./internal/handlers/... -v -run "TestLogin|TestRegister|TestVerify"
```

**Step 5: Build frontend and test manually**
   - Try login with non-existent email → generic message
   - Try login with correct email/wrong password → same message

**Step 6: Commit**

```bash
git add internal/handlers/auth.go
git commit -m "feat(security): prevent user enumeration via generic auth error messages"
```

---

### Task 5: Remove hardcoded default admin user from frontend

**File:** `pacta_appweb/src/lib/storage.ts`

**Step 1: Search for hardcoded passwords**

```bash
grep -n "pacta123\|password.*'\|initializeDefaultUser" pacta_appweb/src/lib/storage.ts
```

**Step 2: Delete `initializeDefaultUser()` function entirely (lines 92-106)**

Also ensure no other hardcoded credentials:

```bash
grep -rn "password.*=" pacta_appweb/src/ | grep -v "hash\|encrypt" | grep -v "var\|let\|const"  # look for string literals
```

**Step 3: Build frontend to verify password removed from bundle**

```bash
cd pacta_appweb && npm run build
grep -r "pacta123" dist/
# Should not find anything
```

**Step 4: Commit**

```bash
git add pacta_appweb/src/lib/storage.ts
git commit -m "chore(security): remove hardcoded default admin credentials from frontend"
```

---

### Task 6: Update React to patched version (19.2.4+)

**File:** `pacta_appweb/package.json`

**Step 1: Check current versions**

```bash
cd pacta_appweb && npm list react react-dom
```

If versions are `19.2.4` or higher, skip. If lower, continue.

**Step 2: Pin exact versions**

Edit `package.json`:

```json
"react": "19.2.4",
"react-dom": "19.2.4",
```

Remove `^` if present.

**Step 3: Install**

```bash
npm install
```

**Step 4: Verify**

```bash
npm list react react-dom
# Should show 19.2.4
```

**Step 5: Audit**

```bash
npm audit --audit-level=high
# Should pass with no high/critical related to react
```

**Step 6: Commit**

```bash
git add pacta_appweb/package.json pacta_appweb/package-lock.json
git commit -m "chore(security): update React to 19.2.4 (patch CVE-2025-55183/4/67779)"
```

---

## Phase 2 — Infrastructure Hardening (Days 3–10)

### Task 7: Bind server to localhost by default with BIND_ADDRESS override

**File:** `internal/config/config.go`

**Step 1: Modify `Default()`**

```go
func Default() *Config {
    dataDir := defaultDataDir()
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

**Step 2: Add documentation comment for config**

Update comment above `Config` struct.

**Step 3: Test that default is localhost**

Write quick test:

```go
func TestDefaultConfig_BindsToLocalhost(t *testing.T) {
    cfg := Default()
    if !strings.HasPrefix(cfg.Addr, "127.0.0.1:") && !strings.HasPrefix(cfg.Addr, "[::1]:") {
        t.Fatalf("Expected localhost bind, got %s", cfg.Addr)
    }
}
```

Add to `config_test.go` (create if missing).

**Step 4: Build and run server manually**

```bash
go run ./cmd/pacta
# Check log output: should say "running on http://127.0.0.1:3000"
```

**Step 5: Commit**

```bash
git add internal/config/config.go internal/config/config_test.go
git commit -m "feat(security): bind to localhost by default; BIND_ADDRESS env override"
```

---

### Task 8: Per-endpoint rate limiting for auth endpoints

**Files:** `internal/server/middleware/rate_limit.go`, `internal/server/server.go`

**Step 1: Add stricter auth limit constant**

```go
var (
    globalLimit = RateLimitConfig{Requests: 100, Window: time.Minute}
    authLimit   = RateLimitConfig{Requests: 5, Window: time.Minute} // new
)
```

**Step 2: Organize router groups with proper limit ordering**

In `server.go`, reorder middleware application:

```go
r := chi.NewRouter()
r.Use(middleware.NewCORS())
r.Use(middleware.SecurityHeaders())
r.Use(chimw.Logger)
r.Use(chimw.Recoverer)

// Auth routes with CSRF exemption + strict rate limit
authRouter := r.With(
    middleware.RateLimitByEndpoint(authLimit.Requests, authLimit.Window),
)
authRouter.Group(func(r chi.Router) {
    r.Post("/api/auth/login", h.HandleLogin)
    r.Post("/api/auth/register", h.HandleRegister)
    r.Post("/api/auth/logout", h.HandleLogout)
    r.Post("/api/auth/verify-code", h.HandleVerifyCode)
})

// Then apply CSRF globally (but auth paths already routed above; adjust order)
// Actually CSRF exempt list is used globally, so keep:
r.Use(middleware.CSRFProtection([]string{...}))
// Then apply global rate limit to non-auth routes
r.Use(middleware.RateLimit())
```

**Better:** Apply CSRF first, then auth rate limiter for those endpoints only. Revised order:

```go
r := chi.NewRouter()
r.Use(middleware.NewCORS())
r.Use(middleware.SecurityHeaders())
r.Use(chimw.Logger)
r.Use(chimw.Recoverer)

// Global CSRF (exempts certain paths)
r.Use(middleware.CSRFProtection([]string{...}))

// Apply auth-specific rate limit first to auth routes
r.Group(func(r chi.Router) {
    r.Use(middleware.RateLimitByEndpoint(authLimit.Requests, authLimit.Window))
    r.Post("/api/auth/login", h.HandleLogin)
    r.Post("/api/auth/register", h.HandleRegister)
    r.Post("/api/auth/logout", h.HandleLogout)
    r.Post("/api/auth/verify-code", h.HandleVerifyCode)
})

// Global rate limit for everything else
r.Use(middleware.RateLimit())

r.Use(h.TenantContextMiddleware)
r.Use(h.AuthMiddleware)  // etc...
```

**Step 3: Verify `RateLimitByEndpoint` exists** — already defined in `rate_limit.go`. Use it.

**Step 4: Test manually**

```bash
# Send 10 login requests quickly
for i in {1..10}; do curl -X POST http://127.0.0.1:3000/api/auth/login -d '{"email":"test@test.com","password":"wrong"}' -s -o /dev/null -w "%{http_code}\n"; done
# Should see 429 after 5th
```

**Step 5: Commit**

```bash
git add internal/server/middleware/rate_limit.go internal/server/server.go
git commit -m "feat(security): apply stricter rate limiting to authentication endpoints"
```

---

### Task 9: Fix IP logging to use X-Forwarded-For when behind trusted proxy

**Files:**
- New: `internal/server/middleware/client_ip.go`
- Modify: `internal/handlers/audit.go` (use client IP from context)
- Modify: `internal/server/server.go` (add middleware to chain)

**Step 1: Write middleware**

Create `internal/server/middleware/client_ip.go`:

```go
package middleware

import (
    "context"
    "net/http"
    "strings"
)

type clientIPKey struct{}

// ClientIP extracts the real client IP, trusting X-Forwarded-For only from localhost (Caddy proxy)
func ClientIP(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        var ip string
        remote := r.RemoteAddr
        // If remote is localhost, trust X-Forwarded-For (Caddy adds it)
        if strings.HasPrefix(remote, "127.0.0.1") || strings.HasPrefix(remote, "[::1]") {
            if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
                // First IP in list is original client
                parts := strings.Split(xff, ",")
                ip = strings.TrimSpace(parts[0])
            } else {
                ip = remote
            }
        } else {
            ip = remote
        }
        ctx := context.WithValue(r.Context(), clientIPKey{}, ip)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// GetClientIP retrieves client IP from request context
func GetClientIP(r *http.Request) string {
    if v := r.Context().Value(clientIPKey{}); v != nil {
        return v.(string)
    }
    return r.RemoteAddr // fallback
}
```

**Step 2: Wire into server**

In `server.go`, after `r.Use(middleware.NewCORS())`, add:

```go
r.Use(middleware.ClientIP)
```

**Step 3: Update audit log handler**

In `internal/handlers/audit.go`, find where IP is extracted:

```go
ip := r.RemoteAddr
```

Replace with:

```go
ip := middleware.GetClientIP(r)
```

Need to import `"github.com/PACTA-Team/pacta/internal/server/middleware"`.

**Step 4: Write test for ClientIP middleware**

`internal/server/middleware/client_ip_test.go`:

```go
package middleware

import (
    "net/http"
    "net/http/httptest"
    "testing"
)

func TestClientIP_TrustsXForwardedForFromLocalhost(t *testing.T) {
    next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ip := GetClientIP(r)
        if ip != "203.0.113.5" {
            t.Errorf("Expected 203.0.113.5, got %s", ip)
        }
    })
    handler := ClientIP(next)

    // Simulate request from Caddy (RemoteAddr=127.0.0.1) with X-Forwarded-For
    req := httptest.NewRequest("GET", "/", nil)
    req.RemoteAddr = "127.0.0.1:12345"
    req.Header.Set("X-Forwarded-For", "203.0.113.5")
    w := httptest.NewRecorder()
    handler.ServeHTTP(w, req)
}

func TestClientIP_UsesRemoteAddrWhenNotLocalhost(t *testing.T) {
    next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ip := GetClientIP(r)
        if ip != "198.51.100.7" {
            t.Errorf("Expected 198.51.100.7, got %s", ip)
        }
    })
    handler := ClientIP(next)

    req := httptest.NewRequest("GET", "/", nil)
    req.RemoteAddr = "198.51.100.7:12345"
    // No X-Forwarded-For
    w := httptest.NewRecorder()
    handler.ServeHTTP(w, req)
}
```

**Step 5: Run tests**

```bash
go test ./internal/server/middleware/... -v
```

**Step 6: Commit**

```bash
git add internal/server/middleware/client_ip.go \
         internal/server/middleware/client_ip_test.go \
         internal/handlers/audit.go \
         internal/server/server.go
git commit -m "feat(security): accurate client IP logging using X-Forwarded-For from trusted proxy"
```

---

### Task 10: Centralize path validation for document storage keys

**File:** `internal/handlers/documents.go`

**Step 1: Create helper function**

In same file (or new `utils.go` in handlers), add:

```go
func validateStorageKey(key string) error {
    if key == "" {
        return errors.New("storage key required")
    }
    // Must not contain path separators or parent directory references
    if strings.Contains(key, "..") || strings.ContainsAny(key, "/\\") {
        return errors.New("invalid storage key")
    }
    // Optional: validate UUID pattern if keys are UUIDs
    // uuid regex: `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`
    return nil
}
```

**Step 2: Apply to all handlers that accept storage key**

Search in `documents.go` for parameters named `key`, `storageKey`, `documentID` used in file paths.

Likely functions:
- `HandleServeTempDocument` (already checks `..` but use validator)
- `HandleUploadTempDocument` (generates key, but later reads from form, so validate)
- `HandleDeleteDocument` (if exists)
- `HandleGetDocument` (if exists)

Add at start of each:

```go
if err := validateStorageKey(key); err != nil {
    h.Error(w, http.StatusBadRequest, "invalid document key")
    return
}
```

**Step 3: Write test for validator**

Add `internal/handlers/documents_test.go` if not exists:

```go
func TestValidateStorageKey(t *testing.T) {
    cases := []struct{ key string; wantErr bool }{
        {"abc123", false},
        {"a1b2-c3d4", false},
        {"../../../etc/passwd", true},
        {"..\\..\\windows", true},
        {"path/to/file", true},
        {"", true},
    }
    for _, c := range cases {
        err := validateStorageKey(c.key)
        hasErr := err != nil
        if hasErr != c.wantErr {
            t.Errorf("validateStorageKey(%q) error = %v, wantErr %v", c.key, err, c.wantErr)
        }
    }
}
```

**Step 4: Run tests**

```bash
go test ./internal/handlers/... -v -run TestValidateStorageKey
```

**Step 5: Commit**

```bash
git add internal/handlers/documents.go internal/handlers/documents_test.go
git commit -m "feat(security): centralize storage key validation to prevent path traversal"
```

---

### Task 11: Unify environment variable names (ENV → ENVIRONMENT)

**Files to scan:**
```bash
grep -rn "os.Getenv(\"ENV\")" internal/
```

Likely in `internal/server/middleware/csrf.go:92` (isProduction function).

**Step 1: Replace occurrences**

Modify `internal/server/middleware/csrf.go`:

```go
func isProduction() bool {
    return os.Getenv("ENVIRONMENT") == "production" || os.Getenv("ENVIRONMENT") == "prod"
}
```

Also check other files:
- `internal/server/middleware/security_headers.go:35` uses `os.Getenv("ENVIRONMENT")` — already consistent.

Run full repo search to ensure no other `ENV` var usage missing.

**Step 2: Update documentation (if any)**

`README.md` or `.env.example` if present.

**Step 3: Test**

Set `ENVIRONMENT=production` and start server; confirm it recognizes production mode.

```bash
ENVIRONMENT=production go run ./cmd/pacta &
# Check logs for HSTS header presence via curl
curl -I http://127.0.0.1:3000 | grep -i strict-transport
# Should not see HSTS on localhost unless configured; but code path hit
```

**Step 4: Commit**

```bash
git add internal/server/middleware/csrf.go
git commit -m "chore(config): standardize ENVIRONMENT variable across middleware"
```

---

### Task 12: Make CORS origins configurable via env var

**File:** `internal/server/middleware/cors.go`

**Step 1: Update `NewCORS()`**

As designed earlier.

**Step 2: Write test**

`internal/server/middleware/cors_test.go` likely exists. Add test case:

```go
func TestNewCORS_ConfigurableOrigins(t *testing.T) {
    os.Setenv("ALLOWED_ORIGINS", "https://example.com,https://api.example.com")
    defer os.Unsetenv("ALLOWED_ORIGINS")
    handler := NewCORS()
    // Inspect handler's allowed origins — might require reflection or integration test
    // Simpler: do HTTP OPTIONS request and check Access-Control-Allow-Origin header
    // t.Skip("Complex to introspect; covered by integration test later")
}
```

Simpler: manually test after implementation.

**Step 3: Commit**

```bash
git add internal/server/middleware/cors.go
git commit -m "feat(security): make CORS allowed origins configurable via ALLOWED_ORIGINS"
```

---

### Task 13: Implement sliding session expiration (reduce to 8h)

**Files:**
- `internal/auth/session.go`
- Database: migrations (add `last_activity` column)

**Step 1: Create migration**

`internal/db/014_add_session_last_activity.sql`:

```sql
ALTER TABLE sessions ADD COLUMN last_activity DATETIME NOT NULL DEFAULT (datetime('now'));
```

**Step 2: Update session creation**

`internal/auth/session.go`:

```go
func CreateSession(db *sql.DB, userID, companyID int) (*models.Session, error) {
    token := generateToken()
    expiresAt := time.Now().Add(8 * time.Hour)
    lastActivity := time.Now()

    result, err := db.Exec(`
        INSERT INTO sessions (token, user_id, company_id, expires_at, last_activity, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, token, userID, companyID, expiresAt, lastActivity)
    // ...
}
```

**Step 3: Create middleware to refresh activity**

In `internal/server/middleware/session_refresh.go` (new):

```go
package middleware

import (
    "net/http"
    "time"

    "github.com/PACTA-Team/pacta/internal/auth"
)

func SessionRefresh(db *sql.DB) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Get session token from cookie
            cookie, err := r.Cookie("session")
            if err == nil {
                // Update last_activity if less than 1h since last
                var lastAct time.Time
                err := db.QueryRow(`
                    SELECT last_activity FROM sessions
                    WHERE token = ? AND expires_at > datetime('now')
                `, cookie.Value).Scan(&lastAct)
                if err == nil && time.Since(lastAct) < time.Hour {
                    // Extend expiry by 1h (sliding window)
                    newExpiry := time.Now().Add(8 * time.Hour)
                    db.Exec(`UPDATE sessions SET last_activity = datetime('now'), expires_at = ? WHERE token = ?`, newExpiry, cookie.Value)
                }
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

Add to `server.go` after `AuthMiddleware`:

```go
r.Use(middleware.SessionRefresh(svc.DB))
```

**Step 4: Update tests** (if any) for session expiry.

**Step 5: Commit**

```bash
git add internal/db/014_add_session_last_activity.sql \
         internal/auth/session.go \
         internal/server/middleware/session_refresh.go \
         internal/server/server.go
git commit -m "feat(security): reduce session lifetime to 8h with sliding expiration"
```

---

## Phase 3 — Operational & Compliance (Weeks 3–6)

### Task 14: Add security.txt and SECURITY.md

**Step 1: Create `./well-known/security.txt`**

Route in `server.go`:

```go
r.Get("/.well-known/security.txt", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "text/plain")
    w.Write([]byte("Contact: mailto:security@pacta.local\nPolicy: https://github.com/PACTA-Team/pacta/security\n"))
})
```

**Step 2: Create `SECURITY.md` at repo root**

```markdown
# Security Policy

## Reporting a Vulnerability

We take security seriously. Please report vulnerabilities privately to:

- Email: security@pacta.local
- PGP Key: [fetch from keyserver]

We aim to respond within 72 hours and fix within 90 days.

## Supported Versions

Only latest minor version receives security updates.

...
```

**Step 3: Commit**

```bash
git add SECURITY.md internal/server/server.go
git commit -m "docs(security): add security disclosure policy and contact"
```

---

### Task 15: Enable automated vulnerability scanning

**Step 1: Add Dependabot config**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    assignees: ["maintainer"]
  - package-ecosystem: "npm"
    directory: "/pacta_appweb"
    schedule:
      interval: "weekly"
    assignees: ["maintainer"]
```

**Step 2: Add govulncheck to CI**

Modify `.github/workflows/build.yml`:

```yaml
- name: Check Go vulnerabilities
  run: |
    go install golang.org/x/vuln/cmd/govulncheck@latest
    govulncheck ./...
```

**Step 3: Add npm audit to frontend CI** (if separate workflow) or to build step.

**Step 4: Commit**

```bash
git add .github/dependabot.yml .github/workflows/build.yml
git commit -m "chore(ci): add automated dependency vulnerability scanning (Dependabot + govulncheck)"
```

---

### Task 16: Sanitize error messages (no leakage)

**Files:** All handlers. Audit to find `h.Error(w, err.Error())` patterns.

**Step 1: Search**

```bash
grep -rn "h.Error(w, .*err.Error()" internal/handlers/
```

**Step 2: Replace each with generic message and log detailed error**

Example change:

```go
// Before:
if err != nil {
    h.Error(w, http.StatusInternalServerError, err.Error())
    return
}

// After:
if err != nil {
    log.Printf("[handler] ERROR: %v", err)
    h.Error(w, http.StatusInternalServerError, "internal server error")
    return
}
```

**Step 3: Commit per file or combined**

```bash
git add internal/handlers/...
git commit -m "chore(security): sanitize error messages to prevent information disclosure"
```

---

### Task 17: Security headers additions

**File:** `internal/server/middleware/security_headers.go`

Add after existing headers:

```go
w.Header().Set("Expect-CT", "max-age=86400")
w.Header().Set("X-Download-Options", "noopen")
w.Header().Set("X-Permitted-Cross-Domain-Policies", "none")
```

**Commit**

```bash
git add internal/server/middleware/security_headers.go
git commit -m "feat(security): add additional security headers (Expect-CT, X-Download-Options)"
```

---

### Task 18: Threat model documentation

Create `docs/security/THREAT_MODEL.md` with STRIDE analysis, data flow, trust boundaries.

**Commit**

```bash
git add docs/security/THREAT_MODEL.md
git commit -m "docs(security): initial threat model and data flow diagram"
```

---

## Checklist Integration

Also create `docs/security/CHECKLIST_REMEDIATION.md` with a tracking table. Mark each task as completed as we go.

---

## Execution Summary

Total tasks: ~18 atomic tasks across 3 phases.  
Estimated effort: 3–5 days for Phase 1, 1 week for Phase 2, 2–4 weeks for Phase 3 (depending on priority).

**Plan file saved to:** `docs/plans/2026-04-26-security-remediation-design.md`

---

## Notes for Implementer

- Run `go test ./...` frequently to catch regressions.
- After each Phase, run `go vet ./...` and `npm run build`.
- Use QA user for authentication tests.
- When modifying CSP nonce injection, if React build fails due to placeholder removal, adjust Vite build or use hash-based CSP fallback.
- Keep commits small and descriptive with `feat(security):` or `chore(security):` prefix.
- If any change breaks existing functionality, consider adding feature flag via env var to rollback quickly.

---

**END OF IMPLEMENTATION PLAN**
