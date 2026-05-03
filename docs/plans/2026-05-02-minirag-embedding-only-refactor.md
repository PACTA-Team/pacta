# MiniRAG Embedding-Only Refactor Implementation Plan (Updated)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor MiniRAG from Ollama HTTP + custom HNSW to a 100% offline, embedding-only RAG system with embedded GGUF model, FAISS-CPU, SQLite metadata, and llama.cpp tokenization — all in a single Go binary under 100MB.

**Architecture:** 
- Embedding inference via llama.cpp CGo (`BAAI/bge-small-en-v1.5` Q8_0 GGUF embedded with go:embed)
- Optional linear adapter (384×384) for Spanish legal domain adaptation (576KB)
- Vector search via FAISS-CPU wrapped in CGo (IndexFlatIP with L2-normalized embeddings)
- Metadata storage in SQLite (contracts, chunks, vector_id mappings)
- Token-based chunking (512 tokens + 50 token overlap) using llama.cpp tokenizer
- RAG query response via static templates (no LLM generation)
- Adapter activation via `MINIRAG_ADAPTER=1` environment variable

**Tech Stack:** Go 1.25, CGo, llama.cpp, FAISS-CPU, SQLite (modernc.org/sqlite), BGE sentence-transformers GGUF

---

## Phase 0: Preparation — BGE Model Fetch (Manual CI)

### Task 0.1: Create model fetch workflow (replaces conversion)

**Files:**
- Create: `.github/workflows/fetch-bge-model.yml`
- Create: `scripts/download_bge_model.py` (or inline in workflow)

**Step 1: Write download script** (simple curl-based)

```python
#!/usr/bin/env python3
import os, sys
from urllib.request import urlretrieve

URL = "https://huggingface.co/TheBloke/bge-small-en-v1.5-GGUF/resolve/main/bge-small-en-v1.5.Q8_0.gguf"
OUTPUT = "internal/ai/minirag/models/bge-small-en-v1.5.Q8_0.gguf"

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
print(f"Downloading {URL} -> {OUTPUT}")
urlretrieve(URL, OUTPUT)
print("Download complete")
```

**Step 2: Create GitHub Actions workflow** `.github/workflows/fetch-bge-model.yml`:

```yaml
name: Fetch BGE Model
on:
  workflow_dispatch:

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: {fetch-depth: 0, token: ${{ secrets.GITHUB_TOKEN }}}
      - name: Download BGE GGUF
        run: |
          mkdir -p internal/ai/minirag/models
          curl -L https://huggingface.co/TheBloke/bge-small-en-v1.5-GGUF/resolve/main/bge-small-en-v1.5.Q8_0.gguf -o internal/ai/minirag/models/bge-small-en-v1.5.Q8_0.gguf
      - name: Configure git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
      - name: Create temp branch and commit
        run: |
          BRANCH="model/bge-$(date +%Y%m%d-%H%M%S)"
          git checkout -b "$BRANCH"
          git add internal/ai/minirag/models/bge-small-en-v1.5.Q8_0.gguf
          git commit -m "chore(minirag): add BGE-small-en-v1.5 GGUF model"
          git push origin HEAD
      - name: Create PR
        uses: peter-evans/create-pull-request@v5
        with:
          title: "chore(minirag): add BGE embedding model"
          body: "Adds `bge-small-en-v1.5.Q8_0.gguf` (89MB) for embedding inference."
          branch: "model/bge-$(date +%Y%m%d-%H%M%S)"
          base: main
          labels: "chore, model"
```

**Step 3: Create models directory placeholder** (if not exists):

```bash
mkdir -p internal/ai/minirag/models
touch internal/ai/minirag/models/.gitkeep
git add internal/ai/minirag/models/.gitkeep
git commit -m "chore(minirag): add models directory"
```

---

## Phase 0.5: Adapter Training (Manual CI, CPU-only)

### Task 0.5.1: Create training script `scripts/train_adapter.py`

**Requirements:** `sentence-transformers`, `torch`

