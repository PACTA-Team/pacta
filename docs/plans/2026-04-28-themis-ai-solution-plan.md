# Themis AI Alpha Release – Plan de Solución

**Fecha:** 2026-04-28  
**Estado:** En progreso  
**Autor:** Kilo (AI Assistant)  
**Base:** PR #295 – `feat/themis-ai-clean`  
**Diseño referencia:** `docs/plans/2026-04-27-themis-ai-design.md`  

---

## 1. Resumen Ejecutivo

Este plan detalla las correcciones necesarias para convertir la implementación actual de Themis AI (PR #295) en una versión **Alpha listo para pruebas end-to-end** con testers y QA. Se abordarán 5 defects críticos que impiden el merge: compilación, seguridad, aislamiento multi-tenant, rate limiting y funcionalidad incompleta.

**Objetivo Alpha:**  
Feature completamente funcional y segura para pruebas internas en entorno controlado.

**Duración estimada total:** 8 horas  
**Fases:** 4 (Correcciones Críticas → Migraciones → Calidad → Release)

---

## 2. Problemas Identificados y Soluciones

### 2.1 Críticos (P0)

| # | Problema | Impacto | Solución Propuesta |
|---|----------|---------|-------------------|
| 1 | **Falta `types.go`** – tipos definidos fueron eliminados, código no compila | Bloquea toda compilación | Restaurar `internal/ai/types.go` desde main (commit `2c70d54`) con todos los tipos: `LLMProvider`, `GenerateContractRequest`, `ReviewContractRequest`, `GenerateResponse`, `ReviewResponse`, `RiskItem` |
| 2 | **API keys en texto plano** – `UpdateSystemSettings` no encripta valor antes de guardar en DB | Vulnerabilidad grave: credenciales legibles en `system_settings` | Modificar `internal/handlers/system_settings.go`: detectar key `ai_api_key` → encriptar con `ai.EncryptAPIKey()` antes de `UPDATE`. Si encriptación falla, retornar 400. |
| 3 | **Filtración multi-tenant en RAG** – `GetSimilarContracts` no filtra por `company_id` | Violación de aislamiento: usuarios ven contratos de otras compañías | Añadir parámetro `companyID` a `GetSimilarContracts` y condición `AND c.company_id = ?` en query. Modificar handler para pasar `companyID` del contexto autenticado. |
| 4 | **RateLimiter no integrado** – implementado pero nunca usado | Riesgo de abuso, costos excesivos LLM | Inyectar `RateLimiter` en `Handler` (campo en struct). Inicializar en `main.go` con `ai.NewRateLimiter(100)`. Llamar `Allow(companyID)` al inicio de ambos handlers AI. Retornar 429 si excede. Agregar header `X-RateLimit-Remaining`. |
| 5 | **Review incompleto** – usa texto placeholder, no extrae documentos | Funcionalidad no usable para contratos reales | Implementar extracción real: si `req.DocumentURL` presente, descargar PDF y extraer texto con `ai.ExtractTextFromPDF`. Si no, usar `req.Text`. Manejar errores de extracción claramente. |

### 2.2 Altos (P1)

| # | Problema | Solución Propuesta |
|---|----------|-------------------|
| 6 | Validación insuficiente en `HandleAIGenerateContract` | Añadir checks: `ClientID > 0`, `SupplierID > 0`, `Amount > 0`, `StartDate < EndDate`, `len(Description) <= 10000` |
| 7 | DoS por PDFs grandes en `ExtractTextFromPDF` | Limitar a 10 MB usando `io.LimitReader(r, 10<<20)`. Error si excede. |
| 8 | Timeout ausente en `HandleAITestConnection` | Usar `context.WithTimeout(r.Context(), 10*time.Second)`. Evitar que cuelgue. |
| 9 | Validación de encryption key no se ejecuta | Llamar `ai.ValidateStartupConfig` en `server.Start` (después de DB conexión, antes de registrar rutas). O validar en `main.go` if AI configurada. |
| 10 | Migración DB inexistente para settings AI | Crear `internal/db/migrations/005_ai_settings.sql` con INSERTs de claves por defecto. Asegurar que `server.Start` la aplique. |

### 2.3 Medios (P2)

| # | Problema | Solución Propuesta |
|---|----------|-------------------|
| 11 | Imports duplicados en frontend | Eliminar import duplicado de `AISection` en `ContractsPage.tsx` |
| 12 | Tests unitarios insuficientes | Agregar tests para: encriptación en `UpdateSystemSettings`, filtro `company_id` en RAG, rate limiterAllow/deny |
| 13 | `console.log` residual en producción | Eliminar de `UserDropdown.tsx` y otros archivos |
| 14 | Uso de `any` en TypeScript | Reemplazar con tipos estrictos (tiempo permitting) |

---

## 3. Arquitectura de Solución

### 3.1 Diagrama de Flujo (Post-Fix)

```
┌─────────────────┐
│   Frontend UI   │
│ (Settings, Form)│
└────────┬────────┘
         │ HTTP POST /api/ai/generate-contract
         ▼
┌─────────────────────────────────────────────┐
│  Handler: HandleAIGenerateContract          │
│  1. Validate request (amount > 0, dates)    │
│  2. Check RateLimiter: Allow(companyID)     │ ← NUEVO
│  3. Get AI config (decrypt API key)         │
│  4. Get companyID from context              │ ← NUEVO (para RAG filter)
│  5. Retriever.GetSimilarContracts(type,     │
│     clientID, supplierID, companyID, 3)     │ ← MODIFICADO
│  6. Build prompt → LLMClient.Generate()     │
│  7. Return response                         │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Retriever: GetSimilarContracts             │
│  SELECT ... WHERE type=? AND company_id=?   │ ← NUEVO FILTRO
│    AND (client_id=? OR supplier_id=?)       │
└─────────────────────────────────────────────┘
```

### 3.2 Security Flow (API Key Encryption)

```
Settings UI → PUT /api/system_settings
   ↓
UpdateSystemSettings handler
   ↓
For each setting:
   if key == "ai_api_key" && value != "":
       encrypted = ai.EncryptAPIKey(value)  ← AES-256-GCM
       DB Exec UPDATE with encrypted value
   else:
       DB Exec UPDATE with plain value
   ↓
DB: system_settings.value = "gAAAAAB..."
   ↓
getAIConfig(): reads encrypted → DecryptAPIKey() → in-memory key
```

---

## 4. Plan de Implementación Detallado

Ver documento separado: `docs/plans/2026-04-28-themis-ai-implementation.md`

*(Generado por `writing-plans` skill)*

---

## 5. Criterios de Éxito – Alpha Readiness

### 5.1 Criterios Técnicos (Locales – Verificables Antes de Push)

- [ ] **No compilation errors**: `go vet ./...` no reporta errores en paquete `internal/ai` o `internal/handlers`
- [ ] **Tipos definidos**: `internal/ai/types.go` existe y contiene todos los tipos requeridos por `client.go`, `prompts.go`, `parser.go`
- [ ] **Encriptación activa**: `UpdateSystemSettings` encripta `ai_api_key` (code review + unit test)
- [ ] **Filtro company_id**: `rag.go` query incluye `AND c.company_id = ?` (code review)
- [ ] **RateLimiter integrado**: handlers verifican límite antes de procesar (code review)
- [ ] **Extracción PDF funcionando**: `ExtractTextFromPDF` limita a 10 MB y extrae texto (unit test)
- [ ] **Validación en generate**: todos los checks de validación presentes (code review)
- [ ] **Migración creada**: `internal/db/migrations/005_ai_settings.sql` existe con INSERTs correctos
- [ ] **Startup validation**: `ValidateStartupConfig` se llama en `server.Start` o `main.go`
- [ ] **No secrets硬编码**: `grep -R "sk-|api_key\s*="` no encuentra credenciales en código
- [ ] **Tests de integración**: `go test ./internal/ai -v -run TestIntegration` pasa (mock server)
- [ ] **Frontend sin errors TS**: `npm run type-check` (si existe) o `npm run build` local permitido? **NO** – ver NOTA abajo

### 5.2 Criterios de CI (Automáticos en GitHub Actions)

Una vez pushed, el workflow `.github/workflows/build.yml` debe pasar:

- [ ] **`go build ./...`** – compilación exitosa
- [ ] **`npm ci && npm run build`** – frontend build sin errores
- [ ] **`go test ./...`** – todos los tests pasan (unit + integración)
- [ ] **Migración aplicable** – DB migrations no fallan en CI
- [ ] **`go vet ./...`** – sin errores de análisis estático
- [ ] **Linting** – si hay linters配置ados, pasan

### 5.3 Criterios de QA (Manual – Guía en `docs/AI_TESTING.md`)

Tester puede completar flujo en <30 minutos:

- [ ] **Configuración**: Usuario admin guarda API key (OpenAI) en Settings → se encripta en DB
- [ ] **Generación**: Botón "New Contract with AI" → contrato generado en <30s
- [ ] **Review**: Botón "Review with Themis" → análisis appear con riesgos, summary
- [ ] **Rate limiting**: 101 requests en same company → 429 en el 101 con header `X-RateLimit-Remaining: 0`
- [ ] **Multi-tenant**: Usuario company A no ve contratos de company B en RAG (verificar con test data)
- [ ] **Error handling**: API key inválida → mensaje claro "Invalid API key" (no stack trace)

---

## 6. Entregables

### 6.1 Código
- `internal/ai/types.go` (restaurado)
- `internal/handlers/system_settings.go` (encriptación)
- `internal/ai/rag.go` (filtro company_id)
- `internal/handlers/ai.go` (rate limiter + extracción real + mejoras)
- `internal/handlers/handler.go` (campo RateLimiter)
- `cmd/pacta/main.go` (validación key + inyección RateLimiter)
- `internal/ai/extractors.go` (límite 10MB)
- `internal/ai/validation.go` (llamada en startup)
- `internal/ai/integration_test.go` (tests integración)
- `internal/db/migrations/005_ai_settings.sql`
- Frontend: limpieza imports, `console.log` removidos

### 6.2 Documentación
- `docs/AI_TESTING.md` – Guía de pruebas manuales para QA
- `docs/AI_DEPLOYMENT.md` – Checklist de deployment
- `docs/plans/2026-04-28-themis-ai-implementation.md` – Plan detallado de tareas (este es el plan de implementation)

### 6.3 Configuración CI
- Ningún cambio necesario (ya existente)

---

## 7. Riesgos y Mitigaciones

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|--------------|---------|------------|
| R1 | RateLimiter in-memory no funciona en multi-instancia | Media | Alto | Documentar limitación: single-instance only. Planificar Redis para producción (v1.0). |
| R2 | Extracción PDF falla con ciertos PDFs (escaneados) | Media | Medio | Limitar a PDFs con texto (no OCR). Mostrar error claro "PDF contains no extractable text". Soportar OCR en futura versión. |
| R3 | LLM genera contenido legal inválido | Alta | Alto | Disclaimer UI obligatorio: "AI-generated content requires human review". No reemplazar abogados. |
| R4 | API key leak en logs/error messages | Baja | Crítico | Revisar que ningún `log.Printf` incluya API key. Sanitizar errores de LLMclient antes de loguear. |
| R5 | Migración no aplica en DB existente | Media | Alto | `server.Start` debe verificar claves AI existen; si no, ejecutar INSERTs manualmente (idempotent). |
| R6 | Tests de integración requieren LLM real (costo) | Baja | Medio | **Mockear HTTP server** – no usar LLM real en tests unitarios/integración. |

---

## 8. Timeline y Dependencias

```
Día 1 (Fase 1 – Críticos):
  T1-T6 (2-3h) → Código compila y seguro

Día 1 (Fase 2 – DB):
  T7-T10 (1-2h) → Migración y límites

Día 2 (Fase 3 – Calidad):
  T11-T15 (2-3h) → Tests y docs

Día 2 (Fase 4 – Release):
  T16-T19 (1h) → Finalización y merge prep

Total: ~8h (spread 2 días)
```

**Dependencias críticas:**
- T1 (types.go) → Todas las demás
- T7 (migración) → T8 (startup validation) – pero T8 puede esperar si usamos validate manual
- T11 (integration tests) → necesita T1-T5 completos

---

## 9. Checklist de Validación Final (Pre-Merge)

**Code Quality:**
- [ ] `go fmt ./...` ejecutado
- [ ] `go vet ./...` sin errores
- [ ] `grep -R "TODO" internal/ai internal/handlers` → vacío o solo TODOs no críticos
- [ ] `grep -R "console.log" pacta_appweb/src` → vacío
- [ ] `grep -R "any" pacta_appweb/src` → mínimo (solo si unavoidable)

**Security:**
- [ ] `grep -R "ai_api_key.*="` → solo encriptación, no plain insert
- [ ] Ninguna clave API en tests fixtures (ej. `"sk-test"` solo en tests, OK)
- [ ] Validación encryption key en startup

**Database:**
- [ ] Migración `005_ai_settings.sql` creada y en orden correcto (001-004 existentes)
- [ ] Migración ejecuta automáticamente en `server.Start`

**Testing:**
- [ ] Unit tests: `go test ./internal/ai -v` OK
- [ ] Integration tests: `go test ./internal/ai -run TestIntegration` OK
- [ ] Handler tests: `go test ./internal/handlers -run TestAI` OK

**Documentation:**
- [ ] `docs/AI_TESTING.md` existe y tiene pasos claros
- [ ] `docs/AI_DEPLOYMENT.md` existe con variables de entorno
- [ ] CHANGELOG actualizado con entrada Themis AI alpha

---

## 10. Transición a Implementation

Una vez aprobado este plan de solución, se invocará la skill `writing-plans` para generar el **Plan de Implementación Detallado** que desglosa cada tarea en:

- Comandos git específicos
- Diferencias esperadas (oldString/newString)
- Comandos de verificación (post-conditions)
- Estimación de tiempo por tarea
- Dependencias entre tareas

---

**Aprobado por:** Usuario (2026-04-28)  
**Próximo paso:** Invocar `writing-plans` para crear plan de implementación tarea por tarea.
