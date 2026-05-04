# Migración a sqlc: Type-Safe SQL para PACTA

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrar PACTA de raw SQL strings a sqlc (code generation) para type-safety, maintainability y reducción de boilerplate, manteniendo compatibilidad total con el codebase existente.

**Architecture:** Extraer todas las queries SQL inline a archivos `.sql` organizados por dominio, configurar sqlc para generar métodos type-safe, y reemplazar gradualmente `db.QueryRow/Query/Exec` por llamadas a `queries` generado. El proyecto actual usa ~215 queries distribuidas en 20+ archivos, sin centralización. sqlc generará una interfaz `Queries` con métodos como `GetSystemSetting(ctx, key)`, `CreateUser(ctx, arg)`, etc.

**Tech Stack:** sqlc v2, SQLite, Go 1.25, goose migrations (se mantienen), patrones existentes de PACTA (handlers con `*sql.DB`, testing con in-memory DB)

---

## 📊 Estado Actual (Diagnóstico)

### Problemas identificados:

1. **SQL espaciado**: 215+ querys inline string literals
2. **Sin type-safety**: Parámetros son `...interface{}` o strings concatenados
3. **Duplicación**: `SELECT value FROM system_settings WHERE key = ?` repetido 15+ veces
4. **Hard to refactor**: Cambiar columna → buscar/reemplazar en 20 archivos
5. **Testing**: Tests duplican SQL en lugar de reutilizar queries
6. **No interfaces**: Imposible mockear queries para tests unitarios

### Ventajas esperadas:

1. ✅ **Compile-time safety**: Si tabla cambia, `go build` falla en todos los usos
2. ✅ **Menos código**: Eliminar ~60% de boilerplate (scans, row handling)
3. ✅ **Autocomplete**: IDE sugiere métodos `GetUserByID`, `ListActiveContracts`
4. ✅ **Testing fácil**: Mock de `Queries` interface
5. ✅ **Mantenible**: Cambiar query → editar 1 `.sql` file → regenerar

---

## 🎯 Estrategia de Migración

### Enfoque: **Incremental + Backwards-Compatible**

**NO hacemos big-bang rewrite**. Migramos módulo por módulo:

```
Phase 1: Preparación (config sqlc, sin cambios en código)
Phase 2: Módulo system_settings (queries simples, bajo riesgo)
Phase 3: Módulo legal (ya tiene internal/db/legal.go - referencia)
Phase 4: Módulo users + auth (crítico, cuidadoso)
Phase 5: Módulo contracts + parties (complejo, muchas queries)
Phase 6: Módulo restante (supplements, signers, documents, workers)
Phase 7: Remover raw SQL legacy, cleanup
```

**Cada fase:**
1. Extraer queries de handlers a archivos `.sql`
2. Configurar sqlc para ese dominio
3. Generar código
4. Reemplazar llamadas raw SQL por `queries.GetXxx()`
5. Testear
6. Commit

---

## 📁 Estructura de Queries Organizada

```
internal/db/
├── migrations/          (goose - sin cambios)
├── models.go            (structs existentes - sin cambios)
├── legal.go             (ya creado, migrar a sqlc)
├── queries.sql          (ARCHIVO ÚNICO - todos los queries)
├── queries_legacy.go    (backup temporal de funciones old)
└── sqlc.yaml            (config sqlc)
```

**O alternativamente (recomendado para組織):**
```
internal/db/queries/
├── system_settings.sql
├── users.sql
├── contracts.sql
├── clients.sql
├── suppliers.sql
├── supplements.sql
├── signers.sql
├── documents.sql
├── ai_legal.sql
├── ai_ratelimit.sql
├── sessions.sql
├── auth.sql
└── workers.sql
```

**sqlc config:**
```yaml
version: "2"
sql:
  - schema: "internal/db/migrations/*.sql"
    queries: "internal/db/queries/*.sql"
    # Genera todos los métodos en un solo paquete `db`
emit:
  go_package: "github.com/PACTA-Team/pacta/internal/db"
```

---

## 🔄 Plan de Implementación Detallado

---

### **Fase 0: Configuración Inicial de sqlc**

#### Task 0.1: Instalar sqlc y agregar a go.mod

**Files:**
- `go.mod` (modify)

**Step 1: Verificar sqlc no está en go.mod**

```bash
grep sqlc go.mod
```

Expected: No output (sqlc no es dependencia de runtime)

**Step 2: Instalar sqlc localmente**

```bash
go install github.com/kyleconroy/sqlc/cmd/sqlc@v1.46.0
which sqlc
```