```python
#!/usr/bin/env python3
"""
Train linear adapter to align BGE-small-en-v1.5 embeddings to Spanish legal domain.
"""
import argparse, sqlite3, os, sys, json, random
from pathlib import Path
from sentence_transformers import SentenceTransformer
import torch
import torch.nn as nn
import torch.optim as optim
import re

# Regex topic extraction for Spanish legal
TOPIC_PATTERNS = {
    'indemnizacion': [r'indemnizaci[oó]n', r'compensaci[oó]n', r'da[oó]s? y perjuicios'],
    'confidencialidad': [r'confiden', r'reserva', r'secreto'],
    'renovacion': [r'renovaci[oó]n', r'pr[oó]rroga', r'extensi[oó]n'],
    'terminacion': [r'terminaci[oó]n', r'rescisi[oó]n', r'cancelaci[oó]n'],
    'pago': [r'pago', r'facturaci[oó]n', r'honorarios', r'tarifa'],
    'responsabilidad': [r'responsabilidad', r'garant[ií]a', r'vicios? ocultos?'],
}

TEMPLATES = {
    'indemnizacion': [
        "¿Qué incluye la indemnización por incumplimiento?",
        "¿Cuál es el monto de la indemnización?",
        "Indemnización por daños y perjuicios",
        "¿Quién paga la indemnización?",
    ],
    'confidencialidad': [
        "¿Qué información es confidencial?",
        "¿Cuánto tiempo dura la confidencialidad?",
        "Consecuencias por violar confidencialidad",
    ],
    'renovacion': [
        "¿Cómo se renueva el contrato?",
        "Plazo para renovar",
        "Renovación automática",
    ],
    'terminacion': [
        "¿Cómo se termina el contrato?",
        "Causas de rescisión",
        "Aviso de terminación",
    ],
    'pago': [
        "Plazo de pago",
        "¿Cuándo se factura?",
        "Método de pago",
    ],
    'responsabilidad': [
        "¿Qué cubre la garantía?",
        "Responsabilidad por vicios ocultos",
        "Exclusión de responsabilidad",
    ],
}

def detect_topics(text):
    topics = []
    for topic, patterns in TOPIC_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, text, re.IGNORECASE):
                topics.append(topic)
                break
    return topics

def generate_queries(text):
    topics = detect_topics(text)
    queries = []
    for topic in topics:
        for templ in TEMPLATES.get(topic, []):
            queries.append(templ)
    return queries

class LegalDataset(torch.utils.data.Dataset):
    def __init__(self, db_path, model, neg_samples=5):
        self.db_path = db_path
        self.model = model
        self.neg_samples = neg_samples
        self.chunks = self._load_chunks()
        self.queries = self._build_queries()
        
    def _load_chunks(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT rowid as id, content FROM minirag_chunks")
        rows = cur.fetchall()
        conn.close()
        return rows
        
    def _build_queries(self):
        pairs = []
        for chunk in self.chunks:
            queries = generate_queries(chunk['content'])
            for q in queries:
                pairs.append((q, chunk['id'], chunk['content']))
        return pairs
    
    def __len__(self):
        return len(self.queries)
    
    def __getitem__(self, idx):
        query, chunk_id, positive = self.queries[idx]
        # Sample negatives from other chunks
        neg_indices = random.sample([i for i in range(len(self.chunks)) if self.chunks[i]['id'] != chunk_id], min(self.neg_samples, len(self.chunks)-1))
        negatives = [self.chunks[i]['content'] for i in neg_indices]
        if len(negatives) < self.neg_samples:
            negatives += [positive] * (self.neg_samples - len(negatives))
        return query, positive, negatives

class LinearAdapter(nn.Module):
    def __init__(self, dim=384):
        super().__init__()
        self.W = nn.Linear(dim, dim, bias=False)
    def forward(self, x):
        return self.W(x)

def info_nce_loss(q, p, negatives, temperature=0.05):
    all_vecs = torch.cat([p.unsqueeze(0), negatives], dim=0)  # [1+N, dim]
    sims = torch.matmul(q.unsqueeze(0), all_vecs.T) / temperature  # [1, 1+N]
    labels = torch.zeros(1, dtype=torch.long, device=q.device)
    return nn.CrossEntropyLoss()(sims, labels)

def train(args):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    model = SentenceTransformer('BAAI/bge-small-en-v1.5')
    model.to(device)
    adapter = LinearAdapter().to(device)
    
    dataset = LegalDataset(args.db, model)
    loader = torch.utils.data.DataLoader(dataset, batch_size=args.batch, shuffle=True)
    
    optimizer = optim.AdamW(adapter.parameters(), lr=args.lr)
    
    for epoch in range(args.epochs):
        total_loss = 0
        for batch in loader:
            queries, positives, negatives = batch
            # Encode with BGE
            with torch.no_grad():
                q_emb = model.encode(queries, convert_to_tensor=True, device=device)
                p_emb = model.encode(positives, convert_to_tensor=True, device=device)
                n_emb = torch.stack([model.encode(neg, convert_to_tensor=True, device=device) for neg in negatives])
            
            # Adapter forward
            q_adapt = adapter(q_emb)
            p_adapt = adapter(p_emb)
            n_adapt = adapter(n_emb.view(-1, 384)).view(n_emb.shape)
            
            # Contrastive loss (mean over batch)
            loss = torch.mean(torch.stack([
                info_nce_loss(q_adapt[i], p_adapt[i], n_adapt[i], args.temp)
                for i in range(q_adapt.size(0))
            ]))
            
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        print(f"Epoch {epoch+1} loss: {total_loss/len(loader)}")
    
    # Save weights as float32 row-major
    weights = adapter.W.weight.detach().cpu().numpy().astype('float32')
    output_path = Path(args.output_dir) / 'adapter_weights.bin'
    weights.tofile(output_path)
    print(f"Saved adapter to {output_path}")
    
    # Metadata
    meta = {
        'epochs': args.epochs,
        'batch_size': args.batch,
        'learning_rate': args.lr,
        'temperature': args.temp,
        'final_loss': total_loss/len(loader),
        'samples': len(dataset)
    }
    with open(Path(args.output_dir) / 'adapter_metadata.json', 'w') as f:
        json.dump(meta, f, indent=2)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="minirag.db", help="Path to SQLite DB")
    parser.add_argument("--output-dir", default="models", help="Where to save adapter_weights.bin")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--temp", type=float, default=0.05)
    args = parser.parse_args()
    train(args)
```

