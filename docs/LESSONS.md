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