# PACTA Monorepo Local-First Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate PACTA's 4 repositories into a single monorepo producing one self-contained Go binary that serves a Next.js static frontend + SQLite REST API backend, fully offline.

**Architecture:** Single Go binary embeds static Next.js build (`output: 'export'`) and SQL migrations. One HTTP server on `:3000` serves static files for `/*` and REST API for `/api/*`. SQLite via `modernc.org/sqlite` (pure Go, no CGO). Session-based auth via httpOnly cookies.

**Tech Stack:** Go 1.23, SQLite, Next.js 15 (App Router, static export), Tailwind CSS v4, shadcn/ui, chi router, GoReleaser v2

---

## Phase 0: Cleanup & Monorepo Setup

### Task 1: Remove old repos and docs

**Files:**
- Delete: `pacta-backend/` (entire directory)
- Delete: `pacta-desktop/` (entire directory)
- Delete: `pacta-docs/` (entire directory)
- Delete: `pacta-caddy.conf`
- Delete: `pacta.service`
- Delete: `docs/PROJECT_SUMMARY.md`

**Step 1: Remove old directories and files**

```bash
cd /home/mowgli/pacta
rm -rf pacta-backend pacta-desktop pacta-docs
rm -f pacta-caddy.conf pacta.service docs/PROJECT_SUMMARY.md
```

**Step 2: Verify cleanup**

```bash
ls -la /home/mowgli/pacta/
```
Expected: Only `pacta_appweb/` and `docs/plans/` remain.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old repos in preparation for monorepo"
```

---

### Task 2: Initialize Go monorepo structure

**Files:**
- Create: `go.mod`
- Create: `go.sum`
- Create: `cmd/pacta/main.go`
- Create: `internal/config/config.go`
- Create: `internal/server/server.go`
- Create: `internal/db/db.go`
- Create: `migrations/001_users.sql`

**Step 1: Initialize Go module**

```bash
cd /home/mowgli/pacta
go mod init github.com/PACTA-Team/pacta
```

**Step 2: Create directory structure**

```bash
mkdir -p cmd/pacta internal/config internal/server internal/db internal/handlers internal/models internal/auth migrations frontend assets
```

**Step 3: Create go.mod with dependencies**

```go
module github.com/PACTA-Team/pacta

go 1.23

require (
    github.com/go-chi/chi/v5 v5.2.1
    github.com/mattn/go-sqlite3 v1.14.24
    golang.org/x/crypto v0.33.0
)
```

Note: Using `github.com/mattn/go-sqlite3` with CGO_ENABLED=0 won't work. Use `modernc.org/sqlite` instead:

```go
module github.com/PACTA-Team/pacta

go 1.23

require (
    github.com/go-chi/chi/v5 v5.2.1
    modernc.org/sqlite v1.34.5
    golang.org/x/crypto v0.33.0
)
```

**Step 4: Create minimal main.go**

```go
package main

import (
    "log"
    "github.com/PACTA-Team/pacta/internal/config"
    "github.com/PACTA-Team/pacta/internal/server"
)

func main() {
    cfg := config.Default()
    log.Printf("PACTA v%s starting on %s", cfg.Version, cfg.Addr)
    if err := server.Start(cfg); err != nil {
        log.Fatalf("Server failed: %v", err)
    }
}
```

**Step 5: Create config.go**

```go
package config

const AppName = "PACTA"
const DefaultPort = 3000
const DefaultDataDir = ".pacta"

var AppVersion = "dev"

type Config struct {
    Addr    string
    DataDir string
    Version string
}

func Default() *Config {
    return &Config{
        Addr:    fmt.Sprintf(":%d", DefaultPort),
        DataDir: DefaultDataDir,
        Version: AppVersion,
    }
}
```

Add `fmt` and `os` imports as needed for data dir resolution.

**Step 6: Create minimal server.go**

```go
package server

import (
    "fmt"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "github.com/PACTA-Team/pacta/internal/config"
)

