# Brevo SDK Integration — Contract Expiry Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Brevo SDK (brevo-go) to send contract expiry notifications via API with SMTP fallback, plus settings UI and internal Go worker.

**Architecture:** Add new email channel (Brevo API) for contract expirations only; existing SMTP path (Brevo→Gmail) unchanged for critical emails. Worker queries DB every N hours for contracts expiring within configurable thresholds, sends personalized emails with "Renew Contract" CTA, logs delivery to DB. Settings managed by admins via Settings → Notifications tab.

**Tech Stack:** Go 1.25+, brevo-go SDK, go-mail (existing), chi router, SQLite/goose migrations, React+TypeScript frontend

---

## Phase 0 — Preparation

### Task 0.1: Create feature branch

```bash
git checkout -b feature/brevo-contract-expiry-2025-06-18
```

### Task 0.2: Add Brevo SDK dependency

**File:** `go.mod`

**Step 1:** Add require:
```go
require (
    github.com/getbrevo/brevo-go v1.0.0
)
```

**Step 2:** Run:
```bash
go get github.com/getbrevo/brevo-go@v1.0.0
go mod tidy
```

**Step 3:** Verify no other changes in `go.mod` or `go.sum`

**Commit:**
```bash
git add go.mod go.sum
git commit -m "deps: add brevo-go SDK v1.0.0"
```

---

## Phase 1 — Database Migrations

### Task 1.1: Write migration file

**File:** `internal/db/migrations/027_contract_expiry_notifications.sql`

**Step 1:** Create file with full SQL (copy from design doc):

```sql
-- +goose Up
CREATE TABLE contract_expiry_notification_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT true,
    frequency_hours INTEGER NOT NULL DEFAULT 6,
    thresholds_days INTEGER[] NOT NULL DEFAULT '{30,14,7,1}'::integer[],
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE contract_expiry_notification_log (
    id BIGSERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    threshold_days INTEGER NOT NULL,
    sent_to_user BOOLEAN NOT NULL DEFAULT false,
    sent_to_admin BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMP,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'failed',
    error_message TEXT,
    channel VARCHAR(10) NOT NULL DEFAULT 'smtp',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, threshold_days)
);

CREATE INDEX idx_contract_expiry_log_contract ON contract_expiry_notification_log(contract_id);
CREATE INDEX idx_contract_expiry_log_threshold ON contract_expiry_notification_log(threshold_days);
CREATE INDEX idx_contract_expiry_log_created ON contract_expiry_notification_log(created_at DESC);

INSERT INTO contract_expiry_notification_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS contract_expiry_notification_log;
DROP TABLE IF EXISTS contract_expiry_notification_settings;
```

**Step 2:** Verify syntax (no typos, `::integer[]` cast correct)

**Commit:**
```bash
git add internal/db/migrations/027_contract_expiry_notifications.sql
git commit -m "db: add contract expiry notification settings and log tables"
```

---

## Phase 2 — Backend: Brevo Email Client

### Task 2.1: Create `internal/email/brevo.go`

**File:** `internal/email/brevo.go`

**Step 1:** Write package with `SendContractExpiryViaBrevo`:

