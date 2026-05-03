# MiniRAG Embedding-Only Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor MiniRAG from Ollama HTTP + custom HNSW to a 100% offline, embedding-only RAG system with embedded GGUF model, FAISS-CPU, SQLite metadata, and llama.cpp tokenization — all in a single Go binary under 100MB.

**Architecture:** 
- Embedding inference via llama.cpp CGo (paraphrase-MiniLM-L3-v2 Q8_0 GGUF embedded with go:embed)
- Vector search via FAISS-CPU wrapped in CGo (IndexFlatIP with L2-normalized embeddings)
- Metadata storage in SQLite (contracts, chunks, vector_id mappings)
- Token-based chunking (512 tokens + 50 token overlap) using llama.cpp tokenizer
- RAG query response via static templates (no LLM generation)

**Tech Stack:** Go 1.25, CGo, llama.cpp, FAISS-CPU, SQLite (modernc.org/sqlite), sentence-transformers GGUF

---

## Phase 0: Preparation — Model Conversion (One-Time, Pre-Build)

### Task 0.1: Create model conversion script

**Files:**
- Create: `scripts/convert_embedding_model.py`
- Create: `internal/ai/minirag/models/.gitkeep`

**Step 1: Write conversion script**

```python
#!/usr/bin/env python3
"""
Convert sentence-transformers/paraphrase-MiniLM-L3-v2 to GGUF Q8_0.
Requires: pip install transformers torch llama-cpp-python
"""
import argparse
from pathlib import Path
from transformers import AutoModel, AutoTokenizer
import torch
from llama_cpp import Llama

def convert(model_name, output_path, quantize="q8_0"):
    print(f"Loading model: {model_name}")
    model = AutoModel.from_pretrained(model_name)
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    # Save original model temporarily
    temp_dir = Path("temp_convert")
    temp_dir.mkdir(exist_ok=True)
    model.save_pretrained(temp_dir)
    tokenizer.save_pretrained(temp_dir)
    
    print(f"Converting to GGUF with quantization: {quantize}")
    # Use llama.cpp convert.py via llama-cpp-python
    # Or call convert.py directly if llama.cpp cloned
    # For now, instruct user to run:
    #   python3 llama.cpp/convert.py temp_convert/ --outfile output_path --vocab-type bpe --quantize q8_0
    print(f"Run: python3 llama.cpp/convert.py {temp_dir} --outfile {output_path} --quantize {quantize}")
    
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf")
    parser.add_argument("--model", default="sentence-transformers/paraphrase-MiniLM-L3-v2")
    args = parser.parse_args()
    convert(args.model, args.output)
```

**Step 2: Create models directory placeholder**

```bash
mkdir -p internal/ai/minirag/models
touch internal/ai/minirag/models/.gitkeep
```

**Step 3: Add conversion instructions to README**

Append to `internal/ai/minirag/README.md` (create if missing):
```
## Model Conversion (One-Time)

To embed paraphrase-MiniLM-L3-v2 as GGUF Q8_0:

1. Install dependencies:
   pip install transformers torch llama-cpp-python

2. Clone llama.cpp in this directory:
   git clone https://github.com/ggerganov/llama.cpp internal/ai/minirag/llama.cpp

3. Run conversion script:
   python3 scripts/convert_embedding_model.py

4. Commit the generated .gguf file (65MB):
   git add internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf
```

**Step 4: Commit scaffold**

```bash
git add scripts/convert_embedding_model.py internal/ai/minirag/models/.gitkeep
git commit -m "chore(minirag): add model conversion script and models dir scaffold"
```

---

## Phase 1: Core Embedding (CGo llama.cpp)

### Task 1.1: Implement CGo embedder with L2 norm and batching

**Files:**
- Create: `internal/ai/minirag/embedding/cgo_embedder.go`
- Create: `internal/ai/minirag/embedding/cgo_embedder_test.go`
- Modify: `internal/ai/minirag/cgo_llama.go` (rename → move logic)
- Delete: `internal/ai/minirag/embeddings.go` (Ollama HTTP client)