func Start(cfg *config.Config) error {
    mux := http.NewServeMux()
    mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "PACTA v%s - API not yet implemented", cfg.Version)
    })

    srv := &http.Server{
        Addr:    cfg.Addr,
        Handler: mux,
    }

    go func() {
        log.Printf("Listening on http://127.0.0.1%s", cfg.Addr)
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Listen: %v", err)
        }
    }()

    // Wait for interrupt
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    log.Println("Shutting down...")
    return nil
}
```

**Step 7: Verify it compiles**

```bash
cd /home/mowgli/pacta
go mod tidy
go build ./cmd/pacta
```
Expected: Binary `pacta` created, no errors.

**Step 8: Quick smoke test**

```bash
./pacta &
sleep 2
curl -s http://127.0.0.1:3000
kill %1
```
Expected: Response contains "PACTA vdev - API not yet implemented".

**Step 9: Commit**

```bash
git add go.mod go.sum cmd/ internal/ migrations/
git commit -m "feat: initialize Go monorepo with minimal server"
```

---

## Phase 1: Database Layer

### Task 3: SQLite database setup with migrations

**Files:**
- Create: `internal/db/db.go`
- Create: `internal/db/migrate.go`
- Create: `migrations/001_users.sql`
- Create: `migrations/002_clients.sql`
- Create: `migrations/003_suppliers.sql`
- Create: `migrations/004_authorized_signers.sql`
- Create: `migrations/005_contracts.sql`
- Create: `migrations/006_supplements.sql`
- Create: `migrations/007_documents.sql`
- Create: `migrations/008_notifications.sql`
- Create: `migrations/009_audit_logs.sql`

**Step 1: Create db.go**

```go
package db

import (
    "database/sql"
    "embed"
    "fmt"
    "os"
    "path/filepath"
    _ "modernc.org/sqlite"
)

//go:embed *.sql
var migrationsFS embed.FS

func Open(dataDir string) (*sql.DB, error) {
    if err := os.MkdirAll(dataDir, 0755); err != nil {
        return nil, fmt.Errorf("create data dir: %w", err)
    }
    dbPath := filepath.Join(dataDir, "pacta.db")
    db, err := sql.Open("sqlite", dbPath)
    if err != nil {
        return nil, fmt.Errorf("open sqlite: %w", err)
    }
    // WAL mode for better concurrency
    if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
        return nil, fmt.Errorf("enable WAL: %w", err)
    }
    // Foreign keys
    if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
        return nil, fmt.Errorf("enable FK: %w", err)
    }
    return db, nil
}
```

**Step 2: Create migrate.go**

```go
package db

import (
    "database/sql"
    "fmt"
    "io/fs"
    "sort"
    "strings"
)

func Migrate(db *sql.DB) error {
    entries, err := fs.ReadDir(migrationsFS, ".")
    if err != nil {
        return fmt.Errorf("read migrations: %w", err)
    }

    // Create migrations tracking table
    if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`); err != nil {
        return fmt.Errorf("create migrations table: %w", err)
    }

    // Get already applied versions
    rows, err := db.Query("SELECT version FROM schema_migrations")
    if err != nil {
        return fmt.Errorf("query applied: %w", err)
    }
    applied := make(map[int]bool)
    for rows.Next() {
        var v int
        rows.Scan(&v)
        applied[v] = true
    }
    rows.Close()

    // Apply in order
    for _, e := range entries {
        if e.IsDir() {
            continue
        }
        name := e.Name()
        if !strings.HasSuffix(name, ".sql") {
            continue
        }
        var version int
        fmt.Sscanf(name, "%d", &version)
        if applied[version] {
            continue
        }
        content, err := migrationsFS.ReadFile(name)
        if err != nil {
            return fmt.Errorf("read %s: %w", name, err)
        }
        tx, err := db.Begin()
        if err != nil {
            return fmt.Errorf("begin tx for %s: %w", name, err)
        }
        if _, err := tx.Exec(string(content)); err != nil {
            tx.Rollback()
            return fmt.Errorf("apply %s: %w", name, err)
        }
        if _, err := tx.Exec("INSERT INTO schema_migrations (version) VALUES (?)", version); err != nil {
            tx.Rollback()
            return fmt.Errorf("track %s: %w", name, err)
        }
        if err := tx.Commit(); err != nil {
            return fmt.Errorf("commit %s: %w", name, err)
        }
    }
    return nil
}
```

**Step 3: Create migration SQL files**

`migrations/001_users.sql`:
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'editor', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'locked')),
    last_access DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- Default admin user (password: admin123, bcrypt cost 10)
