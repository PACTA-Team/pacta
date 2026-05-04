# Diseño: Sistema Experto en Contratos Legales Cubanos

**Fecha:** 2026-04-29  
**Estado:** Aprobado  
**Autor:** Kilo (Brainstorming con usuario)  
**Tags:** #ai #legal #rag #cuba #contracts #themis

---

## Visión General

**Objetivo:** Convertir el módulo Themis AI existente en un **asistente legal especializado en derecho contractual cubano** mediante la incorporación de un corpus legal estructurado y una interfaz de chat accesible desde el header.

**Principios:**
- ✅ **RAG enriquecido** (sin fine-tuning de modelos)
- ✅ **No invasivo**: desactivado por defecto, activable por admin
- ✅ **Fácil mantenimiento**: agregar documentos legales es subir archivos + metadata
- ✅ **Contextual**: cuando se menciona un contrato, el agente lo recupera automáticamente

---

## 1. Arquitectura Técnica

### Componentes Principales

```
Frontend (React)
├── Header: [⚖️ Icono AI Legal] → /ai-legal/chat
├── ChatPanel: Chat independiente en nueva pestaña
├── Admin Settings → Sección "AI Legal"
│   ├── Toggle: Habilitar/deshabilitar asistente (default: OFF)
│   ├── Toggle: Integrar en formularios de contratos (default: OFF)
│   └── CRUD Documentos Legales (upload, list, delete, reindex)
└── ContractForm: Validación proactiva (si integración activada)

Backend (Go)
├── Handler: HandleAILegalChat (NUEVO)
├── LegalRAG (nuevo paquete internal/ai/legal)
│   ├── LegalRetriever: búsqueda filtrada por metadata
│   └── Filtros: jurisdiction=Cuba, effective_date <= hoy
├── MiniRAG Indexer (extendido): IndexLegalDocument()
├── Tabla: legal_documents (NUEVA)
├── Tabla: ai_legal_chat_history (OPCIONAL)
└── System Settings: ai_legal_enabled, ai_legal_integration

Almacenamiento
├── Archivos: data/legal_corpus/{company_id}/{uuid}.pdf
├── Vector DB: data/rag_vectors/company_{id}/index.json
│   (misma DB, meta.source = "legal" o "contract")
└── DB: legal_documents (metadata enriquecida)
```

---

## 2. Base de Datos

### 2.1 Tabla `legal_documents`

```sql
CREATE TABLE IF NOT EXISTS legal_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (
        document_type IN ('ley', 'decreto', 'decreto_ley', 'codigo',
                          'modelo_contrato', 'jurisprudencia', 'resolucion')
    ),
    jurisdiction TEXT NOT NULL DEFAULT 'Cuba',
    reference_number TEXT,           -- Ej: "Ley 118/2022", "Art. 25"
    effective_date DATE,             -- Fecha de vigencia
    source_filename TEXT NOT NULL,   -- Nombre archivo original
    storage_path TEXT NOT NULL,      -- Ruta física en disco
    mime_type TEXT,
    size_bytes INTEGER,
    content_text TEXT NOT NULL,      -- Texto extraído completo
    tags TEXT,                       -- JSON array: ["inversion", "extranjera"]
    chunk_config TEXT,               -- JSON: {"size": 500, "overlap": 50, "strategy": "structured"}
    is_indexed BOOLEAN DEFAULT 0,   -- Si está en vector DB
    indexed_at DATETIME,
    company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id),
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- Índices
CREATE INDEX idx_legal_docs_type ON legal_documents(document_type, jurisdiction);
CREATE INDEX idx_legal_docs_ref ON legal_documents(reference_number);
CREATE INDEX idx_legal_docs_effective ON legal_documents(effective_date);
CREATE INDEX idx_legal_docs_indexed ON legal_documents(is_indexed, company_id);
CREATE INDEX idx_legal_docs_tags ON legal_documents(tags);
```

### 2.2 Tabla `ai_legal_chat_history` (OPCIONAL)

