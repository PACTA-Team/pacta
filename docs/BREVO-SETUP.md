# Mailtrap SMTP Configuration — Step by Step

> **Note:** This document replaces the previous Brevo + Gmail setup. PACTA now uses a single SMTP provider configuration (Mailtrap recommended for development). See [docs/EMAIL-CONFIGURATION.md](EMAIL-CONFIGURATION.md) for the full configuration reference.

---

## Quick Start: Development Setup with Mailtrap

1. Sign up at [mailtrap.io](https://mailtrap.io) — free tier (500 emails/month) is sufficient.
2. Create a new **Inbox** (or use the default demo inbox).
3. Go to the **SMTP Settings** tab in your inbox.
4. Copy the credentials (host, port, username, password).
5. Set environment variables before running PACTA:

```bash
export EMAIL_SMTP_HOST=sandbox.smtp.mailtrap.io
export EMAIL_SMTP_PORT=2525
export EMAIL_SMTP_USERNAME=your_mailtrap_username
export EMAIL_SMTP_PASSWORD=your_mailtrap_password
export EMAIL_FROM="PACTA <noreply@localhost.localdomain>"
go run ./cmd/pacta
```

6. Open [Mailtrap inbox](https://mailtrap.io/inboxes) to see all outgoing emails captured.

That's it — no fallback logic, no Gmail configuration, just one simple SMTP endpoint.

---

## Production SMTP

For production, use any transactional email provider (Postmark, SendGrid, AWS SES, etc.):

```bash
export EMAIL_SMTP_HOST=smtp.postmarkapp.com
export EMAIL_SMTP_PORT=587
export EMAIL_SMTP_USERNAME=your_postmark_server_token
export EMAIL_SMTP_PASSWORD=your_postmark_server_token
export EMAIL_FROM="PACTA <noreply@yourcompany.com>"
./pacta
```

See [docs/EMAIL-CONFIGURATION.md](EMAIL-CONFIGURATION.md) for complete configuration options, systemd setup, troubleshooting, and security notes.