INSERT INTO users (name, email, password_hash, role) VALUES
('Admin', 'admin@pacta.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin');
```

`migrations/002_clients.sql`:
```sql
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    reu_code TEXT,
    contacts TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_clients_name ON clients(name);
```

`migrations/003_suppliers.sql`:
```sql
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    reu_code TEXT,
    contacts TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_suppliers_name ON suppliers(name);
```

`migrations/004_authorized_signers.sql`:
```sql
CREATE TABLE IF NOT EXISTS authorized_signers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    company_type TEXT NOT NULL CHECK (company_type IN ('client', 'supplier')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    position TEXT,
    phone TEXT,
    email TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_signers_company ON authorized_signers(company_id, company_type);
```

`migrations/005_contracts.sql`:
```sql
CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_number TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    client_signer_id INTEGER REFERENCES authorized_signers(id),
    supplier_signer_id INTEGER REFERENCES authorized_signers(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'service',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'cancelled', 'completed')),
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_client ON contracts(client_id);
CREATE INDEX idx_contracts_supplier ON contracts(supplier_id);
CREATE INDEX idx_contracts_end_date ON contracts(end_date);
CREATE INDEX idx_contracts_number ON contracts(contract_number);
```

`migrations/006_supplements.sql`:
```sql
CREATE TABLE IF NOT EXISTS supplements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL REFERENCES contracts(id),
    supplement_number INTEGER NOT NULL,
    description TEXT,
    effective_date DATE,
    modifications TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active')),
    client_signer_id INTEGER REFERENCES authorized_signers(id),
    supplier_signer_id INTEGER REFERENCES authorized_signers(id),
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_supplements_contract ON supplements(contract_id);
CREATE INDEX idx_supplements_status ON supplements(status);
```

`migrations/007_documents.sql`:
```sql
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documents_entity ON documents(entity_id, entity_type);
```

`migrations/008_notifications.sql`:
```sql
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    entity_id INTEGER,
    entity_type TEXT,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read_at);
```

`migrations/009_audit_logs.sql`:
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    previous_state TEXT,
    new_state TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
```

**Step 4: Update db.go to add import for embed**

Ensure `import _ "modernc.org/sqlite"` is present.

**Step 5: Run go mod tidy and verify**

```bash
cd /home/mowgli/pacta
go mod tidy
go build ./cmd/pacta
```

**Step 6: Commit**

```bash
git add internal/db/ migrations/
git commit -m "feat: add SQLite database layer with all migrations"
```

---

### Task 4: Auth layer (bcrypt + sessions)

**Files:**
- Create: `internal/auth/auth.go`
- Create: `internal/auth/session.go`

**Step 1: Create auth.go**

```go
package auth

import (
    "database/sql"
    "fmt"
    "github.com/PACTA-Team/pacta/internal/models"
    "golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
    bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
    return string(bytes), err
}

func CheckPassword(password, hash string) bool {
    return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func Authenticate(db *sql.DB, email, password string) (*models.User, error) {
    var u models.User
    err := db.QueryRow(`
        SELECT id, name, email, password_hash, role, status
        FROM users WHERE email = ? AND deleted_at IS NULL
    `, email).Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.Status)
    if err != nil {
        return nil, fmt.Errorf("user not found")
    }
    if !CheckPassword(password, u.PasswordHash) {
        return nil, fmt.Errorf("invalid password")
    }
    if u.Status != "active" {
        return nil, fmt.Errorf("user account is %s", u.Status)
    }
    return &u, nil
}
```

**Step 2: Create session.go**

```go
package auth

import (
    "crypto/rand"
    "database/sql"
    "encoding/base64"
    "fmt"
    "time"
)

type Session struct {
    Token     string
    UserID    int
    ExpiresAt time.Time
}

func generateToken() (string, error) {
    b := make([]byte, 32)
    _, err := rand.Read(b)
    if err != nil {
        return "", err
    }
    return base64.URLEncoding.EncodeToString(b), nil
}

func CreateSession(db *sql.DB, userID int) (*Session, error) {
    token, err := generateToken()
    if err != nil {
        return nil, err
    }
    expiresAt := time.Now().Add(24 * time.Hour)
    _, err = db.Exec(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        token, userID, expiresAt,
    )
    if err != nil {
        return nil, err
    }
    return &Session{Token: token, UserID: userID, ExpiresAt: expiresAt}, nil
}

func GetSession(db *sql.DB, token string) (*Session, error) {
    var s Session
    err := db.QueryRow(
        "SELECT token, user_id, expires_at FROM sessions WHERE token = ? AND expires_at > ?",
        token, time.Now(),
    ).Scan(&s.Token, &s.UserID, &s.ExpiresAt)
    if err != nil {
        return nil, err
    }
    return &s, nil
}

func DeleteSession(db *sql.DB, token string) error {
    _, err := db.Exec("DELETE FROM sessions WHERE token = ?", token)
    return err
}
```

