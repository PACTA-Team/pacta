# Brevo SDK Integration — Contract Expiry Notifications

> **Status:** Proposed  
> **Created:** 2025-06-18  
> **Components:** `internal/email/brevo.go`, `internal/worker/contract_expiry.go`, Settings → Notifications tab  
> **Related:** v0.36.0 email fallback (SMTP), v0.36.1 binary release

---

## Overview

Integrate **Brevo SDK (brevo-go)** into PACTA to send **contract expiry notifications** via Brevo's Transactional Email API, while keeping existing SMTP (Brevo → Gmail fallback) for critical transactional emails (user registration, admin approvals).

**Goals:**
- Early notifications for contracts approaching expiry (configurable thresholds: 30/14/7/1 days)
- Professional, actionable email templates with direct "Renew Contract" CTA
- Configurable worker frequency and thresholds by admin (Settings → Notifications)
- Automatic fallback to SMTP if Brevo API fails (ensures delivery)
- Internal Go worker (cron-like) running periodically
- Delivery tracking and history in UI

---

## Architecture Decisions

### 1. Email Channel Strategy (Hybrid)

| Email Type | Primary Channel | Fallback | Uses Brevo SDK? |
|------------|----------------|----------|-----------------|
| User registration (OTP) | SMTP (Brevo SMTP) | Gmail SMTP | ❌ No |
| Admin: user awaiting approval | SMTP (Brevo SMTP) | Gmail SMTP | ❌ No |
| **Contract expiry** | **Brevo SDK (API v3)** | **SMTP (Brevo→Gmail)** | ✅ **Yes** |

**Rationale:**
- Critical emails (registration, admin alerts) use proven SMTP fallback path
- Contract notifications benefit from Brevo API: deliverability metrics, higher throughput, template management
- Fallback to SMTP guarantees delivery even if Brevo API is down

### 2. Fallback Chain for Contract Emails

```
SendContractExpiryNotification(contract, recipients)
    ├─ Try: Brevo SDK (brevo.TransactionalEmailsApi.SendEmail)
    │   └─ Success → log "brevo", store metrics
    │   └─ Failure (any error) → log "[email-brevo] error"
    └─ Fallback: sendEmailWithFallback(ctx, msg)  // existing SMTP path
        ├─ Try: Brevo SMTP (smtp-relay.brevo.com:587)
        └─ Fallback: Gmail SMTP (smtp.gmail.com:587)
```

**Fallback triggers on:** API errors, rate limits (429), network timeouts, authentication failures.

### 3. Worker Implementation

**Package:** `internal/worker/contract_expiry.go`

**Structure:**
```go
type ContractExpiryWorker struct {
    config        *config.Service      // DB + Settings
    brevoClient   *brevo.APIClient      // Brevo SDK client
    smtpSender    *email.Service       // Reuse existing SMTP sender
    logger        *log.Logger
    ticker        *time.Ticker
    running       bool
    mu            sync.RWMutex
}
```

**Methods:**
- `NewContractExpiryWorker(cfg *config.Service) *ContractExpiryWorker`
- `Start()` — launches goroutine, loads settings, starts ticker
- `Stop()` — graceful shutdown (cancel context, wait for goroutines)
- `runCycle()` — core loop (runs every `frequency_hours`)

**Core Logic (`runCycle`):**
1. Load notification settings from `contract_expiry_notification_settings` (singleton row)
2. If `enabled == false`, return early
3. For each `threshold_days` in `settings.Thresholds` (e.g., `[30,14,7,1]`):
   - Query contracts expiring in `threshold_days` (BETWEEN NOW() AND NOW()+threshold)
   - Filter: contracts with `status = 'active'` AND not already notified for this threshold (check `contract_expiry_notification_log`)
   - For each contract:
     - Fetch: contract details, associated client, company, responsible user(s)
     - Build email (HTML template with contract data)
     - Send via `sendViaBrevoWithFallback(ctx, contract, recipients)`
     - Log result to `contract_expiry_notification_log` (status, channel, error if any)
     - Rate limit: 100ms pause between emails (configurable)