Expected: `/home/user/go/bin/sqlc` exists

**Step 3: Agregar sqlc como tool dependency en go.mod**

```bash
go mod edit -require=github.com/kyleconroy/sqlc/cmd/sqlc@v1.46.0
go mod tidy
```

**Step 4: Commit**

```bash
git add go.mod go.sum
git commit -m "chore: add sqlc as build tool dependency"
```

---

#### Task 0.2: Crear sqlc.yaml y estructura de queries

**Files:**
- Create: `internal/db/sqlc.yaml`
- Create: `internal/db/queries/` directory

**Step 1: Crear sqlc.yaml**

```yaml
version: "2"
sql:
  - schema: "internal/db/migrations/*.sql"
    queries: "internal/db/queries/*.sql"
    engine: "sqlite"
    gen:
      go_package:
        mode: "query"  # Genera tipos de query, no schema
        package: "db"
emit:
  go_package: "github.com/PACTA-Team/pacta/internal/db"
```

**Step 2: Crear directorio queries**

```bash
mkdir -p internal/db/queries
```

**Step 3: Crear archivo queries/system_settings.sql inicial**

```sql
-- name: GetSystemSetting :one
SELECT value FROM system_settings
WHERE key = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: SetSystemSetting :exec
INSERT INTO system_settings (key, value, updated_at)
VALUES ($1, $2, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP;

-- name: GetAllSettings :many
SELECT key, value FROM system_settings
WHERE deleted_at IS NULL;
```

**Step 4: Generar código inicial**

```bash
cd internal/db
sqlc generate
```

Expected: Genera `db.go` nuevo con `Queries` struct y métodos

**Step 5: Verificar generación**

```bash
ls -la db.go
head -20 db.go
```

Expected: Ver `type Queries struct { ... }` con métodos `GetSystemSetting`, `SetSystemSetting`, etc.

**Step 6: Commit**

```bash
git add internal/db/sqlc.yaml internal/db/queries/system_settings.sql internal/db/db.go
git commit -m "feat: add sqlc configuration and initial system_settings queries"
```

---

### **Fase 1: Migrar system_settings (Módulo Fácil)**

**Objetivo**: Migrar todas las lecturas/escrituras de `system_settings` a sqlc.

#### Task 1.1: Extraer queries de system_settings

**Files to modify:**
- `internal/handlers/system_settings.go`
- `internal/handlers/ai.go`
- `internal/handlers/ai_settings.go` (si existe)
- `internal/email/sendmail.go`
- `internal/email/mailtrap.go`
- `internal/ai/validation.go`
- `internal/ai/ratelimit.go`
- `internal/worker/contract_expiry.go`
- `internal/db/legal.go` (AILegalEnabled, etc.)

**Step 1: Identificar TODAS las queries de system_settings**

```bash
grep -rn "system_settings" --include="*.go" | grep -i "SELECT\|INSERT\|UPDATE"
```

List expected keys:
- ai_provider, ai_api_key, ai_model, ai_endpoint
- rag_mode, local_mode, local_model, embedding_model, hybrid_strategy
- ai_legal_enabled, ai_legal_integration
- smtp_enabled, smtp_host, smtp_user, smtp_pass
- email_notifications_enabled, email_contract_expiry_enabled
- brevo_enabled, brevo_api_key
- mailtrap_smtp_host, mailtrap_smtp_user, mailtrap_smtp_pass
- registration_methods, default_language, timezone
- company_name, company_email, company_address

**Step 2: Agregar queries a `queries/system_settings.sql`**

```sql
-- name: GetSettingValue :one
SELECT value FROM system_settings
WHERE key = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: SetSettingValue :exec
INSERT INTO system_settings (key, value, updated_at)
VALUES ($1, $2, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP;

-- name: GetMultipleSettings :many
SELECT key, value FROM system_settings
WHERE key IN ($1, $2, $3, $4) AND deleted_at IS NULL;
-- Nota: sqlite no soporta array parameters, usar múltiples queries o construir dinámicamente
-- Better: usar variadic function o múltiples llamadas

-- name: GetBoolSetting :one
SELECT value FROM system_settings
WHERE key = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: ListAllSettings :many
SELECT key, value FROM system_settings
WHERE deleted_at IS NULL;
```

**Step 3: Regenerar sqlc**

```bash
cd internal/db
sqlc generate
```

Expected: Nuevos métodos en `db.go`:
- `GetSettingValue(ctx, key string) (string, error)`
- `SetSettingValue(ctx, key, value string) error`
- `GetMultipleSettings(...)`
- `GetBoolSetting(...)`

