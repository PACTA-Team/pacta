# Hybrid Registration System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement hybrid user registration with Resend email verification and admin approval workflow, fix login-after-registration bug, and resolve SPA 404 routing issues.

**Architecture:** Add Resend email SDK to Go backend for sending verification codes. Create two registration modes: email code (5-min timeout) and admin approval (with company assignment). Fix SPA routing by serving index.html for non-file routes. Add admin UI for pending user approvals and company assignment.

**Tech Stack:** Go (chi router, modernc.org/sqlite), Resend Go SDK v3, React + TypeScript, React Router, Tailwind CSS, Sonner toasts

---

## Phase 1: Backend Foundation & Resend Integration

### Task 1: Add Resend Dependency & Configuration

**Files:**
- Modify: `go.mod` (add dependency)
- Modify: `internal/config/config.go:1-40`
- Modify: `.env.example` (add RESEND_API_KEY)
- Create: `internal/email/resend.go`

**Step 1: Add Resend SDK to Go module**

```bash
cd /home/mowgli/pacta
go get github.com/resend/resend-go/v3
```

Expected: Downloads resend-go v3, updates go.mod and go.sum

**Step 2: Add Resend config to Config struct**

Modify `internal/config/config.go`:

```go
type Config struct {
    Addr         string
    DataDir      string
    Version      string
    ResendAPIKey string
}

func Default() *Config {
    dataDir := defaultDataDir()
    return &Config{
        Addr:         fmt.Sprintf(":%d", DefaultPort),
        DataDir:      dataDir,
        Version:      AppVersion,
        ResendAPIKey: os.Getenv("RESEND_API_KEY"),
    }
}
```

**Step 3: Update .env.example**

Add to `pacta_appweb/.env.example`:

```env
# Required for email verification: Get from https://resend.com/api-keys
RESEND_API_KEY=re_your_api_key_here

# Optional: Default sender email (must be verified domain in Resend)
EMAIL_FROM=PACTA <onboarding@resend.dev>
```

**Step 4: Create Resend client wrapper**

Create `internal/email/resend.go`:

```go
package email

import (
    "context"
    "log"
    "os"

    "github.com/resend/resend-go/v3"
)

var client *resend.Client

func Init(apiKey string) {
    if apiKey == "" {
        log.Println("[email] RESEND_API_KEY not set, email features disabled")
        return
    }
    client = resend.NewClient(apiKey)
}

func IsEnabled() bool {
    return client != nil
}

func SendVerificationCode(ctx context.Context, to, code string) error {
    if client == nil {
        return nil // Fallback: log only
    }

    from := os.Getenv("EMAIL_FROM")
    if from == "" {
        from = "PACTA <onboarding@resend.dev>"
    }

    params := &resend.SendEmailRequest{
        To:      []string{to},
        From:    from,
        Subject: "Your PACTA Verification Code",
        Html:    verificationEmailHTML(code),
    }

    _, err := client.Emails.SendWithContext(ctx, params)
    return err
}

func SendAdminNotification(ctx context.Context, adminEmail, userName, userEmail, companyName string) error {
    if client == nil {
        return nil
    }

    from := os.Getenv("EMAIL_FROM")
    if from == "" {
        from = "PACTA <onboarding@resend.dev>"
    }

    params := &resend.SendEmailRequest{
        To:      []string{adminEmail},
        From:    from,
        Subject: "New User Registration Pending Approval",
        Html:    adminNotificationHTML(userName, userEmail, companyName),
    }

    _, err := client.Emails.SendWithContext(ctx, params)
    return err
}

func verificationEmailHTML(code string) string {
    return `<html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1a1a1a">Verify Your PACTA Account</h2>
        <p>Enter this code to complete your registration:</p>
        <div style="background:#f5f5f5;padding:20px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;border-radius:8px;margin:20px 0">` + code + `</div>
        <p style="color:#666;font-size:14px">This code expires in 5 minutes.</p>
        <p style="color:#666;font-size:12px">If you didn't request this, ignore this email.</p>
    </body></html>`
}

func adminNotificationHTML(userName, userEmail, companyName string) string {
    return `<html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1a1a1a">New User Registration Pending</h2>
        <p><strong>Name:</strong> ` + userName + `</p>
        <p><strong>Email:</strong> ` + userEmail + `</p>
        <p><strong>Company:</strong> ` + companyName + `</p>
        <p style="margin-top:20px">Log in to PACTA as admin to review and approve this registration.</p>
    </body></html>`
}
```

**Step 5: Initialize Resend in server startup**

Modify `internal/server/server.go` after `db.Open`:

```go
// Initialize email service
email.Init(cfg.ResendAPIKey)
```

Add import: `"github.com/PACTA-Team/pacta/internal/email"`

**Step 6: Commit**

