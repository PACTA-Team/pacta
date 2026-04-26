# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.44.11] - 2026-04-26

### Changed
- **Backend Security Remediation** — Frontend synchronized with backend v0.44.11 security release (CSP, CSRF, CORS, rate limiting, session hardening, enumeration prevention, sanitized errors, React 19.2.4)

### Fixed
- **CI Compilation** — Fixed missing net/http import in auth enumeration tests

## [0.42.0] - 2026-04-21

### Added
- **Phase 5 - Filtros y Paginación** — Paginación y filtros en ContractsPage y SupplementsPage para mejorar el rendimiento y UX en listas grandes
- **client_name y supplier_name en API** — Nuevos campos añadidos a las respuestas de API de contratos para incluir nombres de cliente y proveedor directamente
- **DL-304 Legal Fields** — Nuevos campos legales para compliance:
  - `obligation_type`, `jurisdiction`, `governing_law`, `dispute_resolution`, `liability_limit`, `penalty_clause`, `termination_notice_days`, `exclusive_jurisdiction`
- **Decreto No. 310** — Taxonomy de tipos de contrato basada en el Decreto No. 310 para cumplimiento legal
- **Campo modification_type en Suplementos** — Nuevo campo para especificar el tipo de modificación
- **Campo contract_title nullable** — El campo título de contrato ahora es nullable para mayor flexibilidad
- **Component FieldTooltip** — Nuevo componente para mostrar tooltips en campos legales del formulario de contratos
- **Campos legales condicionales** — Campos legales que se muestran/ocultan según el rol del usuario (Admin/Manager)
- **Document upload en ContractForm** — Carga de documentos directamente desde el formulario de contratos
- **Contextual role selector** — Selector de rol contextual en formularios basado en el contexto de la operación

### Fixed
- **snake_case standardization** — Estandarización completa de nomenclatura snake_case en todo el frontend para consistencia con el backend
- **TypeScript any[] removal** — Reemplazo de tipos `any[]` con tipos strong en todo el código TypeScript
- **Supplement status preservation** — Preservar el estado del suplemento durante la actualización
- **AuthContext error logging** — Añadido logging en bloques catch vacíos en AuthContext
- **Duplicate interfaces removal** — Eliminación de interfaces duplicadas en el código

### Technical Details
- **Database migrations:** 4 nuevas migraciones
- **Files Modified:** ~15 archivos frontend, ~5 archivos backend
- **Lines Added:** ~800
- **Backend version:** v0.42.0 sincronizado con frontend

## [0.41.0] - 2026-04-19

### Added
- **User Profile API** — Nuevos endpoints backend para gestión de perfil:
  - GET /api/user/profile — Obtener perfil del usuario actual
  - PATCH /api/user/profile — Actualizar nombre y email
  - POST /api/user/change-password — Cambiar contraseña con validación
- **User Certificates API** — Nuevos endpoints para gestión de certificados digitales:
  - POST /api/user/certificate — Subir certificado P12 o público
  - DELETE /api/user/certificate/{type} — Eliminar certificado
- **Audit Logging** — Cambios de perfil, contraseña y certificados registrados

### Technical Details
- **Files Modified:** 4 (`internal/handlers/user.go`, `internal/handlers/profile.go`, `internal/server/server.go`)
- **Files Created:** 2 (migration 030_user_certificates.sql, `internal/handlers/profile.go`)
- **Lines Added:** ~300

## [0.40.1] - 2026-04-18

### Added
- **Settings Persistence Fix** — Added missing `email_verification_required` setting to system_settings table with secure default (false)
- **Individual Save Buttons** — Each settings section now has its own save button for immediate persistence
- **Error Boundary** — Added ErrorBoundary component to App.tsx for better runtime error handling

### Fixed
- **Settings Not Persisting** — Fixed the issue where email verification toggle and other settings wouldn't save due to missing database key
- **Insecure Defaults** - Changed email-related settings defaults from 'true' to 'false' for better security (least privilege)
- **Backend Registration Logic** — Updated HandleRegister to respect email_verification_required toggle during user registration

### Technical Details
- **Files Modified:** 5 (`internal/config/config.go`, `internal/db/migrations/029_email_settings.sql`, `internal/handlers/auth.go`, `pacta_appweb/src/App.tsx`, `pacta_appweb/src/lib/settings-api.ts`)
- **Files Created:** 1 (`pacta_appweb/src/components/ErrorBoundary.tsx`)

## [0.40.0] - 2026-04-18

### Added
- **Email Verification Toggle** — New `email_verification_required` setting in Email Settings tab to control whether users need to verify email during registration
- **Missing Translations** — Added missing translations for settings and users pages to common.json (English and Spanish)

### Fixed
- **Blank Screens on Desktop** — Fixed device detection running before component mount causing blank desktop pages
  - Added `useEffect` to ensure device detection runs only after component mounts
- **Settings Tabs Stacked on Mobile** — Fixed horizontal scroll on mobile settings tabs
  - Added `flex overflow-x-auto` to tab container for proper horizontal scrolling
- **Mobile Access to Session Controls** — Added ThemeToggle, LanguageToggle, and Notifications access to UserDropdown on mobile
  - Mobile users now have access to all session controls that desktop users have in header
