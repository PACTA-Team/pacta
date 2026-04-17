# Email Service Design: Brevo Primary + Gmail Fallback

## Overview

PACTA uses `go-mail v0.7.2` for SMTP email delivery. This design adds reliable email delivery with automatic provider fallback: Brevo as the primary SMTP relay and Gmail as a backup.

### Current State

- Single `getMailClient()` that reads `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
- Defaults to `localhost` if `SMTP_HOST` unset
- Uses opportunistic TLS (`TLSOpportunistic`) — insufficient for production
- Direct SMTP from VPS (port 25) → spam/delivery issues

### Problem

Email deliverability is poor when sending directly from the VPS. We need an external SMTP relay with a fallback mechanism for reliability.

---

## Design Decisions

### 1. Fallback Trigger Strategy

**Decision:** Fallback on *all* errors, including invalid recipients.

Rationale:
- Simpler implementation — any error from `client.DialAndSendWithContext` triggers fallback
- Invalid recipient errors (e.g., mailbox full, address doesn't exist) are transient in some cases
- Better user experience: if Brevo rejects an email for any reason, Gmail might still deliver it
- Worst case: both fail → user sees error, which is acceptable

### 2. Code Structure

**Decision:** Separate provider functions with an orchestrator.

Functions:
- `sendWithBrevo(ctx context.Context, msg *mail.Message) error`
- `sendWithGmail(ctx context.Context, msg *mail.Message) error`
- `sendEmailWithFallback(ctx context.Context, msg *mail.Message) error` — calls the two above

Rationale:
- Clear separation of concerns
- Easy to test each provider independently
- Explicit fallback flow is readable
- Matches user's requirement: "Separate provider functions"

### 3. Configuration Precedence

**Decision tree:**

```
if SMTP_HOST, SMTP_USER, SMTP_PASS are ALL set:
    → try Brevo first
    → if send fails → try Gmail
    → return result (success or combined error)
else if GMAIL_USER and GMAIL_APP_PASSWORD set:
    → skip Brevo → try Gmail directly
    → return result
else:
    → log error: no SMTP configuration found
    → return error: "email service not configured"
```

Rationale:
- Brevo credentials must be **complete** (host, user, pass) to be considered "configured"
- Partial Brevo config (e.g., only `SMTP_HOST` set) is treated as unconfigured → skip to Gmail
- Gmail is always available as long as both `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set
- Fails fast if neither provider is configured — avoids silent failures

### 4. TLS & Port Configuration

Both providers use port 587 with mandatory STARTTLS:

```go
mail.WithPort(587),
mail.WithTLSPortPolicy(mail.TLSMandatory),
```

- **Brevo**: `smtp-relay.brevo.com:587`, authentication via `SMTPAuthPlain`
- **Gmail**: `smtp.gmail.com:587`, authentication via `SMTPAuthPlain` (App Password)

### 5. Sender Address (`EMAIL_FROM`)

- Remains unchanged for both providers
- Read once per send (same as current code)
- Format: `PACTA <pactateam@gmail.com>` or custom value from env

---

## Data Flow

```
User registers (email mode)
    ↓
auth.go calls email.SendVerificationCode(ctx, email, code, lang)
    ↓
SendVerificationCode creates msg from template
    ↓
Calls sendEmailWithFallback(ctx, msg)
    ↓
Decision: Brevo config present?
    ↓ YES
tryBrevo() → client.DialAndSendWithContext()
    ↓ SUCCESS? → return nil
    ↓ FAILURE
log "Brevo failed: <error>. Falling back to Gmail..."
    ↓
tryGmail() → client.DialAndSendWithContext()
    ↓ SUCCESS? → return nil
    ↓ FAILURE
log "Gmail fallback failed: <error>"
    ↓
return error (Gmail failure)
    ↓ NO (Brevo not configured)
Decision: Gmail config present?
    ↓ YES
tryGmail() → return result
    ↓ NO
log "ERROR: no SMTP configuration found"
return error
```

---

## Error Handling

- **Brevo fails, Gmail succeeds**: Return `nil` (email delivered via fallback). Log INFO about successful fallback.
- **Brevo succeeds**: Return `nil`. No fallback attempted.
- **Both fail**: Return Gmail's error (the last error attempted). Log ERROR with both failures.
- **No configuration**: Return error immediately. Log ERROR with setup instructions.

**Error messages in logs:**
```
[email] sending via Brevo (smtp-relay.brevo.com:587)
[email] Brevo send failed: <error>. Falling back to Gmail…
[email] sending via Gmail fallback (smtp.gmail.com:587)
[email] Gmail fallback succeeded
[email] Gmail fallback failed: <error>
[email] no SMTP configuration found (need SMTP_* or GMAIL_* env vars)
```

