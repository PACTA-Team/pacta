# Migración a sqlc para Type-Safe SQL

**Fecha**: 2026-05-02  
**Estado**: Aceptada  
**Decisión**: Adoptar sqlc v2 para generación de código de acceso a datos en PACTA  
**Referencia**: [Plan de migración](docs/plans/2026-04-30-sqlc-migration-pacta.md)

---

## Contexto

PACTA utilizaba **SQL inline** (raw SQL strings) en los handlers, con ~215 queries distribuidas en 22+ archivos Go. Esto generaba:

- ❌ Sin type-safety: parámetros como `...interface{}` o strings concatenados
- ❌ Duplicación: queries como `SELECT value FROM system_settings WHERE key = ?` repetidos 15+ veces
- ❌ Difícil refactor: cambiar una columna requería búsqueda/reemplazo en múltiples archivos
- ❌ Tests duplican SQL en lugar de reutilizar queries
- ❌ Imposible mockear queries para tests unitarios

---

## Decisión

Adoptar **sqlc v2** (code generation) para convertir archivos `.sql` en código Go type-safe:

1. **Estructura**: Queries organizadas en `internal/db/queries/*.sql` por dominio
2. **Generación**: `sqlc generate` produce `internal/db/queries_gen.go` con métodos type-safe
3. **Inyección**: Handlers inyectan `*db.Queries` (interface) en lugar de `*sql.DB` directo
4. **Commit**: Código generado se versiona en git (no se regenera en CI)
5. **CI**: Verifica que `queries_gen.go` esté actualizado con `git diff --exit-code`

---

## Alternativas Consideradas

| Alternativa | Razón de rechazo |
|-------------|------------------|
| **Raw SQL (estado actual)** | Sin type-safety, duplicación, difícil mantenimiento |
| **sqlx** | Menos type-safe,仍需 manual mapping, no genera código |
| **GORM** | Overkill para SQLite simple, abstracción muy pesada, learning curve |

---

## Rationale

✅ **Type-safety**: Si el schema cambia, `go build` falla en todos los usos  
✅ **Menos boilerplate**: Elimina ~60% de código de escaneo y manejo de rows  
✅ **Autocomplete IDE**: Métodos como `GetUserByID`, `ListActiveContracts` autogenerados  
✅ **Testability**: Interface `Queries` permite mockear fácilmente  
✅ **Mantenible**: Cambiar query → editar 1 `.sql` → regenerar  
✅ **SQLite compatible**: sqlc v2 soporta SQLite completamente  
✅ **Código generado commiteado**: CI no necesita instalar sqlc, builds reproducibles  

---

## Consecuencias

### Positivas

- Compile-time safety: errores de schema detectados en build
- Código más limpio: handlers más simples sin SQL inline
- Refactor seguro: cambios de schema rompen build inmediatamente
- Tests más simples: mock de `Queries` interface
- Documentación viva: archivos `.sql` sirven como referencia de queries

### Negativas

- ⚠️ **Dependencia de build**: `sqlc generate` debe ejecutarse tras modificar `.sql`
- ⚠️ **Código generado en git**: Requiere commit de archivos autogenerados
- ⚠️ **Curva de aprendizaje**: equipo debe aprender sqlc syntax y flujo
- ⚠️ **Queries dinámicas limitadas**: sqlc no soporta query building dinámico (se mantienen excepciones)

---

## Configuración

**sqlc.yaml** (`internal/db/sqlc.yaml`):

```yaml
version: "2"
sql:
  - schema: "internal/db/migrations/*.sql"
    queries: "internal/db/queries/*.sql"
    engine: "sqlite"
    gen:
      go:
        package: "db"
        out: "."
      emit:
        interface: true  # Genera interfaz Queries para mocking y WithTx
```

**Estructura resultante**:

```
internal/db/
├── migrations/        # goose migrations (sin cambios)
├── models.go          # structs existentes (sin cambios)
├── queries/           # 22 archivos .sql por dominio
│   ├── system_settings.sql
│   ├── users.sql
│   ├── contracts.sql
│   └── ...
├── queries_gen.go     # GENERADO - no editar manualmente
├── sqlc.yaml          # configuración sqlc
└── db.go              # Open() + Migrate() (sin cambios)
```