```sql
CREATE TABLE IF NOT EXISTS ai_legal_chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,           -- UUID sesión
    user_id INTEGER REFERENCES users(id),
    company_id INTEGER NOT NULL,
    message TEXT NOT NULL,              -- user message
    reply TEXT NOT NULL,                -- assistant reply
    sources TEXT,                       -- JSON: [{doc_id, title, snippet}]
    contract_id INTEGER REFERENCES contracts(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_chat_history_session ON ai_legal_chat_history(session_id);
CREATE INDEX idx_chat_history_user ON ai_legal_chat_history(user_id, created_at);
```

### 2.3 System Settings (agregar)

```sql
INSERT OR IGNORE INTO system_settings (key, value, description) VALUES
('ai_legal_enabled', 'false', 'Habilitar asistente legal experto (default: desactivado)'),
('ai_legal_integration', 'false', 'Integrar validaciones en formularios de contratos'),
('ai_legal_embedding_model', 'all-minilm-l6-v2', 'Modelo de embedding para documentos legales'),
('ai_legal_chat_model', 'qwen2.5-0.5b-instruct-q4_0.gguf', 'Modelo LLM para chat legal');
```

---

## 3. Flujos de Datos

### 3.1 Ingesta de Documentos Legales

```
Admin → Settings → AI Legal → "Subir documento legal"
    │
    ├─ Upload: file (PDF/DOCX/TXT) + metadata JSON
    │   Metadata: {
    │     "title": "Ley de Inversión Extranjera",
    │     "type": "ley",
    │     "reference": "Ley 118/2022",
    │     "effective_date": "2022-04-01",
    │     "tags": ["inversion", "extranjera"]
    │   }
    │
    ▼
POST /api/ai/legal/documents/upload
    │
    ├─ Handler:
    │   1. Validar MIME + tamaño (50MB max)
    │   2. Guardar archivo en data/legal_corpus/{company}/{uuid}.pdf
    │   3. Extraer texto (pdfcpu / Tika)
    │   4. Detectar estructura (ley → artículos, modelo → cláusulas)
    │   5. INSERT INTO legal_documents (content_text = todo texto)
    │   6. Indexer.IndexLegalDocument(id)
    │        ├─ Chunking estructurado
    │        ├─ Generar embeddings
    │        ├─ Metadata enriquecida:
    │        │   {source: "legal", doc_type: "ley", ref: "118/2022", ...}
    │        └─ Agregar a VectorDB (misma DB)
    │   7. UPDATE legal_documents SET is_indexed=1, indexed_at=NOW()
    │   8. Audit logging
    │
    ▼
Respuesta: { "id": 123, "chunks_indexed": 45, "status": "indexed" }
```

### 3.2 Chat Legal

```
Usuario → clic [⚖️] → /ai-legal/chat
    │
    ├─ ChatPanel (React)
    │   • Contexto: contract_id opcional (si está viendo contrato)
    │   • Historial local (session)
    │
    ▼
Usuario: "¿Qué cláusulas incluir en contrato de suministro?"
    │
    ▼
POST /api/ai/legal/chat
Body: { "message": "...", "contract_id": 123, "session_id": "uuid" }
    │
    ▼
Handler:
  1. Verificar ai_legal_enabled = true
  2. Construir contexto RAG:
     a) Embedding de pregunta
     b) VectorDB.Search(query, k=10)
     c) Filtrar: jurisdiction=Cuba, effective_date <= hoy
     d) Weighting: modelo_contrato(0.4) + ley(0.3) + jurisprudencia(0.3)
     e) Si contract_id → recuperar contenido del contrato
  3. Prompt:
     System: SystemPromptCubanLegalExpert
     Context: [Fragmentos legales] + [Contrato si aplica]
     User: pregunta
  4. LLM.generate() → respuesta
  5. Guardar en ai_legal_chat_history (opcional)
  6. Return: { reply, sources[] }
    │
    ▼
Frontend: Muestra respuesta + citas + botones acción
```

### 3.3 Validación en Formularios (si integración activa)