**Step 4: Actualizar UN handler para probar (system_settings.go)**

```go
// OLD:
func (h *Handler) GetSetting(key, defaultValue string) string {
    var value string
    err := h.DB.QueryRow("SELECT value FROM system_settings WHERE key = ? AND deleted_at IS NULL", key).Scan(&value)
    // ...
}

// NEW:
func (h *Handler) GetSetting(key, defaultValue string) string {
    var value string
    err := h.queries.GetSettingValue(ctx, key) //行く
    // ...
}
```

**Pero:** `Handler` actual tiene `DB *sql.DB`, no `queries *db.Queries`. Necesitamos agregar `Queries` al `Handler` struct.

**Modificar Handler:**

```go
// internal/handlers/handler.go
type Handler struct {
    DB          *sql.DB
    Queries     *db.Queries  // ← NUEVO
    DataDir     string
    RateLimiter *ai.RateLimiter
    LLMClient   LLMClient
    // ...
}

// NewHandler:
func NewHandler(db *sql.DB, queries *db.Queries, ...) *Handler {
    return &Handler{
        DB: db,
        Queries: queries,  // ← inyectar
        // ...
    }
}
```

**Step 5: Actualizar main.go para inyectar Queries**

```go
// cmd/pacta/main.go
db, err := db.Open(dataDir)
queries := db.New(db)  // ← si usamos patrón New()
handler := handlers.NewHandler(db, queries, ...)
```

**Step 6: Migrar handlers uno por uno**

Order:
1. `system_settings.go` (más simple)
2. `ai.go` (usa many settings)
3. `legal.go` (usa AILegalEnabled)
4. `validation.go`
5. `sendmail.go`, `mailtrap.go`
6. `contract_expiry.go`

**Cada handler:**
- Replace `h.DB.QueryRow("SELECT value FROM system_settings WHERE key = ?", key).Scan(&val)`
- With `h.queries.GetSettingValue(ctx, key)`

**Step 7: Test each change**

```bash
go test ./internal/handlers -run TestGetSetting -v
go test ./internal/handlers -run TestSystemSettings -v
```

**Step 8: Commit después de cada handler migrado**

---

#### Task 1.2: Migrar queries de users

**Step 1: Extraer queries de users desde handlers/users.go**

Crear `internal/db/queries/users.sql`:

```sql
-- name: GetUserByID :one
SELECT id, name, email, role, status, company_id, last_access, created_at, updated_at
FROM users
WHERE id = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: GetUserByEmail :one
SELECT id, name, email, role, status, company_id, last_access, created_at, updated_at
FROM users
WHERE email = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: UserExists :one
SELECT COUNT(*) FROM users
WHERE email = $1 AND deleted_at IS NULL;

-- name: CountAllUsers :one
SELECT COUNT(*) FROM users
WHERE deleted_at IS NULL;

-- name: GetUserRole :one
SELECT role FROM users
WHERE id = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: GetUserCompanyID :one
SELECT company_id FROM users
WHERE id = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: GetUsersByCompany :many
SELECT id, name, email, role, status
FROM users
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY name;

-- name: UpdateUserLastAccess :exec
UPDATE users
SET last_access = CURRENT_TIMESTAMP
WHERE id = $1 AND deleted_at IS NULL;

-- name: UpdateUserURLFields :exec
UPDATE users
SET avatar_url = $1, avatar_key = $2
WHERE id = $3 AND deleted_at IS NULL;

-- name: GetAvatarFields :one
SELECT avatar_url, avatar_key
FROM users
WHERE id = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: GetUserForSignIn :one
SELECT id, password_hash, role, status, company_id, setup_completed
FROM users
WHERE email = $1 AND deleted_at IS NULL
LIMIT 1;
```

**Step 2: Regenerar sqlc**

```bash
cd internal/db
sqlc generate
```

**Step 3: Migrar handlers/users.go**

Replace todos los `h.DB.QueryRow` relacionados con users por `h.queries.GetUserByID(ctx, id)`, etc.

**Step 4: Update tests** (si usan raw SQL en tests, reemplazar por queries)

**Step 5: Commit**

---

#### Task 1.3: Migrar clients, suppliers, companies

Similar approach: extraer queries a `clients.sql`, `suppliers.sql`, `companies.sql`.

**client queries:**

