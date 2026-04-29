# Fixes Code Review PR #293 - Diseño de Implementación

**Fecha:** 2026-04-28  
**PR Objetivo:** #293 - feat: add Mailtrap SMTP and password reset flow  
**Tipo:** Bug fixes de seguridad y calidad

---

## Problemas Identificados

| Severity | Issue | Solución |
|----------|-------|----------|
| CRITICAL | Migration file naming (`XXX_` → `005_`) | Renombrar archivo |
| CRITICAL | Token expiry mismatch (30 min vs "1 hour") | Alinear template a 30 min |
| HIGH | XSS risk in fallback HTML functions | Eliminar fallbacks |
| HIGH | Missing audit log for password reset | Agregar audit_logs |

---

## Soluciones Detalladas

### 1. Renombrar Migration File

**Archivo actual:** `internal/db/migrations/XXX_password_reset_tokens.sql`  
**Archivo nuevo:** `internal/db/migrations/005_password_reset_tokens.sql`

**Razón:** El sistema de migraciones espera orden numérico. XXX no será aplicado.

### 2. Alinear Token Expiry

**Ubicación:** `internal/email/templates.go`  
**Cambio:** "1 hour" → "30 minutes" (líneas 71 y 80)

**Razón:** El código ya usa `tokenExpiry = 30 * time.Minute`. El template debe coincidir.

### 3. Eliminar Fallback HTML Functions

**Eliminar:**
- `verificationEmailHTML()` en `templates.go:224-232`
- `adminNotificationHTML()` en `templates.go:234-242`

**Nuevo comportamiento:**
- Si `LoadTemplate()` falla, loguear error y retornar texto plano
- Eliminar riesgo de XSS completamente

```go
// Nuevo fallback simple
log.Printf("[email] template load failed: %v", err)
return EmailTemplate{
    Subject: "Password Reset - PACTA",
    HTML:    "<html><body>Password reset requested. Contact support if needed.</body></html>",
}
```

### 4. Agregar Audit Logging

**Ubicación:** `internal/handlers/password_reset.go`

**En `ForgotPassword()`** (request de reset):
```go
_, err = h.DB.Exec(
    "INSERT INTO audit_logs (user_id, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
    userID, "password_reset_request", "Password reset requested via email", getClientIP(r),
)
```

**En `ResetPassword()`** (reset exitoso):
```go
_, err = h.DB.Exec(
    "INSERT INTO audit_logs (user_id, action, details, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
    userID, "password_reset_complete", "Password reset completed successfully",
)
```

---

## Archivos a Modificar

| Archivo | Cambio |
|----------|--------|
| `internal/db/migrations/XXX_password_reset_tokens.sql` | Renombrar a `005_` |
| `internal/email/templates.go` | Fix expiry, eliminar fallbacks |
| `internal/handlers/password_reset.go` | Agregar audit logs |

---

## Verificación Post-Implementación

- [ ] Build pasa sin errores
- [ ] Tests pasan (especialmente `token_test.go`)
- [ ] Migration se aplica correctamente en fresh DB
- [ ] No hay strings "1 hour" en templates.go
- [ ] No existen funciones `*EmailHTML` en templates.go
- [ ] Audit logs se crean en ambos flows

---

## Notas

- Los audit logs usan `ip_address` que requiere verificar si existe en el schema de `audit_logs`
- El helper `getClientIP()` debe implementarse o adaptarse al existente del proyecto