```bash
git add go.mod go.sum internal/config/config.go internal/email/resend.go internal/server/server.go pacta_appweb/.env.example
git commit -m "feat: add Resend email SDK integration and configuration"
```

---

### Task 2: Database Migration for Registration Tables

**Files:**
- Create: `internal/db/migrations/023_registration.sql`

**Step 1: Create migration file**

Create `internal/db/migrations/023_registration.sql`:

```sql
-- +goose Up
-- Registration codes for email verification
CREATE TABLE registration_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    code_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_registration_codes_user_id ON registration_codes(user_id);
CREATE INDEX idx_registration_codes_expires ON registration_codes(expires_at);

-- Pending approvals for admin review
CREATE TABLE pending_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_name TEXT NOT NULL,
    company_id INTEGER REFERENCES companies(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pending_approvals_status ON pending_approvals(status);

-- Add new status values to users (SQLite CHECK constraint needs table recreation)
-- For simplicity, we'll handle status validation in application code
-- Existing statuses: 'active', 'inactive', 'locked'
-- New statuses: 'pending_email', 'pending_approval'

-- +goose Down
DROP INDEX IF EXISTS idx_pending_approvals_status;
DROP TABLE IF EXISTS pending_approvals;
DROP INDEX IF EXISTS idx_registration_codes_expires;
DROP INDEX IF EXISTS idx_registration_codes_user_id;
DROP TABLE IF EXISTS registration_codes;
```

**Step 2: Commit**

```bash
git add internal/db/migrations/023_registration.sql
git commit -m "migration: add registration_codes and pending_approvals tables"
```

---

### Task 3: Registration Handler with Email Code Mode

**Files:**
- Modify: `internal/handlers/auth.go` (HandleRegister)
- Create: `internal/handlers/registration.go`

**Step 1: Create registration handler**

Create `internal/handlers/registration.go`:

```go
package handlers

import (
    "context"
    "crypto/rand"
    "database/sql"
    "encoding/json"
    "fmt"
    "math/big"
    "net/http"
    "time"

    "github.com/PACTA-Team/pacta/internal/auth"
    "github.com/PACTA-Team/pacta/internal/email"
)

type VerifyCodeRequest struct {
    Email string `json:"email"`
    Code  string `json:"code"`
}

func (h *Handler) HandleVerifyCode(w http.ResponseWriter, r *http.Request) {
    var req VerifyCodeRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.Error(w, http.StatusBadRequest, "invalid request")
        return
    }

    // Get user by email
    var userID int
    var status string
    err := h.DB.QueryRow("SELECT id, status FROM users WHERE email = ? AND deleted_at IS NULL", req.Email).Scan(&userID, &status)
    if err != nil {
        h.Error(w, http.StatusNotFound, "user not found")
        return
    }

    if status != "pending_email" {
        h.Error(w, http.StatusBadRequest, "user is not pending email verification")
        return
    }

    // Get latest registration code for user
    var codeHash string
    var expiresAt time.Time
    err = h.DB.QueryRow(`
        SELECT code_hash, expires_at FROM registration_codes 
        WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
    `, userID).Scan(&codeHash, &expiresAt)
    if err != nil {
        h.Error(w, http.StatusInternalServerError, "verification failed")
        return
    }

    // Check expiry
    if time.Now().After(expiresAt) {
        h.Error(w, http.StatusGone, "verification code expired. Contact support to activate your account.")
        return
    }

    // Check attempts
    var attempts int
    h.DB.QueryRow("SELECT attempts FROM registration_codes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", userID).Scan(&attempts)
    if attempts >= 5 {
        h.Error(w, http.StatusTooManyRequests, "too many attempts. Contact support.")
        return
    }

    // Validate code
    if !auth.CheckPassword(req.Code, codeHash) {
        // Increment attempts
        h.DB.Exec("UPDATE registration_codes SET attempts = attempts + 1 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", userID)
        h.Error(w, http.StatusUnauthorized, "invalid code")
        return
    }

    // Code valid: activate user
    _, err = h.DB.Exec("UPDATE users SET status = 'active' WHERE id = ?", userID)
    if err != nil {
        h.Error(w, http.StatusInternalServerError, "verification failed")
        return
    }

    // Auto-assign to first company or create one
    var companyID int
    err = h.DB.QueryRow("SELECT id FROM companies LIMIT 1").Scan(&companyID)
    if err == sql.ErrNoRows {
        // Create default company
        result, _ := h.DB.Exec("INSERT INTO companies (name, company_type) VALUES (?, ?)", "Default Company", "client")
        id64, _ := result.LastInsertId()
        companyID = int(id64)
    }

    // Create user_companies entry
    h.DB.Exec("INSERT INTO user_companies (user_id, company_id, is_default) VALUES (?, ?, 1)", userID, companyID)

    // Create session and set cookie
    session, err := auth.CreateSession(h.DB, int64(userID), companyID)
    if err != nil {
        h.Error(w, http.StatusInternalServerError, "failed to create session")
        return
    }

    http.SetCookie(w, &http.Cookie{
        Name:     "session",
        Value:    session.Token,
        Path:     "/",
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteStrictMode,
    })

    h.JSON(w, http.StatusOK, map[string]string{"status": "verified"})
}

func generateCode() (string, error) {
    n, err := rand.Int(rand.Reader, big.NewInt(1000000))
    if err != nil {
        return "", err
    }
    return fmt.Sprintf("%06d", n.Int64()), nil
}

func sendAdminNotifications(ctx context.Context, db *sql.DB, userName, userEmail, companyName string) error {
    rows, err := db.Query("SELECT email FROM users WHERE role = 'admin' AND status = 'active' AND deleted_at IS NULL")
    if err != nil {
        return err
    }
    defer rows.Close()

    for rows.Next() {
        var adminEmail string
        if err := rows.Scan(&adminEmail); err != nil {
            continue
        }
        email.SendAdminNotification(ctx, adminEmail, userName, userEmail, companyName)
    }
    return nil
}
```

