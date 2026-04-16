# System Settings Design

## Overview

Nueva página de configuración del sistema para admin desde la UI, separada del Setup Wizard inicial.

## Two-Part Architecture

### 1. Setup Wizard (exists)
- Configuración inicial cuando se instala la app por primera vez
- Se ejecuta cuando NO hay base de datos inicializada
- Solo una vez (first-run)

### 2. Settings Page (new)
- Configuración del sistema en producción
- Base de datos ya inicializada
- Múltiples administradores pueden acceder
- Cambios persistentes en BD

## Database

Nueva tabla `system_settings`:

```sql
CREATE TABLE system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    category TEXT NOT NULL,
    updated_by INTEGER REFERENCES users(id),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Categorías:
- `smtp` - configuración de correo
- `company` - datos de la empresa
- `registration` - opciones de registro
- `general` - idioma, timezone

## API Backend

- `GET /api/system-settings` - obtener todos los settings (admin)
- `PUT /api/system-settings` - actualizar settings (admin)

## Frontend Pages

Nueva página `SettingsPage.tsx` con tabs:
- **SMTP** - SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_FROM
- **Empresa** - company_name, company_email, company_address
- **Registro** - registration_methods (email_verification, admin_approval)
- **General** - default_language, timezone

## Navigation

Agregar al menú lateral en `AppSidebar.tsx`:
- ruta: `/settings`
- ícono: Settings/Cog
- roles: ['admin'] only

## Security

- Solo usuarios con role='admin' pueden acceder
- Cambios auditados en log
- Passwords nunca expuestos en response