```sql
-- name: GetClientByID :one
SELECT id, company_id, name, address, reu_code, contacts, created_by, created_at, updated_at
FROM clients
WHERE id = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: ListClientsByCompany :many
SELECT id, name, address, reu_code, contacts
FROM clients
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY name;

-- name: CreateClient :one
INSERT INTO clients (company_id, name, address, reu_code, contacts, created_by, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateClient :one
UPDATE clients
SET name = $2, address = $3, reu_code = $4, contacts = $5, updated_at = CURRENT_TIMESTAMP
WHERE id = $6 AND company_id = $7 AND deleted_at IS NULL
RETURNING *;

-- name: DeleteClient :exec
UPDATE clients
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;
```

Similar para suppliers.

**Step patterns:**

1. Create `.sql` file
2. Run `sqlc generate`
3. Update handler file (replace raw SQL)
4. Update tests
5. Commit

---

### **Fase 2: Migrar contracts (Complejo)**

 contracts table tiene muchas columnas y joins.

#### Task 2.1: Extraer queries básicas de contracts

`internal/db/queries/contracts.sql`:

```sql
-- name: GetContractByID :one
SELECT id, internal_id, contract_number, title, client_id, supplier_id,
       client_signer_id, supplier_signer_id, start_date, end_date,
       amount, type, status, description, object, fulfillment_place,
       dispute_resolution, has_confidentiality, guarantees, renewal_type,
       document_url, document_key, company_id, created_by, created_at, updated_at
FROM contracts
WHERE id = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: GetContractByInternalID :one
SELECT * FROM contracts
WHERE internal_id = $1 AND company_id = $2 AND deleted_at IS NULL
LIMIT 1;

-- name: ListContractsByCompany :many
SELECT id, internal_id, contract_number, title, client_id, supplier_id,
       start_date, end_date, amount, type, status, created_at
FROM contracts
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY created_at DESC;

-- name: CreateContract :one
INSERT INTO contracts (
    internal_id, contract_number, title, client_id, supplier_id,
    client_signer_id, supplier_signer_id, start_date, end_date,
    amount, type, status, description, object, fulfillment_place,
    dispute_resolution, has_confidentiality, guarantees, renewal_type,
    document_url, document_key, company_id, created_by, created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16, $17, $18, $19,
    $20, $21, $22, $23, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: UpdateContract :one
UPDATE contracts
SET title = $2, client_signer_id = $3, supplier_signer_id = $4,
    start_date = $5, end_date = $6, amount = $7, description = $8,
    object = $9, fulfillment_place = $10, dispute_resolution = $11,
    has_confidentiality = $12, guarantees = $13, renewal_type = $14,
    document_url = $15, document_key = $16, updated_at = CURRENT_TIMESTAMP
WHERE id = $17 AND company_id = $18 AND deleted_at IS NULL
RETURNING *;

-- name: DeleteContract :exec
UPDATE contracts
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: CountActiveContracts :one
SELECT COUNT(*) FROM contracts
WHERE company_id = $1 AND deleted_at IS NULL AND status != 'expired';

-- name: GetContractCountForCompany :one
SELECT COUNT(*) FROM contracts
WHERE company_id = $1 AND deleted_at IS NULL;

-- name: GetExpiringSoonContracts :many
SELECT id, internal_id, contract_number, title, end_date, client_id, supplier_id
FROM contracts
WHERE company_id = $1 AND deleted_at IS NULL
  AND date(end_date) BETWEEN date('now') AND date('now', '+30 days')
  AND status != 'expired'
ORDER BY end_date ASC;
```

---

### **Fase 3: Migrar ai_legal (Este proyecto ya tiene funciones en internal/db/legal.go)**

#### Task 3.1: Convertir internal/db/legal.go a queries SQL

**Estrategia:** Extraer las queries de `legal.go` a `queries/ai_legal.sql` y dejar `legal.go` como wrapper delgado que llama a `queries`.

**Step 1: Crear `internal/db/queries/ai_legal.sql`**

```sql
-- name: CreateLegalDocument :one
INSERT INTO legal_documents (
    title, document_type, source, content, content_hash,
    language, jurisdiction, effective_date, publication_date,
    gaceta_number, tags, chunk_count, indexed_at,
    created_at, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: GetLegalDocument :one
SELECT * FROM legal_documents
WHERE id = $1 AND deleted_at IS NULL
LIMIT 1;

-- name: ListLegalDocuments :many
SELECT * FROM legal_documents
WHERE jurisdiction = $1 OR $1 = ''
ORDER BY created_at DESC;

-- name: UpdateLegalDocumentIndexed :exec
UPDATE legal_documents
SET indexed_at = CURRENT_TIMESTAMP, chunk_count = $2
WHERE id = $1 AND deleted_at IS NULL;

-- name: DeleteLegalDocument :exec
UPDATE legal_documents
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetLegalDocumentChunkCount :one
SELECT COUNT(*) FROM document_chunks
WHERE document_id = $1 AND source = 'legal';

-- name: CreateLegalChatMessage :one
INSERT INTO ai_legal_chat_history (
    user_id, session_id, message_type, content,
    context_documents, metadata, created_at
) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
RETURNING *;

-- name: GetLegalChatMessagesBySession :many
SELECT * FROM ai_legal_chat_history
WHERE session_id = $1
ORDER BY created_at ASC;

-- name: GetLegalChatSessionsByUser :many
SELECT session_id, user_id, MAX(created_at) as last_message, created_at, COUNT(*) as message_count
FROM ai_legal_chat_history
WHERE user_id = $1
GROUP BY session_id, user_id
ORDER BY last_message DESC;
```