**Step 2: Modify HandleRegister to support both modes**

Modify `internal/handlers/auth.go` HandleRegister function. Add registration mode field to RegisterRequest:

```go
type RegisterRequest struct {
    Name        string `json:"name"`
    Email       string `json:"email"`
    Password    string `json:"password"`
    Mode        string `json:"mode"`         // "email" or "approval"
    CompanyName string `json:"company_name"` // for approval mode
}
```

After password hash, before INSERT, add mode logic:

```go
// Determine initial status and role
status := "active"
role := "viewer"

// Check if first user
var userCount int
h.DB.QueryRow("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&userCount)
if userCount == 0 {
    role = "admin"
    status = "active" // First user always active
} else {
    // Determine status based on mode
    if req.Mode == "email" {
        status = "pending_email"
    } else if req.Mode == "approval" {
        status = "pending_approval"
    }
}

// Insert user with determined status
result, err := h.DB.Exec(
    "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)",
    req.Name, req.Email, hash, role, status,
)
```

After user insert, add mode-specific handling:

```go
userID, _ := result.LastInsertId()

// Handle registration modes
if userCount > 0 {
    if req.Mode == "email" && email.IsEnabled() {
        // Generate and send code
        code, err := generateCode()
        if err != nil {
            h.Error(w, http.StatusInternalServerError, "failed to generate code")
            return
        }
        codeHash, _ := auth.HashPassword(code)
        h.DB.Exec(
            "INSERT INTO registration_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)",
            userID, codeHash, time.Now().Add(5*time.Minute),
        )
        
        ctx := context.Background()
        email.SendVerificationCode(ctx, req.Email, code)
        
        h.JSON(w, http.StatusCreated, map[string]interface{}{
            "id":    userID,
            "name":  req.Name,
            "email": req.Email,
            "role":  role,
            "status": "pending_email",
        })
        return
    }
    
    if req.Mode == "approval" {
        // Create pending approval
        h.DB.Exec(
            "INSERT INTO pending_approvals (user_id, company_name) VALUES (?, ?)",
            userID, req.CompanyName,
        )
        
        // Notify admins
        ctx := context.Background()
        sendAdminNotifications(ctx, h.DB, req.Name, req.Email, req.CompanyName)
        
        h.JSON(w, http.StatusCreated, map[string]interface{}{
            "id":    userID,
            "name":  req.Name,
            "email": req.Email,
            "role":  role,
            "status": "pending_approval",
        })
        return
    }
}

// Existing auto-login code for first user / active users...
// (keep existing session creation logic for active users)
```

**Step 3: Register new route in server.go**

Modify `internal/server/server.go`:

```go
// Auth routes
r.Post("/api/auth/login", h.HandleLogin)
r.Post("/api/auth/register", h.HandleRegister)
r.Post("/api/auth/logout", h.HandleLogout)
r.Post("/api/auth/verify-code", h.HandleVerifyCode) // NEW
```

**Step 4: Commit**

```bash
git add internal/handlers/auth.go internal/handlers/registration.go internal/server/server.go
git commit -m "feat: implement hybrid registration with email code and admin approval modes"
```

---

### Task 4: Admin Approval Handler

**Files:**
- Create: `internal/handlers/approvals.go`
- Modify: `internal/server/server.go` (add routes)

**Step 1: Create approvals handler**

Create `internal/handlers/approvals.go`:

