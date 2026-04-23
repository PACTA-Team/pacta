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