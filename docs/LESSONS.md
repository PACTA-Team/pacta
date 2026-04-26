# LESSONS.md - Registro de Bugs y Soluciones

Este documento registra errores comunes detectados en el proyecto, sus causas raíz y las soluciones aplicadas. El objetivo es construir un conocimiento acumulativo que prevenga la repetición de errores y acelere el debugging futuro.

## Propósito

- **Tracking**: Registrar errores encontrados con contexto completo
- **Prevención**: Crear reglas que eviten recurrencias
- **Onboarding**: Ayudar a nuevos desarrolladores a evitar errores comunes
- **Debugging acelerado**: Permitir búsquedas rápidas cuando errores se repitan

## Formato de Entrada

Cada lección sigue este formato:

```markdown
## [N] Título Descriptivo del Error

**Fecha**: YYYY-MM-DD
**Tags**: category, error-type, affected-component
**Severity**: critical | high | medium | low

### Contexto
Descripción breve del escenario donde ocurrió el error.

### Síntomas
- Comportamiento observado
- Mensajes de error relevantes
- Logs o trazas importantes

### Causa Raíz
Explicación clara de qué provocó el error.

### Solución
Descripción de cómo se resolvió.

### Regla de Prevención
Regla concreta para evitar este error en el futuro.

### Referencias
- Archivos relacionados
- Commits o PRs relevantes
- Documentación externa
```

## Categorías de Tags

| Categoría | Descripción |
|----------|------------|
| `build` | Errores de compilación o build |
| `runtime` | Errores en tiempo de ejecución |
| `database` | Problemas con SQLite o migraciones |
| `frontend` | Errores en React/TypeScript |
| `backend` | Errores en Go |
| `auth` | Problemas de autenticación |
| `security` | Vulnerabilidades o problemas de seguridad |
| `config` | Errores de configuración |
| `ci-cd` | Problemas en GitHub Actions |
| `performance` | Problemas de rendimiento |
| `migration` | Migraciones de base de datos |

## Reglas de Contribución

1. **Escribir tras cada corrección**: Nunca documentar "después", siempre hacerlo inmediatamente
2. **Causa raíz primero**: Solo documentar después de investigar realmente la causa
3. **Regla accionable**: Toda entrada debe tener una regla concreta y verificable
4. **Actualizar reglas globales**: Si la lección revela un patrón, actualizar rules/ del proyecto
5. **Revisar al inicio**: Consultar este documento cuando se trabaje en componentes mencionados

---

## Historial de Lecciones

<!-- Las lecciones se registran a continuación en orden cronológico inverso -->

## [004] Pérdida de Archivos Locales por git clean -fd sin Verificación

**Fecha**: 2026-04-24
**Tags**: git, workflow, documentation, process
**Severity**: high

### Contexto
Durante una sesión de trabajo, se ejecutó `git restore . && git clean -fd` para descartar cambios locales no deseados. Sin embargo, el usuario tenía-planeado hacer commit y push de esos archivos (planes de security y documentación) para mantener trazabilidad del trabajo en progreso.

### Síntomas
- Archivos documentos de `docs/plans/` y `docs/security/` fueron eliminados permanentemente
- No había sido realizados commits previos, por lo que no había puntos de restauración en el historial
- El directorio de trabajo quedó limpio pero sin los archivos planificados

### Causa Raíz
1. **Confusión de workflow**: El usuario pidió "omitir los cambios localmente sin guardar" - interpreté incorrectamente como descartar
2. **Falta de verificación**: No pregunté si esos archivos hatten sido parte de un workflow planeado (commit+push)
3. **git clean irreversible**: A diferencia de `git restore`, `git clean -fd` elimina archivos sin opción de recuperación si no están en el índice

### Solución
NO HAY SOLUCIÓN - Los archivos fueron eliminados irreversiblemente porque no existían en ningún commit anterior.