**Step 1: Write failing test — L2 normalization**

```go
func TestNormalizeVector(t *testing.T) {
    v := []float32{3, 4}
    norm := normalizeVector(v)
    expected := []float32{0.6, 0.8}
    assert.InDeltaSlice(t, expected, norm, 1e-5)
}
```

**Step 2: Run test — expect fail (function not exists)**

```bash
cd internal/ai/minirag/embedding && go test -v -run TestNormalizeVector
# FAIL: undefined normalizeVector
```

**Step 3: Implement cgo_embedder.go (minimal first)**

```go
package embedding

/*
#cgo CFLAGS: -I../../llama.cpp/include
#cgo LDFLAGS: -L../../llama.cpp/build -llama -lm -lstdc++ -lpthread
#include "llama.h"
#include <stdlib.h>
#include <string.h>
*/
import "C"
import (
    "fmt"
    "os"
    "path/filepath"
    "runtime"
    "unsafe"
    "golang.org/x/exp/constraints"
)

// Embedder uses llama.cpp via CGo to generate embeddings
type Embedder struct {
    model    *C.struct_llama_model
    ctx      *C.struct_llama_context
    vocab    *C.struct_llama_vocab
    modelDir string // temp dir for extracted GGUF
}

// NewEmbedder creates embedder; extracts embedded GGUF to temp dir and loads
func NewEmbedder() (*Embedder, error) {
    // 1. Extract embedded GGUF from go:embed to temp dir
    data, err := embedEmbeddingModel()
    if err != nil {
        return nil, fmt.Errorf("failed to embed model: %w", err)
    }
    tmpDir := os.TempDir()
    modelPath := filepath.Join(tmpDir, "paraphrase-MiniLM-L3-v2-Q8_0.gguf")
    if err := os.WriteFile(modelPath, data, 0644); err != nil {
        return nil, fmt.Errorf("failed to write temp model: %w", err)
    }
    
    // 2. Load model via llama.cpp
    modelParams := C.llama_model_default_params()
    modelParams.n_gpu_layers = C.int(0)
    modelParams.use_mmap = C.bool(true)
    
    cpath := C.CString(modelPath)
    defer C.free(unsafe.Pointer(cpath))
    model := C.llama_model_load_from_file(cpath, modelParams)
    if model == nil {
        return nil, fmt.Errorf("llama_model_load_from_file failed")
    }
    
    // 3. Context
    ctxParams := C.llama_context_default_params()
    ctxParams.n_ctx = C.uint(512)        // embedding context window
    ctxParams.n_batch = C.uint(32)       // batch size
    ctxParams.n_threads = C.int(runtime.NumCPU() - 1)
    ctx := C.llama_init_from_model(model, ctxParams)
    if ctx == nil {
        C.llama_model_free(model)
        return nil, fmt.Errorf("llama_init_from_model failed")
    }
    
    vocab := C.llama_model_get_vocab(model)
    
    return &Embedder{
        model:    model,
        ctx:      ctx,
        vocab:    vocab,
        modelDir: tmpDir,
    }, nil
}

// GenerateEmbedding returns L2-normalized 384-dim vector for text
func (e *Embedder) GenerateEmbedding(text string) ([]float32, error) {
    // Tokenize
    ctext := C.CString(text)
    defer C.free(unsafe.Pointer(ctext))
    
    nTokens := C.llama_tokenize(e.vocab, ctext, C.int(len(text)), nil, 0, true, true)
    if nTokens < 0 {
        return nil, fmt.Errorf("tokenization failed")
    }
    tokens := make([]C.llama_token, nTokens)
    C.llama_tokenize(e.vocab, ctext, C.int(len(text)), &tokens[0], C.int(nTokens), true, true)
    
    // Batch (single for now)
    batch := C.llama_batch_get_one(&tokens[0], C.int(nTokens))
    if C.llama_decode(e.ctx, batch) != 0 {
        return nil, fmt.Errorf("llama_decode failed")
    }
    
    // Get embeddings (sequence-based pooling → mean pooling)
    // llama.cpp provides llama_get_embeddings_seq or llama_get_embeddings
    // Use llama_get_embeddings_seq to get per-token embeddings, then mean pool
    nEmb := C.llama_n_embd(e.model)
    embSize := int(nEmb) // typically 384
    
    // Get embeddings for all tokens
    embData := C.llama_get_embeddings(e.ctx)
    if embData == nil {
        return nil, fmt.Errorf("failed to get embeddings")
    }
    
    // Copy and mean-pool across token dimension
    // embData points to float32 array of size (n_tokens * n_embd)
    // We need mean across tokens → single vector of size n_embd
    // Approach: copy first n_embd values (CLS token equivalent) OR compute mean
    // For sentence-transformers, [CLS] pooling is common; llama tokenizer doesn't add special tokens by default
    // Use mean pooling over all token embeddings
    
    // Convert *C.float to Go slice
    totalTokens := int(C.llama_n_seq_elem(e.ctx, -1)) // all cached tokens
    if totalTokens == 0 {
        totalTokens = int(nTokens)
    }
    
    // We'll use last token's embedding as sentence embedding (standard for decoder models)
    // Alternatively, mean pool
    vec := make([]float32, embSize)
    if totalTokens > 0 {
        offset := (totalTokens - 1) * embSize
        src := (*[1 << 30]float32)(unsafe.Pointer(embData))[offset : offset+embSize]
        copy(vec, src)
    } else {
        // Fallback: first embSize floats
        src := (*[1 << 30]float32)(unsafe.Pointer(embData))[:embSize:embSize]
        copy(vec, src)
    }
    
    // L2 Normalize
    return normalizeVector(vec), nil
}

// Close frees resources
func (e *Embedder) Close() error {
    if e.ctx != nil {
        C.llama_free(e.ctx)
        e.ctx = nil
    }
    if e.model != nil {
        C.llama_model_free(e.model)
        e.model = nil
    }
    // Optionally delete temp GGUF file
    return nil
}

// embedEmbeddingModel returns embedded GGUF bytes (go:embed)
// This function will be generated by go:embed directive once file exists
var embedEmbeddingModel = func() []byte {
    // Placeholder — go:embed replaces this at compile time
    data, err := os.ReadFile("internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf")
    if err != nil {
        panic(fmt.Errorf("embedded model not found: %w", err))
    }
    return data
}
```