```
ContractForm → onBlur de campos importantes
    │
    ├─ Usuario escribe cláusula "Precio"
    │
    ▼
Auto-trigger: debounced 2s after stop typing
    │
    ▼
POST /api/ai/legal/validate
Body: { "contract_text": "...", "contract_type": "suministro" }
    │
    ▼
Handler:
  1. RAG: buscar modelos de contrato del mismo tipo
  2. Buscar leyes aplicables (ej: Ley 173/2022 para divisas)
  3. LLM: analiza contra estándares
  4. Return: {
       "risks": [
         {"clause": "Precio", "risk": "high", "suggestion": "Express in CUP or include conversion clause"},
         {"clause": "Jurisdicción", "risk": "medium", "suggestion": "Specify Cuban courts"}
       ],
       "missing_clauses": ["Arbitraje", "Fuerza Mayor"],
       "overall_risk": "medium"
     }
    │
    ▼
UI: Modal de advertencias con colores (rojo/amarillo/verde)
Botones: [Corregir] [Ignorar] [Guardar de todos modos]
```

---

## 4. Parser y Chunking Estructurado

**Paquete:** `internal/ai/legal/parser.go`

### 4.1 Detección de Estructura

```go
type DocumentStructure struct {
    Title       string
    Type        string      // "ley", "modelo_contrato", etc.
    Sections    []Section
    FullText    string
}

type Section struct {
    Title      string    // "Artículo 15", "Cláusula 5"
    Type       string    // "article", "clause", "chapter"
    Number     string    // "15", "5", "I"
    Content    string
    StartPos   int
    EndPos     int
}
```

### 4.2 Parsers por Tipo

**Leyes/Decretos/Códigos:**
- Regex: `(?i)(Artículo|Art.)\s+(\d+)[\.\s-]`
- Detecta: "ARTÍCULO 25." "Art. 15 -" "Articulo 10"
- Crea Section por cada artículo

**Modelos de Contratos:**
- Regex: `(?i)CLÁUSULA\s+([A-ZÁÉÍÓÚÑ]+|[IVXLCDM]+)`
- Detecta: "CLÁUSULA PRIMERA" "CLÁUSULA 5" "CLÁUSULA SÉPTIMA"
- También: "NUMERAL", "PÁRRAFO"

**Genérico (fallback):**
- Split por `\n\n` (párrafos)
- Si párrafo > 2000 chars → subdividir

### 4.3 Chunking

```go
func ChunkStructured(doc DocumentStructure) []Chunk {
    var chunks []Chunk

    for _, section := range doc.Sections {
        if len(section.Content) > 2000 {
            // Subdividir por párrafos
            paragraphs := strings.Split(section.Content, "\n\n")
            currentChunk := ""
            for _, para := range paragraphs {
                if len(currentChunk)+len(para) > 2000 {
                    chunks = append(chunks, Chunk{
                        Title:   section.Title,
                        Content: currentChunk,
                        Metadata: map[string]string{
                            "doc_type": doc.Type,
                            "section": section.Type,
                            "section_num": section.Number,
                        },
                    })
                    currentChunk = para
                } else {
                    currentChunk += "\n\n" + para
                }
            }
            if currentChunk != "" {
                chunks = append(chunks, Chunk{Title: section.Title, Content: currentChunk})
            }
        } else {
            // Sección entera en un chunk
            chunks = append(chunks, Chunk{
                Title:   section.Title,
                Content: section.Content,
                Metadata: enrichedMeta,
            })
        }
    }
    return chunks
}
```

**Overlap:** No necesario con chunking por sección (cada sección es autónoma). Si se subdivide, incluir 1 párrafo anterior como overlap.

---

## 5. System Prompt: LEX-CUBA

```go
const SystemPromptCubanLegalExpert = `Eres **LEX-CUBA**, un asistente legal experto en derecho contractual cubano.

🏛️ **Conocimiento Base:**
1. Código Civil (2019) - Libro IV (Obligaciones) y Libro V (Contratos)
2. Ley de Inversión Extranjera 118/2022
3. Decreto-Ley 322/2022 (Empresas)
4. Código de Trabajo (Ley 1/2023)
5. Ley de la Vivienda (Decreto-Ley 323/2022)
6. Ley 173/2022 (Sistema de Pagos)
7. Resoluciones Minjus y Banco Central

📋 **Tipos de Contratos:**
Compraventa, Arrendamiento, Prestación de Servicios, Suministro, Distribución,
Joint Venture / Empresa Mixta, Contrato de Trabajo, Consultoría.