```go
package handlers

import (
    "database/sql"
    "encoding/json"
    "net/http"
    "strconv"
    "strings"
    "time"
)

type PendingApproval struct {
    ID          int       `json:"id"`
    UserID      int       `json:"user_id"`
    UserName    string    `json:"user_name"`
    UserEmail   string    `json:"user_email"`
    CompanyName string    `json:"company_name"`
    Status      string    `json:"status"`
    CreatedAt   time.Time `json:"created_at"`
}

func (h *Handler) HandlePendingApprovals(w http.ResponseWriter, r *http.Request) {
    switch r.Method {
    case http.MethodGet:
        h.listPendingApprovals(w, r)
    case http.MethodPost:
        h.approveOrReject(w, r)
    default:
        h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
    }
}

func (h *Handler) listPendingApprovals(w http.ResponseWriter, r *http.Request) {
    rows, err := h.DB.Query(`
        SELECT pa.id, pa.user_id, u.name, u.email, pa.company_name, pa.status, pa.created_at
        FROM pending_approvals pa
        JOIN users u ON u.id = pa.user_id
        WHERE pa.status = 'pending' AND u.deleted_at IS NULL
        ORDER BY pa.created_at DESC
    `)
    if err != nil {
        h.Error(w, http.StatusInternalServerError, "failed to list approvals")
        return
    }
    defer rows.Close()

    var approvals []PendingApproval
    for rows.Next() {
        var a PendingApproval
        rows.Scan(&a.ID, &a.UserID, &a.UserName, &a.UserEmail, &a.CompanyName, &a.Status, &a.CreatedAt)
        approvals = append(approvals, a)
    }
    if approvals == nil {
        approvals = []PendingApproval{}
    }

    h.JSON(w, http.StatusOK, approvals)
}

type ApprovalRequest struct {
    ApprovalID int    `json:"approval_id"`
    Action     string `json:"action"` // "approve" or "reject"
    CompanyID  *int   `json:"company_id,omitempty"`
    Notes      string `json:"notes,omitempty"`
}

func (h *Handler) approveOrReject(w http.ResponseWriter, r *http.Request) {
    var req ApprovalRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.Error(w, http.StatusBadRequest, "invalid request")
        return
    }

    adminID := h.getUserID(r)

    // Get approval
    var userID int
    var companyName string
    err := h.DB.QueryRow("SELECT user_id, company_name FROM pending_approvals WHERE id = ? AND status = 'pending'", req.ApprovalID).Scan(&userID, &companyName)
    if err != nil {
        h.Error(w, http.StatusNotFound, "approval not found")
        return
    }

    if req.Action == "approve" {
        // Assign company: use provided or create new
        companyID := 0
        if req.CompanyID != nil && *req.CompanyID > 0 {
            companyID = *req.CompanyID
        } else {
            // Create company from user's input
            result, err := h.DB.Exec("INSERT INTO companies (name, company_type) VALUES (?, ?)", companyName, "client")
            if err != nil {
                h.Error(w, http.StatusInternalServerError, "failed to create company")
                return
            }
            id64, _ := result.LastInsertId()
            companyID = int(id64)
        }

        // Activate user and assign company
        _, err = h.DB.Exec("UPDATE users SET status = 'active' WHERE id = ?", userID)
        if err != nil {
            h.Error(w, http.StatusInternalServerError, "failed to activate user")
            return
        }

        h.DB.Exec("INSERT INTO user_companies (user_id, company_id, is_default) VALUES (?, ?, 1)", userID, companyID)

        // Update approval
        h.DB.Exec("UPDATE pending_approvals SET status = 'approved', reviewed_by = ?, reviewed_at = ?, company_id = ?, notes = ? WHERE id = ?",
            adminID, time.Now(), companyID, req.Notes, req.ApprovalID)

        h.JSON(w, http.StatusOK, map[string]string{"status": "approved"})
        return
    }

    if req.Action == "reject" {
        // Reject user
        h.DB.Exec("UPDATE users SET status = 'inactive' WHERE id = ?", userID)
        h.DB.Exec("UPDATE pending_approvals SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, notes = ? WHERE id = ?",
            adminID, time.Now(), req.Notes, req.ApprovalID)

        h.JSON(w, http.StatusOK, map[string]string{"status": "rejected"})
        return
    }

    h.Error(w, http.StatusBadRequest, "invalid action")
}

// HandleUserCompany: Admin assigns user to company
func (h *Handler) HandleUserCompany(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPatch {
        h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
        return
    }

    // Extract user ID from path: /api/users/{id}/company
    pathParts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/users/"), "/")
    if len(pathParts) < 2 {
        h.Error(w, http.StatusBadRequest, "invalid path")
        return
    }
    userID, err := strconv.Atoi(pathParts[0])
    if err != nil {
        h.Error(w, http.StatusBadRequest, "invalid user ID")
        return
    }

    var req struct {
        CompanyID int `json:"company_id"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.Error(w, http.StatusBadRequest, "invalid request")
        return
    }

    // Check if user already has company assignment
    var existing int
    h.DB.QueryRow("SELECT COUNT(*) FROM user_companies WHERE user_id = ?", userID).Scan(&existing)

    if existing > 0 {
        _, err = h.DB.Exec("UPDATE user_companies SET company_id = ?, is_default = 1 WHERE user_id = ?", req.CompanyID, userID)
    } else {
        _, err = h.DB.Exec("INSERT INTO user_companies (user_id, company_id, is_default) VALUES (?, ?, 1)", userID, req.CompanyID)
    }

    if err != nil {
        h.Error(w, http.StatusInternalServerError, "failed to assign company")
        return
    }

    h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}