**Step 4: Implement normalizeVector helper**

Add to same file:
```go
func normalizeVector(v []float32) []float32 {
    var norm float32
    for _, x := range v {
        norm += x * x
    }
    norm = float32(math.Sqrt(float64(norm)))
    if norm < 1e-12 {
        return v
    }
    res := make([]float32, len(v))
    for i, x := range v {
        res[i] = x / norm
    }
    return res
}
```

**Step 5: Add go:embed directive (after model file exists)**

Once GGUF is committed, update embedEmbeddingModel:
```go
//go:embed ../../../models/paraphrase-MiniLM-L3-v2-Q8_0.gguf
var embeddedModel []byte
```

**Step 6: Run all tests**

```bash
go test ./internal/ai/minirag/embedding/... -v
```

**Step 7: Commit**

```bash
git add internal/ai/minirag/embedding/cgo_embedder.go internal/ai/minirag/embedding/cgo_embedder_test.go
git commit -m "feat(minirag): add CGo embedder with llama.cpp and L2 norm"
```

---

### Task 1.2: Implement batch embedding for indexing

**Files:**
- Modify: `internal/ai/minirag/embedding/cgo_embedder.go`
- Create: `internal/ai/minirag/embedding/batcher.go`
- Test: `internal/ai/minirag/embedding/batcher_test.go`

**Step 1: Write test — batch of 3 texts**