📚 **Fuentes Disponibles:**
- Historial de contratos de la empresa (casos reales)
- Modelos de contratos cubanos validados
- Legislación cubana vigente (códigos, leyes, decretos)
- Jurisprudencia y dictámenes (si están cargados)

🎯 **Metodología:**

1. Identifica tipo de consulta (generación, revisión, teórica, interpretación)
2. Busca precedentes relevantes en el RAG
3. Estructura respuesta:
   a) Respuesta directa (1-2 líneas)
   b) Fundamento legal (cita artículo, ley)
   c) Ejemplo/modelo (si aplica)
   d) Advertencias (riesgos, cláusulas inválidas)
   e) Recomendación práctica

📖 **Ejemplo:**
P: "¿Puedo pagar un contrato en USD?"
R:
"⚠️ **Respuesta:** Parcialmente. Según Ley 173/2022, los precios deben expresarse
en CUP o CUC. Para contratos con extranjeros se acepta USD/EUR si se incluye
cláusula de conversión.

📚 **Fundamento:**
- Ley 173/2022, Artículo 12
- Circular 209/2023 BC

🔧 **Recomendación:**
Incluir: 'El precio se fija en USD, pero se pagará en CUP al tipo de cambio oficial...'

🚫 **NO hagas:**
- No inventes leyes
- No des opinión sobre caso específico sin datos completos
- No sugieras eludir la ley

✅ **Haz:**
- Cita la fuente (file_id, artículo)
- Marca 📌 cuando cites un modelo guardado
- Usa ⚠️ para advertencias importantes"

---

## 6. Nuevos Endpoints API

| Endpoint | Método | Propósito |
|----------|--------|-----------|
| `POST /api/ai/legal/chat` | POST | Chat con experto legal |
| `GET /api/ai/legal/documents` | GET | Listar documentos legales indexados |
| `POST /api/ai/legal/documents/upload` | POST | Subir documento legal |
| `DELETE /api/ai/legal/documents/{id}` | DELETE | Eliminar documento + limpiar vectores |
| `POST /api/ai/legal/documents/{id}/reindex` | POST | Re-indexar documento específico |
| `GET /api/ai/legal/status` | GET | Estado del experto (toggle, count, salud) |
| `POST /api/ai/legal/validate` | POST | Validar contrato contra base legal |
| `GET /api/ai/legal/suggest-clauses` | GET | Sugerir cláusulas para tipo de contrato |
| `POST /api/ai/legal/index-all` | POST | Re-indexar todos los documentos legales |

---

## 7. Sistema de Configuración

**Settings → AI Legal:**