4. Sleep until next tick (duration = `frequency_hours`)

**Concurrency:** Sequential per threshold (simple, avoids race conditions). Can be parallelized later if needed.

### 4. Database Schema

**Migration:** `internal/db/migrations/027_contract_expiry_notifications.sql`

#### Table 1: `contract_expiry_notification_settings` (singleton)
```sql
CREATE TABLE contract_expiry_notification_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT true,
    frequency_hours INTEGER NOT NULL DEFAULT 6 CHECK (frequency_hours >= 1 AND frequency_hours <= 168),
    thresholds_days INTEGER[] NOT NULL DEFAULT '{30,14,7,1}'::integer[],
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert singleton on migration (if not exists)
INSERT INTO contract_expiry_notification_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
```

#### Table 2: `contract_expiry_notification_log`
```sql
CREATE TABLE contract_expiry_notification_log (
    id BIGSERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    threshold_days INTEGER NOT NULL,
    sent_to_user BOOLEAN NOT NULL DEFAULT false,
    sent_to_admin BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMP,
    delivery_status VARCHAR(20) NOT NULL CHECK (delivery_status IN ('sent', 'failed', 'partial')),
    error_message TEXT,
    channel VARCHAR(10) NOT NULL CHECK (channel IN ('brevo', 'smtp')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, threshold_days)  -- prevents duplicate notifications per threshold
);

CREATE INDEX idx_contract_expiry_log_contract ON contract_expiry_notification_log(contract_id);
CREATE INDEX idx_contract_expiry_log_threshold ON contract_expiry_notification_log(threshold_days);
CREATE INDEX idx_contract_expiry_log_created ON contract_expiry_notification_log(created_at DESC);
```

**Rationale:**
- Singleton settings row ensures one config for whole system
- `thresholds_days` as PostgreSQL array allows flexible escalation
- Log table tracks delivery status per threshold; `UNIQUE` prevents re-sending same notification

---

## API Design

### Endpoint 1: GET `/api/admin/settings/notifications`

**Auth:** Admin only (`requireRole("admin")`)

**Response:**
```json
{
  "enabled": true,
  "frequency_hours": 6,
  "thresholds_days": [30, 14, 7, 1],
  "updated_by": 5,
  "updated_at": "2025-06-18T00:00:00Z"
}
```

### Endpoint 2: PUT `/api/admin/settings/notifications`

**Auth:** Admin only

**Request body:**
```json
{
  "enabled": true,
  "frequency_hours": 12,
  "thresholds_days": [30, 7]
}
```

**Validation:**
- `frequency_hours`: 1–168 (1 week max)
- `thresholds_days`: each 1–365, sorted descending, no duplicates
- At least 1 threshold required

**Response:** Updated settings object (same as GET)

**Error:** 400 if validation fails, 403 if not admin, 500 if DB error

---

## Frontend: Settings → Notifications Tab

**Location:** `pacta_appweb/src/pages/SettingsPage.tsx` — new tab panel

**Fields:**
- [x] **Enable contract expiry notifications** (checkbox)
- **Worker frequency (hours):** `[number input, min=1, max=168, step=1]` — default: `6`
- **Notification thresholds (days):** `[text input]` — default: `30,14,7,1`  
  *Hint: "Comma-separated list: e.g., 30,14,7,1"*
- **Save button** — disabled if unchanged

**UX:**
- On load: `GET /api/admin/settings/notifications`
- On save: `PUT` with JSON, show toast success/error
- Validation: client-side check for valid comma-separated integers

---

## Email Template

**Subject:**
```
⚠️ Contrato {contract_number} vence en {days_left} días — Acción requerida
```

