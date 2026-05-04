# Plan de Solución: Correcciones de Arquitectura IA - PACTA

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Objetivo:** Corregir problemas de arquitectura críticos que impiden el funcionamiento correcto del sistema IA (MiniRAG híbrido y Experto Legal) y completar la implementación según los diseños aprobados.

**Arquitectura actual:** 
- Existe módulo MiniRAG con VectorDB HNSW, indexer, embedding client (Ollama), LLM local (CGo/Ollama).
- Existe módulo Legal con parser, chat_service, handlers.
- Existe Hybrid Orchestrator para modos local/external/hybrid.
- Problemas: ChatLegal no hace RAG, falta integración LLM real, inconsistencia persistencia chunks, tests desactualizados, endpoints faltantes.

**Tech Stack:** Go, SQLite, llama.cpp CGo, Ollama (opcional), HNSW, React frontend (próximo).

---

## Contexto de Issues 302-305

Los issues surgieron duranteTask 4 - Fase 4 de spec review, donde se detectó desincronización entre el spec anterior (basado en tabla `document_chunks`) y la arquitectura actual (basada en VectorDB). Causa raíz: transición de arquitectura SQL-based → VectorDB sin actualizar tests y queries heredadas.

---

## Problemas de Arquitectura Detectados

### CRÍTICOS (Impiden funcionalidad)

1. **ChatService no realiza búsqueda RAG** → `searchContext` retorna vacío, el experto legal no consulta documentos indexados.
2. **ChatService usa LLM placeholder** → `LocalLLM.Complete` devuelve respuestas hardcodeadas, no usa el LLM configurado (CGo/Ollama/External).
3. **Doble sistema de persistencia inconsistente** → IndexLegalDocument guarda en VectorDB pero no en tabla `document_chunks` (aunque el test y queries legados esperan `document_chunks`).
4. **Embeddings dependen exclusivamente de Ollama HTTP** → Modo "cgo" (embebido) para LLM pero embeddings via HTTP rompe 100% offline puro.
5. **Falta endpoints legales** → No hay re-indexar documento, sugerir cláusulas, historial chat.
6. **Configuración RAG no se aplica al chat legal** → ChatService no lee modo RAG ni modelo LLM legal.

### IMPORTANTES (Calidad)

7. **Tests desactualizados** → No verifican chunk_count en legal_documents ni inserción en document_chunks (si se requiere).
8. **Mezcla de responsabilidades** → Handlers contienen lógica de negocio; falta servicio dedicado para Legal RAG.

---

## Plan de Solución

### Fase 1: Restaurar funcionalidad Chat Legal (Urgente)

**Task 1.1:** Implementar búsqueda RAG en ChatService.searchContext

**Files:**
- Modify: `internal/ai/legal/chat_service.go:113-129`
- Test: `internal/ai/legal/chat_service_test.go`

**Step 1:** Agregar método SearchLegalDocuments al indexer (si no existe)

En `internal/ai/minirag/indexer.go`, método SearchLegalDocuments ya existe (líneas 305-320). ✅ Already implemented.

**Step 2:** Implementar searchContext real

```go
func (s *ChatService) searchContext(query string, limit int) ([]SourceRef, error) {
    if s.vectorDB == nil {
        return []SourceRef{}, nil
    }

    // Generar embedding de la consulta usando embedder (se necesita inyectar embedder)
    // Por ahora, usar embedder del indexer? Necesitamos crear un embedder aquí.
    // Mejor: inyectar EmbeddingClient en ChatService.

    // Modificar NewChatService para aceptar embedder
    //   embedder *minirag.EmbeddingClient
}
```

**Decision:** Cambiar ChatService para que reciba Indexer (o VectorDB + Embedder) en lugar de solo VectorDB.

**Step 2 (detalle):** 
- Modificar `NewChatService(db *sql.DB, vectorDB *minirag.VectorDB, embedder *minirag.EmbeddingClient)`.
- En `HandleLegalChat` handler, crear embedder e indexer y pasarlos.

**Step 3:** Generar embedding, buscar, filtrar por jurisdiction Cuba

```go
embedding, err := s.embedder.GenerateEmbedding(query)
if err != nil { log...; return []SourceRef{}, err }
results, err := s.vectorDB.SearchLegalDocuments(embedding, map[string]interface{}{"jurisdiction":"Cuba"}, limit)
```

**Step 4:** Mapear resultados a SourceRef

**Step 5:** Actualizar handler para pasar embedder

En `HandleLegalChat` (handlers/ai.go:989-990):
```go
embedder := minirag.NewEmbeddingClient("", "")
indexer := minirag.NewIndexer(h.DB, vectorDB, embedder) // o al menos pasar embedder
chatSvc := legal.NewChatService(h.DB, vectorDB, embedder)
```

**Step 6:** Agregar tests de integración: consulta devuelve fuentes.

---

**Task 1.2:** Reemplazar LLM placeholder por LLMClient real

**Files:**
- `internal/ai/legal/chat_service.go`: cambiar LocalLLM por LLMClient
- `internal/ai/client.go`: ya existe, puede usarse.