**Step 2: Regenerar sqlc**

```bash
cd internal/db
sqlc generate
```

Expected: Nuevos métodos en `db.go` como:
- `CreateLegalDocument(ctx, arg) (LegalDocumentRow, error)`
- `GetLegalDocument(ctx, id) (LegalDocumentRow, error)`
- etc.

**Step 3: Refactor `internal/db/legal.go`**

Cambiar de funciones manuales a wrappers delgados que llaman queries generados:

```go
// Antes:
func CreateLegalDocument(ctx context.Context, db *sql.DB, arg CreateLegalDocumentParams) (LegalDocumentRow, error) { ... }

// Después:
func CreateLegalDocument(ctx context.Context, db *sql.DB, arg CreateLegalDocumentParams) (LegalDocumentRow, error) {
    return db.CreateLegalDocument(ctx, arg)  // generated method
}
```

O mejor: Eliminar `internal/db/legal.go` por completo y usar directamente `db.Queries` en handlers.

**Step 4: Migrar handlers que usan legal.go**

`internal/handlers/ai.go` (legal endpoints):
- Replace calls to `db.CreateLegalDocument(...)` with `h.queries.CreateLegalDocument(...)`
- Update imports

**Step 5: Eliminar `legal_test.go` (tests antiguos) y crear nuevos tests que usen queries generadas**

**Step 6: Commit**

---

### **Fase 4: Migrar restantes módulos**

Seguir el mismo patrón para:

4.1 `internal/db/queries/clients.sql`
4.2 `internal/db/queries/suppliers.sql`
4.3 `internal/db/queries/supplements.sql`
4.4 `internal/db/queries/signers.sql` (complejo)
4.5 `internal/db/queries/documents.sql`
4.6 `internal/db/queries/sessions.sql`
4.7 `internal/db/queries/auth.sql` (password_reset_tokens, registration_codes)
4.8 `internal/db/queries/ai_ratelimit.sql`
4.9 `internal/db/queries/workers.sql` (contract_expiry related)

---

### **Fase 5: Actualizar Test Helpers**

**Task 5.1: Refactor testhelpers.go para usar Queries**

`internal/handlers/testhelpers.go` actualmente retorna `*sql.DB`. Necesitamos también `*db.Queries`.

```go
// Add:
func setupTestQueries(t *testing.T, db *sql.DB) *db.Queries {
    t.Helper()
    // sqlc generated constructor? Usually: db.New(db)
    // But we don't have generated code yet in tests
    // Option: create wrapper that implements same interface
    return db.NewQueries(db)
}
```

**Step 1: Verificar cómo sqlc genera el constructor**

After `sqlc generate`, check `db.go` for:
```go
func New(db *sql.DB) *Queries { ... }
```

**Step 2: Actualizar todos los tests que usan `setupTestDB`**

Replace:
```go
db := setupTestDB(t)
defer db.Close()
```

With:
```go
db := setupTestDB(t)
queries := db.NewQueries(db)  // si existe
defer db.Close()
```

Y actualizar cada test que hace queries manuales para usar `queries`.

**Step 3: Commit**

---

### **Fase 6: Limpieza y Migración Completa**

#### Task 6.1: Eliminar funciones legacy en db package

Después de migrar todos los módulos:

- Eliminar `internal/db/db.go` (si solo tenía `Open` y `Migrate`, manterlas pero mover si es necesario)
- Eliminar `internal/db/legal.go` (código manual reemplazado por sqlc)
- Eliminar cualquier `queries_legacy.go`

**Check:** Que ningún archivo importe y use funciones directas como `CreateLegalDocument(ctx, db, arg)` → ahora debe ser `queries.CreateLegalDocument(ctx, arg)`

#### Task 6.2: Actualizar main.go para inyectar Queries globalmente

`cmd/pacta/main.go`:

