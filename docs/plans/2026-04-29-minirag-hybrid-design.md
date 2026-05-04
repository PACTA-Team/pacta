# Design Doc: Integración MiniRAG Local Híbrida para PACTA

**Fecha**: 2026-04-29  
**Estado**: Aprobado  
**Autor**: Kilo Agent  

## 1. Resumen Ejecutivo

Se implementará un sistema RAG (Retrieval-Augmented Generation) híbrido que combina:
- **Modo Local**: Motor MiniRAG integrado con modelo Qwen2.5-0.5B-Instruct ejecutándose localmente sin internet
- **Modo Externo**: Mantenimiento de APIs actuales (OpenAI, Groq, etc.) configurables por el administrador
- **Modo Híbrido**: Combinación de ambos con estrategias de merge y reranking

**Beneficios clave**:
- ✅ 100% offline capability (privacidad total)
- ✅ Costo operativo $0 (sin APIs externas)
- ✅ Activable vía configuración administrativa
- ✅ Compilado dentro del binario (sin dependencias externas en runtime)

## 2. Arquitectura del Sistema

### 2.1 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                    PACTA Backend                          │
│                   (Go Binary)                            │
├─────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐       ┌──────────────┐                  │
│  │  Handlers    │──────▶│  AI Client   │                  │
│  │  /api/ai/*  │       │  (ai/client.go)│                  │
│  └──────────────┘       └──────┬───────┘                  │
│                              │                              │
│           ┌──────────────┴──────────────┐               │
│           │    LLMClient (ai/types.go)   │               │
│           ├─────────────────────────────┤               │
│           │ - Provider (OpenAI, etc.)  │               │
│           │ - LocalClient (MiniRAG) │◀──┐            │
│           └─────────────────────────────┘   │            │
│                                          │            │
│  ┌─────────────────────────────────────┐ │            │
│  │  internal/ai/minirag/            │◀┘            │
│  │  ├── vector_db.go (HNSW)       │              │
│  │  ├── embeddings.go (ONNX)       │              │
│  │  ├── local_client.go (Ollama)  │              │
│  │  ├── pdf_parser.go              │              │
│  │  └── indexer.go (Background)    │              │
│  └─────────────────────────────────────┘              │
│                                          │              │
│  ┌─────────────────────────────────────┐              │
│  │  internal/ai/hybrid/              │              │
│  │  ├── orchestrator.go (Router)    │              │
│  │  └── strategies.go (Merge)     │              │
│  └─────────────────────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────┘

         ┌─────────────┐      ┌─────────────┐
         │  Ollama     │      │  SQLite     │
         │  (Qwen2.5)  │      │  (Contracts) │
         └─────────────┘      └─────────────┘
```

### 2.2 Estructura de Archivos

```
internal/
├── config/
│   └── config.go                    # +RAGConfig struct
├── ai/
│   ├── client.go                    # +LocalClient support
│   ├── types.go                     # +RAG types
│   ├── rag.go                       # SQL-based RAG (existente)
│   ├── minirag/                    # NUEVO: Local RAG engine
│   │   ├── vector_db.go             # HNSW vector search
│   │   ├── embeddings.go           # Embedding generation (Ollama/ONNX)
│   │   ├── local_client.go        # Local LLM wrapper (Ollama)
│   │   ├── pdf_parser.go         # PDF/Word parser
│   │   └── indexer.go            # Auto-indexing
│   └── hybrid/                    # NUEVO: Hybrid orchestrator
│       ├── orchestrator.go         # Mode router
│       └── strategies.go         # Merge/rerank strategies
├── handlers/
│   └── ai.go                        # +/rag/* endpoints
└── db/
    └── [new migration]              # RAG settings
```

## 3. Configuración Extendida

### 3.1 Estructura de Config

```go
// internal/config/config.go

type Config struct {
    Addr            string
    DataDir         string
    Version         string
    AIEncryptionKey string
    RAG             RAGConfig  // NUEVO
}

type RAGConfig struct {
    Mode              string // "local" | "external" | "hybrid"
    LocalModel        string // "internal/ai/minirag/models/qwen2.5-0.5b-instruct-q4_0.gguf" (429MB)
    EmbeddingModel    string // "all-minilm-l6-v2"
    VectorDBPath      string // "/data/pacta/rag_vectors"
    HybridStrategy    string // "local-first" | "external-first" | "parallel"
    HybridRerank      bool   // true
}
```

### 3.2 Configuración en Base de Datos

Nuevos `system_settings` (migración pendiente):

```sql
INSERT INTO system_settings (key, value) VALUES 
('rag_mode', 'external'),
('local_model', 'qwen2.5-0.5b-instruct-q4_0.gguf'),  -- 429MB, <500MB limit
('embedding_model', 'all-minilm-l6-v2'),
('vector_db_path', ''),
('hybrid_strategy', 'local-first'),
('hybrid_rerank', 'true');
```

## 4. Motor Local MiniRAG

### 4.1 Vector Database (HNSW)

**Implementación**: Go puro con algoritmo HNSW (Hierarchical Navigable Small World)

- **Dimensión**: 384 (all-minilm-l6-v2)
- **M**: 16 (conexiones por nodo)
- **ef**: 200 (tamaño de lista dinámica)
- **Persistencia**: JSON en disco (vector_db_path)

**API**:
```go
type VectorDB struct {
    index    *hnswIndex
    metadata map[string]DocumentMeta
    path     string
    dim      int
}

func (db *VectorDB) AddDocument(id string, embedding []float32, meta DocumentMeta) error
func (db *VectorDB) Search(query []float32, k int) []SearchResult
func (db *VectorDB) GetDocument(id string) (DocumentMeta, bool)
func (db *VectorDB) DeleteDocument(id string) error
func (db *VectorDB) Count() int
```

### 4.2 Embeddings Locales

**Opción A (Recomendada)**: Ollama API
- Endpoint: `http://localhost:11434/api/embeddings`
- Modelo: `all-minilm-l6-v2` (22MB)
- Latencia: ~50ms por texto

**Opción B (Fallback)**: Hash-based (sin modelo)
- TF hash embeddings
- Solo para testing/desarrollo

### 4.3 LLM Local (Qwen2.5-0.5B-Instruct)

**Integración via llama.cpp CGo**:
```go
type LocalClient struct {
    inference *cgoLLMInference // CGo + llama.cpp (EMBEDDED)
    ollama    *OllamaClient    // Fallback via HTTP
    mode      string           // "cgo" | "ollama" | "external"
    modelPath string
}

func NewLocalClient(mode, modelPath string) *LocalClient {
    // mode "cgo": uso directo de modelo GGUF embebido (429 MB Q4_0)
    // mode "ollama": consulta a servidor Ollama local
    // mode "external": fallback a APIs externas
}
```

**Características del modelo**:
- Parámetros: 0.5B (Qwen2.5 family)
- Cuantización: Q4_0 (429 MB) — bajo límite de 500 MB ✅
- Velocidad: ~35-40 tokens/segundo en CPU
- Contexto: 128k tokens
- Entrenamiento: 18T tokens
- Licencia: Apache 2.0 (gratis)

### 4.4 Indexación de Documentos

**Chunking strategy**:
- Tamaño: 500 caracteres
- Solapamiento: 50 caracteres
- Parseo: PDF via pdfcpu, Word via Tika (opcional)

**Trigger de indexación**:
- Automático: Nuevo contrato → indexar
- Manual: Endpoint `POST /api/ai/rag/index`
- Batch: Re-indexación completa

## 5. Orquestación Híbrida

### 5.1 Modos de Operación

```go
type Orchestrator struct {
    LocalClient   *minirag.LocalClient
    Embedder      *minirag.EmbeddingClient
    VectorDB      *minirag.VectorDB
    ExternalLLM   ai.LLMProvider
    ExternalModel string
    Mode          string // "local" | "external" | "hybrid"
    Strategy      string // "local-first" | "external-first" | "parallel"
    HybridRerank  bool
}
```

### 5.2 Estrategias de Merge

| Estrategia | Descripción | Cuando usar |
|------------|-------------|---------------|
| **local-first** | Intenta local, fallback a external | Uso general, prioriza privacidad |
| **external-first** | Intenta external, fallback a local | Necesita respuestas muy precisas |
| **parallel** | Ejecuta ambos, combina resultados | Máxima robustez |

### 5.3 Reranking

Si `HybridRerank = true`:
1. Generar embeddings de query y documentos
2. Calcular similaridad semántica
3. Reordenar por score combinado (60% semántico + 40% original)

## 6. API Endpoints

### 6.1 Existentes (Mantenidos)

```
POST /api/ai/generate-contract   # Generar contrato (External LLM)
POST /api/ai/review-contract     # Revisar contrato (External LLM)
POST /api/ai/test               # Probar conexión
```

### 6.2 Nuevos (MiniRAG)

```
POST /api/ai/rag/local      # Query local (RAG local)
POST /api/ai/rag/hybrid     # Query híbrido
POST /api/ai/rag/index      # Disparar indexación
GET  /api/ai/rag/status     # Estado del sistema RAG
```

### 6.3 Ejemplo de Request/Response

**POST /api/ai/rag/hybrid**
```json
{
  "query": "Contratos similares a servicios de software",
  "k": 5,
  "strategy": "local-first"
}
```

**Response**:
```json
{
  "query": "Contratos similares a servicios de software",
  "results": [
    {
      "id": "contract_123_chunk_0",
      "score": 0.89,
      "meta": {
        "title": "Contrato de Servicios XYZ",
        "type": "services",
        "source": "contract"
      },
      "content": "Texto del contrato..."
    }
  ],
  "count": 5,
  "mode": "hybrid",
  "strategy": "local-first",
  "health": {
    "local_llm": true,
    "local_embeddings": true,
    "vector_db": true,
    "external_llm": true
  }
}
```

## 7. UI/Configuración Admin

### 7.1 Sección en Configuración del Sistema

```
┌─────────────────────────────────────────────────────┐
│  🤖 Configuración IA - RAG                     │
├─────────────────────────────────────────────────────┤
│                                              │
│  Modo RAG:                                 │
│  (•) Local       - Qwen2.5-0.5B + VectorDB   │
│  ( ) Externa     - APIs configuradas        │
│  ( ) Híbrida     - Ambos + Rerank          │
│                                              │
│  Modelo Local: qwen2.5-0.5b-instruct-q4_0.gguf
│  Embeddings:    all-minilm-l6-v2           │
│  Estrategia:    local-first                  │
│                                              │
│  [ Reindexar contratos ]                    │
│  [ Probar motor local ]                     │
└─────────────────────────────────────────────────────┘
```

## 8. Testing Strategy

### 8.1 Unit Tests

- `vector_db_test.go`: AddDocument, Search, Save/Load
- `embeddings_test.go`: GenerateEmbedding, normalizeVector
- `local_client_test.go`: Mock Ollama responses
- `strategies_test.go`: Merge, Rerank algorithms

### 8.2 Integration Tests

- Local query end-to-end (con Ollama mock)
- Hybrid query con fallback
- Indexación de 100+ contratos

### 8.3 Performance Tests

- Indexación: 100 PDFs < 5 min
- Query: < 3s p95 (local), < 2s (external)
- Memoria: < 4GB total (incluyendo modelo)

## 9. Deployment

### 9.1 Requisitos Previos

**Opción A: Con Ollama instalado**:
```bash
# Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Descargar modelos (solo si usas modo "ollama")
ollama pull qwen2.5-0.5b-instruct
ollama pull all-minilm-l6-v2
```

**Opción B: Binario embebido (Futuro)**:
- Incluir Ollama estático en el binario Go
- Automáticamente descargar modelos al iniciar
- Sin instalación manual

### 9.2 Configuración Inicial

1. Admin configura `rag_mode = "local"` en system_settings
2. Al iniciar, la app verifica si Ollama está disponible
3. Si no, ofrece instrucciones de instalación
4. Primer uso dispara indexación automática

## 10. Migración de Base de Datos

### 10.1 Nueva Migración

Crear archivo: `internal/db/XXX_rag_settings.sql`

```sql
-- Add RAG configuration settings
INSERT INTO system_settings (key, value) VALUES 
('rag_mode', 'external'),
('local_model', 'qwen2.5-0.5b-instruct-q4_0.gguf'),
('embedding_model', 'all-minilm-l6-v2'),
('vector_db_path', ''),
('hybrid_strategy', 'local-first'),
('hybrid_rerank', 'true');

-- Add to schema_migrations
INSERT INTO schema_migrations (version) VALUES ('XXX');
```

## 11. Manejo de Errores y Fallbacks

### 11.1 Escenarios

| Escenario | Comportamiento |
|-----------|----------------|
| Ollama no disponible | Fallback a external (si configurado) |
| Vector DB corrupta | Re-indexación automática |
| Embeddings fallan | Usar fallback hash-based |
| Ambos fallan | Error 503 con mensaje claro |

### 11.2 Logs

```go
log.Printf("[RAG Local] Search failed: %v", err)
log.Printf("[RAG Hybrid] Falling back to external")
log.Printf("[RAG Index] Indexed %d contratos", count)
```

## 12. Seguridad

- API keys cifradas (AES-256, existente)
- Rate limiting por company (100/day, existente)
- Validación de inputs (existente)
- Sin acceso a internet requerido para modo local

## 13. Métricas de Éxito

- ✅ 80% queries respondidas localmente sin internet
- ✅ < 3s latency p95
- ✅ 0 errores por timeout de APIs externas
- ✅ 50% reducción en costos de APIs
- ✅ 100% backward compatibility

## 14. Roadmap Futuro

### Fase 2 (Post-MVP)
- [ ] Compresión de embeddings (INT8 quantization)
- [ ] Caché de queries frecuentes
- [ ] GPU acceleration (opcional)
- [ ] Soporte para más formatos (DOCX, RTF)

### Fase 3 (Optimización)
- [ ] Ollama embebido en binario Go
- [ ] Descarga automática de modelos
- [ ] Auto-reranking con cross-encoder
- [ ] Multi-tenant vector DB isolation

## 15. Conclusión

Esta implementación provee:
1. **Privacidad total** - Datos nunca salen del servidor
2. **Costo cero** - Sin APIs de pago
3. **Flexibilidad** - Modo híbrido para redundancia
4. **Facilidad** - Configurable por el administrador
5. **Escalabilidad** - Basado en algoritmos probados (HNSW)

El sistema mantiene 100% de compatibilidad hacia atrás mientras agrega capacidades de RAG locales de última generación.