---

## Environment Variables

| Variable | Required? | Default | Description |
|----------|-----------|---------|-------------|
| `SMTP_HOST` | Conditional1 | `localhost` | Brevo SMTP host (must be `smtp-relay.brevo.com`) |
| `SMTP_USER` | Conditional1 | — | Brevo login email |
| `SMTP_PASS` | Conditional1 | — | Brevo SMTP key |
| `GMAIL_USER` | Conditional2 | — | Gmail address (`pactateam@gmail.com`) |
| `GMAIL_APP_PASSWORD` | Conditional2 | — | Gmail App Password |
| `EMAIL_FROM` | No | `PACTA <noreply@pacta.duckdns.org>` | Sender display name + address |

Conditional1: Required if using Brevo (all three must be set).
Conditional2: Required if using Gmail (both must be set).

At least one provider must be fully configured.

---

## Testing & Verification

### Manual Test Plan

**Test 1: Brevo works**
1. Set Brevo env vars correctly
2. Keep Gmail vars unset
3. Trigger verification email
4. Expected: log shows "sending via Brevo", email arrives
5. Gmail not touched

**Test 2: Brevo fails → Gmail fallback**
1. Set both Brevo and Gmail env vars
2. Intentionally break Brevo (wrong password or block port 587)
3. Trigger verification email
4. Expected: log shows Brevo failure message, then "sending via Gmail", email arrives via Gmail
5. Confirm fallback logged

**Test 3: Both fail**
1. Set both providers but use invalid credentials for both
2. Trigger verification email
3. Expected: log shows Brevo failure, then Gmail failure, user receives error message
4. API returns 500 with "failed to send verification email"

**Test 4: Brevo unconfigured → Gmail-only**
1. Unset all `SMTP_*` vars
2. Set Gmail vars correctly
3. Trigger verification email
4. Expected: no Brevo attempt, directly uses Gmail, email arrives

**Test 5: Neither configured**
1. Unset all SMTP and Gmail vars
2. Start app
3. Trigger verification email
4. Expected: log shows "no SMTP configuration found", user receives "email service not configured" error
5. API returns 500

### Edge Cases

- **Timeout**: Both clients use 30s timeout (`mail.WithTimeout(30*time.Second)`)
- **Context cancellation**: Uses `DialAndSendWithContext` — respects request timeout
- **Concurrent sends**: Each call creates independent client → safe for concurrent use
- **Large attachment**: Not currently supported by templates, but go-mail handles it

---

## Implementation Files

| File | Changes |
|------|---------|
| `internal/email/sendmail.go` | Replace `getMailClient()` with `sendWithBrevo()`, `sendWithGmail()`, `sendEmailWithFallback()` |
| `docs/EMAIL-CONFIGURATION.md` | New doc (rename + update RESEND-CONFIGURATION.md) |

**No changes:** `internal/email/templates.go`, `internal/handlers/auth.go`

---

## Deliverables

1. ✅ `internal/email/sendmail.go` with Brevo-first + Gmail fallback
2. ✅ `docs/EMAIL-CONFIGURATION.md` covering:
   - Provider overview (Brevo primary, Gmail fallback)
   - How to get Brevo SMTP key (dashboard navigation)
   - How to get Gmail App Password (Google Account → Security → 2-Step Verification → App Passwords)
   - Configuration for Linux systemd (3 options), Windows (3 options), dev `.env`
   - Environment variables table
   - Testing steps
   - Troubleshooting (deliverability, auth failures, config errors)
   - Security notes (don't commit secrets, rotate keys)
3. ✅ Manual test plan as documented above

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gmail rate limits (500/day) | Fallback unusable if Gmail hits quota | Monitor logs for "Gmail fallback" frequency; if frequent, investigate Brevo health |
| Brevo SMTP key compromised | Security → spam from account | Store in environment/systemd, not in code; rotate if exposed |
| Both providers down simultaneously | Email completely unavailable | Monitor logs; alerts on consecutive failures; consider adding third provider if critical |
| STARTTLS required but using opportunistic | Delivery to spam/failed | Use `TLSMandatory` — both providers require TLS on port 587 |

---

## Open Questions

None. All decisions made based on user answers during brainstorming.

---

## Next Steps

1. Invoke `writing-plans` skill to create implementation task list
2. Edit `internal/email/sendmail.go`
3. Rename and update `docs/RESEND-CONFIGURATION.md` → `docs/EMAIL-CONFIGURATION.md`
4. Manual testing per test plan above
5. Git commit: `refactor(email): add Brevo SMTP with Gmail fallback`
