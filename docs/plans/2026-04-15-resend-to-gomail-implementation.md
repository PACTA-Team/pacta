# Resend → go-mail Migration with i18n Email Templates

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Resend API with go-mail for direct SMTP email sending, add i18n support (es/en) for email templates, and improve UX with spam folder warnings.

**Architecture:** Replace `internal/email/resend.go` with `sendmail.go` using `go-mail` library for direct SMTP delivery. Add `templates.go` for i18n email templates. Frontend sends detected language in registration request. Backend detects language from request body → Accept-Language header → fallback to "en".

**Tech Stack:** Go (chi router, `github.com/wneessen/go-mail`), React + TypeScript, i18next, Sonner toasts

---

## Phase 1: Backend — go-mail Email Service

### Task 1: Add go-mail dependency

**Files:**
- Modify: `go.mod` (via `go get`)
- Modify: `go.sum` (auto-updated)

**Step 1: Add go-mail dependency**

Run:
```bash
cd /home/mowgli/pacta && go get github.com/wneessen/go-mail
```

Expected: Downloads go-mail, updates go.mod and go.sum

**Step 2: Verify dependency**

Run:
```bash
go mod tidy
```

Expected: No errors, go.sum updated

**Step 3: Commit**

```bash
git add go.mod go.sum
git commit -m "chore: add go-mail dependency"
```

---

### Task 2: Create i18n email templates

**Files:**
- Create: `internal/email/templates.go`

**Step 1: Write the template file**

Create `internal/email/templates.go`:

```go
package email

// EmailTemplate holds localized email content
type EmailTemplate struct {
	Subject string
	HTML    string
}

// GetVerificationTemplate returns the localized verification email template
func GetVerificationTemplate(lang, code string) EmailTemplate {
	switch lang {
	case "es":
		return EmailTemplate{
			Subject: "Tu código de verificación de PACTA",
			HTML: verificationEmailHTML(code,
				"Verifica tu cuenta de PACTA",
				"Ingresa este código para completar tu registro:",
				"Este código expira en 5 minutos.",
				"Si no solicitaste esto, ignora este correo.",
			),
		}
	default: // "en"
		return EmailTemplate{
			Subject: "Your PACTA Verification Code",
			HTML: verificationEmailHTML(code,
				"Verify Your PACTA Account",
				"Enter this code to complete your registration:",
				"This code expires in 5 minutes.",
				"If you didn't request this, ignore this email.",
			),
		}
	}
}

// GetAdminNotificationTemplate returns the localized admin notification template
func GetAdminNotificationTemplate(lang, userName, userEmail, companyName string) EmailTemplate {
	switch lang {
	case "es":
		return EmailTemplate{
			Subject: "Nueva solicitud de registro pendiente",
			HTML: adminNotificationHTML(
				"Nueva solicitud de registro",
				"Nombre", userName,
				"Correo", userEmail,
				"Empresa", companyName,
				"Inicia sesión en PACTA como administrador para revisar y aprobar este registro.",
			),
		}
	default: // "en"
		return EmailTemplate{
			Subject: "New User Registration Pending Approval",
			HTML: adminNotificationHTML(
				"New User Registration Pending",
				"Name", userName,
				"Email", userEmail,
				"Company", companyName,
				"Log in to PACTA as admin to review and approve this registration.",
			),
		}
	}
}

func verificationEmailHTML(code, title, instruction, expiry, ignore string) string {
	return `<html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1a1a1a">` + title + `</h2>
        <p>` + instruction + `</p>
        <div style="background:#f5f5f5;padding:20px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;border-radius:8px;margin:20px 0">` + code + `</div>
        <p style="color:#666;font-size:14px">` + expiry + `</p>
        <p style="color:#666;font-size:12px">` + ignore + `</p>
    </body></html>`
}

func adminNotificationHTML(title, nameLabel, userName, emailLabel, userEmail, companyLabel, companyName, action string) string {
	return `<html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1a1a1a">` + title + `</h2>
        <p><strong>` + nameLabel + `:</strong> ` + userName + `</p>
        <p><strong>` + emailLabel + `:</strong> ` + userEmail + `</p>
        <p><strong>` + companyLabel + `:</strong> ` + companyName + `</p>
        <p style="margin-top:20px">` + action + `</p>
    </body></html>`
}
```

**Step 2: Commit**

```bash
git add internal/email/templates.go
git commit -m "feat: add i18n email templates (es/en)"
```

---

### Task 3: Create sendmail.go with go-mail

**Files:**
- Create: `internal/email/sendmail.go`

**Step 1: Write the sendmail implementation**

Create `internal/email/sendmail.go`:

