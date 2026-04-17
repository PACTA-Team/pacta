# Email Settings from Database - Design

**Date:** 2026-04-17
**Status:** Approved
**Priority:** High

## Problem

1. Email configuration (Brevo API key, SMTP credentials) is loaded from `.env` environment variables, not from database
2. Admin cannot enable/disable email notifications from UI
3. No tooltips in settings page to guide admin
4. System lacks flexibility to toggle email features on/off

## Goals

1. Admin can configure all email settings from UI
2. Multiple toggle switches to enable/disable email features
3. Use fallback to `.env` for backward compatibility
4. Add tooltips for each setting field

## Solution Overview

Approach 1 (Minimal Intervention) - Fast delivery with maximum reuse of existing code.

## Database Changes

New migration to add email settings to `system_settings` table:

```sql
INSERT INTO system_settings (key, value, category) VALUES
('email_notifications_enabled', 'true', 'email'),
('email_contract_expiry_enabled', 'true', 'email'),
('smtp_enabled', 'true', 'email'),
('brevo_enabled', 'false', 'email'),
('brevo_api_key', '', 'email');
```

**Settings Category:** `email`

## Backend Changes

### 1. email/sendmail.go
- Check `smtp_enabled` setting from DB before sending
- If setting not in DB → fallback to `os.Getenv()` values
- Log warning when email is disabled

### 2. email/brevo.go
- Check `brevo_enabled` setting from DB before sending
- Read `brevo_api_key` from DB or fallback to `os.Getenv("BREVO_API_KEY")`
- Log warning when Brevo is disabled

### 3. worker/contract_expiry.go
- Check `email_notifications_enabled` before processing any notifications
- Check `email_contract_expiry_enabled` before contract expiry emails
- Skip if disabled, no error

## Frontend Changes

### 1. SettingsPage.tsx
- Add new tab "Email Services" (or integrate into SMTP tab)
- Add toggle switches for each enable setting
- Add input field for Brevo API key (password type)
- Add tooltips to all fields

### 2. settings-api.ts (already exists)
- No changes needed - already supports all CRUD operations

### 3. Translations (settings.json)
- Add tooltip text for each field

## Settings Structure

| Key | Type | Default | Tooltip |
|-----|------|---------|---------|
| email_notifications_enabled | boolean | true | Enable/disable all email notifications |
| email_contract_expiry_enabled | boolean | true | Send contract expiry notifications |
| smtp_enabled | boolean | true | Use SMTP for sending emails |
| brevo_enabled | boolean | false | Use Brevo API for sending emails |
| brevo_api_key | string | (empty) | Brevo API key (get from Brevo dashboard) |

## UI Mockup

```
Tab: Email Services
├── Email Notifications
│   ├── [Toggle] Enable Email Notifications
│   └── [Toggle] Enable Contract Expiry Notifications
├── SMTP Configuration  
│   ├── [Toggle] Enable SMTP
│   ├── [Input] SMTP Host
│   ├── [Input] SMTP User
│   ├── [Password] SMTP Password
│   └── [Input] Email From
└── Brevo Configuration
    ├── [Toggle] Enable Brevo API
    └── [Password] Brevo API Key
```

## Tooltip Texts (i18n)

```json
{
  "email_notifications_enabled": "When disabled, no email notifications will be sent",
  "email_contract_expiry_enabled": "Send contract expiry warnings to owners and admins",
  "smtp_enabled": "Use standard SMTP server for email delivery",
  "brevo_enabled": "Use Brevo transactional API (requires API key)",
  "brevo_api_key": "Get from: Dashboard → SMTP & APIs → API → Brevo API"
}
```

## Fallback Logic

Priority order for each setting:
1. **Database** (system_settings table) - highest priority
2. **Environment (.env)** - fallback for backward compatibility
3. **Hardcoded default** - final fallback

If admin sets empty value in DB → uses fallback value

## Testing Checklist

- [ ] Toggle off email_notifications → verify no emails sent
- [ ] Toggle off email_contract_expiry → verify only that type is disabled
- [ ] Toggle off smtp_enabled → verify SMTP emails stop
- [ ] Toggle on brevo_enabled with valid key → verify Brevo sends
- [ ] Toggle on brevo_enabled with empty key → verify fallback to .env works
- [ ] Toggle all off → verify system still runs (no crashes)

## Files to Modify

1. `internal/db/migrations/027_email_settings.sql` (new)
2. `internal/email/sendmail.go` (add DB check)
3. `internal/email/brevo.go` (add DB check)  
4. `internal/worker/contract_expiry.go` (add checks)
5. `pacta_appweb/src/pages/SettingsPage.tsx` (add toggles)
6. `pacta_appweb/public/locales/en/settings.json` (add tooltips)
7. `pacta_appweb/public/locales/es/settings.json` (add tooltips)

## Notes

- Keep backward compatibility with existing .env configuration
- Admin enters values manually via UI (no auto-import)
- High priority → aim for fast delivery