**Step 3: Add sessions table migration**

Create `migrations/010_sessions.sql`:
```sql
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

**Step 4: Commit**

```bash
git add internal/auth/ migrations/010_sessions.sql
git commit -m "feat: add auth layer with bcrypt and session management"
```

---

## Phase 2: API Handlers

### Task 5: Models and base handlers

**Files:**
- Create: `internal/models/models.go`
- Create: `internal/handlers/handler.go`
- Create: `internal/handlers/auth.go`
- Create: `internal/handlers/contracts.go`
- Create: `internal/handlers/clients.go`
- Create: `internal/handlers/suppliers.go`

**Step 1: Create models.go**

```go
package models

import "time"

type User struct {
    ID           int       `json:"id"`
    Name         string    `json:"name"`
    Email        string    `json:"email"`
    PasswordHash string    `json:"-"`
    Role         string    `json:"role"`
    Status       string    `json:"status"`
    LastAccess   *time.Time `json:"last_access,omitempty"`
    CreatedAt    time.Time `json:"created_at"`
    UpdatedAt    time.Time `json:"updated_at"`
}

type Client struct {
    ID        int        `json:"id"`
    Name      string     `json:"name"`
    Address   *string    `json:"address,omitempty"`
    REUCode   *string    `json:"reu_code,omitempty"`
    Contacts  *string    `json:"contacts,omitempty"`
    CreatedBy *int       `json:"created_by,omitempty"`
    CreatedAt time.Time  `json:"created_at"`
    UpdatedAt time.Time  `json:"updated_at"`
}

type Supplier struct {
    ID        int        `json:"id"`
    Name      string     `json:"name"`
    Address   *string    `json:"address,omitempty"`
    REUCode   *string    `json:"reu_code,omitempty"`
    Contacts  *string    `json:"contacts,omitempty"`
    CreatedBy *int       `json:"created_by,omitempty"`
    CreatedAt time.Time  `json:"created_at"`
    UpdatedAt time.Time  `json:"updated_at"`
}

type Contract struct {
    ID               int        `json:"id"`
    ContractNumber   string     `json:"contract_number"`
    Title            string     `json:"title"`
    ClientID         int        `json:"client_id"`
    SupplierID       int        `json:"supplier_id"`
    ClientSignerID   *int       `json:"client_signer_id,omitempty"`
    SupplierSignerID *int       `json:"supplier_signer_id,omitempty"`
    StartDate        string     `json:"start_date"`
    EndDate          string     `json:"end_date"`
    Amount           float64    `json:"amount"`
    Type             string     `json:"type"`
    Status           string     `json:"status"`
    Description      *string    `json:"description,omitempty"`
    CreatedBy        *int       `json:"created_by,omitempty"`
    CreatedAt        time.Time  `json:"created_at"`
    UpdatedAt        time.Time  `json:"updated_at"`
}

type DashboardStats struct {
    TotalContracts   int     `json:"total_contracts"`
    ActiveContracts  int     `json:"active_contracts"`
    ExpiringSoon     int     `json:"expiring_soon"`
    ExpiredContracts int     `json:"expired_contracts"`
    TotalValue       float64 `json:"total_value"`
    ByStatus         map[string]int `json:"by_status"`
}
```

**Step 2: Create handler.go (base with middleware)**

```go
package handlers

import (
    "database/sql"
    "encoding/json"
    "net/http"
    "github.com/PACTA-Team/pacta/internal/auth"
)

type Handler struct {
    DB *sql.DB
}

func (h *Handler) JSON(w http.ResponseWriter, status int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(data)
}

func (h *Handler) Error(w http.ResponseWriter, status int, message string) {
    h.JSON(w, status, map[string]string{"error": message})
}