```go
package email

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/wneessen/go-mail"
)

// SendVerificationCode sends a verification code email to the user
func SendVerificationCode(ctx context.Context, to, code, lang string) error {
	from := os.Getenv("EMAIL_FROM")
	if from == "" {
		from = "PACTA <noreply@pacta.duckdns.org>"
	}

	template := GetVerificationTemplate(lang, code)

	msg := mail.NewMsg()
	if err := msg.From(from); err != nil {
		log.Printf("[email] ERROR setting from address: %v", err)
		return err
	}
	if err := msg.To(to); err != nil {
		log.Printf("[email] ERROR setting to address %s: %v", to, err)
		return err
	}
	msg.Subject(template.Subject)
	msg.SetBodyString(mail.TypeTextHTML, template.HTML)

	client, err := mail.NewClient("localhost",
		mail.WithPort(25),
		mail.WithTLSPortPolicy(mail.TLSOpportunistic),
	)
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

	log.Printf("[email] verification code sent to %s (%s)", to, lang)
	return nil
}

// SendAdminNotification sends a notification email to an admin
func SendAdminNotification(ctx context.Context, adminEmail, userName, userEmail, companyName, lang string) error {
	from := os.Getenv("EMAIL_FROM")
	if from == "" {
		from = "PACTA <noreply@pacta.duckdns.org>"
	}

	template := GetAdminNotificationTemplate(lang, userName, userEmail, companyName)

	msg := mail.NewMsg()
	if err := msg.From(from); err != nil {
		log.Printf("[email] ERROR setting from address: %v", err)
		return err
	}
	if err := msg.To(adminEmail); err != nil {
		log.Printf("[email] ERROR setting to address %s: %v", adminEmail, err)
		return err
	}
	msg.Subject(template.Subject)
	msg.SetBodyString(mail.TypeTextHTML, template.HTML)

	client, err := mail.NewClient("localhost",
		mail.WithPort(25),
		mail.WithTLSPortPolicy(mail.TLSOpportunistic),
	)
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

	log.Printf("[email] admin notification sent to %s (%s)", adminEmail, lang)
	return nil
}
```

**Step 2: Commit**

```bash
git add internal/email/sendmail.go
git commit -m "feat: add go-mail based email sending service"
```

---

### Task 4: Remove resend.go

**Files:**
- Delete: `internal/email/resend.go`

**Step 1: Remove the old Resend implementation**

Run:
```bash
rm /home/mowgli/pacta/internal/email/resend.go
```

**Step 2: Remove Resend from go.mod**

Run:
```bash
cd /home/mowgli/pacta && go mod tidy
```

Expected: Removes `github.com/resend/resend-go/v3` from go.mod and go.sum

**Step 3: Verify build**

Run:
```bash
go build ./...
```

Expected: Build succeeds (may have import errors in other files — that's expected, we'll fix them next)

**Step 4: Commit**

```bash
git add internal/email/resend.go go.mod go.sum
git commit -m "refactor: remove Resend SDK, switch to go-mail"
```

---

### Task 5: Update config to remove ResendAPIKey

**Files:**
- Modify: `internal/config/config.go`

**Step 1: Remove ResendAPIKey from Config struct**

Modify `internal/config/config.go`:

```go
type Config struct {
	Addr    string
	DataDir string
	Version string
}

func Default() *Config {
	dataDir := defaultDataDir()
	return &Config{
		Addr:    fmt.Sprintf(":%d", DefaultPort),
		DataDir: dataDir,
		Version: AppVersion,
	}
}
```

Remove the `ResendAPIKey` field and its `os.Getenv("RESEND_API_KEY")` assignment.

**Step 2: Commit**

```bash
git add internal/config/config.go
git commit -m "refactor: remove ResendAPIKey from config"
```

---

### Task 6: Update server.go to remove email.Init()

**Files:**
- Modify: `internal/server/server.go:33`

**Step 1: Remove email.Init call**

In `internal/server/server.go`, remove the line:
```go
email.Init(cfg.ResendAPIKey)
```

Also remove the `"github.com/PACTA-Team/pacta/internal/email"` import if no longer used (it will still be used by handlers).

**Step 2: Verify build**

Run:
```bash
go build ./...
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add internal/server/server.go
git commit -m "refactor: remove email.Init() from server startup"
```

---

### Task 7: Update handlers with language detection and error logging

**Files:**
- Modify: `internal/handlers/auth.go`

**Step 1: Update RegisterRequest struct**

Add `Language` field to `RegisterRequest`:

```go
type RegisterRequest struct {
	Name        string `json:"name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Mode        string `json:"mode"`
	CompanyName string `json:"company_name"`
	CompanyID   *int   `json:"company_id,omitempty"`
	Language    string `json:"language"`
}
```

**Step 2: Add detectLanguage helper function**

Add this function to `auth.go`:

```go
// detectLanguage determines the user's preferred language
// Priority: request body > Accept-Language header > "en"
func detectLanguage(reqLang string, acceptLangHeader string) string {
	if reqLang != "" {
		if reqLang == "es" || reqLang == "en" {
			return reqLang
		}
	}

	// Parse Accept-Language header (e.g., "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7")
	if acceptLangHeader != "" {
		for _, lang := range strings.Split(acceptLangHeader, ",") {
			code := strings.TrimSpace(strings.Split(lang, ";")[0])
			if strings.HasPrefix(code, "es") {
				return "es"
			}
			if strings.HasPrefix(code, "en") {
				return "en"
			}
		}
	}

	return "en" // fallback
}
```

**Step 3: Update HandleRegister email sending section**

Replace the email sending block (around line 115-130):

```go
if req.Mode == "email" {
    code, err := generateCode()
    if err != nil {
        h.Error(w, http.StatusInternalServerError, "failed to generate code")
        return
    }
    codeHash, _ := auth.HashPassword(code)
    h.DB.Exec(
        "INSERT INTO registration_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)",
        userID, codeHash, time.Now().Add(5*time.Minute),
    )

    lang := detectLanguage(req.Language, r.Header.Get("Accept-Language"))
    ctx := context.Background()
    err = email.SendVerificationCode(ctx, req.Email, code, lang)
    if err != nil {
        log.Printf("[register] ERROR sending verification email to %s: %v", req.Email, err)
        h.Error(w, http.StatusInternalServerError, "failed to send verification email. Please try again or contact support.")
        return
    }

    h.JSON(w, http.StatusCreated, map[string]interface{}{
        "id":      userID,
        "name":    req.Name,
        "email":   req.Email,
        "role":    role,
        "status":  "pending_email",
        "message": "Verification code sent. Check your inbox and spam folder.",
    })
    return
}
```

**Step 4: Update sendAdminNotifications function**

In `internal/handlers/registration.go`, update the `sendAdminNotifications` function signature to accept language:

```go
func sendAdminNotifications(ctx context.Context, db *sql.DB, userName, userEmail, companyName, lang string) error {
    rows, err := db.Query("SELECT email FROM users WHERE role = 'admin' AND status = 'active' AND deleted_at IS NULL")
    if err != nil {
        return err
    }
    defer rows.Close()

    for rows.Next() {
        var adminEmail string
        if err := rows.Scan(&adminEmail); err != nil {
            continue
        }
        email.SendAdminNotification(ctx, adminEmail, userName, userEmail, companyName, lang)
    }
    return nil
}
```

And update the call in `HandleRegister` (approval mode):

```go
lang := detectLanguage(req.Language, r.Header.Get("Accept-Language"))
ctx := context.Background()
sendAdminNotifications(ctx, h.DB, req.Name, req.Email, companyName, lang)
```

**Step 5: Verify build**

Run:
```bash
go build ./...
```

Expected: Build succeeds

**Step 6: Commit**

```bash
git add internal/handlers/auth.go internal/handlers/registration.go
git commit -m "feat: add language detection and error logging to email sending"
```

---

## Phase 2: Frontend — Language + Spam UX

### Task 8: Add language to registration API request

**Files:**
- Modify: `pacta_appweb/src/lib/registration-api.ts`

**Step 1: Update register function to include language**

Modify `registration-api.ts`:

```typescript
export const registrationAPI = {
  register: (name: string, email: string, password: string, mode: 'email' | 'approval', companyName?: string, companyId?: number, language?: string) =>
    fetchJSON(`${BASE}/register`, {
      method: 'POST',
      body: JSON.stringify({
        name, email, password, mode,
        company_name: companyName,
        company_id: companyId,
        language: language || 'en',
      }),
    }),
  // ... rest unchanged
};
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/lib/registration-api.ts
git commit -m "feat: send language in registration request"
```

---

### Task 9: Pass language from LoginForm to registration API

**Files:**
- Modify: `pacta_appweb/src/components/auth/LoginForm.tsx`

**Step 1: Import i18n and get current language**

At the top of `LoginForm.tsx`, add:

```typescript
import { useTranslation } from 'react-i18next';
```

Inside the component, add:

```typescript
const { t, i18n } = useTranslation('login');
```

**Step 2: Update handleRegister to pass language**

In the `handleRegister` function, update the `registrationAPI.register` call:

```typescript
const currentLang = i18n.language.startsWith('es') ? 'es' : 'en';
const data = await registrationAPI.register(
  name, email, password, registrationMode, companyParam, companyId, currentLang
);
```

**Step 3: Update toast message for spam warning**

The toast message will now be handled via the translation keys (see Task 10).

**Step 4: Commit**

```bash
git add pacta_appweb/src/components/auth/LoginForm.tsx
git commit -m "feat: pass detected language to registration API"
```

---

### Task 10: Update translation files with spam warnings

**Files:**
- Modify: `pacta_appweb/public/locales/es/login.json`
- Modify: `pacta_appweb/public/locales/en/login.json`

**Step 1: Update Spanish translations**

Modify `pacta_appweb/public/locales/es/login.json`:

```json
{
  "emailVerificationToast": "¡Código de verificación enviado! Revisa tu bandeja de entrada y la carpeta de spam."
}
```

**Step 2: Update English translations**

Modify `pacta_appweb/public/locales/en/login.json`:

```json
{
  "emailVerificationToast": "Verification code sent! Check your inbox and spam folder."
}
```

**Step 3: Commit**

```bash
git add pacta_appweb/public/locales/es/login.json pacta_appweb/public/locales/en/login.json
git commit -m "feat: add spam folder warning to email verification messages"
```

---

### Task 11: Update VerifyEmailPage with spam warning

**Files:**
- Modify: `pacta_appweb/src/pages/VerifyEmailPage.tsx`

**Step 1: Add spam warning text below the card description**

In `VerifyEmailPage.tsx`, update the CardDescription section:

```tsx
<CardDescription className="text-center">
  Enter the 6-digit code sent to {email}
  <br />
  <span className="text-xs text-muted-foreground">
    Didn't receive it? Check your spam folder.
  </span>