```go
package email

import (
    "context"
    "fmt"
    "log"
    "os"
    "time"

    brevo "github.com/getbrevo/brevo-go/lib"
)

// BrevoClient wraps the Brevo API client
type BrevoClient struct {
    client *brevo.APIClient
    apiKey string
}

// NewBrevoClient creates a new Brevo API client from environment
func NewBrevoClient() (*BrevoClient, error) {
    apiKey := os.Getenv("BREVO_API_KEY")
    if apiKey == "" {
        return nil, fmt.Errorf("BREVO_API_KEY not set")
    }

    cfg := brevo.NewConfiguration()
    cfg.AddDefaultHeader("api-key", apiKey)
    client := brevo.NewAPIClient(cfg)

    log.Printf("[email-brevo] client initialized")
    return &BrevoClient{client: client, apiKey: apiKey}, nil
}

// SendContractExpiryViaBrevo sends a contract expiry notification via Brevo API
func (bc *BrevoClient) SendContractExpiryViaBrevo(
    ctx context.Context,
    contractNumber string,
    daysLeft int,
    expiryDate time.Time,
    contractName string,
    clientName string,
    companyName string,
    contractID int64,
    recipients []string,
    adminEmail string,
) error {
    // Build subject
    subject := fmt.Sprintf("⚠️ Contrato %s vence en %d días — Acción requerida", contractNumber, daysLeft)

    // Build HTML body (inline template — simple for now)
    html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 15px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
    .alert { background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin: 15px 0; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
    .footer { color: #64748b; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h2>📅 Recordatorio de Vencimiento</h2></div>
    <div class="content">
      <p>El contrato <strong>%s</strong> vence en <strong>%d días</strong> (%s).</p>
      <div class="alert"><strong>⚠️ Acción requerida:</strong> Para renovar, cree un nuevo suplemento que actualice la fecha de vencimiento y los valores correspondientes.</div>
      <h3>Detalles:</h3>
      <ul>
        <li><strong>Contrato:</strong> %s</li>
        <li><strong>Cliente:</strong> %s</li>
        <li><strong>Empresa:</strong> %s</li>
        <li><strong>Vencimiento:</strong> %s</li>
      </ul>
      <p><a href="https://pacta.example.com/contracts/%d/supplement" class="button">🔷 Renovar Contrato en PACTA</a></p>
      <p>¿Preguntas? Contacte al administrador: <a href="mailto:%s">%s</a></p>
    </div>
    <div class="footer">Este es un recordatorio automático de PACTA — Contract Management System.</div>
  </div>
</body>
</html>`,
            contractNumber, daysLeft, expiryDate.Format("2006-01-02"),
            contractName, clientName, companyName, expiryDate.Format("2006-01-02"),
            contractID, adminEmail, adminEmail)

    // Build Brevo send email props
    sendProps := brevo.SendEmailProps{
        Subject: subject,
        HtmlContent: &html,
        Sender: &brevo.SendEmailPropsSender{
            Name:  "PACTA",
            Email: os.Getenv("EMAIL_FROM"),
        },
        To:           make([]brevo.SendEmailPropsTo, 0, len(recipients)),
        ReplyTo:      "",
        Bcc:          nil,
        Cc:           nil,
        Attachment:  nil,
        Headers:      nil,
        CustomParams: nil,
        IsTransactional: brevo.PtrBool(true),
    }

    for _, email := range recipients {
        sendProps.To = append(sendProps.To, brevo.SendEmailPropsTo{Email: email})
    }

    // Call Brevo API
    _, _, err := bc.client.TransactionalEmailsApi.SendEmail(ctx, sendProps)
    if err != nil {
        log.Printf("[email-brevo] failed for contract %s: %v", contractNumber, err)
        return fmt.Errorf("brevo send failed: %w", err)
    }

    log.Printf("[email-brevo] sent contract %s expiry (%d days) to %v", contractNumber, daysLeft, recipients)
    return nil
}
```

**Step 2:** Review for correctness (imports, `brevo.SendEmailProps` structure matches SDK)

**Step 3:** Commit
```bash
git add internal/email/brevo.go
git commit -m "feat(email): add Brevo SDK client for contract expiry notifications"
```

---

### Task 2.2: Write unit test for `SendContractExpiryViaBrevo` success

**File:** `internal/email/brevo_test.go`

**Step 1:** Write test with mocked Brevo client:

```go
package email

import (
    "context"
    "os"
    "testing"
    "time"

    "github.com/getbrevo/brevo-go/lib"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
)

type MockTransactionalEmailsApi struct {
    mock.Mock
}

func (m *MockTransactionalEmailsApi) SendEmail(ctx context.Context, sendEmailProps lib.SendEmailProps) (lib.SendEmailResponse, error) {
    args := m.Called(ctx, sendEmailProps)
    return args.Get(0).(lib.SendEmailResponse), args.Error(1)
}

func TestSendContractExpiryViaBrevo_Success(t *testing.T) {
    // Setup
    mockAPI := &MockTransactionalEmailsApi{}
    mockClient := &lib.APIClient{}
    mockClient.TransactionalEmailsApi = mockAPI

    bc := &BrevoClient{client: mockClient}

    ctx := context.Background()
    contractID := int64(123)
    recipients := []string{"user@example.com", "admin@example.com"}

    // Expect SendEmail to be called once
    mockAPI.On("SendEmail", mock.Anything, mock.Anything).Return(lib.SendEmailResponse{}, nil)

    // Call
    err := bc.SendContractExpiryViaBrevo(
        ctx,
        "CNT-2025-0042",
        7,
        time.Date(2025, 5, 15, 0, 0, 0, 0, time.UTC),
        "Service Agreement v2",
        "Acme Corp",
        "PACTA Inc",
        contractID,
        recipients,
        "admin@pacta.com",
    )

    // Assert
    assert.NoError(t, err)
    mockAPI.AssertExpectations(t)
}
```

**Step 2:** Run test (should FAIL — BrevoClient not exported or missing fields)
```bash
go test ./internal/email -run TestSendContractExpiryViaBrevo_Success -v
```

**Step 3:** Fix implementation to make test pass (adjust struct visibility, import path if needed)

**Step 4:** Re-run until PASS

**Commit:**
```bash
git add internal/email/brevo_test.go
git commit -m "test(email): add unit test for Brevo client send"
```

---

## Phase 3 — Worker Implementation

### Task 3.1: Create worker struct and lifecycle

**File:** `internal/worker/contract_expiry.go`

**Step 1:** Write skeleton:

```go
package worker

import (
    "context"
    "database/sql"
    "log"
    "os"
    "sync"
    "time"

    "github.com/PACTA-Team/pacta/internal/email"
    "github.com/PACTA-Team/pacta/internal/models"
    "github.com/PACTA-Team/pacta/internal/db"
)

type ContractExpiryWorker struct {
    config      *config.Service
    brevoClient *email.BrevoClient
    smtpSender  *email.Service
    logger      *log.Logger
    ticker      *time.Ticker
    running     bool
    mu          sync.RWMutex
}