```

**Step 2: Register routes in server.go**

Add to authenticated admin routes group:

```go
// Admin only
r.Group(func(r chi.Router) {
    r.Use(h.RequireRole(4))

    r.Get("/api/users", h.HandleUsers)
    r.Post("/api/users", h.HandleUsers)
    r.Get("/api/users/{id}", h.HandleUserByID)
    r.Put("/api/users/{id}", h.HandleUserByID)
    r.Delete("/api/users/{id}", h.HandleUserByID)
    r.Patch("/api/users/{id}/reset-password", h.HandleUserByID)
    r.Patch("/api/users/{id}/status", h.HandleUserByID)
    r.Patch("/api/users/{id}/company", h.HandleUserCompany) // NEW

    // Approval routes
    r.Get("/api/approvals/pending", h.HandlePendingApprovals)
    r.Post("/api/approvals", h.HandlePendingApprovals)
})
```

**Step 3: Commit**

```bash
git add internal/handlers/approvals.go internal/server/server.go
git commit -m "feat: add admin approval workflow and user company assignment"
```

---

### Task 5: Fix Login Bug & SPA Routing

**Files:**
- Modify: `internal/handlers/auth.go` (HandleLogin)
- Modify: `internal/server/server.go` (SPA handler)

**Step 1: Fix HandleLogin to handle pending statuses**

Modify `internal/handlers/auth.go` HandleLogin:

After `Authenticate` call, add status check:

```go
if user.Status == "pending_email" {
    h.Error(w, http.StatusForbidden, "please verify your email first. Check your inbox for the verification code.")
    return
}
if user.Status == "pending_approval" {
    h.Error(w, http.StatusForbidden, "your account is pending admin approval. You will be notified once approved.")
    return
}
```

Fix company lookup to handle missing company:

```go
// Resolve user's default company
var companyID int
err = h.DB.QueryRow(`
    SELECT company_id FROM user_companies
    WHERE user_id = ? AND is_default = 1
`, user.ID).Scan(&companyID)
if err == sql.ErrNoRows {
    // Try fallback
    err = h.DB.QueryRow("SELECT company_id FROM users WHERE id = ?", user.ID).Scan(&companyID)
}
if err != nil {
    // No company assigned - provide helpful error
    h.Error(w, http.StatusForbidden, "no company assigned. Contact an administrator to assign you to a company.")
    return
}
```

**Step 2: Fix SPA routing**

Modify `internal/server/server.go`:

Replace the static file serving line:

```go
// OLD:
staticSub, _ := fs.Sub(staticFS, "dist")
r.Handle("/*", http.FileServer(http.FS(staticSub)))