**HTML Body (responsive + PACTA branding):**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 24px; }
    .alert { background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .alert strong { color: #dc2626; }
    .details { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .details ul { margin: 0; padding-left: 20px; }
    .details li { margin-bottom: 8px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; }
    .button:hover { background: #1d4ed8; }
    .steps { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .steps ol { margin: 0; padding-left: 20px; }
    .steps li { margin-bottom: 8px; }
    .footer { background: #f1f5f9; padding: 16px; text-align: center; color: #64748b; font-size: 12px; }
    .footer a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📅 Recordatorio de Vencimiento</h1>
    </div>
    <div class="content">
      <p>El contrato <strong>{contract_number}</strong> vence en <strong>{days_left} días</strong> ({expiry_date}).</p>

      <div class="alert">
        <strong>⚠️ Acción requerida:</strong> Para renovar, cree un nuevo suplemento que actualice la fecha de vencimiento y los valores correspondientes.
      </div>

      <h3>📋 Detalles del contrato:</h3>
      <div class="details">
        <ul>
          <li><strong>Contrato:</strong> {contract_name}</li>
          <li><strong>Cliente:</strong> {client_name}</li>
          <li><strong>Empresa:</strong> {company_name}</li>
          <li><strong>Vencimiento:</strong> {expiry_date}</li>
        </ul>
      </div>

      <p style="text-align: center;">
        <a href="{link}" class="button">🔷 Renovar Contrato en PACTA</a>
      </p>

      <div class="steps">
        <p><strong>Pasos:</strong></p>
        <ol>
          <li>Inicie sesión en PACTA</li>
          <li>Abra el contrato <em>{contract_number}</em></li>
          <li>Haga clic en "Crear Suplemento"</li>
          <li>Actualice fecha y valores</li>
          <li>Guarde y notifique al cliente</li>
        </ol>
      </div>

      <p>¿Preguntas? Contacte al administrador: <a href="mailto:{admin_email}">{admin_email}</a></p>
    </div>
    <div class="footer">
      <p>Este es un recordatorio automático de PACTA — Contract Management System.<br>
      Si no desea recibir estos emails, contacte al administrador.</p>
    </div>
  </div>
</body>
</html>
```

**Template variables mapping:**
| Variable | Source |
|----------|--------|
| `{contract_number}` | `contract.ContractNumber` (string, e.g., "CNT-2025-0042") |
| `{days_left}` | `threshold_days` (int, computed) |
| `{expiry_date}` | `contract.ExpiryDate` formatted as "YYYY-MM-DD" |
| `{contract_name}` | `contract.Name` (or supplement name if contract has active supplement) |
| `{client_name}` | `client.LegalName` |
| `{company_name}` | `company.Name` |
| `{link}` | `https://pacta.example.com/contracts/{contract_id}/supplement` (authenticated route — user must be logged in) |
| `{admin_email}` | `company.AdminEmail` or global admin from settings |

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  1. Worker tick (every N hours)                             │
│      └─> internal/worker/contract_expiry.go:runCycle()      │
├─────────────────────────────────────────────────────────────┤
│  2. Load settings from DB                                    │
│      SELECT * FROM contract_expiry_notification_settings    │
│      WHERE id = 1 AND enabled = true                         │
├─────────────────────────────────────────────────────────────┤
│  3. For each threshold_days (e.g., 30, then 14, then 7...)  │
│      └─> Query contracts expiring in threshold:              │
│          SELECT c.* FROM contracts c                         │
│          JOIN clients cl ON c.client_id = cl.id              │
│          JOIN companies co ON cl.company_id = co.id          │
│          WHERE c.expiry_date BETWEEN NOW() AND NOW()+D       │
│            AND c.status = 'active'                           │
│            AND NOT EXISTS (                                   │
│              SELECT 1 FROM contract_expiry_notification_log l│
│              WHERE l.contract_id = c.id AND l.threshold_days = D│
│            )                                                 │
├─────────────────────────────────────────────────────────────┤
│  4. For each contract:                                       │
│      ├─> Determine recipients:                               │
│      │     owner := getUserByID(contract.created_by)          │
│      │     admins := getUsersByCompany(contract.company_id, "admin")│
│      │     recipients := dedupe([owner.Email] + admins.Emails)│
│      ├─> Build HTML email (template with contract data)      │
│      ├─> Build brevo.Email (cc, bcc, reply-to, tracking)    │
│      ├─> Send via Brevo SDK:                                  │
│      │     brevo.SendEmail(ctx, brevo.SendEmailProps{...})   │
│      ├─> If Brevo fails → fallback to SMTP:                  │
│      │     msg := buildMailMessage(recipients, html, subject)│
│      │     err := sendEmailWithFallback(ctx, msg)             │
│      ├─> If SMTP also fails → log error, continue            │
│      └─> Log to contract_expiry_notification_log:            │
│            (contract_id, threshold, sent_to_user, sent_to_admin,│
│             sent_at, status, error, channel)                  │
├─────────────────────────────────────────────────────────────┤
│  5. Sleep until next tick (duration = settings.frequency_hours)│
└─────────────────────────────────────────────────────────────┘
```

---

## Error Handling & Logging

### Logging Prefixes

| Prefix | Usage |
|--------|-------|
| `[email-worker]` | Worker lifecycle: start/stop, settings loaded, cycle start/end, errors |
| `[email-brevo]` | Brevo SDK send attempts: request payload, response, errors (with contract ID) |
| `[email-smtp-fallback]` | Fallback SMTP send: which provider (Brevo SMTP or Gmail), result |

### Retry Strategy

**Per-email:**
1. Try Brevo SDK once
2. On any error → immediate SMTP fallback (single retry via existing `sendEmailWithFallback`)
3. No exponential backoff (notifications are time-sensitive; delayed is better than never)

**Batch level:**
- One contract failure does NOT stop the worker cycle
- Continue with next contract
- Max 1000 contracts per tick (configurable via `MAX_CONTRACTS_PER_CYCLE` env var, default 1000)

### Error Scenarios

| Scenario | Action |
|----------|--------|
| Brevo API 429 (rate limit) | Fallback to SMTP immediately |
| Brevo API 500/network error | Fallback to SMTP |
| SMTP fails (both Brevo and Gmail) | Log error, continue; admin alerted via log history |
| No recipients found (contract owner email empty) | Log warning, skip contract, continue |

---

## Database Schema Details

### Migration: `027_contract_expiry_notifications.sql`

```sql
-- Settings table (singleton)
CREATE TABLE contract_expiry_notification_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT true,
    frequency_hours INTEGER NOT NULL DEFAULT 6,
    thresholds_days INTEGER[] NOT NULL DEFAULT '{30,14,7,1}'::integer[],
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Log table
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

-- Indexes for performance
CREATE INDEX idx_contract_expiry_log_contract ON contract_expiry_notification_log(contract_id);
CREATE INDEX idx_contract_expiry_log_threshold ON contract_expiry_notification_log(threshold_days);
CREATE INDEX idx_contract_expiry_log_created ON contract_expiry_notification_log(created_at DESC);

-- Insert default settings row
INSERT INTO contract_expiry_notification_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
```

---

## Settings API (Backend)

**New handler:** `internal/handlers/contract_expiry_settings.go`

```go
type NotificationSettings struct {
    Enabled         bool      `json:"enabled"`
    FrequencyHours  int       `json:"frequency_hours"`
    ThresholdsDays  []int     `json:"thresholds_days"`
    UpdatedBy       int64     `json:"updated_by,omitempty"`
    UpdatedAt       time.Time `json:"updated_at,omitempty"`
}

// GET /api/admin/settings/notifications
func (h *Handler) GetNotificationSettings(w http.ResponseWriter, r *http.Request) {
    // Auth: requireRole("admin")
    // Query singleton row from contract_expiry_notification_settings
    // Return JSON
}

// PUT /api/admin/settings/notifications
func (h *Handler) UpdateNotificationSettings(w http.ResponseWriter, r *http.Request) {
    // Auth: requireRole("admin")
    // Decode JSON body
    // Validate: frequency_hours 1-168, thresholds len>=1, each 1-365, sorted desc
    // Upsert singleton row
    // Trigger worker config reload (if running)
}
```

**Worker config reload:** Worker watches settings table every cycle (no need to restart). On each `runCycle()`, it re-reads settings from DB. PUT updates DB → next cycle picks up new values automatically.

---

## Frontend Integration

**New file:** `pacta_appweb/src/pages/contracts/NotificationSettingsTab.tsx` (or add to existing SettingsPage)

**API client:** `pacta_appweb/src/lib/contract-expiry-settings-api.ts`

**State:**
```ts
interface NotificationSettings {
  enabled: boolean;
  frequency_hours: number;
  thresholds_days: number[];
}
```

**UI:**
- Tab in Settings page titled "Notifications"
- Checkbox: "Enable contract expiry notifications"
- Number input: "Check every X hours" (default 6)
- Text input: "Notify at days before expiry" (default "30,14,7,1")
- Save button

---

## Worker Lifecycle

**Startup:** Main server initializes worker on startup (if `ENABLE_CONTRACT_EXPIRY_WORKER=true`):
```go
// internal/server/server.go
if os.Getenv("ENABLE_CONTRACT_EXPIRY_WORKER") == "true" {
    expiryWorker := worker.NewContractExpiryWorker(cfg, brevoClient, emailSender)
    expiryWorker.Start()
    defer expiryWorker.Stop()
}
```

**Graceful shutdown:** `Stop()` cancels context, waits for current cycle to finish.

**Monitoring:**
- Logs every cycle start/end with counts
- Optional: expose metrics endpoint `/metrics/worker` (Prometheus) — future enhancement

---

## Email Template Variables (Full List)

| Variable | Type | Source |
|----------|------|--------|
| `{contract_number}` | string | `contract.ContractNumber` |
| `{days_left}` | int | `threshold_days` (loop var) |
| `{expiry_date}` | string | `contract.ExpiryDate.Format("2006-01-02")` |
| `{contract_name}` | string | `contract.Name` (or active supplement name) |
| `{client_name}` | string | `client.LegalName` |
| `{company_name}` | string | `company.Name` |
| `{link}` | string | `/contracts/{contract_id}/supplement` (frontend route, authenticated) |
| `{admin_email}` | string | `company.AdminEmail` or global setting `SUPPORT_EMAIL` |

---

## Security & Privacy

- **No PII in logs:** error messages should not leak full email addresses (truncate/mask)
- **Email opt-out:** Not system-critical; users cannot unsubscribe (contracts are legal obligations)
- **Access control:** Only admins can view notification history (Settings → Notifications)
- **Database:** `contract_expiry_notification_log` accessible only to admins via API (role middleware)

---

## Open Questions (Resolved)

### Q1 — Enlace "Renovar Contrato"

**Decision: B — Ruta autenticada** (`/contracts/{id}/supplement`)

**Rationale:** PACTA requires authentication; user receiving email is registered. Direct link to contract supplement page with session cookie (or redirect to login). No need for one-time tokens.

---

### Q2 — Responsable del contrato (destinatario)

**Decision: Múltiples destinatarios:**
1. **Owner** — `contract.created_by` (user who created the contract)
2. **Admins of company** — all users with role `admin` in `company_id` of the contract

**Implementation:** Deduplicate by email address. Send single email with `To:` owner, `Cc:` admins? Or individual emails per recipient? 

**Recommendation:** **Individual emails** (each recipient gets separate email, `To:` only them). Avoids "Reply All" storms and keeps tracking clean in log table (`sent_to_user`, `sent_to_admin` flags).

---

### Q3 — Plantilla editable?

**Decision: A — Plantilla fija hardcoded en Go**

**Rationale:** Simplicity. Content is standard and unlikely to change per company. Template stored as Go string constant in `brevo.go`. Future enhancement: move to DB if needed.

---

### Q4 — Historial visible en UI

**Decision: Sí — en Settings → Notifications → Tab "History"**

**UI:** Table with columns:
- Date (sent_at)
- Contract (number + name)
- Threshold (days before)
- Recipient (email + role: user/admin)
- Channel (Brevo / SMTP)
- Status (Sent / Failed)
- Error (if failed, truncated)

**API:** `GET /api/admin/notifications/history?contract_id=X&threshold=Y&limit=50`

**No en página del contrato** — centralizar en Settings para admin.

---

## Implementation Phases (Proposed)

### Fase 1 — Database + Settings API (1–2 days)
1. Create migration `027_contract_expiry_notifications.sql`
2. Run migration (`goose` or existing tool)
3. Implement `internal/handlers/contract_expiry_settings.go` (GET/PUT)
4. Unit tests for handlers (table-driven tests)

### Fase 2 — Brevo Client + Email Sending (1–2 days)
1. Add dependency `github.com/getbrevo/brevo-go` to `go.mod`
2. Create `internal/email/brevo.go`:
   - `NewBrevoClient(apiKey string) *brevo.APIClient`
   - `SendContractExpiryViaBrevo(ctx, contract, recipients, template) error`
3. Implement fallback logic: on Brevo error → call `sendEmailWithFallback`
4. Unit tests with mocked Brevo client (table-driven success/failure cases)

### Fase 3 — Worker Implementation (1–2 days)
1. Create `internal/worker/contract_expiry.go`:
   - `ContractExpiryWorker` struct
   - `Start()`, `Stop()`, `runCycle()`
   - `loadSettings()`, `queryExpiringContracts()`, `processContract()`
2. Initialize worker in `internal/server/server.go`
3. Add environment variable `ENABLE_CONTRACT_EXPIRY_WORKER` (default `true`)
4. Unit tests for worker logic (mock DB, Brevo, SMTP)

### Fase 4 — Frontend Settings UI (0.5–1 day)
1. Extend `SettingsPage.tsx` with new "Notifications" tab
2. Add form component: checkbox, number input, text input (thresholds)
3. Implement API client (`contract-expiry-settings-api.ts`)
4. Save/load with toast feedback

### Fase 5 — Testing & QA (1 day)
1. Integration test: full cycle with test DB (sqlite in-memory)
2. Test Brevo failure → SMTP fallback
3. Test duplicate notification prevention (log table UNIQUE constraint)
4. Manual E2E: register contract expiring in 7 days → verify email received
5. Check logs: `[email-worker]`, `[email-brevo]`, `[email-smtp-fallback]`

### Fase 6 — Deployment (0.5 day)
1. Update `CHANGELOG.md` (v0.37.0)
2. Bump version to v0.37.0
3. Merge to main, tag, release
4. Deploy to production server
5. Monitor logs for 24h

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Brevo API rate limit (300 emails/min free tier) | Worker may block/slow | Add rate limiter (sleep 200ms between sends); upgrade Brevo plan if needed |
| Worker consumes DB resources (large contract base) | DB load spike during query | Indexes on `expiry_date`, `status`; limit to 1000 contracts/cycle; paginate |
| False positives (contract already renewed) | Spam email | Add `expiry_notification_suppressed` flag on contract (manual override) |
| Email deliverability (spam) | User doesn't see email | Use Brevo domain authentication; add SPF/DKIM; monitor bounce rates |
| Worker crashes on malformed data | Cycle stops | panic recovery in `processContract()`; log and continue |

---

## Monitoring & Observability

**Logs to monitor:**
- `[email-worker]` — worker health (should see "cycle completed" every N hours)
- `[email-brevo]` — Brevo API success rate
- `[email-smtp-fallback]` — fallback frequency (high = Brevo API unstable)

**Sentry/errors:** Track `delivery_status = 'failed'` entries in log table for alerting.

**Metrics (future):**
- `contract_expiry_notifications_sent_total{channel="brevo|smtp"}`
- `contract_expiry_notifications_failed_total`
- `contract_expiry_worker_cycle_duration_seconds`

---

## Future Enhancements

- **Preview mode:** Admin can send test notification for a specific contract
- **Snooze:** Postpone notification for a contract (add `snoozed_until` column)
- **Webhook:** POST to external system on notification sent/failed
- **Multi-language:** Use i18n templates based on user locale
- **Attachments:** Include PDF preview of contract (if generated)
- **Dashboard:** Settings → Notifications → Analytics chart (sent vs failed over time)

---

**Next step:** Invoke `writing-plans` skill to generate detailed implementation task list with acceptance criteria.