func (h *Handler) AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        cookie, err := r.Cookie("session")
        if err != nil {
            h.Error(w, http.StatusUnauthorized, "unauthorized")
            return
        }
        session, err := auth.GetSession(h.DB, cookie.Value)
        if err != nil {
            h.Error(w, http.StatusUnauthorized, "session expired")
            return
        }
        r = r.WithContext(r.Context())
        // Store userID in request context (simplified - use context.WithValue in production)
        next(w, r)
    }
}
```

**Step 3: Create auth handler**

```go
package handlers

import (
    "encoding/json"
    "net/http"
)

type LoginRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request) {
    var req LoginRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.Error(w, http.StatusBadRequest, "invalid request")
        return
    }

    user, err := auth.Authenticate(h.DB, req.Email, req.Password)
    if err != nil {
        h.Error(w, http.StatusUnauthorized, err.Error())
        return
    }

    session, err := auth.CreateSession(h.DB, user.ID)
    if err != nil {
        h.Error(w, http.StatusInternalServerError, "failed to create session")
        return
    }

    http.SetCookie(w, &http.Cookie{
        Name:     "session",
        Value:    session.Token,
        Path:     "/",
        HttpOnly: true,
        SameSite: http.SameSiteStrictMode,
    })

    h.JSON(w, http.StatusOK, user)
}

func (h *Handler) HandleLogout(w http.ResponseWriter, r *http.Request) {
    cookie, err := r.Cookie("session")
    if err == nil {
        auth.DeleteSession(h.DB, cookie.Value)
    }
    http.SetCookie(w, &http.Cookie{
        Name:     "session",
        Value:    "",
        Path:     "/",
        HttpOnly: true,
        MaxAge:   -1,
    })
    h.JSON(w, http.StatusOK, map[string]string{"status": "logged out"})
}

func (h *Handler) HandleMe(w http.ResponseWriter, r *http.Request) {
    // Simplified - would get user from session
    h.JSON(w, http.StatusOK, map[string]string{"status": "authenticated"})
}
```

**Step 4: Create contracts handler (CRUD skeleton)**

```go
package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"
    "strings"
)

func (h *Handler) HandleContracts(w http.ResponseWriter, r *http.Request) {
    switch r.Method {
    case http.MethodGet:
        h.listContracts(w, r)
    case http.MethodPost:
        h.createContract(w, r)
    default:
        h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
    }
}

func (h *Handler) HandleContract(w http.ResponseWriter, r *http.Request) {
    idStr := strings.TrimPrefix(r.URL.Path, "/api/contracts/")
    id, err := strconv.Atoi(idStr)
    if err != nil {
        h.Error(w, http.StatusBadRequest, "invalid id")
        return
    }

    switch r.Method {
    case http.MethodGet:
        h.getContract(w, id)
    case http.MethodPut:
        h.updateContract(w, id)
    case http.MethodDelete:
        h.deleteContract(w, id)
    default:
        h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
    }
}

func (h *Handler) listContracts(w http.ResponseWriter, r *http.Request) {
    rows, err := h.DB.Query("SELECT id, contract_number, title, client_id, supplier_id, start_date, end_date, amount, type, status, created_at, updated_at FROM contracts WHERE deleted_at IS NULL ORDER BY created_at DESC")
    if err != nil {
        h.Error(w, http.StatusInternalServerError, err.Error())
        return
    }
    defer rows.Close()

    var contracts []map[string]interface{}
    for rows.Next() {
        var c map[string]interface{}
        // Simplified - would scan into struct
        _ = c
    }
    h.JSON(w, http.StatusOK, contracts)
}

func (h *Handler) createContract(w http.ResponseWriter, r *http.Request) {
    var req map[string]interface{}
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.Error(w, http.StatusBadRequest, "invalid request")
        return
    }
    // Insert and return created
    h.JSON(w, http.StatusCreated, req)
}

func (h *Handler) getContract(w http.ResponseWriter, id int) {
    h.JSON(w, http.StatusOK, map[string]interface{}{"id": id})
}

func (h *Handler) updateContract(w http.ResponseWriter, id int) {
    var req map[string]interface{}
    json.NewDecoder(r.Body).Decode(&req)
    h.JSON(w, http.StatusOK, req)
}