func NewContractExpiryWorker(cfg *config.Service, brevo *email.BrevoClient, smtp *email.Service) *ContractExpiryWorker {
    return &ContractExpiryWorker{
        config:      cfg,
        brevoClient: brevo,
        smtpSender:  smtp,
        logger:      log.New(os.Stdout, "[email-worker] ", log.LstdFlags),
        ticker:      nil,
        running:     false,
    }
}

func (w *ContractExpiryWorker) Start() {
    w.mu.Lock()
    if w.running {
        w.mu.Unlock()
        return
    }
    w.running = true
    w.mu.Unlock()

    // Load settings to get frequency
    settings, err := w.loadSettings()
    if err != nil {
        w.logger.Printf("ERROR loading settings: %v — using default 6h", err)
        settings = &models.ContractExpirySettings{FrequencyHours: 6}
    }

    w.ticker = time.NewTicker(time.Duration(settings.FrequencyHours) * time.Hour)
    w.logger.Printf("started — frequency: %dh, thresholds: %v", settings.FrequencyHours, settings.ThresholdsDays)

    go w.run()
}

func (w *ContractExpiryWorker) Stop() {
    w.mu.Lock()
    w.running = false
    w.mu.Unlock()
    if w.ticker != nil {
        w.ticker.Stop()
    }
    w.logger.Println("stopped")
}