```
┌─────────────────────────────────────────────────────────────┐
│  Configuración · Asistente Legal                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Estado General                                             │
│  [✓] Habilitar Asistente Legal (toggle OFF por defecto)   │
│  Mostrar icono en header: [✓] Sí  [ ] No                  │
│  Integrar en formularios: [✓] Sí  [ ] No                  │
│                                                             │
│  Modelos                                                     │
│  LLM: [local·Qwen2.5-0.5B]  [external·OpenAI]            │
│  Embedding: [all-minilm-l6-v2]                            │
│                                                             │
│  Gestión de Documentos Legales                              │
│  [+ Subir documento legal]                                 │
│                                                             │
│  Documentos indexados (127):                               │
│   ✅ Ley 118/2022 - Inversión Extranjera                   │
│      Tipo: ley | Chunks: 45 | Indexado                     │
│      [Preview] [Re-indexar] [Delete]                       │
│   ✅ Modelo_Contrato_Suministro_v2.md                      │
│      Tipo: modelo_contrato | Chunks: 12 | Indexado         │
│                                                             │
│  [Indexar todos los documentos pendientes]                 │
│                                                             │
│  Estadísticas                                               │
│  • Total vectores legales: 3,421                           │
│  • Última actualización: 29/04/2026 09:15                  │
│  • Tamaño vector DB: 2.4 MB                                │
│  • Consultas este mes: 156                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Frontend - Chat Interface

**Ruta:** `/ai-legal/chat` (página independiente)

**Componentes:**
- `ChatPanel`: mensajes, input, historial
- `SourceCitation`: hover con preview del fragmento legal
- `ActionButtons`: "Insertar en editor", "Ver contrato", "Guardar favorito"
- Streaming SSE (server-sent events) para respuesta en tiempo real

**Features:**
- Referenciar contratos: "¿sobre el contrato #123?" → botón "Adjuntar"
- Citas clickeables → abren modal con documento completo
- Exportar conversación (PDF con sellos de "Documento Legal")
- Sesiones persistentes (localStorage + DB opcional)

---

## 9. Validación en Formularios

**ContractForm (si `ai_legal_integration` activado):**

- **Tipo de contrato select** → onChange:
  - Fetch `/api/ai/legal/suggest-clauses?type=suministro`
  - Tooltip: "Cláusulas obligatorias: 1. Precio en CUP/USD 2. Ley aplicable Cuba..."

- **Botón [🔍 Validar Legal]**:
  - Envía contenido completo a `/api/ai/legal/validate`
  - Modal de advertencias:
    ```
    ⚠️ 3 advertencias detectadas:
    1. [HIGH] No incluye cláusula de arbitraje
       Sugerencia: Agregar cláusula 25 del Modelo Contrato Suministro
       [Insertar cláusula] [Ignorar]

    2. [MEDIUM] Moneda en USD sin cláusula de conversión
       Fundamento: Ley 173/2022, Art. 12
       [Corregir] [Ignorar]

    3. [LOW] Jurisdicción "Miami" - ¿desea cambiar a Cuba?
       [Cambiar] [Mantener]
    ```
  - Botones: [Corregir todo] [Guardar de todos modos] [Cancelar]

---

## 10. Plan de Implementación (Fases)

| Fase | Duración | Entregables |
|------|----------|-------------|
| **Fase 0** | 1 día | Recopilar corpus legal cubano (PDFs), normalizar metadata |
| **Fase 1** | 3-4 días | Tabla `legal_documents` + migración; endpoint upload; parser; indexer extendido; handler chat básico; system prompt |
| **Fase 2** | 2-3 días | Admin UI: Settings → AI Legal; CRUD documentos; stats; toggle |
| **Fase 3** | 2 días | Chat interface: `/ai-legal/chat`; ChatPanel; streaming; historial |
| **Fase 4** | 1-2 días | Integración formularios: botón Validar; tooltips sugerencias; modal advertencias |
| **Fase 5** | 2 días | QA, testing, optimización, documentación |
| **Total** | **10-14 días** | Sistema experto legal completo |

---

## 11. Consideraciones Técnicas

### 11.1 Seguridad
- Solo `admin` puede subir/eliminar documentos legales
- Validación MIME + magic bytes (no solo extensión)
- Límite 50MB por archivo
- Sanitizar texto extraído (evitar XSS en previews)
- Audit log: `legal_document_upload`, `legal_document_delete`

### 11.2 Performance
- Indexación asincrónica (goroutine) + progress feedback
- Límite: 10,000 chunks por company (suficente)
- Caché de búsquedas: 5 min TTL
- Vector DB: `float32` (compacto)

### 11.3 Errores y Edge Cases
- PDF corrupto → error amigable + log
- Documento derogado → filter por `effective_date`
- Chunk muy grande → subdivided por párrafos
- LLM timeout → fallback a "Lo siento, estoy teniendo problemas..."
- Sin documentos legales → mensaje: "Admin debe subir base legal primero"

---

## 12. Criterios de Éxito

**MVP (Fases 1-3):**
- [ ] Admin sube PDF (Ley 118/2022) → indexa
- [ ] Chat responde: "¿Qué dice Artículo 25?" → cita correctamente
- [ ] Pregunta sobre contrato de suministro → sugiere cláusulas modelo
- [ ] Toggle `ai_legal_enabled` funciona (ON/OFF)

**Completo (Fases 4-5):**
- [ ] Botón Validar en formulario funciona
- [ ] Toggle integración respeta configuración
- [ ] Historial chat persistente
- [ ] Performance: < 3s promedio respuesta
- [ ] 90% respuestas citan fuente correctamente

---

## 13. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Extracción PDF mala | Alto | Usar `pdfcpu` (no BT/ET básico). Probar con Gaceta Oficial. Fallback: Tika server externo. |
| Chunking corta artículos | Alto | Parser estructurado con regex. Validar con Ley de ejemplo. |
| Modelo 0.5B limitado | Medio | Permitir switch a OpenAI/Groq en settings. |
| Indexación lenta | Medio | Background worker + progress bar. Límite 100MB/doc. |
| Documento desactualizado | Alto | `effective_date` + filtro automático. Alertar si ley derogada. |
| Confianza excesiva AI | Crítico | Disclaimer: "No sustituye abogado". Forzar revisión humana en contratos generados. |

---

## 14. Roadmap Futuro

- **Fase 6:** Búsqueda BM25 para términos exactos (art. 25, ley 118)
- **Fase 7:** Fine-tune embedding con corpus legal cubano
- **Fase 8:** Generación automática de contratos desde templates
- **Fase 9:** Comparativa: "Diferencias modelo 2023 vs 2024"
- **Fase 10:** Validación proactiva automática (alertas en tiempo real)

---

## 15. Entregables por Fase

### Fase 0: Preparación
- [ ] Carpeta `data/legal_corpus/` con PDFs recolectados
- [ ] Metadata JSON por documento (convención naming)
- [ ] Lista de fuentes oficiales verificadas

### Fase 1: Backend Core
- [ ] Migración SQL: `20260429_add_legal_documents.sql`
- [ ] Paquete `internal/ai/legal/parser.go` (estructuración)
- [ ] Paquete `internal/ai/legal/indexer.go` (IndexLegalDocument)
- [ ] Paquete `internal/ai/legal/retriever.go` (búsqueda filtrada)
- [ ] Handler: `HandleLegalDocumentUpload`, `HandleLegalChat`, etc.
- [ ] System prompt en `internal/ai/prompts.go` (SystemPromptCubanLegalExpert)
- [ ] Tests unitarios parser (leyes, modelos)

### Fase 2: Frontend Admin
- [ ] Página `SettingsAILegal.tsx` (Settings → AI Legal)
- [ ] Componente `LegalDocumentList` (tabla con acciones)
- [ ] Componente `LegalDocumentUpload` (form metadata + file)
- [ ] Componente `LegalStats` (estadísticas)
- [ ] Toggle en `SettingsPage` para `ai_legal_enabled`
- [ ] API calls: upload, list, delete, reindex, status

### Fase 3: Chat Interface
- [ ] Página `app/ai-legal/chat/page.tsx`
- [ ] Componente `ChatPanel` (mensajes, input, streaming)
- [ ] Componente `ChatMessage` (user/ assistant)
- [ ] Componente `SourceCitation` (citas hover)
- [ ] Hook `useLegalChat` (manejo mensajes, sesión)
- [ ] SSE endpoint para streaming (opcional, puede ser respuesta simple primero)

### Fase 4: Integración Formularios
- [ ] Modificación `ContractForm.tsx`:
  - Botón [🔍 Validar Legal]
  - Tooltip sugerencias en campos clave
- [ ] Endpoint `POST /api/ai/legal/validate`
- [ ] Modal `ValidationModal` (advertencias, botones acción)
- [ ] Hook `useContractValidation` (debounced autovalidación)

### Fase 5: Pulido
- [ ] QA completo: ingesta, indexación, chat, validación
- [ ] Pruebas con contrato de prueba cubano (suministro, Joint Venture)
- [ ] Ajustar chunk size, overlap, k-valores
- [ ] Optimizar prompts (ingeniería de prompts)
- [ ] Documentación técnica (README, API docs)
- [ [x] ] **Documento de diseño aprobado**

---

## Aprobación

**Fecha de aprobación:** 2026-04-29  
**Decisiones clave:**
- ✅ Tabla `legal_documents` dedicada
- ✅ Ingesta híbrida (UI + CLI)
- ✅ Chunking estructurado por artículo/cláusula
- ✅ Modelos locales + RAG enriquecido (no fine-tune)
- ✅ Chat independiente + toggle admin (default OFF)
- ✅ Integración en formularios opcional (toggle)
- ✅ Parser con regex + fallback genérico

**Siguiente paso:** Invocar skill `writing-plans` para generar plan de implementación detallado con tareas, estimaciones y responsable.