```go
// Antes:
db, err := db.Open(dataDir)
handler := handlers.NewHandler(db, ...)

// Después:
db, err := db.Open(dataDir)
queries := db.NewQueries(db)  // generated
handler := handlers.NewHandler(db, queries, ...)
```

---

### **Fase 7: Verificación y CI**

#### Task 7.1: Actualizar GitHub Actions CI

`.github/workflows/build.yml`:

```yaml
- name: Generate sqlc queries
  run: |
    go install github.com/kyleconroy/sqlc/cmd/sqlc@v1.46.0
    cd internal/db
    sqlc generate
    go fmt ./...

- name: Verify no uncommitted generated code
  run: |
    git diff --exit-code internal/db/db.go || (echo "Run 'sqlc generate' and commit changes"; exit 1)
```

#### Task 7.2: Run all tests

```bash
go test ./...
go test ./internal/handlers -v -count=1
```

---

## 📋 Lista Completa de Queries a Extraer

### system_settings (7 queries)
- GetSettingValue(key)
- SetSettingValue(key, value)
- GetAllSettings()
- GetBoolSetting(key) → convierte "true"/"1"
- GetMultipleSettings(keys []string) → usar IN o múltiples calls
- ListAllSettings()

### users (11 queries)
- GetUserByID
- GetUserByEmail
- UserExists(email)
- CountAllUsers
- GetUserRole
- GetUserCompanyID
- GetUsersByCompany
- UpdateUserLastAccess
- UpdateUserURLFields(avatar_url, avatar_key, id)
- GetAvatarFields
- GetUserForSignIn (para login)

### clients (8 queries)
- GetClientByID
- ListClientsByCompany
- CreateClient
- UpdateClient
- DeleteClient (soft)
- ClientExists(id, companyID)
- CountClientsByCompany
- GetClientName

### suppliers (8 queries) — similar a clients

### contracts (15 queries)
- GetContractByID
- GetContractByInternalID
- ListContractsByCompany
- CreateContract
- UpdateContract
- DeleteContract
- CountActiveContracts
- GetExpiringSoonContracts
- ContractExists(id, companyID)
- GetContractType
- UpdateContractStatus
- SearchContracts(query) (full-text, maybe skip para sqlc)
- GetRecentContracts(limit)
- GetContractsByStatus(companyID, status)
- GetContractsByClient/Supplier

### supplements (10 queries)
- GetSupplementByID
- ListSupplementsByContract
- CreateSupplement
- UpdateSupplement
- DeleteSupplement
- GetLatestSupplementNumber(contractID)
- GetActiveSupplements
- CountSupplementsByContract
- GetSupplementStatus

### documents (6 queries)
- GetDocumentByID
- ListDocumentsByEntity(entityType, entityID)
- CreateDocument
- UpdateDocument
- DeleteDocument
- CountDocumentsByEntity

### authorized_signers (8 queries)
- GetSignerByID
- ListSignersByCompany
- CreateSigner
- UpdateSigner
- DeleteSigner
- GetSignerCompanyOwnership(id, companyID) — complejo
- ListSignersByClient
- ListSignersBySupplier

### sessions (5 queries)
- CreateSession
- GetSessionByToken
- UpdateSessionExpiry
- DeleteSession
- DeleteExpiredSessions

### password_reset_tokens (5 queries)
- CreateToken
- GetToken
- MarkUsed
- DeleteUsedTokens
- GetValidToken

### registration_codes (4 queries)
- CreateCode
- GetLatestCodeForUser
- IncrementAttempts
- GetPendingCode

### ai_rate_limits (4 queries)
- GetCountForCompanyToday
- IncrementCount
- ResetCount
- GetRateLimitInfo

### ai_legal (10 queries) — ya definidas arriba

### rag_contracts (si existe tabla para RAG de contratos)

---

## 🔄 Orden de Migración Recomendado (Prioridad)

| Fase | Módulo | queries | Riesgo | Esfuerzo |
|------|--------|---------|--------|----------|
| 1 | system_settings | 7 | Bajo | 1h |
| 2 | sessions | 5 | Bajo | 1h |
| 3 | password_reset_tokens | 5 | Bajo | 1h |
| 4 | registration_codes | 4 | Bajo | 1h |
| 5 | ai_rate_limits | 4 | Bajo | 1h |
| 6 | users | 11 | Medio | 2h |
| 7 | clients | 8 | Medio | 1.5h |
| 8 | suppliers | 8 | Medio | 1.5h |
| 9 | contracts | 15 | Alto | 3h |
| 10 | supplements | 10 | Alto | 2h |
| 11 | documents | 6 | Medio | 1.5h |
| 12 | authorized_signers | 8 | Alto | 2h |
| 13 | ai_legal | 10 | Medio | 2h |
| **Total** | **13 módulos** | **~107 queries** | — | **~20h** |