```go
func TestBatchEmbedding(t *testing.T) {
    e := newTestEmbedder(t) // helper loads tiny GGUF test model or skips if not available
    texts := []string{"contract clause A", "contract clause B", "contract clause C"}
    embeddings, err := e.GenerateBatch(texts, 2) // batch size 2
    require.NoError(t, err)
    assert.Len(t, embeddings, 3)
    for _, emb := range embeddings {
        assert.Len(t, emb, 384)
    }
}
```

**Step 2: Add GenerateBatch method (dynamic batch)**

```go
// GenerateBatch processes texts in batches of up to batchSize
func (e *Embedder) GenerateBatch(texts []string, batchSize int) ([][]float32, error) {
    if batchSize <= 0 {
        batchSize = 32
    }
    results := make([][]float32, len(texts))
    for i := 0; i < len(texts); i += batchSize {
        end := i + batchSize
        if end > len(texts) {
            end = len(texts)
        }
        batch := texts[i:end]
        // For each text in batch, tokenize + decode separately (llama.cpp batch API requires padding)
        // Simpler: loop (still faster due to context reuse)
        for j, text := range batch {
            emb, err := e.GenerateEmbedding(text)
            if err != nil {
                return nil, fmt.Errorf("batch item %d failed: %w", j, err)
            }
            results[i+j] = emb
        }
    }
    return results, nil
}
```

**Step 3: Add dynamic batch sizing based on memory**

Add method `AdjustBatchSize()` that polls `runtime.MemStats` and reduces batch if `HeapAlloc > 300MB`.

**Step 4: Run tests + commit**

---

## Phase 2: FAISS-CPU Wrapper (CGo)

### Task 2.1: Compile FAISS as static library and create wrapper

**Files:**
- Create: `internal/ai/minirag/vector/faiss_wrapper.go` (CGo)
- Create: `internal/ai/minirag/vector/faiss_wrapper_test.go`
- Create: `internal/ai/minirag/vector/faiss/CMakeLists.txt` (FAISS build config)
- Create: `scripts/build_faiss.sh` (compile FAISS static lib)

**Step 1: Write failing test — add and search vectors**

```go
func TestFAISSAddAndSearch(t *testing.T) {
    idx := NewFAISSIndex(384)
    defer idx.Close()
    
    vec := normalizeVector(randomVector(384, 42))
    idx.Add(vec, 123) // ID=123
    
    results := idx.Search(vec, 1)
    assert.Len(t, results, 1)
    assert.Equal(t, 123, results[0].ID)
    assert.InDelta(t, 1.0, results[0].Score, 1e-5) // self-match
}
```

**Step 2: Write minimal CGo wrapper skeleton (compile-fail expected)**

`faiss_wrapper.go`:
```go
package vector

/*
#cgo CFLAGS: -I../../faiss/c_api
#cgo LDFLAGS: -L../../faiss/build -lfaiss
#include <faiss/c_api.h>
#include <stdlib.h>
*/
import "C"
import (
    "fmt"
    "unsafe"
)

type FAISSIndex struct {
    index C.faiss_index
    dim   int
}

func NewFAISSIndex(dim int) *FAISSIndex {
    var index C.faiss_index
    var d C.size_t = C.size_t(dim)
    C.faiss_index_factory(&index, d, C.CString("Flat"), C.FaissMetricType(0)) // INNER_PRODUCT
    return &FAISSIndex{index: index, dim: dim}
}

func (f *FAISSIndex) Add(vec []float32, id int64) error {
    // TODO: implement
    return nil
}

func (f *FAISSIndex) Search(query []float32, k int) []SearchResult {
    // TODO
    return nil
}

func (f *FAISSIndex) Close() {
    C.faiss_index_free(f.index)
}
```

**Step 3: Build FAISS library**

`scripts/build_faiss.sh`:
```bash
#!/usr/bin/env bash
set -e
cd internal/ai/minirag/vector/faiss
git clone --depth 1 https://github.com/facebookresearch/faiss.git .
mkdir -p build && cd build
cmake -DCMAKE_BUILD_TYPE=Release -DFAISS_ENABLE_GPU=OFF -DFAISS_ENABLE_PYTHON=OFF ..
make -j$(nproc) faiss
cp libfaiss.a ../../../../..  # or appropriate LDFLAGS path
echo "FAISS built: $(pwd)/libfaiss.a"
```

