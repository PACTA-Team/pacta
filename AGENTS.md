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

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues. Uses `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles with default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.

## CGo Embedding: Phi-3.5-mini-instruct

### Procedimiento para embedding de modelo local

1. **Clonar llama.cpp**:
   ```bash
   cd /home/mowgli/pacta/internal/ai/minirag/
   git clone --depth 1 https://github.com/ggerganov/llama.cpp.git
   cd llama.cpp && mkdir -p build && cd build
   cmake .. -DBUILD_SHARED_LIBS=OFF -DCMAKE_BUILD_TYPE=Release
   make -j$(nproc)
   ```

2. **Descargar modelo Phi-3.5-mini-instruct GGUF**:
   - Desde Hugging Face: `microsoft/Phi-3.5-mini-instruct-gguf`
   - Archivo: `phi-3.5-mini-instruct.Q4_K_M.gguf` (~2GB)
   - Ubicación: `internal/ai/minirag/models/phi-3.5-mini-instruct.Q4_K_M.gguf`

3. **CI/CD con GitHub Actions**:
   - Build.yml y release.yml incluyen pasos para clonar, compilar y descargar modelo
   - Usar `actions/cache@v4` para cachear builds de llama.cpp
   - `CGo_ENABLED=1` necesario para compilar con bindings CGo

4. **Configuración de rutas**:
   - `CGo_CFLAGS`: `-I$(pwd)/internal/ai/minirag/llama.cpp/include`
   - `CGo_LDFLAGS`: `-L$(pwd)/internal/ai/minirag/llama.cpp/build -llama -lm -lstdc++ -lpthread`

5. **Modos de uso (configurable desde frontend)**:
   - `"cgo"`: Phi-3.5-mini-instruct embebido en binario (PREFERIDO)
   - `"ollama"`: Ollama HTTP API (alternativa local)
   - `"external"`: APIs externas (OpenAI, etc.)

### Archivos clave:
- `internal/ai/minirag/cgo_llama.go` — CGo bindings (build tag: `//go:build cgo`)
- `internal/ai/minirag/local_client.go` — LocalClient con 3 modos
- `internal/ai/hybrid/orchestrator.go` — Hybrid orchestrator
- `.github/workflows/build.yml` — CI con CGo
- `.github/workflows/release.yml` — Release con CGo

---

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