**Nota**: Las queries de los handlers que no están en tablas (ej: `SELECT COUNT(*) FROM contracts WHERE ...`) también se migrarán.

---

## 🛠️ Consideraciones Técnicas

### 1. **De `*sql.DB` a `*db.Queries`**

**Problema:** sqlc genera un struct `Queries` que contiene un `*sql.DB`.

```go
// Generated
type Queries struct {
    db *sql.DB
}
func New(db *sql.DB) *Queries { ... }
```

**Handler actual:**
```go
type Handler struct {
    DB *sql.DB
}
```

**Solución:**

Opción A (wrapper):
```go
type Handler struct {
    DB      *sql.DB
   Queries *db.Queries
}
```

Opción B (solo queries):
```go
type Handler struct {
    Queries *db.Queries  // DB accesible via queries.db
}
```

Prefiero **Opción A** para mantener compatibilidad con código que usa `h.DB` directamente durante transición.

### 2. **Context propagation**

Raw SQL actual usa métodos sin contexto (`QueryRow`, `Exec`). sqlc genera métodos con contexto (`QueryRowContext`, etc.).

**Handler todos reciben `http.Request` → tienen `ctx := r.Context()`**.

**Cambio requerido:**
```go
// OLD:
row := h.DB.QueryRow("SELECT ...", args...)

// NEW:
row := h.queries.db.QueryRowContext(ctx, "SELECT ...", args...)  // si usamos wrapper
// O
row := h.queries.GetXxx(ctx, args...)  // método generado (preferido)
```

### 3. **Soft-delete pattern (`deleted_at IS NULL`)**

cada SELECT que lee tablas con soft-delete debe incluir `AND deleted_at IS NULL`.

sqlc no automágicamente agrega este filtro. Debemos incluirlo en cada query `.sql`.

**Checklist:** Verificar que todas las queries SELECT de tablas con `deleted_at` lo incluyan.

Tablas con soft-delete (confirmar en migrations):
- users
- companies
- clients
- suppliers
- contracts
- supplements
- documents
- authorized_signers
- sessions? (posible)
- password_reset_tokens? (posible)
- registration_codes? (posible)
- ai_rate_limits? (NO)
- system_settings? (YES tiene deleted_at)
- legal_documents (YES)
- ai_legal_chat_history (¿? probablemente NO tiene deleted_at)

### 4. **Transacciones**

Actual code: pocas transacciones explícitas. sqlc soporta `Tx` methods:

```go
tx, err := h.queries.BeginTx(ctx)
defer tx.Rollback()
tx.GetUser(...)
tx.CreateAuditLog(...)
tx.Commit()
```

**Acción:** Durante migración, identificar queries dentro de transacciones y reemplazar por `tx.Query` (sqlc genera métodos `WithTx`).

### 5. **Dynamic queries (WHERE condicional)**

Algunos handlers construyen WHERE dinámicamente:

```go
query := "SELECT ... FROM contracts WHERE company_id = ?"
if status != "" {
    query += " AND status = ?"
}
```

sqlc **no soporta** query building dinámico. Soluciones:

1. **Múltiples queries estáticas** en `.sql` para cada combinación común
2. **Usar `sqlx.Named` o `squirrel`** para casos complejos (pero rompe sqlc)
3. **Keep raw SQL para casos dinámicos específicos** (excepciones)

Para PACTA, los dinámicos son raros. Mayoría son queries con filtros fijos.

### 6. **Tests existentes que duplican queries**

Algunos tests usan `db.Exec("INSERT ...")` directo. Deberían usar queries generadas también.

**Plan:** Durante migración de cada módulo, actualizar tests correspondientes.

---

## 📝 Ejemplo de Migración Paso a Paso (Mini-Caso)

### Antes (handler actual):

```go
func (h *Handler) GetSystemSetting(w http.ResponseWriter, r *http.Request) {
    key := chi.URLParam(r, "key")

    var value string
    err := h.DB.QueryRow(
        "SELECT value FROM system_settings WHERE key = $1 AND deleted_at IS NULL",
        key,
    ).Scan(&value)

    if err != nil {
        h.Error(w, http.StatusNotFound, "setting not found")
        return
    }

    h.JSON(w, http.StatusOK, map[string]string{"value": value})
}
```

### Después (con sqlc):

