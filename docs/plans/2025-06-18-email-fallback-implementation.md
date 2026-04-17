# Email Service — Brevo Primary + Gmail Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor PACTA's email service to use Brevo SMTP as primary with automatic Gmail fallback for reliable transactional email delivery.

**Architecture:** Replace single `getMailClient()` with three functions: `sendWithBrevo()` (primary), `sendWithGmail()` (fallback), and `sendEmailWithFallback()` (orchestrator). Both providers use port 587 with mandatory TLS. Brevo attempted first if its three env vars are set; otherwise skip directly to Gmail.

**Tech Stack:** Go 1.21+, go-mail v0.7.2, chi router, SQLite, systemd (Linux)

---

## Task 1: Rename and update email configuration documentation (DONE)

**Status:** ✅ Completed
- File renamed: `docs/RESEND-CONFIGURATION.md` → `docs/EMAIL-CONFIGURATION.md`
- Content fully rewritten to cover both Brevo and Gmail providers
- All three Linux systemd options, Windows options, dev `.env` documented
- Environment variable table, testing steps, troubleshooting included

**Verification:**
- `git status` shows new file staged, old file deleted
- Content reviewed and matches design spec

---

## Task 2: Refactor internal/email/sendmail.go — create sendWithBrevo()

**Files:**
- Create: `internal/email/sendmail.go` — replace `getMailClient()` with new provider-specific send functions

**Step 2.1:** Remove `getMailClient()` function and add `sendWithBrevo()` skeleton

Read the current file to understand structure, then replace lines 12-37 (`getMailClient`) with:

```go
// sendWithBrevo sends the email using Brevo SMTP relay
func sendWithBrevo(ctx context.Context, msg *mail.Message) error {
	// TODO: implement
	return nil
}
```

Leave `SendVerificationCode` and `SendAdminNotification` unchanged for now — they will call `sendEmailWithFallback` instead of `getMailClient` in a later task.

**Step 2.2:** Implement `sendWithBrevo` body

Replace `// TODO: implement` with:

```go
func sendWithBrevo(ctx context.Context, msg *mail.Message) error {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASS")

	// Use default only if explicitly not set? No — Brevo requires explicit host
	if smtpHost == "" {
		smtpHost = "smtp-relay.brevo.com"
	}

	opts := []mail.Option{
		mail.WithPort(587),
		mail.WithTLSPortPolicy(mail.TLSMandatory),
	}

	if smtpUser != "" && smtpPass != "" {
		opts = append(opts, mail.WithSMTPAuth(mail.SMTPAuthPlain))
		opts = append(opts, mail.WithUsername(smtpUser))
		opts = append(opts, mail.WithPassword(smtpPass))
	} else {
		// Should not happen if caller checks config, but fail gracefully
		return fmt.Errorf("Brevo SMTP credentials not fully configured (SMTP_USER/SMTP_PASS)")
	}

	client, err := mail.NewClient(smtpHost, opts...)
	if err != nil {
		return fmt.Errorf("failed to create Brevo client: %w", err)
	}

	log.Printf("[email] sending via Brevo (%s:587)", smtpHost)
	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
		return fmt.Errorf("Brevo send failed: %w", err)
	}

	log.Printf("[email] email sent via Brevo")
	return nil
}
```

**Step 2.3:** Add necessary imports

At the top of the file, add `"fmt"` to the import block (line 3-10 area). The imports should look like:

```go
import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/wneessen/go-mail"
)
```

**Step 2.4:** Compile check

```bash
cd /home/mowgli/pacta && go build ./internal/email 2>&1 | head -20
```

Expected: No errors. Warnings OK. If errors, fix before proceeding.

---

## Task 3: Add `sendWithGmail()` function

**Step 3.1:** Add `sendWithGmail` after `sendWithBrevo`

