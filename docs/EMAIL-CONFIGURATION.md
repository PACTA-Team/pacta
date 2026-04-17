# Email Service — Brevo Primary + Gmail Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor PACTA's email service to use Brevo SMTP as primary with automatic Gmail fallback for reliable transactional email delivery.

**Architecture:** Replace single `getMailClient()` with three functions: `sendWithBrevo()` (primary), `sendWithGmail()` (fallback), and `sendEmailWithFallback()` (orchestrator). Both providers use port 587 with mandatory TLS. Brevo attempted first if its three env vars are set; otherwise skip directly to Gmail.

**Tech Stack:** Go 1.21+, go-mail v0.7.2, chi router, SQLite, systemd (Linux)

---

## Task 1: Rename and update email configuration documentation

**Files:**
- Modify: `docs/RESEND-CONFIGURATION.md` → rename to `docs/EMAIL-CONFIGURATION.md`
- Delete old file after rename

**Step 1.1:** Rename the file

```bash
cd /home/mowgli/pacta
git mv docs/RESEND-CONFIGURATION.md docs/EMAIL-CONFIGURATION.md
```

Verify: `ls docs/EMAIL-CONFIGURATION.md` should exist.

**Step 1.2:** Rewrite the entire document with new content

Replace all content in `docs/EMAIL-CONFIGURATION.md` with the following (copy-paste exactly):

```markdown
# Email Configuration — Brevo Primary with Gmail Fallback

## Overview

PACTA sends transactional emails via SMTP using one of two configured providers:

- **Brevo** (primary) — `smtp-relay.brevo.com:587`
- **Gmail** (automatic fallback) — `smtp.gmail.com:587`

If Brevo is configured and succeeds, it's used. If Brevo fails (connection, authentication, or send error), PACTA automatically retries with Gmail. Gmail is always used if Brevo is not configured.

Emails sent:
- **User registration verification** — 6-digit OTP, expires in 5 minutes
- **Admin notifications** — Notifies admin when a user registers via approval mode

---

## Prerequisites

### Option A — Brevo (Primary)

1. Create a free account at [brevo.com](https://www.brevo.com)
2. In dashboard: **SMTP & API** → **SMTP** tab
3. Generate an SMTP key (not your account password)
4. Copy: `SMTP Host = smtp-relay.brevo.com`, `Port = 587`
5. Save the SMTP key securely

### Option B — Gmail (Fallback or standalone)

1. Sign in to [Google Account](https://myaccount.google.com) as `pactateam@gmail.com`
2. Enable **2-Step Verification** (required for App Passwords)
3. Go to **Security** → **App Passwords**
4. Generate a new app password for "Mail" / "Other (Custom)" → name it "PACTA Server"
5. Copy the 16-character App Password (no spaces)

---

## Configuration

### Linux (systemd service)

#### Option 1: Environment file (recommended)

Create `/etc/pacta/environment`:

```ini
# Brevo — optional (if set, used as primary)
SMTP_HOST=smtp-relay.brevo.com
SMTP_USER=your_brevo_login_email@example.com
SMTP_PASS=your_brevo_smtp_key_here

# Gmail — required if Brevo not set, optional if Brevo works
GMAIL_USER=pactateam@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password

# Sender address (display name + email)
EMAIL_FROM=PACTA <pactateam@gmail.com>
```

Edit systemd service to load it:

```bash
sudo systemctl edit pacta
```

Add:
```ini
[Service]
EnvironmentFile=/etc/pacta/environment
```

Reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart pacta
```

#### Option 2: Direct environment variables in systemd

```bash
sudo systemctl edit pacta
```

Add:
```ini
[Service]
Environment="SMTP_HOST=smtp-relay.brevo.com"
Environment="SMTP_USER=your_brevo_login_email@example.com"
Environment="SMTP_PASS=your_brevo_smtp_key_here"
Environment="GMAIL_USER=pactateam@gmail.com"
Environment="GMAIL_APP_PASSWORD=your_16_char_app_password"
Environment="EMAIL_FROM=PACTA <pactateam@gmail.com>"
```

Reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart pacta
```

#### Option 3: Shell export (temporary, current session only)

```bash
export SMTP_HOST=smtp-relay.brevo.com
export SMTP_USER=your_brevo_login_email@example.com
export SMTP_PASS=your_brevo_smtp_key_here
export GMAIL_USER=pactateam@gmail.com
export GMAIL_APP_PASSWORD=your_16_char_app_password
export EMAIL_FROM="PACTA <pactateam@gmail.com>"
./pacta
```

### Windows

#### Option 1: System environment variables

1. Open **System Properties** → **Advanced** → **Environment Variables**
2. Under **System variables**, click **New**
3. Add Brevo vars (or skip if only using Gmail):
   - `SMTP_HOST` → `smtp-relay.brevo.com`
   - `SMTP_USER` → your Brevo login email
   - `SMTP_PASS` → your Brevo SMTP key
4. Add Gmail vars:
   - `GMAIL_USER` → `pactateam@gmail.com`
   - `GMAIL_APP_PASSWORD` → your 16-character app password
5. Add `EMAIL_FROM` → `PACTA <pactateam@gmail.com>`
6. Restart PACTA

#### Option 2: Command Prompt (temporary)

```cmd
set SMTP_HOST=smtp-relay.brevo.com
set SMTP_USER=your_brevo_login_email@example.com
set SMTP_PASS=your_brevo_smtp_key_here
set GMAIL_USER=pactateam@gmail.com
set GMAIL_APP_PASSWORD=your_16_char_app_password
set EMAIL_FROM="PACTA <pactateam@gmail.com>"
pacta.exe
```

#### Option 3: PowerShell (temporary)

```powershell
$env:SMTP_HOST="smtp-relay.brevo.com"
$env:SMTP_USER="your_brevo_login_email@example.com"
$env:SMTP_PASS="your_brevo_smtp_key_here"
$env:GMAIL_USER="pactateam@gmail.com"
$env:GMAIL_APP_PASSWORD="your_16_char_app_password"
$env:EMAIL_FROM="PACTA <pactateam@gmail.com>"
.\pacta.exe
```

### Development (local frontend + backend)

Create a `.env` file in `pacta_appweb/` for local dev scripts (the Go backend reads from process environment, not from `.env` — your IDE or shell must set them before running the binary):

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_USER=your_brevo_login_email@example.com
SMTP_PASS=your_brevo_smtp_key_here
GMAIL_USER=pactateam@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password
EMAIL_FROM="PACTA <pactateam@gmail.com>"
```

Or export in terminal before running:

```bash
export SMTP_HOST=smtp-relay.brevo.com
export SMTP_USER=your_brevo_login_email@example.com
export SMTP_PASS=your_brevo_smtp_key_here
export GMAIL_USER=pactateam@gmail.com
export GMAIL_APP_PASSWORD=your_16_char_app_password
export EMAIL_FROM="PACTA <pactateam@gmail.com>"
go run ./cmd/pacta
```

---

## Environment Variables

| Variable | Required? | Default | Description |
|----------|-----------|---------|-------------|
| `SMTP_HOST` | Conditional | `localhost` | Brevo SMTP host (should be `smtp-relay.brevo.com`) |
| `SMTP_USER` | Conditional | — | Brevo login email address |
| `SMTP_PASS` | Conditional | — | Brevo SMTP key (from SMTP & API tab) |
| `GMAIL_USER` | Conditional | — | Gmail address (e.g., `pactateam@gmail.com`) |
| `GMAIL_APP_PASSWORD` | Conditional | — | Gmail App Password (16 chars, no spaces) |
| `EMAIL_FROM` | No | `PACTA <noreply@pacta.duckdns.org>` | Sender display name and email |