**Step 4: Implement full Add/Search using FAISS C API**

Implement `Add` (xb, xb_ids) and `Search` (xq, D, I) per FAISS C API:
- `faiss_index_factory(&index, dim, "Flat", FAISS_METRIC_INNER_PRODUCT)`
- `faiss_index_add_with_ids(index, d, xb, n, xb_ids)`
- `faiss_index_search(index, d, xq, k, D, I)`

**Step 5: Test search returns correct top-k by inner product (cosine since L2 normalized)**

**Step 6: Commit wrapper + build script**

---

## Phase 3: SQLite Metadata Store

### Task 3.1: Define schema and CRUD operations

**Files:**
- Create: `internal/ai/minirag/storage/sqlite_store.go`
- Create: `internal/ai/minirag/storage/sqlite_store_test.go`
- Migration: `internal/db/migrations/YYYMMDDHHMMSS_create_minirag_tables.up.sql`

**Step 1: Write test — store and retrieve chunk metadata**

```go
func TestSQLiteChunkCRUD(t *testing.T) {
    store := setupTestStore(t)
    defer store.Close()
    
    meta := ChunkMeta{
        ContractID:  1,
        ChunkIndex:  0,
        Content:     "Clausula de indemnizacion...",
        PageNumber:  5,
        ClauseType: "indemnizacion",
        VectorID:   123,
    }
    err := store.AddChunk(meta)
    require.NoError(t, err)
    
    retrieved, err := store.GetChunkByVectorID(123)
    require.NoError(t, err)
    assert.Equal(t, meta.Content, retrieved.Content)
}
```

**Step 2: Create migration SQL**

```sql
-- internal/db/migrations/20250502000000_create_minirag_tables.up.sql
CREATE TABLE IF NOT EXISTS minirag_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    page_number INTEGER,
    clause_type TEXT,
    vector_id INTEGER NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_minirag_contract ON minirag_chunks(contract_id);
CREATE INDEX IF NOT EXISTS idx_minirag_vector_id ON minirag_chunks(vector_id);
CREATE INDEX IF NOT EXISTS idx_minirag_clause_type ON minirag_chunks(clause_type);
```

**Step 3: Implement sqlite_store.go using modernc.org/sqlite**

```go
package storage

import (
    "database/sql"
    "time"
    "modernc.org/sqlite"
)

type ChunkMeta struct {
    ID          int64        `json:"id"`
    ContractID  int64        `json:"contract_id"`
    ChunkIndex  int          `json:"chunk_index"`
    Content     string       `json:"content"`
    PageNumber  *int         `json:"page_number,omitempty"`
    ClauseType  string       `json:"clause_type,omitempty"`
    VectorID    int64        `json:"vector_id"`
    CreatedAt   time.Time    `json:"created_at"`
}

type SQLiteStore struct {
    db *sql.DB
}

func NewSQLiteStore(path string) (*SQLiteStore, error) {
    db, err := sql.Open("sqlite", path)
    if err != nil {
        return nil, err
    }
    // Run migrations
    if err := runMigrations(db); err != nil {
        return nil, err
    }
    return &SQLiteStore{db: db}, nil
}

func (s *SQLiteStore) AddChunk(meta ChunkMeta) error {
    _, err := s.db.Exec(`
        INSERT INTO minirag_chunks (contract_id, chunk_index, content, page_number, clause_type, vector_id)
        VALUES (?, ?, ?, ?, ?, ?)`,
        meta.ContractID, meta.ChunkIndex, meta.Content, meta.PageNumber, meta.ClauseType, meta.VectorID)
    return err
}

func (s *SQLiteStore) GetChunkByVectorID(vectorID int64) (ChunkMeta, error) {
    row := s.db.QueryRow(`
        SELECT id, contract_id, chunk_index, content, page_number, clause_type, vector_id, created_at
        FROM minirag_chunks WHERE vector_id = ?`, vectorID)
    // scan...
}
```