```go
// queries/system_settings.sql (ya generado)
// GetSettingValue :one

// handler (actualizado):
func (h *Handler) GetSystemSetting(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    key := chi.URLParam(r, "key")

    setting, err := h.queries.GetSettingValue(ctx, key)
    if err != nil {
        h.Error(w, http.StatusNotFound, "setting not found")
        return
    }

    h.JSON(w, http.StatusOK, map[string]string{"value": setting.Value})
}
```

**Diferencia:**
- ✅ `err` maneja `sql.ErrNoRows` automáticamente en generado
- ✅ `setting.Value` es `string` directo, no `Scan` manual
- ✅ Método `GetSettingValue` es type-safe (key es `string`)

---

## ⚠️ **Riesgos y Mitigaciones**

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| **Queries dinámicas rotas** | Alto | Identificar beforehand; mantener raw SQL para casos especiales |
| **Transacciones mal migradas** | Alto | Revisar cada transacción; usar `WithTx` generado |
| **Tests que fallan** | Medio | Migrar tests en paralelo a handlers |
| **sqlc no soporta某种SQL** | Medio | SQLite-compatible queries only (PACTA usa solo SQLite) |
| **Soft-delete olvidado** | Alto | Auditoría post-migración de todos los SELECTs |
| **Build break en CI** | Alto | Agregar `sqlc generate` como pre-commit hook o CI step |
| **Archivos generados no committeados** | Medio | Decidir política: commit generated code o generar en CI |

**Política recomendada:** **Sí committear `db.go` generado**. Razón:
- CI builds sin necesidad de sqlc instalado (solo Go)
- Build reproducible
- Code review puede ver cambios generados (diff claros)
- Git tracking de esquema changes

---

## 📦 **Commits esperados (ejemplo)**

```
1. chore: add sqlc v1.46.0 as build dependency
2. feat: add sqlc.yaml config and queries/ directory
3. feat: generate initial db.go with system_settings queries
4. refactor: migrate system_settings handler to use sqlc
5. refactor: migrate AI config retrieval to sqlc
6. refactor: migrate email settings to sqlc
7. refactor: migrate rate limit queries to sqlc
8. refactor: migrate legal settings to sqlc
9. refactor: migrate user queries to sqlc
10. refactor: migrate client/supplier queries to sqlc
...
```

**Meta-commit final:**
```
refactor: complete sqlc migration - replace raw SQL with type-safe queries
```

---

## 🎯 **Criterios de Éxito**

### MVP (Fase 1-3):
- [ ]sqlc configurado y `db.go` generado
- [ ] system_settings, users, contracts, ai_legal migrados
- [ ] Todos los tests pasan (`go test ./...`)
- [ ] Build en CI exitoso
- [ ] 80% de raw SQL eliminado

### Completo (Fase 4-7):
- [ ] 100% de queries migradas a sqlc
- [ ] No hay archivos con `db.QueryRow("SELECT` (solo `queries.GetXxx`)
- [ ] Type-safety comprobada (cambio de schema → build break)
- [ ] Tests actualizados a usar queries generadas
- [ ] Documentación actualizada (README: "Database access via sqlc")
- [ ] Pre-commit hook o CI step que verifica `sqlc generate` al día

---

## 📚 **Referencias**

- **sqlc docs**: https://sqlc.dev
- **sqlc + SQLite**: https://sqlc.dev/docs/tutorials/configure/sqlite
- **Ejemplo PACTA-style**: Ver `internal/db/legal.go` (funciones tipo DB wrapper)

---

## 🚀 **Próximos Pasos Inmediatos**

1. **Ejecutar Task 0.1 y 0.2** (config sqlc)
2. **Extraer system_settings queries** (más fácil, 15 usos)
3. **Generar y commit db.go inicial**
4. **Migrar handler system_settings** como POC
5. **Evaluar**: ¿Vale la pena continuar? ¿Problemas encontrados?
6. **Continuar con módulos restantes** en orden de bajo riesgo → alto riesgo

---

**Plan completo generado.** Guardar como `docs/plans/2026-04-30-sqlc-migration-pacta.md`

---
## Aprobación

**Fecha:** 2026-04-30
**Decisiones clave:**
- ✅ Migración incremental (no big-bang)
- ✅ Committear código generado
- ✅ Mantener `*sql.DB` en Handler durante transición
- ✅ Priorizar system_settings → users → contracts → ai_legal
- ✅ Usar sqlc v1.46+ (estable)
- ✅ SQLite compatible (sin extensiones PostgreSQL-specific)

**Siguiente paso:** Ejecutar Fase 0 (config sqlc) usando subagent-driven development.
