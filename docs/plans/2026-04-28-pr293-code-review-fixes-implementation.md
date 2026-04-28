# PR #293 Code Review Fixes - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 critical/high issues found in code review: migration naming, token expiry mismatch, XSS in fallbacks, missing audit logs.

**Architecture:** 4 targeted fixes following security best practices. Minimal changes to minimize risk.

**Tech Stack:** Go backend, SQLite migrations, email templates

---

## Task 1: Rename Migration File

**Files:**
- Modify: `internal/db/migrations/XXX_password_reset_tokens.sql` → renombrar a `005_password_reset_tokens.sql`

**Step 1: Renombrar archivo**

Run: `git mv internal/db/migrations/XXX_password_reset_tokens.sql internal/db/migrations/005_password_reset_tokens.sql`

**Step 2: Verificar**

Run: `ls -la internal/db/migrations/`
Expected: `005_password_reset_tokens.sql` listed, `XXX_*` not present

**Step 3: Commit**

```bash
git add -A && git commit -m "fix: rename migration to follow numeric sequence"
```

---

## Task 2: Align Token Expiry in Templates

**Files:**
- Modify: `internal/email/templates.go:71,80`

**Step 1: Cambiar "1 hour" a "30 minutes"**

Edit `internal/email/templates.go`:

```go
// Línea 71 - English
data["ExpiryText"] = "This link expires in 30 minutes.",

// Línea 80 - Spanish  
data["ExpiryText"] = "Este enlace expira en 30 minutos.",
```

**Step 2: Commit**

```bash
git add internal/email/templates.go && git commit -m "fix: align token expiry text with code (30 min)"
```

---

## Task 3: Remove XSS-Risky Fallback Functions

**Files:**
- Modify: `internal/email/templates.go`

**Step 1: Eliminar funciones fallback**

Remove lines 224-242 (functions `verificationEmailHTML` and `adminNotificationHTML`)

**Step 2: Simplificar fallbacks en cada template function**

En `GetVerificationTemplate`, cambiar fallback de:
```go
return EmailTemplate{
    Subject: "Your PACTA Verification Code",
    HTML:    verificationEmailHTML(code, ...),
}
```

A:
```go
log.Printf("[email] failed to load verification template: %v", err)
return EmailTemplate{
    Subject: "Your PACTA Verification Code",
    HTML:    "<html><body>Please use the verification code sent to your email.</body></html>",
}
```

Repetir para `GetAdminNotificationTemplate`.

**Step 3: Commit**

```bash
git add internal/email/templates.go && git commit -m "fix: remove XSS-risky fallback HTML functions"
```

---

## Task 4: Add Audit Logging

**Files:**
- Modify: `internal/handlers/password_reset.go`

**Step 1: Agregar audit log en ForgotPassword (request)**

After line 62 (after `GenerateResetToken`):
```go
// Log audit for password reset request
h.DB.Exec(
    "INSERT INTO audit_logs (user_id, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
    userID, "password_reset_request", "Password reset requested", r.RemoteAddr,
)
```

**Step 2: Agregar audit log en ResetPassword (success)**

After line 146 (after `MarkTokenUsed`):
```go
// Log audit for successful password reset
h.DB.Exec(
    "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
    userID, "password_reset_complete", "Password reset completed successfully",
)
```

**Step 3: Commit**

```bash
git add internal/handlers/password_reset.go && git commit -m "fix: add audit logging for password reset flows"
```

---

## Task 5: Verify All Changes

**Step 1: Run build**

Run: `go build ./...` (en CI, no local)
Expected: PASS

**Step 2: Push changes**

Run: `git push`
Expected: All commits pushed

---

## Summary

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Rename migration `XXX_` → `005_` | 1 commit |
| 2 | Align expiry "1 hour" → "30 minutes" | 1 commit |
| 3 | Remove XSS-risky fallback functions | 1 commit |
| 4 | Add audit logging (request + reset) | 1 commit |
| 5 | Verify and push | - |

**Total: 4 commits**

---

**Plan complete and saved to `docs/plans/2026-04-28-pr293-code-review-fixes-implementation.md`. Three execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**3. Plan-to-Issues (team workflow)** - Convert plan tasks to GitHub issues for team distribution

**Which approach?**