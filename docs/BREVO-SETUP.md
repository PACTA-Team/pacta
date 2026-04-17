# Brevo SMTP Configuration — Step by Step

> This guide covers Brevo SMTP setup for PACTA's transactional email service. Brevo is used as the primary SMTP provider with automatic Gmail fallback.

---

## Overview

PACTA uses Brevo's SMTP relay (`smtp-relay.brevo.com:587`) as the primary email provider. If Brevo fails for any reason, PACTA automatically falls back to Gmail.

**Emails sent:**
- User registration verification (6-digit OTP)
- Admin notifications (new user registrations in approval mode)

---

## Prerequisites

- A Brevo account (free tier works: 300 emails/day)
- Access to `pactateam@gmail.com` (for sender verification and fallback)
- Gmail 2-Step Verification enabled (for fallback App Password)

---

## Step 1 — Create a Brevo Account

1. Go to [brevo.com](https://www.brevo.com) and sign up
2. Use any email address (it doesn't have to be `pactateam@gmail.com`)
3. Complete the registration process and verify your email

---

## Step 2 — Activate the Transactional Platform

If the transactional platform is not activated on your account, you won't be able to send emails.

**What to do:**

1. **New accounts:** The transactional platform is usually activated automatically. Wait a few minutes after registration.
2. **If you see the error** `"SMTP account is not yet activated"` when testing:
   - Contact Brevo support via the chat in your dashboard
   - Request activation of the **Transactional Email (SMTP)** feature
   - [Brevo Help Article](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-issues-with-Brevo-SMTP)

---

## Step 3 — Generate Your SMTP Key

The SMTP Key is your password for SMTP authentication — **not** your account password, and **not** an API key.

1. Log in to your Brevo dashboard
2. Click your account menu (top-right) → **Settings**
3. Go to the **SMTP & API** tab
4. Click the **SMTP** sub-tab
5. You'll see:
   - **SMTP Host:** `smtp-relay.brevo.com` (pre-filled)
   - **SMTP Login:** Your Brevo account email (read-only)
6. Click **Generate** to create a new SMTP Key
7. **Copy the key immediately** — it's shown only once
8. Save it securely (password manager, vault, etc.)

> ⚠️ **Important:** The SMTP Key is what you'll use as `SMTP_PASS` in PACTA's environment variables.

[Brevo Help: Create and manage SMTP keys](https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys)

---

## Step 4 — Verify the Sender Email (`pactateam@gmail.com`)

Brevo requires sender address verification. When you add a new "From" address, Brevo sends a confirmation email that must be clicked before you can use it.

1. In your Brevo dashboard, go to **Senders & Domains**
2. Click **Add a Sender**
3. Enter:
   - **Sender name:** `PACTA`
   - **Email address:** `pactateam@gmail.com`
4. Click **Add**
5. Check your Gmail inbox for a verification email from Brevo
6. Click the verification link inside the email

> ✅ After clicking the link, `pactateam@gmail.com` is verified and ready to use as the `EMAIL_FROM` address.

---

## Step 5 — Configure PACTA Environment Variables

Once you have:
- ✅ Brevo SMTP Key (`SMTP_PASS`)
- ✅ Your Brevo login email (`SMTP_USER`)
- ✅ Verified `pactateam@gmail.com` as sender

Set these environment variables on your PACTA server:

### Linux (systemd)

Create `/etc/pacta/environment`:

```ini
# Brevo — Primary SMTP
SMTP_HOST=smtp-relay.brevo.com
SMTP_USER=your_brevo_login_email@example.com
SMTP_PASS=your_smtp_key_here

# Gmail — Fallback (required for fallback path)
GMAIL_USER=pactateam@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password_here

# Sender address
EMAIL_FROM=PACTA <pactateam@gmail.com>
```

Then configure systemd to load it:

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

### Development (local)

Set environment variables in your shell before running:

```bash
export SMTP_HOST=smtp-relay.brevo.com
export SMTP_USER=your_brevo_login_email@example.com
export SMTP_PASS=your_smtp_key_here
export GMAIL_USER=pactateam@gmail.com
export GMAIL_APP_PASSWORD=your_gmail_app_password_here
export EMAIL_FROM="PACTA <pactateam@gmail.com>"
go run ./cmd/pacta
```

Or use a `.env` file (if your launcher/IDE loads it):

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_USER=your_brevo_login_email@example.com
SMTP_PASS=your_smtp_key_here
GMAIL_USER=pactateam@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password_here
EMAIL_FROM="PACTA <pactateam@gmail.com>"
```

---

## Step 6 — Verify Connectivity from Your VPS/Server

Before testing PACTA, ensure your server can reach Brevo's SMTP server:

```bash
# Test port 587 connectivity
nc -zv smtp-relay.brevo.com 587
```

Expected output:
```
Connection to smtp-relay.brevo.com 587 port [tcp/submission] succeeded!
```

If it fails:
- Check outbound firewall rules (port 587 must be open)
- Verify network connectivity
- Some cloud providers block SMTP by default — check your provider's policy

---

## Step 7 — Test Email Delivery

1. Ensure all environment variables are set (check with `env | grep -E "SMTP|GMAIL|EMAIL_FROM"`)
2. Restart the PACTA service if running as a daemon
3. Trigger a verification email:
   - Register a new user with email verification enabled
   - Or use the API: `POST /api/register` with `{"email": "test@example.com", ...}`
4. Check PACTA logs:

```bash
# If running as systemd service
sudo journalctl -u pacta -f

# Look for lines like:
[email] sending via Brevo (smtp-relay.brevo.com:587)
[email] email sent via Brevo
# or on failure:
[email] Brevo send failed: <error>. Falling back to Gmail…
[email] sending via Gmail fallback (smtp.gmail.com:587)
[email] email sent via Gmail fallback
```

5. Check the recipient inbox (and spam folder)

---

## Troubleshooting

### "SMTP account is not yet activated"

**Cause:** Brevo transactional email feature not enabled on your account.

**Fix:**
- Contact Brevo support via dashboard chat
- Request activation of SMTP relay for your account
- Waíta few minutes and retry

### "authentication failed" or "invalid credentials"

**Cause:** Wrong `SMTP_USER` or `SMTP_PASS`.

**Fix:**
- Verify you're using the **SMTP Key** (from Settings → SMTP & API → SMTP tab), not your account password
- Copy the key exactly as shown (no extra spaces)
- `SMTP_USER` must be your Brevo login email (the one you signed up with)

### "connection refused" or timeout

**Cause:** Network/firewall blocking port 587.

**Fix:**
- Run `nc -zv smtp-relay.brevo.com 587` to test connectivity
- Open outbound port 587 in your firewall/security group
- Check with your VPS provider if they block SMTP (some do by default)

### Email not arriving (logs say "sent")

**Cause:** Deliverability issues (spam folder, domain reputation, etc.)

**Fix:**
- Check spam folder
- Ensure `EMAIL_FROM` domain matches authenticated domain (Gmail may flag mismatched senders)
- Verify `pactateam@gmail.com` is verified in Brevo dashboard
- Check Brevo → Email Activity for delivery stats (bounced, blocked, etc.)

### Gmail fallback not triggering

**Cause:** Brevo succeeds but email goes to spam; fallback only triggers on **send errors**, not deliverability issues.

**Fix:**
- To force Gmail for testing, temporarily unset Brevo credentials or intentionally break them
- Improve Brevo deliverability: verify sender, warm up IP, check blacklists

---

## Environment Variables Summary

| Variable | Required? | Where to get it |
|----------|-----------|-----------------|
| `SMTP_HOST` | Conditional* | Use `smtp-relay.brevo.com` |
| `SMTP_USER` | Conditional* | Your Brevo account email (login) |
| `SMTP_PASS` | Conditional* | SMTP Key from Brevo Settings → SMTP & API |
| `GMAIL_USER` | Conditional** | `pactateam@gmail.com` |
| `GMAIL_APP_PASSWORD` | Conditional** | Gmail App Password (16 chars) |
| `EMAIL_FROM` | No (recommended) | `PACTA <pactateam@gmail.com>` |

> *Brevo is "configured" only if `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are **all** non-empty.
> **Gmail is "configured" only if `GMAIL_USER` and `GMAIL_APP_PASSWORD` are **both** non-empty.
> - If Brevo is configured: tried first; on **any error** → fallback to Gmail
> - If Brevo not configured: Gmail used directly
> - At least one provider must be fully configured for email to work

---

## References

- [Brevo SMTP Documentation](https://developers.brevo.com/docs/smtp-integration)
- [Brevo SMTP Troubleshooting](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-issues-with-Brevo-SMTP)
- [Brevo SMTP Key Management](https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys)
- [PACTA Email Configuration (full)](./EMAIL-CONFIGURATION.md)