### Task 0.5.2: Create workflow `.github/workflows/train-adapter.yml`

```yaml
name: Train Adapter
on:
  workflow_dispatch:
    inputs:
      epochs:
        description: 'Training epochs'
        required: false
        default: '3'
      batch:
        description: 'Batch size'
        required: false
        default: '32'

jobs:
  train:
    runs-on: ubuntu-latest-24.04
    timeout-minutes: 360
    steps:
      - uses: actions/checkout@v4
        with: {fetch-depth: 0, token: ${{ secrets.GITHUB_TOKEN }}}
      - name: Setup Python
        uses: actions/setup-python@v5
        with: {python-version: '3.13'}
      - name: Install dependencies
        run: |
          pip install --upgrade uv
          uv pip install sentence-transformers torch
      - name: Prepare DB
        run: |
          # Use existing DB from repo or fail if not present
          if [ ! -f "data/minirag.db" ]; then
            echo "ERROR: Database not found at data/minirag.db"
            echo "Make sure contracts are indexed and minirag_chunks table exists."
            exit 1
          fi
          cp data/minirag.db ./minirag.db
      - name: Train adapter
        run: |
          mkdir -p models
          python scripts/train_adapter.py --db ./minirag.db --output-dir models --epochs ${{ inputs.epochs }} --batch ${{ inputs.batch }}
      - name: Verify adapter file
        run: |
          ls -lh models/adapter_weights.bin
          test -s models/adapter_weights.bin
      - name: Configure git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
      - name: Create temp branch and commit
        run: |
          BRANCH="adapter/trained-$(date +%Y%m%d-%H%M%S)"
          git checkout -b "$BRANCH"
          git add models/adapter_weights.bin models/adapter_metadata.json
          git commit -m "feat(minirag): add trained linear adapter for Spanish legal domain"
          git push origin HEAD
      - name: Create PR
        uses: peter-evans/create-pull-request@v5
        with:
          title: "feat(minirag): add adapter for Spanish legal domain"
          body: |
            Trained linear adapter (384×384) on existing contracts using synthetic queries.
            Improves semantic search for Spanish legal documents.
          branch: "adapter/trained-$(date +%Y%m%d-%H%M%S)"
          base: main
          labels: "feat, adapter, ci-generated"
```