func (h *Handler) deleteContract(w http.ResponseWriter, id int) {
    h.DB.Exec("UPDATE contracts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", id)
    h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
```

**Step 5: Create clients handler**

```go
package handlers

import (
    "encoding/json"
    "net/http"
)

func (h *Handler) HandleClients(w http.ResponseWriter, r *http.Request) {
    switch r.Method {
    case http.MethodGet:
        h.listClients(w, r)
    case http.MethodPost:
        h.createClient(w, r)
    default:
        h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
    }
}

func (h *Handler) listClients(w http.ResponseWriter, r *http.Request) {
    rows, err := h.DB.Query("SELECT id, name, address, reu_code, contacts, created_at, updated_at FROM clients WHERE deleted_at IS NULL")
    if err != nil {
        h.Error(w, http.StatusInternalServerError, err.Error())
        return
    }
    defer rows.Close()

    var clients []map[string]interface{}
    for rows.Next() {
        var id int
        var name string
        var address, reu, contacts *string
        var createdAt, updatedAt string
        rows.Scan(&id, &name, &address, &reu, &contacts, &createdAt, &updatedAt)
        clients = append(clients, map[string]interface{}{
            "id": id, "name": name, "address": address,
            "reu_code": reu, "contacts": contacts,
            "created_at": createdAt, "updated_at": updatedAt,
        })
    }
    h.JSON(w, http.StatusOK, clients)
}

func (h *Handler) createClient(w http.ResponseWriter, r *http.Request) {
    var req map[string]interface{}
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.Error(w, http.StatusBadRequest, "invalid request")
        return
    }
    h.JSON(w, http.StatusCreated, req)
}
```

**Step 6: Create suppliers handler (same pattern as clients)**

```go
package handlers

import "net/http"

func (h *Handler) HandleSuppliers(w http.ResponseWriter, r *http.Request) {
    switch r.Method {
    case http.MethodGet:
        h.listSuppliers(w, r)
    case http.MethodPost:
        h.createSupplier(w, r)
    default:
        h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
    }
}

func (h *Handler) listSuppliers(w http.ResponseWriter, r *http.Request) {
    rows, err := h.DB.Query("SELECT id, name, address, reu_code, contacts, created_at, updated_at FROM suppliers WHERE deleted_at IS NULL")
    if err != nil {
        h.Error(w, http.StatusInternalServerError, err.Error())
        return
    }
    defer rows.Close()
    var suppliers []map[string]interface{}
    for rows.Next() {
        var id int
        var name string
        var address, reu, contacts *string
        var createdAt, updatedAt string
        rows.Scan(&id, &name, &address, &reu, &contacts, &createdAt, &updatedAt)
        suppliers = append(suppliers, map[string]interface{}{
            "id": id, "name": name, "address": address,
            "reu_code": reu, "contacts": contacts,
            "created_at": createdAt, "updated_at": updatedAt,
        })
    }
    h.JSON(w, http.StatusOK, suppliers)
}

func (h *Handler) createSupplier(w http.ResponseWriter, r *http.Request) {
    var req map[string]interface{}
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.Error(w, http.StatusBadRequest, "invalid request")
        return
    }
    h.JSON(w, http.StatusCreated, req)
}
```

**Step 7: Commit**

```bash
git add internal/models/ internal/handlers/
git commit -m "feat: add API handlers for auth, contracts, clients, suppliers"
```

---

## Phase 3: Server Integration

### Task 6: Wire up server with routes and static file serving

**Files:**
- Modify: `internal/server/server.go`
- Modify: `cmd/pacta/main.go`

**Step 1: Rewrite server.go with full routing**

```go
package server

import (
    "embed"
    "io/fs"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/go-chi/chi/v5"
    "github.com/PACTA-Team/pacta/internal/config"
    "github.com/PACTA-Team/pacta/internal/db"
    "github.com/PACTA-Team/pacta/internal/handlers"
)

//go:embed frontend/out
var staticFS embed.FS

