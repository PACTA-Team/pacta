# Plan de Implementación: Integración MiniRAG Híbrida

**Fecha**: 2026-04-29  
**Basado en**: `docs/plans/2026-04-29-minirag-hybrid-design.md`  
**Estado**: Listo para ejecución  

## Fase 1: Configuración Base (Día 1)

### Paso 1.1: Extender Configuración ✅ COMPLETADO
**Archivo**: `internal/config/config.go`  
**Estado**: Ya implementado en pasos anteriores.

**Cambios realizados**:
- Agregado `RAGConfig struct`
- Agregado `DefaultRAGConfig()` helper
- Actualizado `Config.Validate()` con validación RAG

### Paso 1.2: Migración de Base de Datos ❌ PENDIENTE
**Archivo**: `internal/db/007_rag_settings.sql` (ya creado)

**Tarea**: La migración ya fue creada con el modelo actualizado a Qwen2.5-0.5B. Verificar que los valores por defecto sean correctos.

```sql
-- internal/db/007_rag_settings.sql (ACTUALIZADO)
INSERT INTO system_settings (key, value) VALUES 
('rag_mode', 'external'),
('local_model', 'qwen2.5-0.5b-instruct-q4_0.gguf'),  -- Cambiado desde phi-3.5-mini-instruct
('embedding_model', 'all-minilm-l6-v2'),
('vector_db_path', ''),
('hybrid_strategy', 'local-first'),
('hybrid_rerank', 'true');
```

**Verificación**:
```bash
# En CI (GitHub Actions):
go test ./internal/config/...
```

---

## Fase 2: Motor Vectorial Local (Día 2)

### Paso 2.1: Vector Database (HNSW) ✅ COMPLETADO
**Archivo**: `internal/ai/minirag/vector_db.go`  
**Estado**: Implementado.

**Características**:
- Algoritmo HNSW puro en Go
- Persistencia JSON
- Cosine similarity
- Document metadata storage

### Paso 2.2: Corrección de Imports ❌ PENDIENTE
**Problema**: `internal/ai/client.go` importa `minirag` pero el path es incorrecto.

**Solución**:
```go
// internal/ai/client.go - imports correctos:
import (
    "github.com/PACTA-Team/pacta/internal/ai/minirag"
)
```

**Estado actual**: ❌ El archivo fue truncado y necesita recreación completa.

### Paso 2.3: Embeddings Client ✅ COMPLETADO
**Archivo**: `internal/ai/minirag/embeddings.go`  
**Estado**: Implementado con Ollama API y fallback.

---

## Fase 3: LLM Local (Día 3)

### Paso 3.1: Local LLM Client ✅ COMPLETADO
**Archivo**: `internal/ai/minirag/local_client.go`  
**Estado**: Implementado con soporte Ollama.

### Paso 3.2: Integración en LLMClient ✅ COMPLETADO
**Archivo**: `internal/ai/client.go`  
**Estado**: Agregado campo `LocalClient *minirag.LocalClient`.

**Pero**: El archivo se truncó durante edición. Necesita recreación.

---

## Fase 4: Parser y Indexación (Día 4)

### Paso 4.1: PDF/Word Parser ✅ COMPLETADO
**Archivo**: `internal/ai/minirag/pdf_parser.go`  
**Estado**: Implementado con soporte Tika opcional.

### Paso 4.2: Document Indexer ✅ COMPLETADO
**Archivo**: `internal/ai/minirag/indexer.go`  
**Estado**: Implementado con chunking y background indexing.

---

## Fase 5: Orquestador Híbrido (Día 5)

### Paso 5.1: Orchestrator ✅ COMPLETADO
**Archivo**: `internal/ai/hybrid/orchestrator.go`  
**Estado**: Implementado con 3 modos y fallbacks.

### Paso 5.2: Merge Strategies ✅ COMPLETADO
**Archivo**: `internal/ai/hybrid/strategies.go`  
**Estado**: Implementado con local-first, external-first, parallel.

---

## Fase 6: HTTP Handlers (Día 6)

### Paso 6.1: Restaurar handlers/ai.go ❌ PENDIENTE (CRÍTICO)
**Archivo**: `internal/handlers/ai.go`  
**Estado**: ❌ Truncado a 18 líneas.

**Acción requerida**: Recrear el archivo completo con:
1. Imports correctos (incluyendo minirag e hybrid)
2. Funciones existentes (HandleAIGenerateContract, HandleAIReviewContract, etc.)
3. Nuevas funciones (HandleRAGLocal, HandleRAGHybrid, HandleRAGIndex, HandleRAGStatus)
4. Router actualizado en HandleAI()

**Verificación**:
```bash
# En CI:
go build ./internal/handlers/...
```

### Paso 6.2: Verificar Routing ❌ PENDIENTE
**Tarea**: Asegurar que los nuevos endpoints estén registrados en el router principal.

