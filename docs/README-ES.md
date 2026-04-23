# PACTA

**Sistema de Gestión de Ciclo de Vida de Contratos**

[![Release](https://img.shields.io/github/v/release/PACTA-Team/pacta?sort=semver&color=green)](https://github.com/PACTA-Team/pacta/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go Report Card](https://goreportcard.com/badge/github.com/PACTA-Team/pacta)](https://goreportcard.com/report/github.com/PACTA-Team/pacta)
[![CI](https://github.com/PACTA-Team/pacta/actions/workflows/release.yml/badge.svg)](https://github.com/PACTA-Team/pacta/actions/workflows/release.yml)
[![Downloads](https://img.shields.io/github/downloads/PACTA-Team/pacta/total?color=orange)](https://github.com/PACTA-Team/pacta/releases)

PACTA es una plataforma de gestión de contratos con enfoque local-first, diseñada para organizaciones que requieren control total sobre sus datos. Distribuido como un único binario sin dependencias externas, se ejecuta completamente en tu máquina — sin nube, sin servidores de terceros, sin datos saliendo de tu infraestructura.

🇺🇸 [Read in English →](../README.md)

---

## Características

- **Gestión de Contratos** — Operaciones CRUD completas con borrado suave, seguimiento de versiones y flujos de estado
- **Registro Híbrido** — Verificación por código de correo (vía SMTP local) o aprobación de administrador con asignación de empresa
- **Gestión de Partes** — Registro centralizado de clientes, proveedores y firmantes autorizados
- **Flujos de Aprobación** — Aprobaciones estructuradas de suplementos con estados de borrador, aprobado y activo
- **Adjuntos de Documentos** — Vincula documentos de respaldo directamente a contratos y partes
- **Notificaciones y Alertas** — Recordatorios automáticos para contratos por expirar y próximas renovaciones
- **Pista de Auditoría** — Pantalla de historial completo con filtrado, paginación y registro de actividad de usuario; log inmutable de todas las operaciones para cumplimiento
- **Control de Acceso Basado en Roles** — Permisos granulares entre roles de administrador, gerente, editor y visor
- **Soporte Multi-Empresa** — Aislamiento completo de datos entre empresas; contratos con ámbito por empresa con validación FK; soporte para modos de empresa única y multi-empresa
- **Panel de Aprobación de Administrador** — Aprobaciones de usuarios pendientes con asignación de empresa y notificaciones por correo
- **Asistente de Configuración** — Asistente multi-paso mejorado con configuración de empresa, selección de roles, paso de firmantes, modo tutorial y protección de rutas para configuración pendiente
- **Página de Perfil** — Perfil de usuario con información de cuenta, cambio de contraseña, gestión de certificados y registro de actividad personal
- **Tema Claro/Oscuro** — Alternancia de tema con conciencia del sistema y preferencias persistentes
- **Cero Dependencias Externas** — Un único binario estático, SQLite embebido, sin servidor de base de datos necesario

---

## Inicio Rápido

### 1. Descargar

Obtén la última versión para tu plataforma desde la página de [Releases](https://github.com/PACTA-Team/pacta/releases).

### 2. Instalar

| Plataforma | Guía |
|------------|-------|
| 🐧 Linux (Producción) | [Guía de Instalación →](docs/INSTALLATION-LINUX.md) |
| 🪟 Windows (Local) | [Guía de Instalación →](docs/INSTALLATION-WINDOWS.md) |
| 🍎 macOS | Descarga `.tar.gz` desde [Releases](https://github.com/PACTA-Team/pacta/releases), extrae, ejecuta `./pacta` |

### 3. Ejecutar

```bash
./pacta
```

La aplicación se inicia en `http://127.0.0.1:3000` y abre tu navegador automáticamente.

### 4. Configurar

En la primera ejecución, PACTA abre un **Asistente de Configuración** en tu navegador. Navega a `/setup` (o espera la redirección automática) para configurar:

1. **Información de la empresa** — Detalles básicos de la organización
2. **Cuenta de administrador** — Correo electrónico y contraseña para el administrador principal
3. **Selección de roles** — Elige roles y permisos de usuario
4. **Registro de firmantes** — Agrega firmantes autorizados de contratos
5. **Modo tutorial** — Recorrido guiado opcional

Una vez completada la configuración, serás redirigido a la página de inicio de sesión. Usa las credenciales que creaste para iniciar sesión.

> **Nota:** El asistente de configuración solo aparece en la primera ejecución. Si necesitas reconfigurar, elimina el archivo de base de datos SQLite y reinicia PACTA.

---

## Plataformas Soportadas

| SO      | Arquitectura | Formato         | Guía |
|---------|-------------|-----------------|------|
| Linux   | amd64       | `.tar.gz`, `.deb` | [Guía Linux →](docs/INSTALLATION-LINUX.md) |
| Linux   | arm64       | `.tar.gz`, `.deb` | [Guía Linux →](docs/INSTALLATION-LINUX.md) |
| macOS   | amd64       | `.tar.gz`       | Extrae y ejecuta `./pacta` |
| macOS   | arm64       | `.tar.gz`       | Extrae y ejecuta `./pacta` |
| Windows | amd64       | `.tar.gz`       | [Guía Windows →](docs/INSTALLATION-WINDOWS.md) |

---

## Arquitectura

PACTA sigue una arquitectura minimalista y autocontenida:

```
┌──────────────────────────────────────────────┐
│  pacta (único binario Go)                    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Frontend React + TypeScript embebido  │  │
│  │  (compilación Vite, generado estático) │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  Base de datos SQLite (Go puro, sin CGO)│  │
│  │  └─ Migraciones SQL (auto-aplicadas)   │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  Servidor HTTP (:3000)                 │  │
│  │  ├── GET /*    → frontend estático     │  │
│  │  └── /api/*    → API REST (chi router) │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Todos los datos permanecen locales.         │
│  No se requiere internet.                    │
└──────────────────────────────────────────────┘
```

### Stack Tecnológico

| Capa         | Tecnología                            |
|--------------|---------------------------------------|
| Backend      | Go 1.25, chi router                   |
| Base de datos| SQLite (`modernc.org/sqlite`, Go puro)|
| Frontend     | React 19, TypeScript, Vite, Tailwind CSS |
| Componentes UI| shadcn/ui                            |
| Animaciones  | Framer Motion                         |
| Autenticación| Sesiones con cookies, bcrypt          |
| Empaquetado  | GoReleaser, NFPM (.deb)               |

---

## Referencia de API

| Método   | Ruta                  | Auth | Descripción                          |
|----------|-----------------------|------|--------------------------------------|
| `POST`   | `/api/auth/register`  | No   | Registrar nuevo usuario              |
| `POST`   | `/api/auth/login`     | No   | Autenticar usuario                   |
| `POST`   | `/api/auth/logout`    | Sí   | Destruir sesión                      |
| `GET`    | `/api/auth/me`        | Sí   | Obtener usuario actual               |
| `GET`    | `/api/contracts`      | Sí   | Listar contratos                     |
| `POST`   | `/api/contracts`      | Sí   | Crear contrato                       |
| `GET`    | `/api/contracts/{id}` | Sí   | Obtener contrato por ID              |
| `PUT`    | `/api/contracts/{id}` | Sí   | Actualizar contrato                  |
| `DELETE` | `/api/contracts/{id}` | Sí   | Borrado suave de contrato            |
| `GET`    | `/api/clients`        | Sí   | Listar clientes                      |
| `POST`   | `/api/clients`        | Sí   | Crear cliente                        |
| `GET`    | `/api/suppliers`      | Sí   | Listar proveedores                   |
| `POST`   | `/api/suppliers`      | Sí   | Crear proveedor                      |
| `GET`    | `/api/setup`          | No   | Obtener estado de configuración      |
| `GET`    | `/api/audit-logs`     | Sí   | Listar registros de auditoría con filtros |
| `GET`    | `/api/audit-logs/contract/{id}` | Sí | Historial de auditoría para un contrato |

---

## Changelog

| Versión | Fecha | Tipo | Resumen |
|---------|-------|------|-----------|
| [v0.24.0](https://github.com/PACTA-Team/pacta/releases/tag/v0.24.0) | 2026-04-13 | 🌍 i18n | Traducciones completas español/inglés, detección de idioma, formato localizado |
| [v0.23.0](https://github.com/PACTA-Team/pacta/releases/tag/v0.23.0) | 2026-04-12 | 🔧 Refactor | API de auditoría, API de configuración de notificaciones, eliminación de localStorage |
| [v0.22.0](https://github.com/PACTA-Team/pacta/releases/tag/v0.22.0) | 2026-04-12 | ✨ Funcionalidad | Auto-avance en modo configuración, feedback táctil de tarjetas |
| [v0.21.0](https://github.com/PACTA-Team/pacta/releases/tag/v0.21.0) | 2026-04-12 | 🔒 Seguridad | Seguridad en flujo de configuración, componente ForbiddenPage |
| [v0.20.4](https://github.com/PACTA-Team/pacta/releases/tag/v0.20.4) | 2026-04-12 | 🐛 Corrección | Orden de migraciones, migraciones de base de datos goose |
| [v0.18.0](https://github.com/PACTA-Team/pacta/releases/tag/v0.18.0) | 2026-04-11 | ✨ Funcionalidad | Landing page, alternancia de tema, animaciones Framer Motion |
| [v0.17.0](https://github.com/PACTA-Team/pacta/releases/tag/v0.17.0) | 2026-04-11 | ✨ Funcionalidad | Soporte multi-empresa, asistente de configuración |

[Ver changelog completo →](../CHANGELOG.md)

---

## Desarrollo

Consulta la [Guía de Desarrollo](DEVELOPMENT.md) para prerrequisitos, configuración local y directrices de contribución.

Inicio rápido para desarrolladores:

```bash
# Terminal 1: Compilar frontend
cd pacta_appweb
npm ci && npm run build

# Terminal 2: Ejecutar servidor Go
cd ..
go run ./cmd/pacta
```

---

## Seguridad

- **Vinculación solo local** — El servidor escucha solo en `127.0.0.1`
- **Cookies httpOnly, SameSite=Strict** — Previene robo de tokens por XSS
- **Hash de contraseñas bcrypt** — Factor de costo 10
- **Consultas SQL parametrizadas** — Sin vectores de inyección SQL
- **Gestión de sesiones del lado del servidor** — Control total del ciclo de vida de la sesión
- **Autorización basada en roles** — Aplicada a nivel del manejador de API

---

## Licencia

Licencia MIT. Ver [LICENSE](../LICENSE) para más detalles.
