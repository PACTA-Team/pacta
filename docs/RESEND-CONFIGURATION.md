# Resend Email Configuration

## Overview

PACTA uses [Resend](https://resend.com) for sending transactional emails, including:
- **User registration verification** — 6-digit codes with 5-minute expiration
- **Admin notifications** — Alerts when new users register via admin approval mode

## Prerequisites

1. Create a free account at [resend.com](https://resend.com)
2. Verify your sending domain (or use the default `onboarding@resend.dev` for testing)
3. Generate an API key from [resend.com/api-keys](https://resend.com/api-keys)

## Configuration

### Linux (systemd service)

#### Option 1: Environment file (recommended)

Create `/etc/pacta/environment`:

```ini
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=PACTA <onboarding@resend.dev>
```

Then edit the systemd service to load it:

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

#### Option 2: Direct environment variable

```bash
sudo systemctl edit pacta
```

Add:
```ini
[Service]
Environment="RESEND_API_KEY=re_your_api_key_here"
Environment="EMAIL_FROM=PACTA <onboarding@resend.dev>"
```

Reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart pacta
```

#### Option 3: Shell export (temporary, current session only)

```bash
export RESEND_API_KEY="re_your_api_key_here"
export EMAIL_FROM="PACTA <onboarding@resend.dev>"
./pacta
```

### Windows

#### Option 1: System environment variables

1. Open **System Properties** → **Advanced** → **Environment Variables**
2. Under **System variables**, click **New**
3. Add:
   - Variable name: `RESEND_API_KEY`
   - Variable value: `re_your_api_key_here`
4. Repeat for `EMAIL_FROM` (optional):
   - Variable name: `EMAIL_FROM`
   - Variable value: `PACTA <onboarding@resend.dev>`
5. Restart PACTA

#### Option 2: Command prompt (temporary, current session only)

```cmd
set RESEND_API_KEY=re_your_api_key_here
set EMAIL_FROM=PACTA <onboarding@resend.dev>
pacta.exe
```

#### Option 3: PowerShell (temporary, current session only)

```powershell
$env:RESEND_API_KEY="re_your_api_key_here"
$env:EMAIL_FROM="PACTA <onboarding@resend.dev>"
.\pacta.exe
```

### Development (local frontend + backend)

Create a `.env` file in `pacta_appweb/`:

```env
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=PACTA <onboarding@resend.dev>
```

> **Note:** The backend reads `RESEND_API_KEY` from the process environment, not from `.env` files. Use your shell or IDE to set it before running the Go binary.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | Yes | _(none)_ | Your Resend API key (starts with `re_`) |
| `EMAIL_FROM` | No | `PACTA <onboarding@resend.dev>` | Sender email address |

## Verification

After configuring, check the application logs on startup:

```
[email] RESEND_API_KEY not set, email features disabled
```

If you **don't** see this message, the email service is configured correctly.

To test email sending, register a new user with "Email verification" mode and check if the verification code arrives.

## Troubleshooting

### "Email not sent" in logs
- Verify your API key is correct (starts with `re_`)
- Check that your domain is verified in Resend dashboard
- Ensure you have remaining email quota in your Resend plan

### Emails not arriving
- Check spam folder
- For `onboarding@resend.dev` (test domain), emails may take up to 5 minutes
- Verify the recipient email address is correct

### "RESEND_API_KEY not set" warning
- The variable is not in the process environment of the running binary
- For systemd: verify `EnvironmentFile` path or `Environment` directive
- For manual: run `echo $RESEND_API_KEY` before starting the binary

## Security

- **Never commit** `RESEND_API_KEY` to version control
- **Never share** your API key publicly
- Use `.gitignore` to exclude `.env` files
- Rotate your API key if exposed
- Consider using a secrets manager for production deployments