func Start(cfg *config.Config) error {
    database, err := db.Open(cfg.DataDir)
    if err != nil {
        return err
    }
    defer database.Close()

    if err := db.Migrate(database); err != nil {
        return err
    }

    h := &handlers.Handler{DB: database}

    r := chi.NewRouter()

    // API routes
    r.Group(func(r chi.Router) {
        r.Post("/api/auth/login", h.HandleLogin)
        r.Post("/api/auth/logout", h.HandleLogout)
        r.Get("/api/auth/me", h.AuthMiddleware(h.HandleMe))

        r.Get("/api/contracts", h.AuthMiddleware(h.HandleContracts))
        r.Post("/api/contracts", h.AuthMiddleware(h.HandleContracts))
        r.Get("/api/contracts/{id}", h.AuthMiddleware(h.HandleContract))
        r.Put("/api/contracts/{id}", h.AuthMiddleware(h.HandleContract))
        r.Delete("/api/contracts/{id}", h.AuthMiddleware(h.HandleContract))

        r.Get("/api/clients", h.AuthMiddleware(h.HandleClients))
        r.Post("/api/clients", h.AuthMiddleware(h.HandleClients))

        r.Get("/api/suppliers", h.AuthMiddleware(h.HandleSuppliers))
        r.Post("/api/suppliers", h.AuthMiddleware(h.HandleSuppliers))
    })

    // Static files (Next.js export)
    staticSub, _ := fs.Sub(staticFS, "frontend/out")
    r.Handle("/*", http.FileServer(http.FS(staticSub)))

    srv := &http.Server{
        Addr:         cfg.Addr,
        Handler:      r,
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 15 * time.Second,
        IdleTimeout:  60 * time.Second,
    }

    go func() {
        log.Printf("PACTA v%s running on http://127.0.0.1%s", cfg.Version, cfg.Addr)
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Listen: %v", err)
        }
    }()

    // Open browser
    openBrowser("http://127.0.0.1" + cfg.Addr)

    // Wait for signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    log.Println("Shutting down...")
    return nil
}

func openBrowser(url string) {
    // Platform-specific browser open (reuse from pacta-desktop/internal/browser)
}
```

**Step 2: Update main.go**

```go
package main

import (
    "log"
    "github.com/PACTA-Team/pacta/internal/config"
    "github.com/PACTA-Team/pacta/internal/server"
)

func main() {
    cfg := config.Default()
    log.Printf("PACTA v%s starting...", cfg.Version)
    if err := server.Start(cfg); err != nil {
        log.Fatalf("Server failed: %v", err)
    }
}
```

**Step 3: Add browser open utility**

Create `internal/server/browser.go`:
```go
package server

import (
    "os/exec"
    "runtime"
)

func openBrowser(url string) {
    var cmd *exec.Cmd
    switch runtime.GOOS {
    case "windows":
        cmd = exec.Command("cmd", "/c", "start", url)
    case "darwin":
        cmd = exec.Command("open", url)
    default:
        cmd = exec.Command("xdg-open", url)
    }
    cmd.Start()
}
```

**Step 4: Create placeholder frontend**

```bash
mkdir -p frontend/out
echo '<!DOCTYPE html><html><head><title>PACTA</title></head><body><h1>PACTA - Frontend coming soon</h1></body></html>' > frontend/out/index.html
```

**Step 5: Build and test**

```bash
cd /home/mowgli/pacta
go mod tidy
go build ./cmd/pacta
```

**Step 6: Commit**

```bash
git add internal/server/ cmd/pacta/main.go frontend/out/
git commit -m "feat: wire up server with chi router, routes, and static file serving"
```

---

## Phase 4: Frontend

### Task 7: Convert Next.js app to static export

**Files:**
- Modify: `pacta_appweb/next.config.ts`
- Modify: `pacta_appweb/package.json`
- Create: `frontend/` (new Next.js app based on existing UI patterns)

**Step 1: Change output mode in next.config.ts**

Change `output: 'standalone'` to `output: 'export'`:

```typescript
const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true, // Required for static export
  },
  // Remove CORS headers (same origin now)
  // Remove allowedOrigins
};
```

**Step 2: Update API calls to use same-origin**

All frontend API calls change from full URLs to relative paths:
- `fetch('/api/auth/login', ...)` instead of `fetch('http://backend:port/api/auth/login', ...)`
- Remove JWT token handling (use cookie sessions)
- Remove Authorization headers

**Step 3: Remove server-side dependencies**

- Remove `better-sqlite3` from dependencies (backend handles DB)
- Remove JWT-related packages
- Remove server-side API routes (`app/next_api/`)

**Step 4: Build static export**

```bash
cd /home/mowgli/pacta/pacta_appweb
npm ci
npm run build
# Output goes in out/
```

**Step 5: Copy to frontend/out**

```bash
rm -rf /home/mowgli/pacta/frontend/out
cp -r /home/mowgli/pacta/pacta_appweb/out /home/mowgli/pacta/frontend/
```

**Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: add static Next.js frontend export"
```

