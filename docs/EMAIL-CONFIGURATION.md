# Email Configuration — Mailtrap SMTP

## Overview

PACTA sends transactional emails via SMTP using a single configured SMTP server. By default in development, it uses **Mailtrap** (an email testing sandbox) to capture outgoing messages without delivering them to real inboxes. In production, configure any SMTP provider (e.g., Postmark, SendGrid, AWS SES, your own mail server).

Emails sent:
- **Password reset** — Secure token link (1 hour expiry)
- **Email verification** — 6-digit OTP (5 minute expiry)
- **Contract expiry notifications** — Alerts for contracts approaching expiry
- **Admin notifications** — New user registrations requiring approval
- **Report notifications** — Generated PDF reports ready for download

---

## Prerequisites

### Development: Mailtrap (recommended)

1. Create a free account at [mailtrap.io](https://mailtrap.io)
2. Create a new **Inbox** (default is fine)
3. Go to **SMTP Settings** tab
4. Copy the credentials:
   - **SMTP Host** (e.g., `sandbox...mailtrap.io`)
   - **SMTP Port** (usually `2525`, also `587` or `465` available)
   - **Username** (e.g., `...`)
   - **Password** (e.g., `...`)

These credentials capture all outgoing emails in the Mailtrap inbox UI — perfect for development and QA.

### Production: Any SMTP Provider

Choose your provider and gather:
- SMTP host (e.g., `smtp.postmarkapp.com`, `smtp.sendgrid.net`)
- SMTP port (usually `587` for TLS, or `465` for SSL)
- Username (often an API key or account email)
- Password (API key or app password)
- Sender email address (must be verified with your provider)

---

## Configuration

### Linux (systemd service)

#### Option 1: Environment file (recommended)

Create `/etc/pacta/environment`:

```ini
# Mailtrap SMTP (development) or production SMTP
EMAIL_SMTP_HOST=your_smtp_host
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USERNAME=your_smtp_username
EMAIL_SMTP_PASSWORD=your_smtp_password

# Sender address (display name + email)
EMAIL_FROM=PACTA <noreply@pacta.duckdns.org>
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
Environment="EMAIL_SMTP_HOST=your_smtp_host"
Environment="EMAIL_SMTP_PORT=587"
Environment="EMAIL_SMTP_USERNAME=your_smtp_username"
Environment="EMAIL_SMTP_PASSWORD=your_smtp_password"
Environment="EMAIL_FROM=PACTA <noreply@pacta.duckdns.org>"
```

Reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart pacta
```

#### Option 3: Shell export (temporary, current session only)

```bash
export EMAIL_SMTP_HOST=your_smtp_host
export EMAIL_SMTP_PORT=587
export EMAIL_SMTP_USERNAME=your_smtp_username
export EMAIL_SMTP_PASSWORD=your_smtp_password
export EMAIL_FROM="PACTA <noreply@pacta.duckdns.org>"
./pacta
```

### Windows

#### Option 1: System environment variables

1. Open **System Properties** → **Advanced** → **Environment Variables**
2. Under **System variables**, click **New**
3. Add SMTP variables:
   - `EMAIL_SMTP_HOST` → your SMTP host
   - `EMAIL_SMTP_PORT` → `587`
   - `EMAIL_SMTP_USERNAME` → your SMTP username
   - `EMAIL_SMTP_PASSWORD` → your SMTP password or API key
4. Add `EMAIL_FROM` → `PACTA <noreply@pacta.duckdns.org>`
5. Restart PACTA

#### Option 2: Command Prompt (temporary)

```cmd
set EMAIL_SMTP_HOST=your_smtp_host
set EMAIL_SMTP_PORT=587
set EMAIL_SMTP_USERNAME=your_smtp_username
set EMAIL_SMTP_PASSWORD=your_smtp_password
set EMAIL_FROM="PACTA <noreply@pacta.duckdns.org>"
pacta.exe
```

#### Option 3: PowerShell (temporary)

```powershell
$env:EMAIL_SMTP_HOST="your_smtp_host"
$env:EMAIL_SMTP_PORT=587
$env:EMAIL_SMTP_USERNAME="your_smtp_username"
$env:EMAIL_SMTP_PASSWORD="your_smtp_password"
$env:EMAIL_FROM="PACTA <noreply@pacta.duckdns.org>"
.\pacta.exe
```

### Development (local frontend + backend)

Create a `.env` file in `pacta_appweb/` for local dev scripts. The Go backend reads from process environment, not from `.env` — your IDE or shell must set them before running the binary:

```env
EMAIL_SMTP_HOST=sandbox.smtp.mailtrap.io
EMAIL_SMTP_PORT=2525
EMAIL_SMTP_USERNAME=your_mailtrap_username
EMAIL_SMTP_PASSWORD=your_mailtrap_password
EMAIL_FROM="PACTA <noreply@localhost.localdomain>"
```

Or export in terminal before running:

```bash
export EMAIL_SMTP_HOST=sandbox.smtp.mailtrap.io
export EMAIL_SMTP_PORT=2525
export EMAIL_SMTP_USERNAME=your_mailtrap_username
export EMAIL_SMTP_PASSWORD=your_mailtrap_password
export EMAIL_FROM="PACTA <noreply@localhost.localdomain>"
go run ./cmd/pacta
```

---

## Environment Variables

| Variable | Required? | Default | Description |
|----------|-----------|---------|-------------|
| `EMAIL_SMTP_HOST` | Yes | `localhost` | SMTP server hostname |
| `EMAIL_SMTP_PORT` | No | `587` | SMTP port (587 for TLS, 465 for SSL, 2525 for Mailtrap) |
| `EMAIL_SMTP_USERNAME` | No | — | SMTP username (Mailtrap username or provider API key) |
| `EMAIL_SMTP_PASSWORD` | No | — | SMTP password or API key |
| `EMAIL_FROM` | No | `PACTA <noreply@pacta.duckdns.org>` | Sender display name and email address |

> **Note:** All four SMTP variables are typically set together. If `EMAIL_SMTP_HOST` is not set, email sending is disabled and a warning is logged at startup.

---

## Verification

### Check startup logs

When PACTA starts, check logs for email configuration status:

```
[email] email service initialized — SMTP: your_smtp_host:587
[email] sender: PACTA <noreply@pacta.duckdns.org>
```

If no configuration:
```
[email] WARNING: no SMTP configuration found — email sending disabled
```

### Test password reset flow

1. Ensure SMTP credentials are set
2. Go to login page → click "Forgot password?"
3. Enter your registered email
4. Check Mailtrap inbox (or real inbox in production) for reset email
5. Click the link and set a new password
6. Log in with the new password

Expected logs:
```
[email] sending password reset email to user@example.com
[email] password reset token generated for user_id=123
```

### Test email verification (registration)

1. Register a new user with email verification enabled
2. Check inbox for 6-digit verification code
3. Enter code in the app

Expected logs:
```
[email] sending verification code to user@example.com
```

### Test failure

Intentionally use invalid SMTP credentials, restart PACTA, and attempt a password reset. Logs should show:

```
[email] SMTP send failed: 535 Authentication failed
[email] failed to send email to user@example.com: authentication error
```

The user sees: "Unable to send email. Please check server configuration."

---

## Troubleshooting

### "no SMTP configuration found" in logs

**Cause:** `EMAIL_SMTP_HOST` (or other SMTP vars) are not set in the process environment.

**Fix:**
- Verify env vars are set in the systemd service or shell where PACTA runs
- For systemd: `systemctl show pacta --property=Environment` to see current environment
- Run `env | grep EMAIL_SMTP` to check current process
- Ensure you reloaded systemd daemon after editing: `sudo systemctl daemon-reload`

### SMTP authentication failed

**Cause:** Invalid `EMAIL_SMTP_USERNAME` or `EMAIL_SMTP_PASSWORD`.

**Fix:**
- Verify credentials with your SMTP provider
- For Mailtrap: check the SMTP settings tab in your inbox
- Ensure no extra spaces in env var values
- Test credentials with: `openssl s_client -starttls smtp -connect your_smtp_host:587`

### Emails not arriving (but send logs say success)

**Cause:** Deliverability / spam filtering or using Mailtrap (development sandbox).

**Fix:**
- **Mailtrap:** Check your Mailtrap inbox in the web UI — emails never leave Mailtrap
- **Production:** Check spam folder
- Verify `EMAIL_FROM` domain matches authenticated domain
- Ensure sender domain is verified in your SMTP provider dashboard
- Use a consistent `EMAIL_FROM` across both providers

### Connection timeout / refused

**Cause:** Outbound port 587 (or 2525 for Mailtrap) blocked by firewall.

**Fix:**
- Verify outbound SMTP port is open on your server/network
- Test connectivity: `telnet your_smtp_host 587`
- For cloud providers (AWS, GCP, Azure), check security group / firewall rules

### Rate limits

Mailtrap: Free tier ~500 emails/month. Production providers have daily/monthly limits. If you hit a limit, the SMTP server returns `421` or `451` errors. Upgrade plan or switch provider.

---

## Security Notes

- **Never commit** credentials to version control
- Use `.gitignore` for any local `.env` files
- Store secrets in environment variables or secret managers (systemd environment file with `600` permissions)
- Rotate SMTP passwords/API keys periodically or if exposed
- Use TLS (port 587 or 465) — never plain text SMTP
- `EMAIL_FROM` should use a domain you control and have verified with your provider

---

## Technical Notes

- Library: `github.com/wneessen/go-mail` v0.7.2
- Port: 587 (STARTTLS) or 2525 (Mailtrap)
- TLS policy: `mail.StartTLS` (opportunistic TLS) — encrypts if server supports it
- Authentication: `mail.SMTPAuthPlain` (username + password or API key as password)
- Connection reuse: Not used — a new client is created per email send (acceptable for transactional volume)
- Timeout: 30 seconds per provider
- Context: Uses request context with 30s timeout — respects graceful shutdowns
- HTML emails: Rendered via Go `text/template` with embedded template strings in binary
- Embedded templates: Compiled into the binary at build time — no external template files needed

---

## Switching Providers

To change SMTP providers (e.g., from Mailtrap to Postmark):

1. Update `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USERNAME`, `EMAIL_SMTP_PASSWORD`
2. Restart PACTA
3. Check startup logs confirm new provider
4. Test by triggering a password reset or registration

No code changes required — the configuration is entirely environment-driven.