```go
// sendWithGmail sends the email using Gmail SMTP as fallback
func sendWithGmail(ctx context.Context, msg *mail.Message) error {
	gmailUser := os.Getenv("GMAIL_USER")
	gmailPass := os.Getenv("GMAIL_APP_PASSWORD")

	if gmailUser == "" || gmailPass == "" {
		return fmt.Errorf("Gmail credentials not configured (GMAIL_USER/GMAIL_APP_PASSWORD)")
	}

	opts := []mail.Option{
		mail.WithPort(587),
		mail.WithTLSPortPolicy(mail.TLSMandatory),
		mail.WithSMTPAuth(mail.SMTPAuthPlain),
		mail.WithUsername(gmailUser),
		mail.WithPassword(gmailPass),
	}

	client, err := mail.NewClient("smtp.gmail.com", opts...)
	if err != nil {
		return fmt.Errorf("failed to create Gmail client: %w", err)
	}

	log.Printf("[email] sending via Gmail fallback (smtp.gmail.com:587)")
	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
		return fmt.Errorf("Gmail fallback failed: %w", err)
	}

	log.Printf("[email] email sent via Gmail fallback")
	return nil
}
```

**Step 3.2:** Compile check

```bash
cd /home/mowgli/pacta && go build ./internal/email 2>&1 | head -20
```

Expected: No errors.

---

## Task 4: Add `sendEmailWithFallback()` orchestrator

**Step 4.1:** Add function between `sendWithGmail` and `SendVerificationCode`

```go
// sendEmailWithFallback attempts to send via Brevo first, then Gmail on failure
func sendEmailWithFallback(ctx context.Context, msg *mail.Message) error {
	// Check if Brevo is fully configured
	hasBrevo := os.Getenv("SMTP_HOST") != "" && os.Getenv("SMTP_USER") != "" && os.Getenv("SMTP_PASS") != ""

	if hasBrevo {
		err := sendWithBrevo(ctx, msg)
		if err == nil {
			return nil // Brevo succeeded
		}
		// Brevo failed — log and fallback to Gmail
		log.Printf("[email] Brevo send failed: %v. Falling back to Gmail…", err)
	} else {
		log.Printf("[email] Brevo not configured, using Gmail directly")
	}

	// Either Brevo was not configured or it failed — try Gmail
	err := sendWithGmail(ctx, msg)
	if err != nil {
		log.Printf("[email] Gmail fallback failed: %v", err)
		return err
	}
	return nil
}
```

---

## Task 5: Update `SendVerificationCode` to use fallback

**Step 5.1:** In `SendVerificationCode` (lines 40-76), replace the client acquisition and send logic

Find lines 60-72:

```go
	client, err := getMailClient()
	if err != nil {
		log.Printf("[email] ERROR creating mail client: %v", err)
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
		log.Printf("[email] ERROR sending verification code to %s: %v", to, err)
		return err
	}
```

Replace with:

```go
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := sendEmailWithFallback(ctx, msg); err != nil {
		log.Printf("[email] ERROR sending verification code to %s: %v", to, err)
		return err
	}
```

**Step 5.2:** Compile check

```bash
cd /home/mowgli/pacta && go build ./internal/email 2>&1 | head -20
```

Expected: No errors.

---

## Task 6: Update `SendAdminNotification` to use fallback

**Step 6.1:** In `SendAdminNotification` (lines 79-115), replace client acquisition similarly

Find lines 99-111:

```go
	client, err := getMailClient()
	if err != nil {
		log.Printf("[email] ERROR creating mail client: %v", err)
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
		log.Printf("[email] ERROR sending admin notification to %s: %v", adminEmail, err)
		return err
	}
```

Replace with:

```go
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := sendEmailWithFallback(ctx, msg); err != nil {
		log.Printf("[email] ERROR sending admin notification to %s: %v", adminEmail, err)
		return err
	}
```

**Step 6.2:** Compile check

```bash
cd /home/mowgli/pacta && go build ./internal/email 2>&1 | head -20
```

Expected: No errors.

---

## Task 7: Delete obsolete `getMailClient` function

**Step 7.1:** Remove lines 12-37 entirely (the old `getMailClient` function)

Confirm it is not referenced anywhere else in this file (only SendVerificationCode and SendAdminNotification used it — both now use `sendEmailWithFallback`).

**Step 7.2:** Compile check

```bash
cd /home/mowgli/pacta && go build ./internal/email 2>&1 | head -20
```

Expected: No errors.

---

## Task 8: Full build and test

**Step 8.1:** Build entire project

```bash
cd /home/mowgli/pacta && go build ./...
```

Expected: Build succeeds, no errors.

**Step 8.2:** Run tests (if any exist)

```bash
cd /home/mowgli/pacta && go test ./internal/email -v 2>&1 | head -50
```

Likely: No tests exist for email package. That's OK — skip failures if no test files.

**Step 8.3:** Run linter if available