func (w *ContractExpiryWorker) run() {
    for w.running {
        w.runCycle()
        <-w.ticker.C
    }
}
```

**Step 2:** Commit
```bash
git add internal/worker/contract_expiry.go
git commit -m "feat(worker): add ContractExpiryWorker struct and lifecycle"
```

---

### Task 3.2: Implement `loadSettings()` and `queryExpiringContracts()`

**File:** `internal/worker/contract_expiry.go` (append)

**Step 1:** `loadSettings()` — read singleton row:

```go
func (w *ContractExpiryWorker) loadSettings() (*models.ContractExpirySettings, error) {
    var s models.ContractExpirySettings
    err := w.config.DB.QueryRow(`
        SELECT id, enabled, frequency_hours, thresholds_days, updated_by, updated_at
        FROM contract_expiry_notification_settings
        WHERE id = 1
    `).Scan(&s.ID, &s.Enabled, &s.FrequencyHours, &s.ThresholdsDays, &s.UpdatedBy, &s.UpdatedAt)

    if err == sql.ErrNoRows {
        // Should not happen (migration inserts singleton), but default
        return &models.ContractExpirySettings{
            ID:              1,
            Enabled:         true,
            FrequencyHours:  6,
            ThresholdsDays:  []int{30, 14, 7, 1},
        }, nil
    }
    return &s, err
}
```

**Step 2:** `queryExpiringContracts(thresholdDays int)`:

```go
func (w *ContractExpiryWorker) queryExpiringContracts(thresholdDays int) ([]models.Contract, error) {
    rows, err := w.config.DB.Query(`
        SELECT c.id, c.contract_number, c.name, c.expiry_date, c.created_by,
               cl.legal_name AS client_name, co.name AS company_name
        FROM contracts c
        JOIN clients cl ON c.client_id = cl.id
        JOIN companies co ON cl.company_id = co.id
        WHERE c.expiry_date BETWEEN DATE('now', ? || ' days') AND DATE('now', ? || ' days')
          AND c.status = 'active'
          AND NOT EXISTS (
              SELECT 1 FROM contract_expiry_notification_log l
              WHERE l.contract_id = c.id AND l.threshold_days = ?
          )
        ORDER BY c.expiry_date ASC
        LIMIT 1000
    `, thresholdDays, thresholdDays, thresholdDays)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var contracts []models.Contract
    for rows.Next() {
        var c models.Contract
        err := rows.Scan(&c.ID, &c.ContractNumber, &c.Name, &c.ExpiryDate, &c.CreatedBy,
                         &c.ClientName, &c.CompanyName)
        if err != nil {
            return nil, err
        }
        contracts = append(contracts, c)
    }
    return contracts, rows.Err()
}
```

**Step 3:** Commit
```bash
git add internal/worker/contract_expiry.go
git commit -m "feat(worker): add loadSettings and queryExpiringContracts"
```

---

### Task 3.3: Implement `processContract()` and `sendViaBrevoWithFallback()`

**File:** `internal/worker/contract_expiry.go` (append)

**Step 1:** `processContract`:

```go
func (w *ContractExpiryWorker) processContract(ctx context.Context, contract models.Contract, thresholdDays int) error {
    // 1. Get recipients
    owner, err := w.config.GetUserByID(contract.CreatedBy)
    if err != nil {
        w.logger.Printf("ERROR getting owner %d for contract %s: %v", contract.CreatedBy, contract.ContractNumber, err)
        return err
    }
    admins, err := w.config.GetUsersByCompanyAndRole(contract.CompanyID, "admin")
    if err != nil {
        w.logger.Printf("ERROR getting admins for company %d: %v", contract.CompanyID, err)
        return err
    }

    // Dedupe emails
    emailSet := make(map[string]bool)
    emailSet[owner.Email] = false // user
    for _, admin := range admins {
        emailSet[admin.Email] = false // admin
    }
    var recipients []string
    for email := range emailSet {
        recipients = append(recipients, email)
    }

    if len(recipients) == 0 {
        w.logger.Printf("WARNING: no recipients for contract %s", contract.ContractNumber)
        return nil // skip, but no error
    }

    // 2. Send via Brevo with fallback
    err = w.sendViaBrevoWithFallback(ctx, contract, thresholdDays, recipients)
    if err != nil {
        w.logger.Printf("[email-worker] final send failed for contract %s (threshold %d): %v", contract.ContractNumber, thresholdDays, err)
        // Log failure to DB
        w.logSend(contract.ID, thresholdDays, false, false, err, "smtp")
        return err
    }

    // 3. Log success
    w.logSend(contract.ID, thresholdDays, true, true, nil, "brevo")
    return nil
}
```

**Step 2:** `sendViaBrevoWithFallback`:

```go
func (w *ContractExpiryWorker) sendViaBrevoWithFallback(
    ctx context.Context,
    contract models.Contract,
    thresholdDays int,
    recipients []string,
) error {
    // Determine admin email (first admin found, or fallback)
    adminEmail := "support@pacta.example.com"
    admins, _ := w.config.GetUsersByCompanyAndRole(contract.CompanyID, "admin")
    if len(admins) > 0 {
        adminEmail = admins[0].Email
    }

    // Try Brevo SDK first
    err := w.brevoClient.SendContractExpiryViaBrevo(
        ctx,
        contract.ContractNumber,
        thresholdDays,
        contract.ExpiryDate,
        contract.Name,
        contract.ClientName,
        contract.CompanyName,
        contract.ID,
        recipients,
        adminEmail,
    )
    if err == nil {
        return nil
    }

    // Brevo failed → log and fallback to SMTP
    w.logger.Printf("[email-brevo] failed for %s: %v — falling back to SMTP", contract.ContractNumber, err)

    // Build mail message using existing go-mail (reuse templates or build inline)
    // For now, build simple HTML inline (same template as Brevo)
    subject := fmt.Sprintf("⚠️ Contrato %s vence en %d días — Acción requerida", contract.ContractNumber, thresholdDays)
    html := buildEmailHTML(contract, thresholdDays, adminEmail) // helper function

    msg := mail.NewMsg()
    if err := msg.From(os.Getenv("EMAIL_FROM")); err != nil {
        return fmt.Errorf("failed to set From: %w", err)
    }
    for _, r := range recipients {
        if err := msg.To(r); err != nil {
            return fmt.Errorf("failed to add recipient %s: %w", r, err)
        }
    }
    msg.Subject(subject)
    msg.SetBodyString(mail.TypeTextHTML, html)

    // Use existing SMTP fallback function (from sendmail.go)
    // We need to expose it as public if not already — check sendmail.go
    return sendEmailWithFallback(ctx, msg) // This function must be exported (capitalized)
}
```

**Step 3:** Helper `buildEmailHTML` (copy template from design doc as Go string):

```go
func buildEmailHTML(contract models.Contract, daysLeft int, adminEmail string) string {
    return fmt.Sprintf(`<!DOCTYPE html><html><head><style>body{font-family:sans-serif;line-height:1.6}.c{max-width:600px;margin:0 auto;padding:20px}.h{background:#f59e0b;color:white;padding:15px;text-align:center}.a{background:#fef2f2;border-left:4px solid #dc2626;padding:12px;margin:15px 0}.b{display:inline-block;background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px}.f{color:#64748b;font-size:12px;margin-top:20px}</style></head><body><div class="c"><div class="h"><h2>📅 Recordatorio de Vencimiento</h2></div><div class="c"><p>El contrato <strong>%s</strong> vence en <strong>%d días</strong> (%s).</p><div class="a"><strong>⚠️ Acción requerida:</strong> Para renovar, cree un nuevo suplemento que actualice la fecha de vencimiento y los valores correspondientes.</div><h3>Detalles:</h3><ul><li><strong>Contrato:</strong> %s</li><li><strong>Cliente:</strong> %s</li><li><strong>Empresa:</strong> %s</li><li><strong>Vencimiento:</strong> %s</li></ul><p><a href="https://pacta.example.com/contracts/%d/supplement" class="b">🔷 Renovar Contrato en PACTA</a></p><p>¿Preguntas? Contacte al administrador: <a href="mailto:%s">%s</a></p></div><div class="f">Este es un recordatorio automático de PACTA.</div></div></body></html>`,
        contract.ContractNumber, daysLeft, contract.ExpiryDate.Format("2006-01-02"),
        contract.Name, contract.ClientName, contract.CompanyName, contract.ExpiryDate.Format("2006-01-02"),
        contract.ID, adminEmail, adminEmail)
}
```

**Step 4:** `logSend()` — insert into `contract_expiry_notification_log`:

```go
func (w *ContractExpiryWorker) logSend(
    contractID int64,
    threshold int,
    sentToUser, sentToAdmin bool,
    err error,
    channel string,
) {
    status := "sent"
    var errMsg string
    if err != nil {
        status = "failed"
        errMsg = err.Error()
    }

    _, dbErr := w.config.DB.Exec(`
        INSERT INTO contract_expiry_notification_log
            (contract_id, threshold_days, sent_to_user, sent_to_admin, sent_at, delivery_status, error_message, channel)
        VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)
        ON CONFLICT (contract_id, threshold_days)
        DO UPDATE SET
            sent_to_user = excluded.sent_to_user,
            sent_to_admin = excluded.sent_to_admin,
            sent_at = excluded.sent_at,
            delivery_status = excluded.delivery_status,
            error_message = excluded.error_message,
            channel = excluded.channel
    `, contractID, threshold, sentToUser, sentToAdmin, status, errMsg, channel)

    if dbErr != nil {
        w.logger.Printf("ERROR logging notification for contract %d: %v", contractID, dbErr)
    } else {
        w.logger.Printf("logged contract %d threshold %d: status=%s channel=%s", contractID, threshold, status, channel)
    }
}
```

**Note:** Uses `ON CONFLICT` (UPSERT) to update if duplicate (shouldn't happen due to UNIQUE, but safe).

**Step 5:** Commit
```bash
git add internal/worker/contract_expiry.go
git commit -m "feat(worker): implement processContract and fallback logic"
```

---

### Task 3.3: Implement `runCycle()` main loop

**File:** `internal/worker/contract_expiry.go` (append)

```go
func (w *ContractExpiryWorker) runCycle() {
    w.logger.Println("cycle start")

    // 1. Load settings
    settings, err := w.loadSettings()
    if err != nil {
        w.logger.Printf("ERROR loading settings: %v — skipping cycle", err)
        return
    }
    if !settings.Enabled {
        w.logger.Println("worker disabled — skipping")
        return
    }

    w.logger.Printf("processing thresholds: %v", settings.ThresholdsDays)

    // 2. For each threshold
    totalSent := 0
    for _, days := range settings.ThresholdsDays {
        contracts, err := w.queryExpiringContracts(days)
        if err != nil {
            w.logger.Printf("ERROR querying contracts for %d days: %v", days, err)
            continue
        }

        w.logger.Printf("threshold %d days: %d contracts to process", days, len(contracts))

        for _, contract := range contracts {
            err := w.processContract(context.Background(), contract, days)
            if err != nil {
                w.logger.Printf("ERROR processing contract %s (ID=%d): %v", contract.ContractNumber, contract.ID, err)
            } else {
                totalSent++
            }
            time.Sleep(100 * time.Millisecond) // rate limit
        }
    }

    w.logger.Printf("cycle complete — total notifications sent: %d", totalSent)
}
```

**Step 1:** Write code above

**Step 2:** Add `GetUserByID` and `GetUsersByCompanyAndRole` stubs to `config.Service` (if not exist). Need to check existing `config.Service` methods.

**Check:** Does `internal/config/service.go` (or `internal/config/config.go`) have:
- `GetUserByID(id int64) (*User, error)`?
- `GetUsersByCompanyAndRole(companyID int64, role string) ([]User, error)`?

If NOT, create them:

```go
// internal/config/service.go (or config.go)
func (s *Service) GetUserByID(id int64) (*User, error) {
    user := &User{}
    err := s.DB.QueryRow(`SELECT id, email, name, role, company_id FROM users WHERE id = ?`, id).Scan(
        &user.ID, &user.Email, &user.Name, &user.Role, &user.CompanyID,
    )
    return user, err
}

