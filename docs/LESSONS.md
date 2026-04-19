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