**Step 4: Add filter methods: `GetByContract`, `GetByClauseType`, `SearchByMetadata`**

**Step 5: Run tests + commit**

---

## Phase 4: Token-Based Chunking

### Task 4.1: Token chunker using llama tokenizer

**Files:**
- Create: `internal/ai/minirag/parser/token_chunker.go`
- Modify: `internal/ai/minirag/parser.go` (replace character-based chunking)

**Step 1: Write test — chunk 1000 tokens into 512+50 overlap chunks**

```go
func TestTokenChunking(t *testing.T) {
    // Need CGo llama context for tokenization
    // Skip if llama not available
    text := strings.Repeat("word ", 1000) // ~1000 tokens
    chunks := TokenChunk(text, 512, 50)
    assert.True(t, len(chunks) >= 2)
    // Check overlap: last 50 tokens of chunk[0] appear at start of chunk[1]
}
```

**Step 2: Implement TokenChunk using embedder's tokenizer**

Since tokenizer tied to llama model, either:
- Pass `*embedding.Embedder` to chunker to call `tokenize()` (expose method)
- Or replicate tokenization in chunker (requires llama vocab)

Option: extend `cgo_embedder`:
```go
func (e *Embedder) Tokenize(text string) ([]C.llama_token, error)
func (e *Embedder) TokensToText(tokens []C.llama_token) string
```

Then `TokenChunk`:
```go
func TokenChunk(text string, chunkSize, overlap int, embedder *embedding.Embedder) ([]Chunk, error) {
    tokens, err := embedder.Tokenize(text)
    if err != nil { return nil, err }
    step := chunkSize - overlap
    var chunks []Chunk
    for i := 0; i < len(tokens); i += step {
        end := i + chunkSize
        if end > len(tokens) {
            end = len(tokens)
        }
        chunkTokens := tokens[i:end]
        chunkText, _ := embedder.TokensToText(chunkTokens)
        chunks = append(chunks, Chunk{Text: chunkText, TokenStart: i, TokenEnd: end})
    }
    return chunks, nil
}
```

**Step 3: Update `parser.ParseByArticles` to use token chunker for legal docs**

Keep article/clause detection but base chunk boundaries on tokens not characters.

**Step 4: Commit**

---

## Phase 5: Service Integration (Orchestrator)

### Task 5.1: Create MiniRAG service tying parser → embedder → FAISS → SQLite

**Files:**
- Create: `internal/ai/minirag/service.go`
- Create: `internal/ai/minirag/service_test.go`

**Step 1: Write test — index contract → search query → results**

```go
func TestIndexAndSearch(t *testing.T) {
    s := newTestService(t) // sets up embedder, faiss, sqlite with temp paths
    defer s.Close()
    
    contract := &models.LegalDocument{
        ID: 1, DocumentType: "acuerdo", Title: "Test Contract",
        Content: "El proveedor indemnizará al cliente por daños...",
        Jurisdiction: "AR", Language: "es",
    }
    err := s.IndexLegalDocument(contract)
    require.NoError(t, err)
    
    results, err := s.SearchLegalDocuments("indemnizacion", nil, 5)
    require.NoError(t, err)
    assert.True(t, len(results) > 0)
    assert.Contains(t, results[0].Content, "indemnizar")
}
```

**Step 2: Implement Service struct**