**Step 1:** Definir interfaz LLMClient ya está en `internal/ai/types.go`? Ver que en chat_service se define otra interfaz. Mejor usar `ai.LLMClient` (de client.go) que ya tiene Generate.

**Step 2:** Modificar ChatService:
```go
type ChatService struct {
    db       *sql.DB
    vectorDB *minirag.VectorDB
    embedder *minirag.EmbeddingClient
    llm      ai.LLMInterface // o *ai.LLMClient
}
```
`ai.LLMClient` tiene método Generate(ctx, prompt, context). Adaptar.

**Step 3:** En NewChatService, crear LLMClient a partir de configuración (leer system settings para ai_provider, etc.) o inyectarlo desde handler.

**Decision:** Inyectar LLMClient desde handler (más simple). Handler ya tiene h.LLMClient o puede construirlo con getAIConfig.

Modificar `HandleLegalChat`:
```go
llmClient := h.LLMClient
if llmClient == nil {
    provider, apiKey, model, endpoint, err := h.getAIConfig()
    // ...
    llmClient = ai.NewLLMClient(ai.LLMProvider(provider), apiKey, model, endpoint)
}
chatSvc := legal.NewChatService(h.DB, vectorDB, embedder, llmClient)
```

**Step 4:** En chat_service.ProcessMessage, usar s.llm.Generate (con contexto RAG) en lugar de placeholder.

**Step 5:** Eliminar respuestas hardcodeadas.

---

**Task 1.3:** Asegurar actualización de `chunk_count` e `indexed_at` en legal_documents

**Current:** IndexLegalDocument ya actualiza (indexer.go:279-287). El handler `HandleUploadLegalDocument` lanza goroutine pero no reporta el chunk_count al frontend. Se puede mejorar pero no bloquea.

**Issue 302:** Ya código existe, pero test no verifica. Se abordará en Fase 2.

---

### Fase 2: Persistencia y Tests (Resuelve Issues 302-305)

**Task 2.1:** Decidir estrategia de persistencia de chunks

**Opción A:** Mantener solo VectorDB (JSON) → eliminar referencias a `document_chunks` en queries y tests.
**Opción B:** Doble persistencia → insertar en `document_chunks` además de VectorDB.

**Recomendación:** Dado diseño actual (MiniRAG VectorDB como source of truth) y que no hay uso de SQL para búsqueda, elegir **Opción A**. Simplifica y elimina deuda técnica.

**Step 1:** Eliminar función `FindSimilarLegalChunks` en `internal/db/legal.go` (está obsoleta).
**Step 2:** Eliminar creación de tabla `document_chunks` en tests (`indexer_test.go:84-98`).
**Step 3:** Asegurar que `GetLegalDocumentChunkCount` no se use en ningún lado. Si no se usa, eliminarlo también de `legal.go`. (Buscar usos).
**Step 4:** Actualizar tests de indexer para verificar:
   - VectorDB.Count() coincide con número de chunks generados.
   - Actualización de `chunk_count` e `indexed_at` en tabla `legal_documents` (leer desde DB).

**Task 2.2:** Actualizar TestIndexLegalDocument para verificar DB

**Files:** `internal/ai/minirag/indexer_test.go:138-192`

**Step 1:** Después de indexar, consultar la DB:
```go
var countDB int
err = db.QueryRow("SELECT chunk_count FROM legal_documents WHERE id = ?", doc.ID).Scan(&countDB)
```
**Step 2:** Asegurar countDB == len(chunks).
**Step 3:** Verificar `indexed_at` no NULL.

**Task 2.3:** Cerrar issues 302-305

Con los cambios, los issues se resuelven:
- 302: actualización existe + test verifica.
- 303: método GetLegalDocumentChunkCount se eliminará si no se usa.
- 304: test se actualiza a verificar DB.
- 305: inserción en document_chunks ya no requerida; se elimina código obsoleto.

---

### Fase 3: Endpoints Legales Faltantes

**Task 3.1:** Implementar GET /api/ai/legal/documents/{id}/reindex

**Files:** `internal/handlers/ai.go`

**Step 1:** Agregar ruta en `HandleAI` switch:
```go
case path == "/legal/documents/"+idStr+"/reindex" && r.Method == http.MethodPost:
    h.HandleReindexLegalDocument(w, r, id)
```
**Step 2:** Crear `HandleReindexLegalDocument`:
   - Buscar documento por ID.
   - Borrar chunks del VectorDB (eliminar por metadata document_id).
   - Re-indexar con IndexLegalDocument.
   - Devolver status.

**Task 3.2:** Implementar GET /api/ai/legal/suggest-clauses

**Files:** `internal/handlers/ai.go`

**Step 1:** Ruta: `case path == "/legal/suggest-clauses" && r.Method == http.MethodGet`
**Step 2:** Leer query param `type`.
**Step 3:** Buscar en VectorDB documentos de tipo "modelo_contrato" para ese tipo.
**Step 4:** Devolver lista de títulos/IDs.

**Task 3.3:** Implementar GET /api/ai/legal/chat/history (para historial)

**Files:** `internal/handlers/ai.go`, `internal/db/legal.go` ya tiene ListLegalChatMessages.