- **Settings Labels Capitalization** — Added `capitalize` CSS class to Settings page labels
  - All labels now display with proper title case formatting

### Technical Details
- **Files Modified:** 7 (`pacta_appweb/src/components/layout/AppLayout.tsx`, `pacta_appweb/src/components/header/UserDropdown.tsx`, `pacta_appweb/src/pages/SettingsPage.tsx`, `pacta_appweb/src/pages/SettingsPage/EmailSettingsTab.tsx`, `pacta_appweb/public/locales/en/common.json`, `pacta_appweb/public/locales/es/common.json`, `pacta_appweb/public/locales/en/settings.json`, `pacta_appweb/public/locales/es/settings.json`)


## [0.6.0] - 2026-04-17

### Changed (Backend)
- **Email service Brevo + Gmail fallback** — Backend email now uses Brevo SMTP primary with automatic Gmail fallback; environment variables: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (Brevo) and `GMAIL_USER`, `GMAIL_APP_PASSWORD` (Gmail); mandatory TLS on port 587; comprehensive logging for provider selection and failures

### Technical Details (Backend)
- **Files Modified:** `internal/email/sendmail.go` (replaced `getMailClient` with `sendWithBrevo`, `sendWithGmail`, `sendEmailWithFallback`)
- **Lines Added:** ~74 new code lines, ~373 new docs
- **No frontend changes** — API signatures unchanged, templates untouched
- **Backend version:** v0.36.0 synchronized with frontend

## [0.5.0] - 2026-04-08

### Added
- **Native Windows Launcher (PACTA.exe)** - Go-based launcher with embedded contract icon
- **First-offline installer** - Auto-generates .env with JWT_SECRET during installation
- **Automatic NSSM service configuration** - Correct paths, environment variables, and logging
- **Windows Firewall rule** - Auto-adds inbound rule for port 3000 during install
- **Desktop shortcut option** - Optional desktop icon during installation
- **Version info embedding** - File properties show PACTA branding in Windows Explorer
- **Direct launch mode** - `--no-wait` flag skips server health check

### Changed
- **start.bat** - Improved output with server URL display and clear instructions
- **Installer shortcuts** - All shortcuts now use PACTA.exe launcher with consistent icon
- **GitHub Actions workflow** - Compiles Go launcher with goversioninfo for icon embedding

### Technical Details
- **Files Created:** 10 files (launcher source, build scripts, icons, manifests)
- **Files Modified:** 3 files (workflow, ISS, start.bat)
- **Lines Added:** 440 lines
- **Languages:** Go, Inno Setup Pascal Script, Batch, YAML

### Installer Improvements
- Auto-generates unique JWT_SECRET using GUID during install
- Sets NODE_ENV, PORT, HOSTNAME environment variables for NSSM service
- Configures stdout/stderr logging to `shared/logs/`
- Creates all required directories (data, uploads, logs, config)
- Uninstall cleans up NSSM service and firewall rule

### Security
- JWT_SECRET auto-generated per installation (no default credentials)
- CORS restricted to local origins
- httpOnly cookies for token storage
- Role-based authorization middleware

[Unreleased]: https://github.com/PACTA-Team/pacta_appweb/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/PACTA-Team/pacta_appweb/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/PACTA-Team/pacta_appweb/releases/tag/v0.4.1

## [0.3.1] - 2026-04-08

### Fixed
- **Release build pipeline** - Fixed broken Linux .deb and Windows .exe artifacts

### Linux (.deb)
- Added `EnvironmentFile` to pacta.service for proper .env loading
- Fixed postinst script to install systemd service file to `/etc/systemd/system/`
- Auto-generate JWT_SECRET on install if placeholder detected
- Include `.next/standalone` build output in package (was missing)
- Include `.next/static` and `public` folder for static assets
- Create required directories (data, uploads, logs, config)
- Clean up service file on uninstall

### Windows (.exe)
- Fixed start.bat paths to use correct standalone structure
- Added .env loading via NSSM AppEnvironmentExtra
- Added log file configuration (stdout/stderr)
- Include `.next/static` and proper directory structure

### General
- Added `PORT=3000` to .env.example
- Added build verification step to catch missing standalone early

## [0.2.0-security] - 2026-04-07

### Security
- JWT secret management: fail-hard in production without JWT_SECRET
- Removed hardcoded default credentials
- Server-side route protection via middleware with JWT verification
- httpOnly cookies instead of localStorage for token storage
- Upload endpoint protected with authentication + magic byte validation
- CORS restricted to local origins (127.0.0.1, localhost)
- Role-based authorization middleware (requireRole)
- Error message sanitization in production
- Health endpoint made read-only (no database seeding)
- Password validation strengthened (min 12 chars, complexity)
- Admin approval workflow for new user registrations

### Added
- Setup wizard for initial admin creation
- Pending approval page for new registrations
- GitHub Actions workflow for multi-platform binary builds
- Linux/Windows packaging with systemd/NSSM services

### Tests
- 41 tests passing (auth, seed, middleware, login, register)

[Unreleased]: https://github.com/PACTA-Team/pacta_appweb/compare/v0.2.0-security...HEAD
[0.2.0-security]: https://github.com/PACTA-Team/pacta_appweb/releases/tag/v0.2.0-security