```go
type Service struct {
    Embedder *embedding.Embedder
    VectorDB *vector.FAISSIndex
    Store    *storage.SQLiteStore
    Parser   *parser.TokenParser
}

func NewService(modelPath, dbPath, vectorPath string) (*Service, error) {
    emb, err := embedding.NewEmbedder()
    if err != nil { return nil, err }
    vdb, err := vector.NewFAISSIndex(384)
    if err != nil { return nil, err }
    store, err := storage.NewSQLiteStore(dbPath)
    if err != nil { return nil, err }
    return &Service{
        Embedder: emb, VectorDB: vdb, Store: store,
        Parser: parser.NewTokenParser(emb, 512, 50),
    }, nil
}

func (s *Service) IndexLegalDocument(doc *models.LegalDocument) error {
    // 1. Chunk
    chunks, err := s.Parser.ParseLegalDocument(doc.Content)
    if err != nil { return err }
    
    // 2. Batch embed
    texts := make([]string, len(chunks))
    for i, ch := range chunks {
        texts[i] = ch.Text
    }
    embeddings, err := s.Embedder.GenerateBatch(texts, 32)
    if err != nil { return err }
    
    // 3. Add to FAISS + SQLite in transaction
    for i, emb := range embeddings {
        vectorID := generateUniqueVectorID() // e.g., atomic counter or docID*10000+i
        if err := s.VectorDB.Add(emb, vectorID); err != nil {
            return err
        }
        meta := storage.ChunkMeta{
            ContractID: int64(doc.ID),
            ChunkIndex: i,
            Content:    chunks[i].Text,
            ClauseType: chunks[i].ClauseType,
            VectorID:   vectorID,
        }
        if err := s.Store.AddChunk(meta); err != nil {
            return err
        }
    }
    return nil
}

func (s *Service) SearchLegalDocuments(query string, filters map[string]interface{}, limit int) ([]vector.SearchResult, error) {
    // 1. Embed query
    qEmb, err := s.Embedder.GenerateEmbedding(query)
    if err != nil { return nil, err }
    
    // 2. FAISS search (k = limit * 2, then filter)
    raw := s.VectorDB.Search(qEmb, limit*2)
    
    // 3. Load metadata from SQLite for each result
    var results []vector.SearchResult
    for _, r := range raw {
        meta, err := s.Store.GetChunkByVectorID(r.ID)
        if err != nil { continue }
        // Apply filters (jurisdiction, clause_type)
        if filters != nil {
            if jur, ok := filters["jurisdiction"].(string); ok && meta.ClauseType != jur {
                continue
            }
        }
        results = append(results, vector.SearchResult{
            ID:      fmt.Sprintf("%d", meta.ID),
            Score:   r.Score,
            Meta:    convertMeta(meta),
            Content: meta.Content,
        })
        if len(results) >= limit {
            break
        }
    }
    return results, nil
}
```

**Step 3: RAG Response template function**

```go
func FormatRAGResponse(query string, results []vector.SearchResult) string {
    var b strings.Builder
    fmt.Fprintf(&b, "Consulta: %s\n\n", query)
    fmt.Fprintf(&b, "Cláusulas relevantes:\n")
    for i, r := range results {
        fmt.Fprintf(&b, "%d. [score: %.2f] %s (contrato: %s, página: %s)\n",
            i+1, r.Score, truncate(r.Content, 200), r.Meta.ExtraFields["contract_id"], r.Meta.ExtraFields["page"])
    }
    if len(results) == 0 {
        fmt.Fprint(&b, "No se encontraron cláusulas relevantes.\n")
    }
    return b.String()
}
```

**Step 4: Run integration test → commit**

---

## Phase 6: Deletion & Cleanup

### Task 6.1: Remove Ollama/LLM code paths

**Files:**
- Delete: `internal/ai/minirag/embeddings.go` (Ollama client)
- Delete: `internal/ai/minirag/local_client.go` (LLM generation modes)
- Delete: `internal/ai/minirag/cgo_llama.go` (LLM Generate method)
- Modify: `internal/ai/minirag/vector_db.go` → keep but deprecate (HNSW no longer primary). Or delete if FAISS fully replaces.

**Step:** Remove all Ollama HTTP client code and LLM Generate methods. Keep only embedding path.

**Commit:** "refactor(minirag): remove Ollama and LLM generation dependencies"

---

## Phase 7: Build & CI Integration