**Step 1:** Ruta: `/api/ai/legal/chat/history?session_id=...`
**Step 2:** Handler que llama db.ListLegalChatMessages y devuelve JSON.

---

### Fase 4: Correcciones de arquitectía Embeddings & Modo Local

**Task 4.1:** Sincronizar modo embeddings con modo LLM

**Problema:** EmbeddingClient solo usa Ollama. En modo "cgo" debería poder usar embeddings locales via CGo (llama.cpp) también.

**Opción corto plazo:** Permitir que EmbeddingClient use CGoLLMInference para embeddings (reutilizar llama.cpp). 
**Implementación:**
- En `cgo_llama.go`, el método `Generate` ya existe; agregar `GenerateEmbedding` que usa `llama_embed` o similar (llama.cpp tiene api de embeddings).
- O bien, si Qwen2.5 puede hacer embeddings? Sí, Qwen2.5 puede usarse como embedding model, pero mejor usar all-MiniLM-L6-v2 que es específico. all-MiniLM-L6-v2 también está en GGUF y puede correr con llama.cpp.
- Modificar `EmbeddingClient` para soportar dos backends: Ollama y CGo local (similar a LocalClient).

**Decision para MVP:** 
- Mantener embeddings via Ollama por simplicidad.
- Documentar que modo "cgo" requiere también Ollama para embeddings (o instalar embedding server separado).
- O未来 release: integrar embeddings CGo.

Para este plan, dejamos como está, pero añadimos tarea para documentar requisitos.

**Task 4.2:** Asegurar configuración consistente

**Files:** `internal/config/config.go`

**Step 1:** Agregar struct RAGConfig:
```go
type RAGConfig struct {
    Mode              string `env:"RAG_MODE" default:"external"`
    LocalMode         string `env:"RAG_LOCAL_MODE" default:"cgo"`
    LocalModel        string `env:"RAG_LOCAL_MODEL" default:"qwen2.5-0.5b-instruct-q4_0.gguf"`
    EmbeddingModel    string `env:"RAG_EMBEDDING_MODEL" default:"all-minilm-l6-v2"`
    HybridStrategy    string `env:"RAG_HYBRID_STRATEGY" default:"local-first"`
    HybridRerank      bool   `env:"RAG_HYBRID_RERANK" default:"true"`
}
```
**Step 2:** Agregar campo RAG RAGConfig en Config.
**Step 3:** Cargar desde env o DB al inicio.

---

### Fase 5: Testing & QA

**Task 5.1:** Tests de integración ChatLegal con RAG

**Files:** `internal/ai/legal/chat_service_test.go` (nuevo)

- Setup: crear DB con documento legal, indexar en VectorDB.
- Llamar ProcessMessage con pregunta que coincida.
- Verificar que respuesta contenga referencias al documento (o al menos que searchContext no vacío).

**Task 5.2:** Tests end-to-end handler LegalChat

- Usar httptest.NewRequest a /api/ai/legal/chat.
- Mock de LLMClient para devolver respuesta predecible.
- Verificar status, JSON, y que se guardaron mensajes en DB.

**Task 5.3:** Actualizar indexer_test para verificar tabla legal_documents (como se describió).

---

### Fase 6: Frontend & UI (si aplica)

**Nota:** Los diseños incluyen páginas de chat y admin UI. Esa parte queda pendiente si el frontend no está listo. Este plan se centra en backend.

---

## Entregablespor Fase

**Fase1:** Chat legal funcional con RAG, LLM real. 
- chat_service.go actualizado.
- handler HandleLegalChat usa LLMClient.
- Endpoint responde con contexto.

**Fase2:** Tests actualizados, issues 302-305 resueltos.
- Tests verifican chunk_count DB.
- Eliminación código obsoleto document_chunks.

**Fase3:** Endpoints reindex, suggest-clauses, historial.

**Fase4:** Config RAG struct en config.go.

**Fase5:** Cobertura tests de integración.

---

## Criterios de Éxito

- [ ] Chat legal responde citando documentos relevantes (RAG works).
- [ ] LLM configurado (OpenAI, Groq, o local CGo) se usa, no placeholder.
- [ ] Tests pasan y verifican estado consistente VectorDB + DB.
- [ ] Endpoints legales completos según diseño.
- [ ] Configuración RAG unificada en struct.
- [ ] Issues 302-305 cerrados.

---

## Comandos de Verificación

```bash
# Tests
go test ./internal/ai/minirag/... -v
go test ./internal/ai/legal/... -v

# Build
go build ./...

# Manual: probar chat legal con documento indexado
# 1. Subir ley PDF
# 2. Esperar indexación
# 3. Preguntar: "¿Qué dice el artículo 5?"
# 4. Verificar respuesta incluye fragmento del documento
```

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Embeddings via Ollama no disponibles | Modo fallback a hash (ya existe) |
| LLM placeholder no reemplazado a tiempo | Tests de integración detectan inmediatamente |
| Rotura de tests existentes | Ejecutar CI completo antes de merge |

---

**Siguiente paso:** Ejecutar Fase 1, Task 1.1 y 1.2.