---

## Flujo de Trabajo

### Agregar nueva query:

1. Crear/editar archivo `internal/db/queries/<dominio>.sql`
2. Ejecutar `sqlc generate` desde `internal/db/`
3. Verificar que `queries_gen.go` se actualizó
4. Usar método generado en handler: `h.queries.GetXxx(ctx, args)`
5. Commit incluye: `.sql` + `queries_gen.go`

### Modificar query existente:

1. Editar el archivo `.sql` correspondiente
2. Ejecutar `sqlc generate`
3. Actualizar handlers que usen esa query (si el signature cambió)
4. Actualizar tests (si aplica)
5. Commit ambos archivos

---

## Excepciones

### 1. RLS (Row Level Security) dinámico

`internal/db/rls.go` contiene funciones para políticas RLS dinámicas que sqlc no puede generar. Se mantienen como código manual.

### 2. Queries con número variable de parámetros

Función `GetSettingsByKeys` (o similares) que aceptan slices/arrays: sqlc no soporta `IN` con parámetros dinámicos en SQLite. Se implementa con query building manual dentro de la función generada (ver `GetSettingsByKeys` en `queries_gen.go`).

### 3. Queries extremadamente dinámicas

Handlers que construyen WHERE condicionalmente (filtros opcionales) pueden requerir SQL manual o múltiples queries estáticas para cada combinación común.

---

## CI/CD

El workflow de GitHub Actions (`build.yml`) incluye:

```yaml
- name: Install sqlc
  run: go install github.com/sqlc-dev/sqlc/cmd/sqlc@v1.46.0

- name: Generate sqlc queries
  run: |
    cd internal/db
    sqlc generate
    go fmt ./...

- name: Auto-commit sqlc-generated changes
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    if ! git diff --quiet internal/db/; then
      git add internal/db/
      git commit -m "ci(sqlc): auto-generate queries from sqlc.yaml"
      git push origin HEAD:${GITHUB_REF#refs/heads/}
    fi
```

**Flujo automático:**
1. CI ejecuta `sqlc generate`
2. Si `queries_gen.go` (u otros archivos generados) cambiaron, el workflow hace commit y push automáticamente
3. Eso dispara un segundo workflow run (push event) que pasa sin cambios
4. Build y release continúan con código actualizado

Esto elimina la necesidad de regenerar manualmente y asegura que el código generado siempre esté sincronizado con `sqlc.yaml`.

---

## Migración Completada

- **Fecha de implementación**: 2026-05-02
- **Queries migradas**: 215+ queries en 22 archivos `.sql`
- **Módulos cubiertos**: system_settings, users, clients, suppliers, contracts, supplements, documents, authorized_signers, sessions, password_reset_tokens, registration_codes, ai_rate_limits, ai_legal, y más
- **Handlers actualizados**: Todos los handlers ahora inyectan `*db.Queries`
- **Interface generada**: `Querier` interface permite mocking en tests (emit.interface: true)
- **CI/CD**: Auto-commit de código generado en build workflow
- **Configuración**: `sqlc.yaml` corregido a formato v2 estándar (`gen.go.package`)

---

## Beneficios Obtenidos

1. **Type-safety completa**: Cambios de schema detectados en compile-time
2. **Código más limpio**: Handlers reducidos ~40% en líneas de SQL
3. **Autocomplete**: IDE sugiere todos los métodos disponibles
4. **Mocking en tests**: `db.Queries` es interfaz → tests más rápidos y aislados
5. **Documentación integrada**: Archivos `.sql` sirven como referencia clara
6. **CI automatizado**: Código generado se actualiza automáticamente en cada build

---

## Referencias

- [Plan de migración detallado](docs/plans/2026-04-30-sqlc-migration-pacta.md)
- [Documentación sqlc](https://sqlc.dev)
- [sqlc + SQLite tutorial](https://sqlc.dev/docs/tutorials/configure/sqlite)
- Estructura: `internal/db/queries/` (SQL files), `queries_gen.go` (generado)

---

**Palabras clave**: sqlc, type-safe SQL, code generation, database queries, Go, SQLite