### Task 7.1: Update CI to compile llama.cpp and FAISS before Go build

**Files:**
- Modify: `.github/workflows/build.yml`

**Step 1: Add FAISS and llama.cpp build steps**

```yaml
- name: Build llama.cpp
  working-directory: internal/ai/minirag
  run: |
    git clone --depth 1 https://github.com/ggerganov/llama.cpp llama.cpp
    cd llama.cpp && mkdir -p build && cd build
    cmake .. -DCMAKE_BUILD_TYPE=Release
    make -j$(nproc)
    cp libllama.a ../../../..  # or leave in place for LDFLAGS

- name: Build FAISS
  working-directory: internal/ai/minirag/vector/faiss
  run: |
    git clone --depth 1 https://github.com/facebookresearch/faiss .
    mkdir -p build && cd build
    cmake -DCMAKE_BUILD_TYPE=Release -DFAISS_ENABLE_GPU=OFF -DFAISS_ENABLE_PYTHON=OFF ..
    make -j$(nproc) faiss
    cp libfaiss.a ../../../../..  # adjust path

- name: Set CGO env
  run: echo "CGO_ENABLED=1" >> $GITHUB_ENV
```

**Step 2: Ensure Go build uses CGO LDFLAGS**

Update `internal/ai/minirag/embedding/cgo_embedder.go` and `vector/faiss_wrapper.go` with correct relative paths in `#cgo LDFLAGS`.

**Step 3: Verify build**

```bash
CGO_ENABLED=1 go build ./...
```

**Step 4: Commit CI changes**

---

## Phase 8: Final Testing & Documentation

### Task 8.1: Integration test with real legal contract

**Files:**
- Create: `internal/ai/minirag/testdata/sample_contract.txt`
- Create: `internal/ai/minirag/e2e_test.go`

**Step:** Index sample contract, run semantic queries in Spanish, verify results contain expected clauses.

### Task 8.2: Update README with architecture and usage

**Files:**
- Update: `internal/ai/minirag/README.md`

Content:
- System architecture diagram
- Build instructions (CGo + FAISS + llama.cpp)
- Model conversion (one-time)
- API usage: `service.IndexLegalDocument`, `service.SearchLegalDocuments`
- Memory limits and tuning
- RAG response format

**Step: Commit documentation**

---

## Phase 9: Cleanup & Validation

### Task 9.1: Verify binary size < 100MB

```bash
go build -o pacta-minirag cmd/pacta/main.go
du -h pacta-minirag
# Should be ~80-90MB (65MB model + 15MB code + libs)
```

### Task 9.2: Run 72h stability test (in background)

```bash
nohup ./pacta-minirag --stress-test > stress.log 2>&1 &
sleep 86400 && kill $!
# Check for memory leaks, errors
```

### Task 9.3: Final commit with version tag

```bash
git add .
git commit -m "feat(minirag): embedding-only RAG with embedded GGUF, FAISS, SQLite"
git tag -a v0.3.0-minirag-embed -m "MiniRAG embedding-only refactor"
```

---

## Implementation Order Summary

**Order (no parallelism due to dependencies):**
1. Model conversion (phase 0) → commit GGUF
2. CGo embedder (phase 1) — depends on model file present
3. FAISS wrapper (phase 2) — depends on FAISS build
4. SQLite store (phase 3) — independent
5. Token chunker (phase 4) — depends on embedder tokenize
6. Service integration (phase 5) — depends on 1-4
7. Deletion cleanup (phase 6)
8. CI integration (phase 7)
9. E2E tests + docs (phase 8)
10. Validation (phase 9)

**Total estimated tasks:** ~30 subtasks (each 5-15 min) → ~8-12 hours developer time.

---

## References

- Plan de diseño: `docs/plans/2026-05-02-minirag-embedding-only-design.md`
- llama.cpp C API: `llama.h` (in submodule)
- FAISS C API: `faiss/c_api.h`
- Sentence Transformers: `paraphrase-MiniLM-L3-v2` (384-dim)
