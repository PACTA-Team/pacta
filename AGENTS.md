# AGENTS.md - Pacta Project Rules

## Rutas de Archivos

- **Ruta base del proyecto**: `/home/mowgli/pacta/`
- Usar rutas relativas desde la raíz del proyecto al hacer edits
- NO usar ruta absoluta completa en oldString/newString

## Critical: Local-Write, CI-Build

- **DO**: Write code, create features, fix bugs
- **DO NOT**: Run `go build`, `go mod tidy`, `npm run build`, compile, or test locally
- **REASON**: Local environment not configured; Go, Node, and all tooling only available in GitHub Actions

## Build Process (CI Reference)

Build runs on every push to any branch (`.github/workflows/build.yml`):

```bash
# 1. Build frontend
cd pacta_appweb && npm ci && npm run build

# 2. Copy dist to Go embedding location
cp -r pacta_appweb/dist cmd/pacta/dist

# 3. Go tidy and build
go mod tidy
go build ./...
go vet ./...
```

**Go version**: 1.25 (CI uses this; go.mod says 1.23+)
**Node version**: 22+

## Project Structure

```
cmd/pacta/         - Entry point, embeds frontend from ./dist
internal/
  server/          - HTTP server, chi router, static serving
  db/              - SQLite migrations (auto-applied on startup)
  handlers/        - REST API handlers
  models/          - Go structs
  auth/            - Bcrypt + session management
pacta_appweb/      - Vite + React + TypeScript frontend (ACTIVE)
frontend/          - Legacy static site (ignore)
```

## Development (Two Terminals)

```bash
# Terminal 1: Frontend (Vite dev)
cd pacta_appweb && npm run dev

# Terminal 2: Go server
go run ./cmd/pacta
```

Server runs on `http://127.0.0.1:3000`.

## Adding Migrations

1. Create `internal/db/NNN_description.sql`
2. Auto-applied on next startup (tracked in `schema_migrations`)

## Release Process

Tag with `v*` triggers release workflow (`.github/workflows/release.yml`):
- Builds frontend + Go binary
- Runs GoReleaser for multi-platform packages

## Skills

- **ci-debug-workflow**: Required for CI failures
- **systematic-debugging**: Root cause analysis
- **brainstorming**: When solution unclear

## Self-Improvement Loop

 Después de cualquier corrección del usuario, seguir este flujo:

1. **Registrar**: Documentar el error en `docs/LESSONS.md` siguiendo el formato establecido
2. **Regla**: Escribir una regla concreta que prevenga el mismo error
3. **Iterar**: Refinar las reglas hasta que la tasa de error se reduzca
4. **Revisar**: Consultar `docs/LEESONS.md` al inicio de cada sesión para errores relevantes del proyecto

### Reglas de Prevención de Errores

- **Nunca repetir soluciones**: Si un error ya fue documentado, aplicar la regla existente
- **Causa raíz antes de acción**: Solo documentar después de investigar la causa real
- **Reglas accionables**: Cada lección debe tener una regla verificable y específica
- **Actualización inmediata**: Registrar errores inmediatamente, no "después"
- **Revisión proactiva**: Al inicio de sesión, revisar lecciones relevantes al trabajo actual
