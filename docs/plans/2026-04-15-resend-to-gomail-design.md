# Design: Resend → go-mail Migration with i18n Email Templates

## Problem

Resend API en modo testing solo permite enviar emails a la dirección verificada de la cuenta (`jelvysc@gmail.com`). Cualquier otro destinatario recibe 403 `validation_error`. DuckDNS no soporta TXT records para verificar dominio en producción.

Además, los emails están hardcodeados en inglés sin soporte para el sistema multilanguage (i18next) de la app.

## Solution

Reemplazar Resend SDK con `go-mail` para envío SMTP directo desde el VPS, con templates de email en español e inglés detectados automáticamente.

## Architecture

### Backend (Go)

| Archivo | Acción |
|---------|--------|
| `internal/email/resend.go` | **Eliminar** |
| `internal/email/sendmail.go` | **Crear** — envío SMTP directo con `go-mail` |
| `internal/email/templates.go` | **Crear** — templates i18n para emails |
| `internal/handlers/auth.go` | **Modificar** — enviar idioma + log errores + campo `message` |
| `internal/config/config.go` | **Modificar** — quitar `ResendAPIKey` |
| `internal/server/server.go` | **Modificar** — quitar `email.Init()` |
| `go.mod` | **Modificar** — quitar `resend-go`, añadir `go-mail` |

### Frontend (React)

| Archivo | Acción |
|---------|--------|
| `pacta_appweb/src/lib/registration-api.ts` | **Modificar** — enviar `language` en request |
| `pacta_appweb/src/components/auth/LoginForm.tsx` | **Modificar** — toast con aviso de spam |
| `pacta_appweb/src/pages/VerifyEmailPage.tsx` | **Modificar** — texto "revisa spam" |
| `pacta_appweb/public/locales/es/login.json` | **Modificar** — actualizar textos |
| `pacta_appweb/public/locales/en/login.json` | **Modificar** — actualizar textos |

## Data Flow

### Registro con verificación por email

```
Frontend                          Backend                          SMTP
   │                                │                                │
   │ POST /api/auth/register        │                                │
   │ {name, email, password,        │                                │
   │  mode:"email", language:"es"}  │                                │
   ├───────────────────────────────>│                                │
   │                                │ 1. Insert user (pending_email) │
   │                                │ 2. Generate 6-digit code       │
   │                                │ 3. Detect language (body >     │
   │                                │    Accept-Language > "en")     │
   │                                │ 4. Select template (es/en)     │
   │                                │ 5. go-mail.SendEmail           │
   │                                ├───────────────────────────────>│
   │                                │  (SMTP directo, port 25)       │
   │                                │<───────────────────────────────│
   │                                │ 6. Log success/error           │
   │ 201 {status, message}          │                                │
   │<───────────────────────────────│                                │
   │                                │                                │
   │ Toast: "Código enviado.        │                                │
   │ Revisa spam"                   │                                │
```

### Language Detection

```
1. Frontend envía `language` en el body del request (desde localStorage `pacta-language`)
2. Backend: si `req.Language` está set → usar ese
3. Backend: si no → parsear `Accept-Language` header → primer idioma (`es-ES` → `es`)
4. Fallback: si idioma no soportado → `"en"`
```

## Email Templates

### Español (`es`)

**Asunto:** Tu código de verificación de PACTA

**Cuerpo HTML:**
```html
<h2>Verifica tu cuenta de PACTA</h2>
<p>Ingresa este código para completar tu registro:</p>
<div style="...">044886</div>
<p>Este código expira en 5 minutos.</p>
<p>Si no solicitaste esto, ignora este correo.</p>
```

### English (`en`)

**Subject:** Your PACTA Verification Code

**Body HTML:**
```html
<h2>Verify Your PACTA Account</h2>
<p>Enter this code to complete your registration:</p>
<div style="...">044886</div>
<p>This code expires in 5 minutes.</p>
<p>If you didn't request this, ignore this email.</p>
```

## Error Handling

1. **Error de envío SMTP:** Log del error + respuesta 500 al frontend con mensaje claro
2. **Email cae en spam:** No es un error técnico — se mitiga con UX ("revisa spam")
3. **Idioma no reconocido:** Fallback a inglés (`en`)
4. **SMTP port 25 bloqueado:** Log del error, sugerir al admin configurar relay SMTP externo

## Frontend UX Changes

### Toast de registro (LoginForm.tsx)
- **Antes:** `"Verification code sent to your email"`
- **Después:** `"Verification code sent! Check your inbox and spam folder."` (en)
- **Después:** `"¡Código enviado! Revisa tu bandeja de entrada y la carpeta de spam."` (es)

### VerifyEmailPage.tsx
- **Antes:** `"Enter the 6-digit code sent to {email}"`
- **Después:** Añadir debajo: `"Didn't receive it? Check your spam folder."` (en)
- **Después:** `"¿No lo recibiste? Revisa tu carpeta de spam."` (es)

## Environment Variables

### Antes
```
RESEND_API_KEY=re_xxx
EMAIL_FROM=PACTA <onboarding@resend.dev>
```

### Después
```
EMAIL_FROM=PACTA <noreply@pacta.duckdns.org>
```

`RESEND_API_KEY` ya no es necesario.

## Testing

1. Registro con `language: "es"` → email en español
2. Registro con `language: "en"` → email en inglés
3. Registro sin `language` → fallback a Accept-Language → inglés
4. Verificación de código → funciona igual
5. Error SMTP → log visible en journalctl