---

## Phase 1: Core Embedding (CGo llama.cpp) — Updated for BGE + Adapter

### Task 1.1: Implement CGo embedder with L2 norm, batching, and optional adapter

**Files:**
- Create: `internal/ai/minirag/embedding/cgo_embedder.go`
- Create: `internal/ai/minirag/embedding/cgo_embedder_test.go`
- Delete: `internal/ai/minirag/embeddings.go` (Ollama HTTP client) — already done?
- Delete: `internal/ai/minirag/local_client.go` — already done?
- Delete: `internal/ai/minirag/cgo_llama.go` — already done?

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

**Step 3: Implement `cgo_embedder.go` (minimal first)**

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
    "bytes"
    "encoding/binary"
    "fmt"
    "os"
    "path/filepath"
    "runtime"
    "unsafe"
)

// Embedder uses llama.cpp via CGo to generate embeddings
type Embedder struct {
    model    *C.struct_llama_model
    ctx      *C.struct_llama_context
    vocab    *C.struct_llama_vocab
    adapterW [384 * 384]float32
    useAdapter bool
}

//go:embed ../../../models/bge-small-en-v1.5.Q8_0.gguf
var embeddedModel []byte

//go:embed ../../../models/adapter_weights.bin
var embeddedAdapter []byte

// NewEmbedder creates embedder; extracts embedded GGUF to temp dir and loads
func NewEmbedder(useAdapter bool) (*Embedder, error) {
    // 1. Extract embedded GGUF from go:embed to temp dir
    tmpDir := os.TempDir()
    modelPath := filepath.Join(tmpDir, "bge-small-en-v1.5.Q8_0.gguf")
    if err := os.WriteFile(modelPath, embeddedModel, 0644); err != nil {
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
    
    e := &Embedder{
        model:       model,
        ctx:         ctx,
        vocab:       vocab,
        useAdapter:  useAdapter,
    }
    
    if useAdapter {
        if len(embeddedAdapter) != 384*384*4 {
            return nil, fmt.Errorf("adapter weights size invalid: got %d, want %d", len(embeddedAdapter), 384*384*4)
        }
        binary.Read(bytes.NewReader(embeddedAdapter), binary.LittleEndian, e.adapterW[:])
    }
    
    return e, nil
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
    
    // Batch (single)
    batch := C.llama_batch_get_one(&tokens[0], C.int(nTokens))
    if C.llama_decode(e.ctx, batch) != 0 {
        return nil, fmt.Errorf("llama_decode failed")
    }
    
    // Get embedding (use last token)
    nEmb := C.llama_n_embd(e.model)
    embSize := int(nEmb) // 384
    
    embData := C.llama_get_embeddings(e.ctx)
    if embData == nil {
        return nil, fmt.Errorf("failed to get embeddings")
    }
    
    totalTokens := int(C.llama_n_seq_elem(e.ctx, -1))
    if totalTokens == 0 {
        totalTokens = int(nTokens)
    }
    
    vec := make([]float32, embSize)
    if totalTokens > 0 {
        offset := (totalTokens - 1) * embSize
        src := (*[1 << 30]float32)(unsafe.Pointer(embData))[offset : offset+embSize]
        copy(vec, src)
    } else {
        src := (*[1 << 30]float32)(unsafe.Pointer(embData))[:embSize:embSize]
        copy(vec, src)
    }
    
    // Apply adapter if enabled
    if e.useAdapter {
        vec = e.applyAdapter(vec)
    }
    
    // L2 Normalize
    return normalizeVector(vec), nil
}

// applyAdapter applies the linear transformation W (384×384) to v
func (e *Embedder) applyAdapter(v []float32) []float32 {
    out := make([]float32, 384)
    for i := 0; i < 384; i++ {
        var sum float32
        for j := 0; j < 384; j++ {
            sum += v[j] * e.adapterW[j*384+i]
        }
        out[i] = sum
    }
    return out
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
    return nil
}

// normalizeVector normalizes a vector to unit length
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

**Step 4: Implement tests** (`cgo_embedder_test.go`):
- `TestNormalizeVector`
- `TestGenerateEmbedding_NonEmpty` (skip if model file missing)
- `TestGenerateEmbedding_Empty` returns zero 384-vector
- `TestAdapterApplication` (if adapter enabled, verify transform)

**Step 5: Add tokenization methods** (needed for chunker):

```go
// Tokenize converts text to llama tokens
func (e *Embedder) Tokenize(text string) ([]C.llama_token, error) {
    ctext := C.CString(text)
    defer C.free(unsafe.Pointer(ctext))
    nTokens := C.llama_tokenize(e.vocab, ctext, C.int(len(text)), nil, 0, true, true)
    if nTokens < 0 {
        return nil, fmt.Errorf("tokenization failed")
    }
    tokens := make([]C.llama_token, nTokens)
    C.llama_tokenize(e.vocab, ctext, C.int(len(text)), &tokens[0], C.int(nTokens), true, true)
    return tokens, nil
}

// TokensToText converts tokens back to string
func (e *Embedder) TokensToText(tokens []C.llama_token) (string, error) {
    var buf strings.Builder
    for _, token := range tokens {
        tmp := make([]byte, 128)
        n := C.llama_token_to_piece(e.vocab, token, (*C.char)(unsafe.Pointer(&tmp[0])), C.int(len(tmp)), 1, C.bool(true))
        if n > 0 {
            buf.Write(tmp[:n])
        }
    }
    return buf.String(), nil
}
```

**Step 6: Add `GenerateBatch` method** (loop over `GenerateEmbedding`)

**Step 7: Run all tests → commit**

---

## Phase 2: FAISS-CPU Wrapper (CGo)

*Already implemented in previous phases — no changes needed unless FAISS build paths require adjustment.* 

Ensure `vector/faiss_wrapper.go` exists with `IndexFlatIP` + `Add` + `Search`.

---

## Phase 3: SQLite Metadata Store

*Already implemented. Ensure `storage/sqlite_store.go` has `GetMaxVectorID` method for Service.*

Add if missing:
```go
func (s *SQLiteStore) GetMaxVectorID() (int64, error) {
    row := s.db.QueryRow("SELECT COALESCE(MAX(vector_id), 0) FROM minirag_chunks")
    var max int64
    err := row.Scan(&max)
    return max, err
}
```

---

## Phase 4: Token-Based Chunking

### Task 4.1: Create `internal/ai/minirag/chunker.go` (in package minirag)

```go
package minirag

import (
    "internal/ai/minirag/embedding"
    "strings"
)

// TokenChunker splits text into token-based chunks with overlap.
type TokenChunker struct {
    embedder *embedding.Embedder
    chunkSize int
    overlap   int
}

func NewTokenChunker(emb *embedding.Embedder, chunkSize, overlap int) *TokenChunker {
    return &TokenChunker{embedder: emb, chunkSize: chunkSize, overlap: overlap}
}

// Chunk splits text into chunks of ~chunkSize tokens with overlap.
func (tc *TokenChunker) Chunk(text string) ([]Chunk, error) {
    tokens, err := tc.embedder.Tokenize(text)
    if err != nil {
        return nil, err
    }
    if len(tokens) <= tc.chunkSize {
        content, _ := tc.embedder.TokensToText(tokens)
        return []Chunk{{ID: 0, Text: content, Position: 0}}, nil
    }
    step := tc.chunkSize - tc.overlap
    var chunks []Chunk
    for i := 0; i < len(tokens); i += step {
        end := i + tc.chunkSize
        if end > len(tokens) {
            end = len(tokens)
        }
        chunkTokens := tokens[i:end]
        chunkText, _ := tc.embedder.TokensToText(chunkTokens)
        chunks = append(chunks, Chunk{
            ID:       len(chunks),
            Text:     chunkText,
            Position: i,
        })
    }
    return chunks, nil
}
```

**Update `indexer.go`** to use `NewTokenChunker` instead of `ParseByArticles`.

---

## Phase 5: Service Integration (Orchestrator)

### Task 5.1: Update `internal/ai/minirag/service.go`

```go
type Service struct {
    Embedder *embedding.Embedder
    VectorDB *vector.FAISSIndex
    Store    *storage.SQLiteStore
}

func NewService(modelPath, dbPath string) (*Service, error) {
    useAdapter := os.Getenv("MINIRAG_ADAPTER") == "1"
    emb, err := embedding.NewEmbedder(useAdapter)
    if err != nil { return nil, err }
    vdb, err := vector.NewFAISSIndex(384)
    if err != nil { return nil, err }
    store, err := storage.NewSQLiteStore(dbPath)
    if err != nil { return nil, err }
    return &Service{Embedder: emb, VectorDB: vdb, Store: store}, nil
}

func (s *Service) IndexLegalDocument(doc *models.LegalDocument) error {
    // Chunk using token chunker
    chunker := NewTokenChunker(s.Embedder, 512, 50)
    chunks, err := chunker.Chunk(doc.Content)
    if err != nil {
        return err
    }
    
    // Generate embeddings batch
    texts := make([]string, len(chunks))
    for i, ch := range chunks {
        texts[i] = ch.Text
    }
    embeddings, err := s.Embedder.GenerateBatch(texts, 32)
    if err != nil {
        return err
    }
    
    // Get next vector ID
    maxID, _ := s.Store.GetMaxVectorID()
    startID := maxID + 1
    
    // Add to FAISS + SQLite
    for i, emb := range embeddings {
        vectorID := startID + int64(i)
        if err := s.VectorDB.Add(emb, vectorID); err != nil {
            return err
        }
        meta := storage.ChunkMeta{
            ContractID:  int64(doc.ID),
            ChunkIndex:  i,
            Content:     chunks[i].Text,
            ClauseType:  "", // optional: extract from chunk
            VectorID:    vectorID,
        }
        if err := s.Store.AddChunk(meta); err != nil {
            return err
        }
    }
    return nil
}

func (s *Service) SearchLegalDocuments(query string, limit int) ([]RAGSearchResult, error) {
    qEmb, err := s.Embedder.GenerateEmbedding(query)
    if err != nil {
        return nil, err
    }
    raw := s.VectorDB.Search(qEmb, limit*2)
    
    var results []RAGSearchResult
    for _, r := range raw {
        meta, err := s.Store.GetChunkByVectorID(r.ID)
        if err != nil {
            continue
        }
        results = append(results, RAGSearchResult{
            ID:      fmt.Sprintf("%d", meta.ID),
            Score:   r.Score,
            Meta:    meta,
            Content: meta.Content,
        })
        if len(results) >= limit {
            break
        }
    }
    return results, nil
}

func (s *Service) Close() error {
    s.Store.Close()
    s.Embedder.Close()
    return nil
}
```

---

## Phase 6: Deletion & Cleanup

**Verify removed files:**
- `internal/ai/minirag/embeddings.go` — deleted
- `internal/ai/minirag/local_client.go` — deleted
- `internal/ai/minirag/cgo_llama.go` — deleted
- `internal/ai/minirag/vector_db.go` — delete (FAISS replaces it)
- Any imports of these packages in other files must be removed

**Search and replace:**
```bash
grep -r "minirag/embeddings" . --include="*.go" && echo "Found usage"
grep -r "minirag/local_client" . --include="*.go" && echo "Found usage"
grep -r "minirag/cgo_llama" . --include="*.go" && echo "Found usage"
grep -r "minirag/vector_db" . --include="*.go" && echo "Found usage"
```

If any found, update those files to use new `embedding`, `vector`, `storage` packages.

---

## Phase 7: Build & CI Integration - COMPLETE

**Build workflow** (`.github/workflows/build.yml`) already updated in previous steps to:
- Build llama.cpp and FAISS
- Set CGO_ENABLED=1
- Build Go binary

**Additional workflows now added:**
- `fetch-bge-model.yml` — manual model download
- `train-adapter.yml` — manual adapter training

No further changes needed.

---

## Phase 8: Final Testing & Documentation

### Task 8.1: E2E test (update for BGE + adapter)

`internal/ai/minirag/e2e_test.go`:
```go
func TestE2E(t *testing.T) {
    os.Setenv("MINIRAG_ADAPTER", "1") // or "0" for baseline
    svc := setupTestService(t) // NewService with temp DB
    defer svc.Close()
    
    doc := &models.LegalDocument{
        ID: 1, DocumentType: "acuerdo", Title: "Test",
        Content: "El proveedor indemnizará al cliente por daños y perjuicios. " +
                 "La información confidencial no será divulgada.",
        Jurisdiction: "AR", Language: "es",
    }
    err := svc.IndexLegalDocument(doc)
    require.NoError(t, err)
    
    results, err := svc.SearchLegalDocuments("indemnización", 5)
    require.NoError(t, err)
    require.True(t, len(results) > 0)
    // Optionally assert score threshold
}
```

### Task 8.2: Update README.md (`internal/ai/minirag/README.md`)

Sections:
- Overview (BGE + optional adapter)
- Model files: `bge-small-en-v1.5.Q8_0.gguf` (89MB), `adapter_weights.bin` (576KB)
- Build requirements (CGO, llama.cpp, FAISS)
- How to fetch BGE model (manual workflow)
- How to train adapter (manual workflow, prerequisites)
- How to enable adapter (`MINIRAG_ADAPTER=1`)
- Architecture diagram
- API usage example
- Memory tuning
- Troubleshooting

---

## Phase 9: Cleanup & Validation

### Task 9.1: Verify binary size

```bash
go build -o pacta-minirag ./cmd/pacta
du -h pacta-minirag
# Expect ~90MB (89MB GGUF + code + libs)
```

### Task 9.2: Run tests

```bash
go test ./internal/ai/minirag/... -v
```

### Task 9.3: Final commit and tag

```bash
git add .
git commit -m "feat(minirag): complete embedding-only RAG with BGE, FAISS, SQLite, and Spanish legal adapter
- BGE-small-en-v1.5 GGUF embedded (89MB)
- Linear adapter 384x384 for domain adaptation (576KB)
- Adapter trained on existing contracts with synthetic queries
- Activation via MINIRAG_ADAPTER=1
- FAISS-CPU vector search, SQLite metadata
- Token-based chunking with llama tokenizer
- CI workflows for model fetch and adapter training"
git tag -a v0.3.0-minirag-embed -m "MiniRAG embedding-only refactor with BGE and adapter"
```

---

## Implementation Order Summary

**Order:**
1. Fetch BGE model workflow (Phase 0) → PR → merge to main
2. Implement/verify CGo embedder with adapter support (Phase 1)
3. FAISS wrapper (Phase 2) — already done?
4. SQLite store + GetMaxVectorID (Phase 3)
5. Token chunker (Phase 4)
6. Service integration (Phase 5)
7. Train adapter workflow (Phase 0.5) → PR → merge
8. Delete dead code (Phase 6)
9. E2E tests + docs (Phase 8)
10. Validation & tag (Phase 9)

**Total tasks:** ~25 subtasks.

---

## References

- Plan de diseño original: `docs/plans/2026-05-02-minirag-embedding-only-design.md`
- llama.cpp C API: `llama.h`
- FAISS C API: `faiss/c_api.h`
- BGE model: `BAAI/bge-small-en-v1.5` (HuggingFace)