// NEW:
staticSub, _ := fs.Sub(staticFS, "dist")
r.Handle("/*", spaHandler(staticSub))
```

Add spaHandler function at end of file:

```go
func spaHandler(fsys fs.FS) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Try to serve the requested file
        path := strings.TrimPrefix(r.URL.Path, "/")
        f, err := fsys.Open(path)
        if err != nil {
            // File doesn't exist, serve index.html for SPA routing
            indexPath, _ := fsys.Open("index.html")
            defer indexPath.Close()
            http.ServeContent(w, r, "index.html", time.Time{}, indexPath.(interface{ Stat() (os.FileInfo, error) }).Stat().(interface{}))
            // Simpler fallback:
            http.ServeFile(w, r, "dist/index.html")
            return
        }
        defer f.Close()

        // Check if it's a directory request
        stat, err := f.Stat()
        if err == nil && stat.IsDir() {
            // Serve directory index
            http.FileServer(http.FS(fsys)).ServeHTTP(w, r)
            return
        }

        // Serve the file
        http.FileServer(http.FS(fsys)).ServeHTTP(w, r)
    })
}
```

Add imports: `"strings"`, `"os"`, `"time"`

**Step 3: Commit**

```bash
git add internal/handlers/auth.go internal/server/server.go
git commit -m "fix: resolve login bug and SPA 404 routing issues"
```

---

## Phase 2: Frontend Implementation

### Task 6: Registration API Client & LoginForm Updates

**Files:**
- Create: `pacta_appweb/src/lib/registration-api.ts`
- Modify: `pacta_appweb/src/components/auth/LoginForm.tsx`

**Step 1: Create registration API client**

Create `pacta_appweb/src/lib/registration-api.ts`:

```typescript
const BASE = '/api/auth';

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const registrationAPI = {
  register: (name: string, email: string, password: string, mode: 'email' | 'approval', companyName?: string) =>
    fetchJSON(`${BASE}/register`, {
      method: 'POST',
      body: JSON.stringify({ name, email, password, mode, company_name: companyName }),
    }),

  verifyCode: (email: string, code: string) =>
    fetchJSON(`${BASE}/verify-code`, {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
};

export const approvalsAPI = {
  listPending: () => fetchJSON('/api/approvals/pending'),
  approve: (approvalId: number, companyId?: number, notes?: string) =>
    fetchJSON('/api/approvals', {
      method: 'POST',
      body: JSON.stringify({ approval_id: approvalId, action: 'approve', company_id: companyId, notes }),
    }),
  reject: (approvalId: number, notes?: string) =>
    fetchJSON('/api/approvals', {
      method: 'POST',
      body: JSON.stringify({ approval_id: approvalId, action: 'reject', notes }),
    }),
};

export const usersAPI = {
  // ... existing methods ...
  assignCompany: (userId: number, companyId: number) =>
    fetchJSON(`/api/users/${userId}/company`, {
      method: 'PATCH',
      body: JSON.stringify({ company_id: companyId }),
    }),
};
```

**Step 2: Update LoginForm with registration mode selector**

Modify `pacta_appweb/src/components/auth/LoginForm.tsx`:

Add state variables:

```tsx
const [registrationMode, setRegistrationMode] = useState<'email' | 'approval'>('email');
const [companyName, setCompanyName] = useState('');
const [showVerification, setShowVerification] = useState(false);
const [verificationEmail, setVerificationEmail] = useState('');
const [verificationCode, setVerificationCode] = useState('');
```

Update handleRegister:

```tsx
const handleRegister = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    const result = await register(name, email, password);
    if (result.user) {
      if (result.user.status === 'pending_email') {
        setVerificationEmail(email);
        setShowVerification(true);
        toast.info('Verification code sent to your email');
      } else if (result.user.status === 'pending_approval') {
        toast.success('Registration submitted. An admin will review your request.');
        setShowRegister(false);
        setName('');
        setEmail('');
        setPassword('');
      } else {
        toast.success(t('registerSuccess'));
        setShowRegister(false);
        setName('');
        setEmail('');
        setPassword('');
      }
    } else {
      toast.error(result.error || t('registerError'));
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : t('registerError'));
  }
};
```

Add verification form and mode selector in the registration section (after the password field):

```tsx
{!showVerification && (
  <>
    <div className="space-y-2">
      <Label>Registration Method</Label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="mode"
            value="email"
            checked={registrationMode === 'email'}
            onChange={() => setRegistrationMode('email')}
          />
          <span className="text-sm">Email verification</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="mode"
            value="approval"
            checked={registrationMode === 'approval'}
            onChange={() => setRegistrationMode('approval')}
          />
          <span className="text-sm">Admin approval</span>
        </label>
      </div>
    </div>

    {registrationMode === 'approval' && (
      <div className="space-y-2">
        <Label htmlFor="company">Company Name</Label>
        <Input
          id="company"
          placeholder="Your company name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
        />
      </div>
    )}
  </>
)}

{showVerification && (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="code">Verification Code</Label>
      <Input
        id="code"
        placeholder="Enter 6-digit code"
        value={verificationCode}
        onChange={(e) => setVerificationCode(e.target.value)}
        maxLength={6}
        required
      />
    </div>
    <Button onClick={handleVerifyCode} className="w-full">
      Verify Email
    </Button>
  </div>
)}
```

Add handleVerifyCode:

```tsx
import { registrationAPI } from '@/lib/registration-api';

const handleVerifyCode = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    await registrationAPI.verifyCode(verificationEmail, verificationCode);
    toast.success('Email verified! You are now logged in.');
    navigate('/dashboard');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    if (message.includes('expired')) {
      navigate('/registration-expired');
    } else {
      toast.error(message);
    }
  }
};
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/lib/registration-api.ts pacta_appweb/src/components/auth/LoginForm.tsx
git commit -m "feat: add registration mode selector and email verification UI"
```

---

### Task 7: Verify Email & Registration Expired Pages

**Files:**
- Create: `pacta_appweb/src/pages/VerifyEmailPage.tsx`
- Create: `pacta_appweb/src/pages/RegistrationExpiredPage.tsx`
- Modify: `pacta_appweb/src/App.tsx`

**Step 1: Create VerifyEmailPage**

Create `pacta_appweb/src/pages/VerifyEmailPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { registrationAPI } from '@/lib/registration-api';
import { toast } from 'sonner';