</CardDescription>
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/pages/VerifyEmailPage.tsx
git commit -m "feat: add spam folder hint on verification page"
```

---

## Phase 3: Deploy & Verify

### Task 12: Update production .env file

**Files:**
- Modify: `/opt/pacta/.env` (on the VPS)

**Step 1: Remove RESEND_API_KEY**

On the VPS, edit `/opt/pacta/.env`:

```diff
-RESEND_API_KEY=re_RNptY9iA_2fn8TGd5N2tHkZbmHG2gypJX
 EMAIL_FROM=PACTA <noreply@pacta.duckdns.org>
```

**Step 2: Restart service**

Run on VPS:
```bash
sudo systemctl restart pacta
sudo journalctl -u pacta --since "10s ago" -f
```

Expected: Service starts, shows "PACTA v0.32.x running on http://127.0.0.1:3000"

---

### Task 13: Build and deploy

**Files:**
- Build: `go build`

**Step 1: Build the binary**

Run:
```bash
cd /home/mowgli/pacta && go build -o pacta ./cmd/pacta
```

Expected: Binary builds without errors

**Step 2: Deploy to VPS**

Run:
```bash
scp pacta usipipo:/opt/pacta/pacta
ssh usipipo "sudo systemctl restart pacta"
```

**Step 3: Verify service is running**

Run:
```bash
ssh usipipo "sudo journalctl -u pacta --since '30s ago' --no-pager"
```

Expected: No errors, service running

**Step 4: Test registration flow**

1. Open `http://pacta.duckdns.org:3000`
2. Register a new user with email mode
3. Verify: toast shows spam warning
4. Check email inbox (and spam) for verification code
5. Enter code to verify

**Step 5: Commit final state**

```bash
git add -A
git commit -m "deploy: go-mail migration complete"
```

---

## Summary of Changes

| Layer | Files Changed | Action |
|-------|--------------|--------|
| Backend | `internal/email/resend.go` | Deleted |
| Backend | `internal/email/sendmail.go` | Created — go-mail SMTP sender |
| Backend | `internal/email/templates.go` | Created — i18n templates (es/en) |
| Backend | `internal/handlers/auth.go` | Modified — language detection + error logging |
| Backend | `internal/handlers/registration.go` | Modified — language param for admin notifications |
| Backend | `internal/config/config.go` | Modified — removed ResendAPIKey |
| Backend | `internal/server/server.go` | Modified — removed email.Init() |
| Backend | `go.mod`, `go.sum` | Modified — swap resend-go for go-mail |
| Frontend | `pacta_appweb/src/lib/registration-api.ts` | Modified — send language param |
| Frontend | `pacta_appweb/src/components/auth/LoginForm.tsx` | Modified — pass language from i18n |
| Frontend | `pacta_appweb/src/pages/VerifyEmailPage.tsx` | Modified — spam folder hint |
| Frontend | `public/locales/es/login.json` | Modified — spam warning text |
| Frontend | `public/locales/en/login.json` | Modified — spam warning text |
| Deploy | `/opt/pacta/.env` | Modified — remove RESEND_API_KEY |