func (s *Service) GetUsersByCompanyAndRole(companyID int64, role string) ([]User, error) {
    rows, err := s.DB.Query(`SELECT id, email, name, role, company_id FROM users WHERE company_id = ? AND role = ?`, companyID, role)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    var users []User
    for rows.Next() {
        var u User
        rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.CompanyID)
        users = append(users, u)
    }
    return users, rows.Err()
}
```

**Adjust field names** based on actual `users` table schema (check migrations).

**Step 3:** Commit all changes:
```bash
git add internal/worker/contract_expiry.go internal/config/service.go
git commit -m "feat(worker): complete runCycle with recipient lookup and logging"
```

---

### Task 3.4: Initialize worker in server

**File:** `internal/server/server.go`

**Step 1:** Import worker and Brevo client:

```go
import (
    // ...
    "github.com/PACTA-Team/pacta/internal/worker"
    "github.com/PACTA-Team/pacta/internal/email"
)
```

**Step 2:** In `NewServer()` or `Run()`, after config load:

```go
// Initialize Brevo client (ignore error — fallback to SMTP-only mode if Brevo not configured)
brevoClient, err := email.NewBrevoClient()
if err != nil {
    w.logger.Printf("[email-worker] Brevo client not initialized: %v — contract expiry notifications will use SMTP only", err)
    brevoClient = nil // worker will handle nil client and skip Brevo path
}