export default function VerifyEmailPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [code, setCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  useEffect(() => {
    if (timeLeft <= 0) {
      navigate('/registration-expired');
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, navigate]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registrationAPI.verifyCode(email, code);
      toast.success('Email verified successfully!');
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid code';
      if (message.includes('expired')) {
        navigate('/registration-expired');
      } else {
        toast.error(message);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Verify Your Email</CardTitle>
          <CardDescription className="text-center">
            Enter the 6-digit code sent to {email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-4">
            <div className="text-3xl font-mono font-bold text-primary">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
            <p className="text-sm text-muted-foreground">Time remaining</p>
          </div>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                className="text-center text-2xl tracking-widest"
                autoFocus
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Verify & Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Create RegistrationExpiredPage**

Create `pacta_appweb/src/pages/RegistrationExpiredPage.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone } from 'lucide-react';

export default function RegistrationExpiredPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Verification Code Expired</CardTitle>
          <CardDescription className="text-center">
            The 5-minute window for email verification has expired.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
              Please contact support or an administrator to activate your account.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>support@pacta.app</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>Contact your system administrator</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => navigate('/login')}>
              Back to Login
            </Button>
            <Button className="flex-1" onClick={() => navigate('/')}>
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Add routes to App.tsx**

Modify `pacta_appweb/src/App.tsx`:

Add imports:
```tsx
import VerifyEmailPage from './pages/VerifyEmailPage';
import RegistrationExpiredPage from './pages/RegistrationExpiredPage';
```

Add routes (before the 404 catch-all):
```tsx
<Route path="/verify-email" element={<VerifyEmailPage />} />
<Route path="/registration-expired" element={<RegistrationExpiredPage />} />
```

**Step 4: Commit**

```bash
git add pacta_appweb/src/pages/VerifyEmailPage.tsx pacta_appweb/src/pages/RegistrationExpiredPage.tsx pacta_appweb/src/App.tsx
git commit -m "feat: add verify email and registration expired pages"
```

---

### Task 8: Admin Pending Approvals UI

**Files:**
- Create: `pacta_appweb/src/components/admin/PendingUsersTable.tsx`
- Modify: `pacta_appweb/src/pages/UsersPage.tsx`

**Step 1: Create PendingUsersTable component**

Create `pacta_appweb/src/components/admin/PendingUsersTable.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { approvalsAPI } from '@/lib/registration-api';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

interface PendingApproval {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  company_name: string;
  status: string;
  created_at: string;
}

interface Company {
  id: number;
  name: string;
}

export default function PendingUsersTable() {
  const { t } = useTranslation('settings');
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<number | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [approvalsData, companiesData] = await Promise.all([
        approvalsAPI.listPending(),
        fetch('/api/companies', { credentials: 'include' }).then(r => r.json()),
      ]);
      setApprovals(approvalsData);
      setCompanies(companiesData);
    } catch (err) {
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (approvalId: number) => {
    setActioning(approvalId);
    try {
      const companyId = selectedCompany[approvalId] || undefined;
      await approvalsAPI.approve(approvalId, companyId, notes[approvalId]);
      toast.success('User approved');
      loadData();
    } catch (err) {
      toast.error('Failed to approve');
    } finally {
      setActioning(null);
    }
  };

  const handleReject = async (approvalId: number) => {
    setActioning(approvalId);
    try {
      await approvalsAPI.reject(approvalId, notes[approvalId]);
      toast.success('Registration rejected');
      loadData();
    } catch (err) {
      toast.error('Failed to reject');
    } finally {
      setActioning(null);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  if (approvals.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No pending registrations
        </CardContent>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Registered</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {approvals.map((approval) => (
          <TableRow key={approval.id}>
            <TableCell className="font-medium">{approval.user_name}</TableCell>
            <TableCell>{approval.user_email}</TableCell>
            <TableCell>
              <Select
                value={selectedCompany[approval.id]?.toString() || ''}
                onValueChange={(v) => setSelectedCompany(prev => ({ ...prev, [approval.id]: parseInt(v) }))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select or create new" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Create: {approval.company_name}</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>{new Date(approval.created_at).toLocaleDateString()}</TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleApprove(approval.id)}
                  disabled={actioning === approval.id}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReject(approval.id)}
                  disabled={actioning === approval.id}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
              <Textarea
                placeholder="Notes (optional)"
                value={notes[approval.id] || ''}
                onChange={(e) => setNotes(prev => ({ ...prev, [approval.id]: e.target.value }))}
                className="mt-2 h-16"
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Step 2: Add Pending tab to UsersPage**

Modify `pacta_appweb/src/pages/UsersPage.tsx`:

Add import and state:
```tsx
import PendingUsersTable from '@/components/admin/PendingUsersTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
const [activeTab, setActiveTab] = useState('users');
```

Wrap the existing user table and add tabs:

```tsx
return (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <p className="text-muted-foreground">{t('subtitle')}</p>
      <Button onClick={() => setShowForm(true)}>
        <Plus className="mr-2 h-4 w-4" />
        {t('addNew')}
      </Button>
    </div>

    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="pending">Pending Approvals</TabsTrigger>
      </TabsList>
      <TabsContent value="users">
        {/* Existing user table code */}
      </TabsContent>
      <TabsContent value="pending">
        <PendingUsersTable />
      </TabsContent>
    </Tabs>
  </div>
);
```

**Step 3: Add company selector to user edit form**

In UsersPage.tsx, add company field to edit form:

Add state:
```tsx
const [companies, setCompanies] = useState<{id: number, name: string}[]>([]);
const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
```

Load companies in useEffect:
```tsx
useEffect(() => {
  fetch('/api/companies', { credentials: 'include' })
    .then(r => r.json())
    .then(setCompanies)
    .catch(() => {});
}, []);
```

Add to edit form (after role/status selects):
```tsx
<div className="space-y-2">
  <Label htmlFor="company">Company</Label>
  <Select
    value={selectedCompanyId?.toString() || ''}
    onValueChange={(v) => setSelectedCompanyId(parseInt(v))}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select company" />
    </SelectTrigger>
    <SelectContent>
      {companies.map(c => (
        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

Update handleSubmit to include company assignment when editing:
```tsx
if (editingUser && selectedCompanyId) {
  await usersAPI.assignCompany(editingUser.id, selectedCompanyId);
}
```

**Step 4: Commit**

```bash
git add pacta_appweb/src/components/admin/PendingUsersTable.tsx pacta_appweb/src/pages/UsersPage.tsx
git commit -m "feat: add admin pending approvals UI and company assignment"
```

---

## Phase 3: Testing & Verification

### Task 9: Build & Verify

**Files:**
- All modified files

**Step 1: Build Go backend**

```bash
cd /home/mowgli/pacta
go build ./cmd/pacta
```

Expected: No errors, produces `pacta` binary

**Step 2: Build frontend**

```bash
cd /home/mowgli/pacta/pacta_appweb
npm run build
```

Expected: Builds to `dist/` directory with no errors

**Step 3: Run Go vet and lint**

```bash
cd /home/mowgli/pacta
go vet ./...
```

Expected: No issues

**Step 4: Commit final state**

```bash
git add .
git commit -m "chore: build verification and cleanup"
```

---

### Task 10: Update Documentation

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `CHANGELOG.md`
- Create: `docs/REGISTRATION-FLOW.md`

**Step 1: Update ARCHITECTURE.md**

Add section about registration:

```markdown
## Registration Flow

PACTA supports two registration modes:
- **Email Verification**: New users receive a 6-digit code via Resend, valid for 5 minutes
- **Admin Approval**: Users submit registration with company name, admins review and approve

Unverified users have status `pending_email` or `pending_approval` and cannot login until verified/approved.
```

**Step 2: Update CHANGELOG.md**

Add entry at top:

```markdown
## [Unreleased]

### Added
- Hybrid registration system with Resend email verification
- Admin approval workflow for new user registrations
- Email verification with 5-minute timeout and support contact flow
- Pending approvals UI in admin panel
- Company assignment for users from admin panel

### Fixed
- Login failing after registration due to missing company assignment
- 404 errors on browser back button and page refresh (SPA routing)
```

**Step 3: Create REGISTRATION-FLOW.md**

Create `docs/REGISTRATION-FLOW.md`:

```markdown
# Registration Flow Documentation

## Overview

PACTA now supports two registration methods for new users.

## Email Verification Flow

1. User selects "Email verification" on registration form
2. User enters name, email, password
3. System sends 6-digit code to email via Resend
4. User has 5 minutes to enter code
5. On success: user activated, auto-assigned to company, logged in
6. On timeout: user directed to contact support

## Admin Approval Flow

1. User selects "Admin approval" on registration form
2. User enters name, email, password, company name
3. System creates user with `pending_approval` status
4. All admins receive email notification
5. Admin reviews in Users page → "Pending Approvals" tab
6. Admin approves (assigns to existing or new company) or rejects
7. User can login after approval

## Configuration

Set `RESEND_API_KEY` environment variable to enable email features.
If not set, only admin approval mode is available.
```

**Step 4: Final commit**

```bash
git add docs/ARCHITECTURE.md docs/CHANGELOG.md docs/REGISTRATION-FLOW.md
git commit -m "docs: update architecture and changelog with registration flow"
```

---

## Summary

**Total Tasks**: 10
**Estimated Commits**: 10
**Key Files Created**: 8
**Key Files Modified**: 10

**Testing Strategy**:
- TDD: Write tests for registration code generation, validation, expiry
- Manual testing: Register via both modes, verify email flow, admin approval
- Build verification: `go build`, `go vet`, `npm run build`

**Risk Areas**:
- Resend API key must be set for email mode (graceful fallback if missing)
- SPA routing must not break API routes (check path prefix first)
- Company assignment logic must handle edge case of zero companies