> **Conditional rules:** At least one provider must be fully configured.
> - Brevo is considered "configured" only if `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are **all** non-empty.
> - Gmail is considered "configured" only if `GMAIL_USER` and `GMAIL_APP_PASSWORD` are **both** non-empty.
> - If Brevo is configured, it's tried first. On any failure, Gmail is automatically used as fallback.
> - If Brevo is not configured, Gmail is used directly.

---

## Verification

### Check startup logs

When PACTA starts, check logs for email configuration status:

```
[email] email service initialized — primary: Brevo (smtp-relay.brevo.com:587), fallback: Gmail (smtp.gmail.com:587)
```

If no configuration:
```
[email] WARNING: no SMTP configuration found — email sending disabled
```

### Test Brevo delivery

1. Ensure only Brevo vars are set (unset Gmail vars to test pure Brevo path)
2. Register a new user with **Email verification** mode
3. Check inbox for 6-digit code
4. Logs should show:
   ```
   [email] sending via Brevo (smtp-relay.brevo.com:587)
   [email] verification code sent to user@example.com (en)
   ```

### Test Gmail fallback

1. Set both Brevo and Gmail credentials
2. Intentionally break Brevo (wrong password or block outbound port 587 to `smtp-relay.brevo.com`)
3. Register a new user
4. Check inbox — email should arrive via Gmail
5. Logs should show:
   ```
   [email] sending via Brevo (smtp-relay.brevo.com:587)
   [email] Brevo send failed: <error>. Falling back to Gmail…
   [email] sending via Gmail fallback (smtp.gmail.com:587)
   [email] verification code sent to user@example.com (en)
   ```

### Test Gmail-only (Brevo unset)

1. Unset all `SMTP_*` variables
2. Keep only `GMAIL_USER` and `GMAIL_APP_PASSWORD` set
3. Register a new user
4. Logs should show:
   ```
   [email] Brevo not configured, using Gmail directly
   [email] sending via Gmail fallback (smtp.gmail.com:587)
   [email] verification code sent to user@example.com (en)
   ```

### Test both fail

1. Set both providers with invalid credentials
2. Register a new user
3. API should return HTTP 500: "failed to send verification email"
4. Logs should show both failures
5. User sees: "failed to send verification email. Please try again or contact support."

---

## Troubleshooting

### "no SMTP configuration found" in logs

**Cause:** Neither Brevo nor Gmail credentials are set in the process environment.

**Fix:**
- Verify env vars are set in the systemd service or shell where PACTA runs
- For systemd: `systemctl show pacta --property=Environment` to see current environment
- Run `env | grep -E "SMTP|GMAIL|EMAIL_FROM"` to check current process
- Ensure you reloaded systemd daemon after editing: `sudo systemctl daemon-reload`

### Brevo authentication failed

**Cause:** Invalid `SMTP_USER` or `SMTP_PASS`.

**Fix:**
- Verify SMTP key from Brevo dashboard (not your account password)
- Check that the key has not expired or been revoked
- Ensure no extra spaces in env var values
- Test credentials with `openssl s_client -starttls smtp -connect smtp-relay.brevo.com:587`

### Gmail authentication failed

**Cause:** Invalid `GMAIL_APP_PASSWORD` or 2-Step Verification not enabled.

**Fix:**
- Confirm 2-Step Verification is ON for `pactateam@gmail.com`
- Generate a fresh App Password (each password is single-use, 16 chars)
- Copy exact 16-character string (no spaces, no dashes)
- Use `GMAIL_USER=pactateam@gmail.com` exactly
- Ensure no typos or trailing spaces

### Emails not arriving (but send logs say success)

**Cause:** Deliverability / spam filtering.

**Fix:**
- Check spam folder
- Verify `EMAIL_FROM` domain matches authenticated domain (Gmail may flag mismatched senders)
- For Brevo: ensure sender domain is verified in Brevo dashboard if using custom domain
- Consider using a consistent `EMAIL_FROM` across both providers
- Check Brevo dashboard → Email Activity for sent/delivered/bounced stats

### Gmail fallback not triggering

**Cause:** Brevo credentials work but emails land in spam.

**Fix:**
- Fallback only triggers on **send errors**, not on deliverability issues (spam folder)
- If Brevo accepts the email but it goes to spam, Gmail won't be tried
- To force Gmail: temporarily unset Brevo credentials or fix Brevo deliverability

### Rate limits

**Brevo:** Free tier: 300 emails/day. Paid: higher limits.
**Gmail:** 500 emails/day (per account).

If you see immediate failures after many sends, you may have hit a rate limit. Wait 24h for Gmail reset. For Brevo, check your plan in Brevo dashboard.

---

## Security Notes

- **Never commit** credentials to version control
- Use `.gitignore` for any local `.env` files
- Store secrets in environment variables or secret managers (Vault, AWS Secrets Manager, etc.)
- For systemd: environment file permissions should be `600` (readable only by root)
- Rotate SMTP keys and App Passwords periodically or if exposed
- Consider audit logging of email send attempts (who, when, to whom)

---

## Technical Notes

- Port: 587 (STARTTLS)
- TLS policy: `mail.TLSMandatory` — TLS required
- Authentication: `mail.SMTPAuthPlain` (username + password)
- Connection reuse: Not used — a new client is created per email send (acceptable for transactional volume)
- Timeout: 30 seconds per provider
- Context: Uses request context with 30s timeout — respects graceful shutdowns