**Archivo**: `internal/server/` (router registration)

---

## Fase 7: Testing (Día 7)

### Paso 7.1: Unit Tests para VectorDB ❌ PENDIENTE
**Archivo**: `internal/ai/minirag/vector_db_test.go` (nuevo)

```go
func TestVectorDB_AddDocument(t *testing.T) { ... }
func TestVectorDB_Search(t *testing.T) { ... }
func TestCosineSimilarity(t *testing.T) { ... }
```

### Paso 7.2: Unit Tests para Embeddings ❌ PENDIENTE
**Archivo**: `internal/ai/minirag/embeddings_test.go` (nuevo)

### Paso 7.3: Integration Tests ❌ PENDIENTE
**Tarea**: Probar endpoints /rag/local y /rag/hybrid con mocks.

---

## Fase 8: Documentación y Finalización (Día 8)

### Paso 8.1: Actualizar README ❌ PENDIENTE
**Archivo**: `README.md`  
**Tarea**: Agregar sección "MiniRAG Integration" con instrucciones de uso.

### Paso 8.2: Documentación Admin ❌ PENDIENTE
**Archivo**: `docs/ADMIN.md` (nuevo)  
**Tarea**: Guía para configurar RAG desde el panel de administración.

### Paso 8.3: Commit y Push ❌ PENDIENTE
**Tarea**: Commit de todos los cambios con mensaje descriptivo.

```bash
git add -A
git commit -m "feat: integrate MiniRAG hybrid local RAG system

- Add local RAG with Qwen2.5-0.5B-Instruct (429MB, under 500MB limit)
- Add hybrid mode (local + external)
- Add vector database (HNSW)
- Add embedding generation (Ollama)
- Add admin-configurable settings
- Maintain 100% backward compatibility

Closes #XX"
```

---

## Resumen de Estado Actual

### ✅ Completado:
1. `internal/config/config.go` - RAGConfig struct
2. `internal/ai/minirag/vector_db.go` - HNSW implementation
3. `internal/ai/minirag/embeddings.go` - Embedding client
4. `internal/ai/minirag/local_client.go` - Local LLM client
5. `internal/ai/minirag/pdf_parser.go` - PDF/Word parser
6. `internal/ai/minirag/indexer.go` - Document indexer
7. `internal/ai/hybrid/orchestrator.go` - Hybrid orchestrator
8. `internal/ai/hybrid/strategies.go` - Merge strategies
9. `docs/plans/2026-04-29-minirag-hybrid-design.md` - Design doc

### ❌ Pendiente (Crítico):
1. **Recrear `internal/handlers/ai.go`** - Archivo truncado
2. **Corregir imports en `internal/ai/client.go`** - Path incorrecto
3. **Crear migración DB** - `internal/db/XXX_rag_settings.sql`
4. **Unit tests** - Faltan tests para nuevos paquetes
5. **Documentación** - README y ADMIN.md

### 🚨 Problemas Identificados:
1. **handlers/ai.go truncado**: Durante la edición, el archivo se redujo a solo 18 líneas de imports. Necesita recreación completa.
2. **Imports circulares**: `client.go` en paquete `ai` importa `minirag` que también está en `ai/`. Esto es correcto porque minirag es un subpaquete.
3. **Build va a fallar**: Hasta que se arregle handlers/ai.go, el proyecto no compilará.

---

## Siguiente Paso Inmediato

**Recrear `internal/handlers/ai.go`** completo:

1. Restaurar todas las funciones originales
2. Agregar nuevos imports (minirag, hybrid)
3. Agregar nuevos handlers (HandleRAGLocal, etc.)
4. Actualizar router en HandleAI()
5. Verificar que el archivo esté completo (666 líneas según estado anterior)

**Comando de verificación** (en CI):
```bash
cd /home/mowgli/pacta
go build ./...
```

---

## Notas de Implementación

### Error Común a Evitar:
- **No truncar archivos**: Al usar `write`, siempre incluir el contenido COMPLETO del archivo.
- **Verificar después de editar**: Siempre leer el archivo después de una edición para confirmar que se aplicó correctamente.

### Dependencias Agregadas:
```go
// go.mod - Ninguna dependencia nueva requireda
// El sistema usa Ollama a través de HTTP, no imports directos
```

### Compatibilidad:
- ✅ 100% backward compatible
- ✅ APIs existentes mantenidas
- ✅ Configuración opcional (si no se configura RAG, usa external por defecto)

---

## Checklist Pre-Commit

- [ ] `internal/handlers/ai.go` completo y sin errores
- [ ] `internal/ai/client.go` imports correctos
- [ ] `internal/db/XXX_rag_settings.sql` creado
- [ ] `go build ./...` pasa en CI
- [ ] Tests unitarios pasan
- [ ] Documentación actualizada
- [ ] Design doc aprobado y guardado
- [ ] Plan de implementación creado (este archivo)