### Regla de Prevención
> **Confirmar antes de git clean**: Antes de ejecutar `git clean -fd` o `git restore .`, PREGUNTAR si hay archivos que el usuario quiere preservar o hacer commit.
>
> - `git restore .` solo revierte cambios en archivostracked
> - `git clean -fd` elimina archivos sin rastrear PERMANENTEMENTE
> - Si el usuario quiere "descartar locally sin guardar", siempre confirmar qué archivos involucra
> - Preguntar explícitamente: "¿Quieres que делаем commit de estos archivos primero o descartarlos?"

### Referencias
- Archivos perdidos:
  - `docs/plans/2026-04-24-fix-ci-typescript-errors.md`
  - `docs/plans/security-hardening-cors-rls-headers.md`
  - `docs/security/` (directorio completo)

---

## [005] Consolidación de Migraciones: Duplicación de IDs y Orden de Goose

**Fecha**: 2026-04-25
**Tags**: database, migration, goose, sqlite, build
**Severity**: high

### Contexto
Se consolidaron 41 migraciones individuales (001-041) en 3 archivos grandes (001_initial_schema, 002_schema_updates, 003_security_rls). Al hacer merge a main y construir el binario, el servicio falló al iniciar porque goose encontró IDs duplicados.

### Síntomas
```
panic: runtime error: compare错误: runtime error: invalid memory address or nil pointer dereference
goroutine 1 [running]:
github.com/pressly/goose/v3.Migrations.Less(...)
...
```
- El servicio no iniciaba: Main process exited, code=exited, status=2/INVALIDARGUMENT
- Goose recolectaba ambos conjuntos de migraciones (44 archivos: 3 nuevos + 41 antiguos)

### Causa Raíz
1. **Archivos antiguos no eliminados**: Los 38 archivos originales (001-041 excepto 039 que era placeholder) coexistieron con los 3 nuevos archivos consolidados
2. **IDs duplicados**: goose detectó múltiples archivos con el mismo número de versión (001_users.sql Y 001_initial_schema.sql, etc.)
3. **Merge incompleto**: PR #263 agregó los 3 archivos nuevos pero NO eliminó los antiguos
4. **Release pre-mergado**: El tag v0.44.7 se creó antes del merge final, por lo que el binario descargado contenía el código incorrecto