// Initialize worker
expiryWorker := worker.NewContractExpiryWorker(cfg, brevoClient, emailSender)
expiryWorker.Start()
defer expiryWorker.Stop()
```

**Step 3:** Add environment variable flag (optional):

```go
if os.Getenv("ENABLE_CONTRACT_EXPIRY_WORKER") == "false" {
    w.logger.Println("contract expiry worker disabled by env var")
} else {
    expiryWorker.Start()
    defer expiryWorker.Stop()
}
```

**Step 4:** Commit
```bash
git add internal/server/server.go
git commit -m "feat(server): initialize contract expiry worker on startup"
```

---

## Phase 4 — Backend: Settings API

### Task 4.1: Create handler file

**File:** `internal/handlers/contract_expiry_settings.go`

**Step 1:** Write handler:

```go
package handlers

import (
    "encoding/json"
    "net/http"
    "strconv"

    "github.com/PACTA-Team/pacta/internal/config"
    "github.com/PACTA-Team/pacta/internal/middleware"
)

type ContractExpirySettingsHandler struct {
    cfg *config.Service
}

func NewContractExpirySettingsHandler(cfg *config.Service) *ContractExpirySettingsHandler {
    return &ContractExpirySettingsHandler{cfg: cfg}
}

// GET /api/admin/settings/notifications
func (h *ContractExpirySettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
    if err := middleware.RequireRole(r, "admin"); err != nil {
        http.Error(w, "forbidden", http.StatusForbidden)
        return
    }

    var s models.ContractExpirySettings
    err := h.cfg.DB.QueryRow(`
        SELECT id, enabled, frequency_hours, thresholds_days, updated_by, updated_at
        FROM contract_expiry_notification_settings WHERE id = 1
    `).Scan(&s.ID, &s.Enabled, &s.FrequencyHours, &s.ThresholdsDays, &s.UpdatedBy, &s.UpdatedAt)

    if err != nil {
        http.Error(w, "failed to load settings", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(s)
}

// PUT /api/admin/settings/notifications
func (h *ContractExpirySettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
    if err := middleware.RequireRole(r, "admin"); err != nil {
        http.Error(w, "forbidden", http.StatusForbidden)
        return
    }

    var req struct {
        Enabled          bool     `json:"enabled"`
        FrequencyHours   int      `json:"frequency_hours"`
        ThresholdsDays   []int   `json:"thresholds_days"`
    }

    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid JSON", http.StatusBadRequest)
        return
    }

    // Validation
    if req.FrequencyHours < 1 || req.FrequencyHours > 168 {
        http.Error(w, "frequency_hours must be between 1 and 168", http.StatusBadRequest)
        return
    }
    if len(req.ThresholdsDays) == 0 {
        http.Error(w, "at least one threshold required", http.StatusBadRequest)
        return
    }
    // Validate thresholds: each between 1-365, descending, unique
    seen := make(map[int]bool)
    for _, d := range req.ThresholdsDays {
        if d < 1 || d > 365 {
            http.Error(w, "threshold days must be between 1 and 365", http.StatusBadRequest)
            return
        }
        if seen[d] {
            http.Error(w, "duplicate threshold values not allowed", http.StatusBadRequest)
            return
        }
        seen[d] = true
    }
    // Ensure descending order (optional — sort server-side)
    // (frontend should send sorted, but we can sort here too)

    // Upsert singleton row
    _, err := h.cfg.DB.Exec(`
        INSERT INTO contract_expiry_notification_settings (id, enabled, frequency_hours, thresholds_days, updated_by, updated_at)
        VALUES (1, ?, ?, ?, ?, NOW())
        ON CONFLICT (id) DO UPDATE SET
            enabled = excluded.enabled,
            frequency_hours = excluded.frequency_hours,
            thresholds_days = excluded.thresholds_days,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
    `, req.Enabled, req.FrequencyHours, req.ThresholdsDays, r.Context().Value("userID"))

    if err != nil {
        http.Error(w, "database error: "+err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
```

**Step 2:** Register routes in `internal/server/server.go` or router setup:

```go
// In SetupRoutes()
settingsHandler := handlers.NewContractExpirySettingsHandler(cfg)
router.HandleFunc("/api/admin/settings/notifications", settingsHandler.GetSettings).Methods("GET")
router.HandleFunc("/api/admin/settings/notifications", settingsHandler.UpdateSettings).Methods("PUT")
```

**Step 3:** Commit
```bash
git add internal/handlers/contract_expiry_settings.go internal/models/settings.go internal/server/server.go
git commit -m "feat(api): add GET/PUT /api/admin/settings/notifications"
```

---

### Task 4.2: Add model structs

**File:** `internal/models/settings.go` (new or extend existing)

```go
package models

type ContractExpirySettings struct {
    ID              int64   `json:"id"`
    Enabled         bool    `json:"enabled"`
    FrequencyHours  int     `json:"frequency_hours"`
    ThresholdsDays  []int  `json:"thresholds_days"`
    UpdatedBy       int64   `json:"updated_by,omitempty"`
    UpdatedAt       string  `json:"updated_at,omitempty"`
}
```

**Commit:**
```bash
git add internal/models/settings.go
git commit -m "models: add ContractExpirySettings struct"
```

---

## Phase 5 — Frontend: Settings Tab

### Task 5.1: Create API client

**File:** `pacta_appweb/src/lib/contract-expiry-settings-api.ts`

```ts
export interface NotificationSettings {
  enabled: boolean;
  frequency_hours: number;
  thresholds_days: number[];
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const res = await fetch(`${API_BASE}/admin/settings/notifications`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export async function updateNotificationSettings(data: Partial<NotificationSettings>): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/settings/notifications`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Failed to update settings');
  }
}
```

**Commit:**
```bash
git add pacta_appweb/src/lib/contract-expiry-settings-api.ts
git commit -m "feat(frontend): add API client for notification settings"
```

---

### Task 5.2: Create Settings tab component

**File:** `pacta_appweb/src/pages/SettingsPage/NotificationsTab.tsx`

```tsx
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { getNotificationSettings, updateNotificationSettings } from '@/lib/contract-expiry-settings-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function NotificationsTab() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [frequencyHours, setFrequencyHours] = useState(6);
  const [thresholds, setThresholds] = useState('30,14,7,1');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const s = await getNotificationSettings();
      setEnabled(s.enabled);
      setFrequencyHours(s.frequency_hours);
      setThresholds(s.thresholds_days.join(','));
    } catch (err) {
      toast({ title: 'Error', description: 'Could not load settings', variant: 'destructive' });
    }
  }

  async function save() {
    setLoading(true);
    try {
      const thresholdsArr = thresholds.split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t));
      await updateNotificationSettings({
        enabled,
        frequency_hours: frequencyHours,
        thresholds_days: thresholdsArr,
      });
      toast({ title: 'Success', description: 'Settings saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label htmlFor="enable-notifications">Enable contract expiry notifications</Label>
        <Switch id="enable-notifications" checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="frequency">Check every (hours)</Label>
        <Input
          id="frequency"
          type="number"
          min={1}
          max={168}
          value={frequencyHours}
          onChange={e => setFrequencyHours(parseInt(e.target.value) || 6)}
        />
        <p className="text-sm text-muted-foreground">How often the worker checks for expiring contracts (1–168 hours)</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="thresholds">Notification thresholds (days)</Label>
        <Input
          id="thresholds"
          placeholder="30,14,7,1"
          value={thresholds}
          onChange={e => setThresholds(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">Comma-separated list — e.g., 30,14,7,1 (days before expiry)</p>
      </div>

      <Button onClick={save} disabled={loading}>
        {loading ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}
```

**Step 1:** Create file

**Step 2:** Add to `SettingsPage.tsx`:

```tsx
import { NotificationsTab } from './NotificationsTab';

// Inside tab switch:
{activeTab === 'notifications' && <NotificationsTab />}
```

**Step 3:** Commit
```bash
git add pacta_appweb/src/pages/SettingsPage/NotificationsTab.tsx pacta_appweb/src/pages/SettingsPage.tsx
git commit -m "feat(frontend): add Notifications settings tab"
```

---

## Phase 6 — Testing & QA

### Task 6.1: Integration test — worker cycle with test DB

**File:** `internal/worker/contract_expiry_worker_test.go`

```go
package worker

import (
    "context"
    "os"
    "testing"
    "time"

    "github.com/PACTA-Team/pacta/internal/config"
    _ "github.com/mattn/go-sqlite3"
)

func TestContractExpiryWorker_Integration(t *testing.T) {
    // Setup in-memory SQLite
    db, err := sql.Open("sqlite3", ":memory:")
    if err != nil { t.Fatal(err) }
    defer db.Close()

    // Run migrations (027)
    // TODO: call goose or embed migration
    // For now, manually create tables

    // Insert test data:
    // - contract expiring in 7 days
    // - owner user (company admin)
    // - settings: enabled=true, frequency=1h, thresholds=[7]

    // Start worker with ticker = 1s (for test)
    // Wait 2 cycles
    // Assert: log table has entries, sent_to_user=true, sent_to_admin=true, channel='brevo' (or 'smtp' if Brevo key missing)

    t.Skip("TODO: full integration test pending goose test harness")
}
```

**Simpler unit test** (mock DB and Brevo):

```go
func TestProcessContract_SendsToRecipients(t *testing.T) {
    // Mock config.Service with stubbed methods
    // Mock Brevo client (success)
    // Call processContract
    // Assert logSend called with correct args
}
```

---

### Task 6.2: Manual E2E test plan

1. **Start server locally** with test DB and real Brevo credentials (or mock)
2. **Create test contract:**
   - Expiry date = 7 days from now
   - Status = 'active'
   - `created_by` = user A (email: `user@test.com`)
   - Company has admin user B (`admin@test.com`)
3. **Settings:** `enabled=true, frequency=1 hour (test), thresholds=[7]`
4. **Wait** for worker cycle (or trigger manually via HTTP endpoint for testing)
5. **Check logs:** `[email-worker]`, `[email-brevo]` shows "sent"
6. **Check inboxes:** both user@test.com and admin@test.com receive email
7. **Check DB:** `contract_expiry_notification_log` has 2 rows (user + admin flagged), status='sent', channel='brevo'
8. **Second cycle** (same threshold): no duplicate sends (UNIQUE constraint prevents)

---

### Task 6.3: Fallback test

1. Set `BREVO_API_KEY` to invalid value
2. Restart server/worker
3. Worker should attempt Brevo → fail → fallback to SMTP
4. Check logs: `[email-brevo] failed... falling back to SMTP`
5. Check email received via SMTP (Brevo SMTP or Gmail)
6. DB log: `channel='smtp'`, status='sent'

---

## Phase 7 — Deployment

### Task 7.1: Update CHANGELOG

**File:** `CHANGELOG.md` — Add new unreleased section:

```markdown
## [Unreleased]

### Added
- **Brevo SDK integration for contract expiry notifications**
  - Internal Go worker (`internal/worker/contract_expiry.go`) runs every N hours (configurable)
  - Sends notifications via Brevo Transactional Email API with automatic SMTP fallback
  - Settings page: Settings → Notifications (enable, frequency, thresholds)
  - Email template with "Renew Contract" CTA, sent to contract owner + company admins
  - Delivery tracking in `contract_expiry_notification_log` table
  - Configurable thresholds: 30/14/7/1 days (customizable)

### Changed
- **Email architecture:** Contract expiry now uses Brevo API (with SMTP fallback) while registration/admin emails remain on SMTP

### Technical Details
- **New files:** `internal/email/brevo.go`, `internal/worker/contract_expiry.go`, `internal/handlers/contract_expiry_settings.go`, `docs/plans/2025-06-18-brevo-contract-expiry-design.md`
- **DB migrations:** `027_contract_expiry_notifications.sql` (2 new tables)
- **Frontend:** Notifications tab in SettingsPage, API client `contract-expiry-settings-api.ts`
- **Dependencies:** `github.com/getbrevo/brevo-go v1.0.0`
```

**Bump version:** v0.37.0

```bash
# Update backend VERSION in internal/config (if separate) or go.mod replace?
# For Go project: tag will be v0.37.0
git add CHANGELOG.md
git commit -m "chore: bump version to v0.37.0 - Brevo contract expiry notifications"
```

---

### Task 7.2: Merge, tag, release

```bash
git checkout main
git merge --no-ff feature/brevo-contract-expiry-2025-06-18
git tag -a v0.37.0 -m "Release v0.37.0: Brevo contract expiry notifications"
git push origin main v0.37.0
```

Release workflow (`Release` job in GitHub Actions) will build binaries and create GitHub Release automatically.

---

## Acceptance Criteria

- [ ] Migration `027` runs successfully (tables created, singleton row inserted)
- [ ] Brevo client initializes if `BREVO_API_KEY` set; logs error if not, but worker still runs (SMTP-only mode)
- [ ] Worker starts on server boot (if enabled)
- [ ] Settings GET/PUT endpoints work (admin auth required)
- [ ] Settings UI loads, saves, validates input
- [ ] Worker sends email for contract expiring in threshold days (Brevo path)
- [ ] Brevo failure triggers SMTP fallback (email still delivered)
- [ ] Duplicate prevention works (same contract+threshold not sent twice)
- [ ] Log table populated with correct status/channel
- [ ] Email received by owner and admins with correct template
- [ ] CI passes (backend tests, frontend build)

---

## File Changes Summary

| File | Type | Lines |
|------|------|-------|
| `internal/email/brevo.go` | New | ~120 |
| `internal/email/brevo_test.go` | New | ~80 |
| `internal/worker/contract_expiry.go` | New | ~200 |
| `internal/handlers/contract_expiry_settings.go` | New | ~100 |
| `internal/models/settings.go` | New | ~20 |
| `internal/db/migrations/027_contract_expiry_notifications.sql` | New | ~40 |
| `internal/server/server.go` | Modified | +15 (worker init) |
| `internal/config/service.go` | Modified | +30 (GetUserByID, GetUsersByCompanyAndRole) |
| `pacta_appweb/src/lib/contract-expiry-settings-api.ts` | New | ~40 |
| `pacta_appweb/src/pages/SettingsPage/NotificationsTab.tsx` | New | ~120 |
| `pacta_appweb/src/pages/SettingsPage.tsx` | Modified | +10 (tab switch) |
| `CHANGELOG.md` | Modified | +30 |
| `go.mod` | Modified | +1 dependency |

---

**Plan complete and saved to `docs/plans/2025-06-18-brevo-contract-expiry-implementation.md`.**

## 🚀 Three execution options:

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration  
**2. Parallel Session (separate)** — Open new session with `executing-plans`, batch execution with checkpoints  
**3. Plan-to-Issues (team workflow)** — Convert plan tasks to GitHub issues for team distribution  

Which approach?