```bash
cd /home/mowgli/pacta && which golangci-lint >/dev/null && golangci-lint run ./internal/email || echo "golangci-lint not installed — skipping"
```

Or if project uses a different linter, use that. If none, skip.

---

## Task 9: Commit implementation

**Step 9.1:** Review changes

```bash
cd /home/mowgli/pacta && git diff --stat
```

Expected: `docs/EMAIL-CONFIGURATION.md` (new), `internal/email/sendmail.go` (modified)

**Step 9.2:** Stage all changes

```bash
cd /home/mowgli/pacta && git add -A && git status
```

**Step 9.3:** Commit with message

```bash
cd /home/mowgli/pacta && git commit -m "feat(email): add Brevo SMTP primary with Gmail fallback

- Replace getMailClient with provider-aware sendEmailWithFallback
- sendWithBrevo: uses SMTP_* env vars, port 587, TLSMandatory
- sendWithGmail: uses GMAIL_* env vars, port 587, TLSMandatory
- Automatic fallback: Brevo failure → Gmail; Brevo unconfigured → Gmail directly
- Clear logging for provider selection and failures
- Update/rename docs/RESEND-CONFIGURATION.md to docs/EMAIL-CONFIGURATION.md
- No changes to templates or handlers (signatures preserved)"
```

**Step 9.4:** Push to remote

```bash
cd /home/mowgli/pacta && git push origin main
```

---

## Task 10: Manual testing checklist

Perform these tests on a running PACTA instance (dev or staging). You'll need ability to set environment variables and restart the service.

**Test A — Brevo-only (primary path)**
- [ ] Set only Brevo env vars (SMTP_HOST, SMTP_USER, SMTP_PASS), unset Gmail vars
- [ ] Restart PACTA
- [ ] Check logs for "sending via Brevo"
- [ ] Register new user with email verification
- [ ] Verify code arrives in inbox
- [ ] No Gmail-related log entries should appear

**Test B — Brevo fails, Gmail fallback triggers**
- [ ] Set both Brevo and Gmail env vars
- [ ] Break Brevo (wrong SMTP_PASS or block port 587 with firewall)
- [ ] Restart PACTA
- [ ] Register new user
- [ ] Check logs: Brevo failure message → Gmail fallback message → success
- [ ] Verify code arrives (via Gmail)
- [ ] Restore Brevo credentials

**Test C — Gmail-only (Brevo unconfigured)**
- [ ] Unset all SMTP_* vars (SMTP_HOST, SMTP_USER, SMTP_PASS)
- [ ] Keep Gmail vars set (GMAIL_USER, GMAIL_APP_PASSWORD)
- [ ] Restart PACTA
- [ ] Check logs: "Brevo not configured, using Gmail directly"
- [ ] Register new user
- [ ] Verify code arrives via Gmail

**Test D — Both providers fail**
- [ ] Set both providers with invalid credentials
- [ ] Restart PACTA
- [ ] Register new user
- [ ] API should return 500, user sees error
- [ ] Logs show both Brevo failure and Gmail failure
- [ ] Restore valid credentials

**Test E — Neither configured**
- [ ] Unset all email-related env vars
- [ ] Restart PACTA
- [ ] Check logs: "no SMTP configuration found"
- [ ] Register new user
- [ ] API returns 500 with config error
- [ ] Restore at least Gmail configuration

---

## Notes for implementer

- go-mail version is v0.7.2 — all used APIs (`WithPort`, `WithTLSPortPolicy`, `WithSMTPAuth`, `WithUsername`, `WithPassword`, `DialAndSendWithContext`) are stable in this version
- Do NOT add any new dependencies — only standard library + go-mail
- Do NOT modify `templates.go` or `auth.go`
- Timeout already set in existing code (30 seconds) — keep that
- The `EMAIL_FROM` env var is read inside each Send* function (unchanged)
- Error messages in logs: keep the `[email]` prefix for consistency
- If you encounter any ambiguity, refer back to the design doc: `docs/plans/2025-06-18-email-fallback-design.md`

---

## Deliverables checklist

- [x] `docs/EMAIL-CONFIGURATION.md` — complete (Task 1 DONE)
- [ ] `internal/email/sendmail.go` — fully refactored with Brevo/Gmail fallback
- [ ] All functions compile without errors
- [ ] Git commit pushed to main with clear message
- [ ] Manual testing performed (at least Tests A, C, E in one session)