---

## Phase 5: Build & Release

### Task 8: GoReleaser configuration

**Files:**
- Create: `.goreleaser.yml`
- Create: `.github/workflows/release.yml`

**Step 1: Create .goreleaser.yml**

```yaml
version: 2
project_name: pacta

before:
  hooks:
    - bash -c 'cd frontend && npm ci && npm run build'

builds:
  - id: pacta
    main: ./cmd/pacta
    binary: pacta
    env:
      - CGO_ENABLED=0
    goos:
      - linux
      - darwin
      - windows
    goarch:
      - amd64
      - arm64
    ignore:
      - goos: windows
        goarch: arm64
    ldflags:
      - -s -w -X github.com/PACTA-Team/pacta/internal/config.AppVersion={{.Version}}

archives:
  - format: tar.gz
    name_template: "{{ .ProjectName }}_{{ .Version }}_{{ .Os }}_{{ .Arch }}"
    files:
      - README.md
      - LICENSE

nfpms:
  - package_name: pacta
    vendor: "PACTA Team"
    maintainer: "PACTA Team"
    description: "PACTA Contract Management System - Local-first"
    license: "MIT"
    homepage: "https://github.com/PACTA-Team/pacta"
    formats:
      - deb
    bindir: /usr/local/bin

release:
  draft: true
  prerelease: auto
  name_template: "PACTA {{ .Version }}"
```

**Step 2: Create .github/workflows/release.yml**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version tag (e.g., v0.1.0)'
        required: true
        type: string

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-go@v5
        with:
          go-version: '1.23'
          cache: true

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - uses: goreleaser/goreleaser-action@v6
        with:
          distribution: goreleaser
          version: '~> v2'
          args: release --clean
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Step 3: Commit**

```bash
git add .goreleaser.yml .github/
git commit -m "ci: add GoReleaser config and release workflow"
```

---

## Phase 6: Documentation

### Task 9: Write project documentation

**Files:**
- Create: `README.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/DEVELOPMENT.md`
- Create: `docs/DEPLOYMENT.md`

**Step 1: Create README.md**

```markdown
# PACTA — Contract Lifecycle Management

Local-first contract management system. Single binary, zero external dependencies.

## Quick Start

```bash
# Download the latest release for your platform
./pacta  # Opens http://127.0.0.1:3000
```

## Features

- Contract CRUD operations
- Client & supplier management
- Authorized signers
- Supplements with approval workflow
- Document attachments
- Notifications & alerts
- Audit logging
- Role-based access control

## Architecture

Single Go binary embedding:
- SQLite database (pure Go, no CGO)
- Static Next.js frontend
- SQL migrations

No internet required. All data stays local.

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

## License

MIT
```

**Step 2: Create docs/DEVELOPMENT.md**

```markdown
# Development Guide

## Prerequisites

- Go 1.23+
- Node.js 22+
- npm

## Running locally

```bash
# Terminal 1: Build frontend
cd frontend && npm ci && npm run build

# Terminal 2: Run Go server
go run ./cmd/pacta
```

## Project Structure

```
cmd/pacta/        - Entry point
internal/
  server/         - HTTP server, routing, static serving
  db/             - SQLite setup & migrations
  handlers/       - REST API handlers
  models/         - Data structs
  auth/           - Bcrypt & session management
frontend/         - Next.js app (static export)
migrations/       - SQL migration files
```

## Adding a migration

Create `migrations/NNN_description.sql` in the migrations directory.
It will be auto-applied on next startup.
```

**Step 3: Commit**

```bash
git add README.md docs/ARCHITECTURE.md docs/DEVELOPMENT.md docs/DEPLOYMENT.md
git commit -m "docs: add project documentation"
```

---

## Summary of Commits

1. `chore: remove old repos in preparation for monorepo`
2. `feat: initialize Go monorepo with minimal server`
3. `feat: add SQLite database layer with all migrations`
4. `feat: add auth layer with bcrypt and session management`
5. `feat: add API handlers for auth, contracts, clients, suppliers`
6. `feat: wire up server with chi router, routes, and static file serving`
7. `feat: add static Next.js frontend export`
8. `ci: add GoReleaser config and release workflow`
9. `docs: add project documentation`