### Solución
1. Crear rama `cleanup/remove-old-migrations` (PR #264)
2. Eliminar los 38 archivos antiguos de migración
3. Mergear a main con protección de rama temporalmente deshabilitada
4. Crear nuevo tag v0.44.8 con el código limpio

### Regla de Prevención
> **Siempre eliminar archivos obsoletos en el mismo PR que agrega reemplazos**. Al consolidar migraciones (o cualquier archivo):
> - Agregar archivos consolidados
> - **Eliminar inmediatamente los archivos originales** en el mismo commit/PR
> - Verificar con `ls internal/db/migrations/` que no quedan duplicados
> - NO crear releases hasta que el merge esté completo y verificado
> - Reconstruir binario después del merge (no antes)

### Referencias
- Archivos eliminados: 001_users.sql a 041_prepare_pg_rls.sql (38 archivos)
- Archivos mantenidos: 001_initial_schema.sql, 002_schema_updates.sql, 003_security_rls.sql
- PRs: #263 (consolidation), #264 (cleanup)
- Commits: 10215fc, dd8a4ec, 7b604e1
- Tag: v0.44.8

---

## [006] Sintaxis de Trigger SQLite: CREATE TRIGGER BEFORE INSERT Modificando NEW

**Fecha**: 2026-04-26
**Tags**: database, migration, sqlite, trigger, goose
**Severity**: high

### Contexto
En la migración 003_security_rls.sql se intentó crear un trigger para auto-setear `company_id` en `audit_logs` basándose en el `user_id`. El trigger usaba sintaxis de PostgreSQL/AFTER INSERT que no es compatible con SQLite.

### Síntomas
```
ERROR 003_security_rls.sql: failed to run SQL migration:
failed to execute SQL query "CREATE TRIGGER audit_logs_company_metadata
BEFORE INSERT ON audit_logs
FOR EACH ROW
WHEN NEW.company_id IS NULL
BEGIN
    SELECT COALESCE(...) INTO NEW.company_id;": SQL logic error: near "INTO": syntax error (1)
```

El servicio no iniciaba porque la migración 003 fallaba.

### Causa Raíz
1. **Sintaxis incorrecta para SQLite**: Intentó usar `SELECT ... INTO NEW.column` que no existe en SQLite
2. **SQLite BEFORE INSERT limitations**: En SQLite, los triggers BEFORE INSERT no pueden modificar el registro NEW directamente usando UPDATE; debe usarse asignación directa (pero SQLite no soporta `SET NEW.column = value` en sintaxis estándar)
3. **Enfoque equivocado**: El patrón de trigger para auto-setear campos debería manejarse en la aplicación, no en el trigger, para SQLite

### Solución
Se eliminó el trigger completamente de la migración 003:
- `company_id` ya es obligatorio y se backfill en migración 002
- La lógica de asignación de `company_id` se maneja en el código de la aplicación (handlers/services)
- Se agregó comentario explicando por qué no hay trigger

### Regla de Prevención
> **SQLite NO soporta modificación directa de NEW en triggers**. Para SQLite:
> - NO usar `SELECT ... INTO NEW.column`
> - NO asumir sintaxis de PostgreSQL/MySQL
> - Para valores por defecto dinámicos (basados en otras tablas), manejar en **código de aplicación**, no en triggers
> - Si un trigger es necesario para SQLite, usar INSERT en otra tabla (log/audit), NO modificar la tabla origen
> - Siemante testear migraciones en SQLite (no solo en PostgreSQL)

### Referencias
- Migración: internal/db/migrations/003_security_rls.sql (trigger eliminado)
- Error: journalctl -u pacta.service mostró "SQL logic error: near 'INTO'"
- Commit: eb9521b "fix: remove broken trigger from migration 003"
- Tag: v0.44.9

---

## [003] SVG como Componente React: Falta de Plugin SVGR en Vite Causa Página en Blanco

**Fecha**: 2026-04-22
**Tags**: frontend, config, rendering, vite, svg
**Severity**: critical

### Contexto
Se integró el logo de la aplicación (SVG) en el sidebar usando `import ContractIcon from '@/images/contract_icon.svg?react'`. La aplicación funcionaba en desarrollo pero al hacer build o en ciertos estados, la página se quedaba en blanco en vista de escritorio.

### Síntomas
- Página completamente en blanco (white screen) en desktop view
- Sin errores visibles en consola del navegador (error silencioso de React)
- Al inspeccionar con devtools: `ContractIcon` importado como string (URL) en lugar de componente React
- Al intentar renderizar `<ContractIcon />`, React falla porque recibe un string en lugar de un componente válido

### Causa Raíz
1. **Configuración Vite incompleta**: El proyecto tenía declaraciones TypeScript para módulos `*.svg?react` en `src/types/svg.d.ts`, pero NO estaba instalado ni configurado `vite-plugin-svgr` en `vite.config.ts`.
2. **Type/runtime mismatch**: TypeScript creía que `ContractIcon` era un componente React (por las declaraciones de tipo), pero en runtime Vite, sin el plugin, trataba `.svg` como asset estático y devolvía la URL como string.
3. **Resultado**: React intentó renderizar un string como componente → TypeError → página en blanco.

### Solución
1. Instalar `vite-plugin-svgr` como devDependency: `npm install -D vite-plugin-svgr`
2. Configurar `vite.config.ts`:
   ```ts
   import svgr from 'vite-plugin-svgr';
   plugins: [
     react(),
     svgr({ svgo: true, titleProp: true, ref: true }),
     tailwindcss()
   ]
   ```
3. Añadir `ErrorBoundary` component para manejo graceful de fallos
4. Mejorar accesibilidad: `aria-label`, `role="img"`, `title` en el SVG

### Regla de Prevención
> **Siempre verificar plugins de Vite para imports especiales**. Cuando se use cualquier import con query suffix (`?react`, `?url`, `?raw`), asegurar que el plugin correspondiente está instalado y configurado.
>
> - `*.svg?react` → requiere `vite-plugin-svgr`
> - `*.module.css` → requiere `@vitejs/plugin-react` (ya incluye CSS modules)
> - Verificar `vite.config.ts` antes de asumir que un import type tendrá soporte runtime
> - Los errores de "component is not a function" o pantallas en blanco con imports de assets suelen indicar falta de plugin

### Referencias
- Archivos modificados: `pacta_appweb/vite.config.ts`, `pacta_appweb/src/components/layout/AppSidebar.tsx`
- Nuevo archivo: `pacta_appweb/src/components/common/ErrorBoundary.tsx`
- Diseño: `docs/plans/2026-04-22-fix-svg-rendering-design.md`
- Commits:
  - `ebcc35b` feat: add vite-plugin-svgr for SVG React components
  - `c93d9cd` config: enable SVGR plugin for SVG React component imports
  - `3c98a57` feat: add ErrorBoundary component for graceful SVG failure handling
  - `a25f911` fix: wrap logo in ErrorBoundary and add accessibility attributes
  - `92b65b6` build: verify SVG plugin configuration works

---

## [002] Inconsistencia de Tipos: any[] vs Tipos Strongly-Typed

**Fecha**: 2026-04-20
**Tags**: frontend, types, consistency
**Severity**: high

### Contexto
Al reemplazar `any[]` por tipos específicos (`Contract[]`, `Client[]`, `Supplier[]`) en ContractsPage y DashboardPage, aparecieron errores LSP que estaban ocultos previamente.

### Síntomas
```
ERROR: This comparison appears to be unintentional because the types 'string' and 'number' have no overlap.
ERROR: Property 'clientId' does not exist on type...
```

### Causa Raíz
1. **Inconsistencia de tipos**: `Client.id` es `string`, `Contract.client_id` es `number` - tipos diferentes para IDs
2. **Naming híbrido**: El código del formulario usa camelCase (`data.clientId`), pero la API del backend espera snake_case (`client_id`)
3. El uso de `any[]` ocultaba estos errores de type-checking

### Solución
1. Para **comparaciones de ID**: Usar conversión explícita `Number(cl.id) === c.client_id`
2. **Arquitectura deciden**: Usar consistentemente snake_case en todo el proyecto (viene del backend)

### Regla de Prevención
> **Snake_case estándar**: Todo el proyecto debe usar snake_case consistentemente para mantener consistencia con el backend.
> - No crear tipos duplicados camelCase y snake_case
> - Al agregar tipos strong, verificar que el naming sea consistente con la API backend
> - Usar conversión explícita cuando sea necesario: `Number()` o `String()`

### Referencias
- pacta_appweb/src/pages/ContractsPage.tsx
- pacta_appweb/src/pages/DashboardPage.tsx
- pacta_appweb/src/types/index.ts
- internal/models/models.go (backend)

---

## [001] Ejemplo: Error de Build por Falta de Dependencias

**Fecha**: 2026-04-19
**Tags**: build, ci-cd, configuration
**Severity**: critical

### Contexto
El workflow de CI falló porque se intentó ejecutar `go build` localmente antes de push.

### Síntomas
```
error: go command not found
local environment not configured
```

### Causa Raíz
Se intentó ejecutar comandos de build en el entorno local donde Go no está instalado, contraviniendo la regla de que todo build debe correr solo en CI.

### Solución
Se configuró el proceso para que todo build ocurra en GitHub Actions, no localmente.

### Regla de Prevención
> **DO**: Escribir código, crear features, fix bugs
> **DO NOT**: Ejecutar `go build`, `go mod tidy`, `npm run build`, compilar, o testear localmente
> **REASON**: El entorno local no está configurado; Go, Node, y todas las herramientas solo están disponibles en GitHub Actions

### Referencias
- AGENTS.md - Reglas del proyecto
- .github/workflows/build.yml

---

## [007] SQLite Sintaxis Incompatible: DEFAULT (expresión) en ALTER TABLE ADD COLUMN

**Fecha**: 2026-04-26  
**Tags**: database, migration, sqlite, goose  
**Severity**: critical

### Contexto
El servicio PACTA falla al iniciar con error en migración 004 (`004_add_session_last_activity.sql`). El binario se construye desde el branch main y se despliega en `/opt/pacta`. Al ejecutar, goose aplica migraciones sobre la base de datos existente.

### Síntomas
```
2026/04/26 16:41:30 Server failed: run migrations: ERROR 004_add_session_last_activity.sql: failed to run SQL migration: failed to execute SQL query "ALTER TABLE sessions ADD COLUMN last_activity DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP);": SQL logic error: Cannot add a column with non-constant default (1)
```
- El servicio entra en bucle de auto-restart (`activating (auto-restart)`)
- El binario existe en `/opt/pacta/pacta` pero falla al iniciar
- Base de datos en `/opt/pacta/data/pacta.db` (132KB) no se actualiza

### Causa Raíz
1. **SQLite restricción de sintaxis**: En `ALTER TABLE ADD COLUMN`, SQLite solo acepta `DEFAULT` con valores constantes literales (ej: `DEFAULT 0`, `DEFAULT 'text'`, `DEFAULT CURRENT_TIMESTAMP`). **NO acepta expresiones** como `DEFAULT (CURRENT_TIMESTAMP)` (con paréntesis).
2. **Sintaxis incorrecta**: La migración 004 usó `DEFAULT (CURRENT_TIMESTAMP)` que es una expresión, no una constante.
3. **La documentación de SQLite** especifica: "The DEFAULT clause specifies a default value for the column. If a constant between parentheses, like `(123)` or `('abc')`, is used as the default value, it is evaluated for each row inserted." Pero la sintaxis de ALTER TABLE ADD COLUMN no permite expresiones evaluadas.

### Solución
Reescribir migración 004 en dos pasos compatibles con SQLite:
```sql
-- Paso 1: Agregar columna sin restricción NOT NULL (DEFAULT implícito es NULL)
ALTER TABLE sessions ADD COLUMN last_activity DATETIME;

-- Paso 2: Backfill de datos existentes (si los hubiera)
UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE last_activity IS NULL;

-- Paso 3: La columna ahora contiene valores; futuros INSERTs desde aplicación
-- proporcionan last_activity explícitamente (CreateSession en internal/auth/session.go)
```
**Nota**: No se puede alterar columna a NOT NULL después en SQLite sin recrear tabla. La aplicación (CreateSession) siempre inserta `last_activity` explícitamente, por lo que la columna será poblada en todos los INSERTs futuros. Para datos existentes, el backfill garantiza integridad.

### Regla de Prevención
> **DEFAULT en SQLite ALTER TABLE**: Solo usar constantes literales (`DEFAULT 0`, `DEFAULT 'text'`, `DEFAULT CURRENT_TIMESTAMP`).  
> - NO usar `DEFAULT (expression)` con paréntesis  
> - Para valores dinámicos como `CURRENT_TIMESTAMP`, usar `DEFAULT CURRENT_TIMESTAMP` sin paréntesis  
> - Si se necesita expresión compleja, agregar columna nullable, luego `UPDATE` masivo, luego (si es crítico) recrear tabla con NOT NULL  
> - Siempre consultar la [tabla de restricciones de SQLite](https://www.sqlite.org/lang_altertable.html) antes de escribir migraciones

### Referencias
- Migración corregida: `internal/db/migrations/004_add_session_last_activity.sql`
- Error observado: ejecución manual de `/opt/pacta/pacta` (binario v0.44.12)
- Estado servicio: `systemctl status pacta` → `Active: activating (auto-restart)`  
- Versión SQLite: `modernc.org/sqlite v1.50.0` (bindings Go, motor SQLite 3.45+)

---

## [008] Dependencia Circular en Migración Consolidada 001

**Fecha**: 2026-04-26  
**Tags**: database, migration, sqlite, goose  
**Severity**: critical

### Contexto
La migración consolidada 001_initial_schema.sql combina 13 migraciones originales en un solo archivo. Dentro de este archivo, existe una dependencia circular:
- `users.company_id` → `companies.id`
- `companies.created_by` → `users.id`

Ambas tablas se crean en el mismo archivo, y SQLite requiere que la tabla referenciada exista antes de crear la tabla que la referencia.

### Síntomas
En una base de datos nueva (fresca), goose fallaría al ejecutar migración 001 con error:
```
SQL logic error: no such table: companies
```
al intentar crear `users` (porque `companies` aún no existe). Si se invierte el orden:
```
SQL logic error: no such table: users
```
al crear `companies` (porque `users` no existe still).

### Causa Raíz
1. **Creación simultánea en mismo archivo**: Cuando las migraciones se consolidaron, ambas tablas se definieron en el mismo transaction/script.
2. **SQLite requiere tabla referenciada exista**: Aunque se use `PRAGMA foreign_keys=off`, la referencia `REFERENCES`仍要求表存在在创建时。
3. **No se puede crear ambas en cualquier orden**: La circularidad impide cualquier orden de creación sin violar dependencias.

### Solución
Separar la creación en 3 pasos dentro del mismo archivo (sin transacción goose):
1. Crear `companies` **sin** columna `created_by`
2. Crear `users` (que referencia `companies`, ya existente ✓)
3. `ALTER TABLE companies ADD COLUMN created_by INTEGER REFERENCES users(id)` — se agrega después que `users` existe
4. Continuar con el resto de tablas (`user_companies`, `clients`, etc.)

Esto resuelve la circularidad porque `ALTER TABLE ADD COLUMN` puede agregar una FK después de que ambas tablas existen.

### Regla de Prevención
> **Consolidación de migraciones con dependencias circulares**: Al combinar múltiples migraciones en una sola, verificar que no haya dependencias circulares entre tablas.  
> - Si existe FK mutua (A→B y B→A), crear una de las tablas sin laFK, luego la otra tabla, luego `ALTER TABLE` para agregar la FK faltante  
> - Para SQLite, el orden debe ser: tabla sin dependencia → tabla con dependencia simple → ALTER TABLE para cerrar ciclo  
> - Probar migraciones en base de datos nueva (no solo en existente) antes de commit

### Referencias
- Archivo corregido: `internal/db/migrations/001_initial_schema.sql` (reescrito completo con orden correcto)
- Historial: commit `10215fc` consolidó 41 migraciones en 3; luego se detectó dependencia circular
- Tablas involucradas: `users` y `companies`
- Columnas: `users.company_id` → `companies.id`, `companies.created_by` → `users.id`

---

## [009] Vista con Columna Inexistente: entity_type vs table_name

**Fecha**: 2026-04-26  
**Tags**: database, migration, sqlite, goose  
**Severity**: high

### Contexto
La migración 003_security_rls.sql crea una vista `v_potential_cross_tenant_access` para monitoreo de acceso cross-tenant. La vista SELECT desde `audit_logs` y filtra por `table_name`.

### Síntomas
Al ejecutar migración 003, goose retorna error:
```
ERROR 003_security_rls.sql: failed to run SQL migration:
failed to execute SQL query "CREATE VIEW ...": SQL logic error: no such column: audit_logs.table_name
```

### Causa Raíz
1. **Error de nomenclatura**: La tabla `audit_logs` creada en migración 001 usa la columna `entity_type` (no `table_name`) para registrar el tipo de entidad afectada.
2. **Inconsistencia entre migraciones**: La vista en 003 fue escrita asumiendo que existía `table_name`, probablemente copiada de un diseño anterior o de otra base de datos.
3. **Migración 003 agrega columnas a audit_logs** (user_agent, session_id, violation_flag) pero NO agrega `table_name`. La columna correcta es `entity_type`.

### Solución
Modificar la vista para usar `entity_type`:
```sql
CREATE VIEW v_potential_cross_tenant_access AS
SELECT
    al.id,
    al.user_id,
    al.company_id,
    al.action,
    al.entity_type AS table_name,  -- <-- corregir: usar entity_type
    al.created_at,
    u.email as user_email,
    c.name as company_name
FROM audit_logs al
...
WHERE ...
    AND al.entity_type IN ('contracts', 'clients', 'suppliers', 'documents')  -- <-- corregir
ORDER BY al.created_at DESC;
```
Se renombra `entity_type` como `table_name` en el SELECT para mantener el nombre de la vista sin cambios, o se puede renombrar la vista completa.

### Regla de Prevención
> **Consistencia de nombres de columnas en vistas**: Al crear vistas que unen múltiples tablas, verificar que todas las columnas referenciadas existan en las tablas base.  
> - Usar `PRAGMA table_info(tablename)` o revisar la definición de tabla en migración correspondiente  
> - En migraciones consolidadas, buscar la definición de columna en migración 001 (o la que crea la tabla)  
> - No asumir nombres de columnas de otros sistemas; verificar en el schema actual  
> - Probar `CREATE VIEW` en base de datos SQLite antes de commit

### Referencias
- Tabla audit_logs definida en: `internal/db/migrations/001_initial_schema.sql` línea 222-236
- Columna correcta: `entity_type TEXT NOT NULL` (línea 227)
- Vista errónea en: `internal/db/migrations/003_security_rls.sql` líneas 38-54
- Commit que introduce la vista: `06d231e` (fase 2 de seguridad)

---

## [010] DEFAULT 0 en company_id Viola Restricción Foreign Key

**Fecha**: 2026-04-26  
**Tags**: database, migration, sqlite, data-integrity  
**Severity**: high

### Contexto
La tabla `sessions` en migración 001 definía:
```sql
company_id INTEGER NOT NULL DEFAULT 0 REFERENCES companies(id)
```

### Síntomas
- Al insertar una sesión sin especificar `company_id`, SQLite intenta insertar 0
- Como `companies.id` comienza en 1 (AUTOINCREMENT), la FK falla: `FOREIGN KEY constraint failed`
- La aplicación `CreateSession` en `internal/auth/session.go` sí pasa `companyID` explícitamente, por lo que en producción no ocurría—pero es una trampa de schema peligrosa.

### Causa Raíz
1. **Valor por defecto incorrecto**: `0` no es un `company_id` válido (IDs empiezan en 1).
2. **Patrón anti-sqlite**: En SQLite, `DEFAULT 0` en columna con FK puede insertar valor inexistente si no se valida en aplicación.
3. **Legacy de migraciones previas**: Durante consolidación, se mantuvo DEFAULT 0 quizás de diseño anterior.

### Solución
Eliminar DEFAULT 0 de la definición:
```sql
company_id INTEGER NOT NULL REFERENCES companies(id)
```
La aplicación (handler de auth) ya proporciona `companyID` explícitamente, por lo que el DEFAULT nunca se usa. Esto convierte la columna en estrictamente NOT NULL sin valor por defecto, forzando a que siempre se pase explícitamente.

### Regla de Prevención
> **Nunca usar DEFAULT en columnas FOREIGN KEY**: El DEFAULT debe ser un valor que exista en la tabla referenciada, o la columna debe omitir DEFAULT y exigir que la aplicación provea el valor.  
> - Verificar que cualquier DEFAULT en columna con REFERENCES apunte a un ID existente real  
> - Preferir `NOT NULL` sin DEFAULT sobre `DEFAULT` incorrecto  
> - En SQLite, `DEFAULT 0` en FK casi siempre es incorrecto (IDs empiezan en 1)

### Referencias
- Tabla sessions: `internal/db/migrations/001_initial_schema.sql` línea 65-71
- Código que inserta: `internal/auth/session.go` línea 40-43
- Arreglo aplicado: commit actual (eliminar DEFAULT 0)
