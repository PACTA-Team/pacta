# MiniRAG — Embedding-Only RAG for Spanish Legal Documents

> **100% offline, embedding-only RAG** for semantic search over Spanish legal contracts.
> Uses BGE (bge-small-en-v1.5) via llama.cpp CGo, FAISS-CPU, SQLite. No LLM generation.
> Binary size: ~100MB, RAM: ~89MB model + FAISS index.

---

## Overview

MiniRAG is now an embedding-only, 100% offline RAG system for Spanish legal documents. It uses:

- **BGE embedding model**: `bge-small-en-v1.5.Q8_0.gguf` (89MB) via llama.cpp CGo, embedded in binary with `go:embed`
- **Optional domain adapter**: Linear 384×384 transformation trained on Spanish legal contracts (576KB), activated by `MINIRAG_ADAPTER=1`
- **Vector search**: FAISS-CPU `IndexFlatIP` on L2-normalized embeddings (cosine similarity)
- **Metadata store**: SQLite (`minirag_chunks` table)
- **Chunking**: Token-based (512 tokens, 50 overlap) using llama.cpp tokenizer

The system is **retrieval only** — no generation, no LLM, no external API calls.

---

## Model Files

Both files are embedded in the Go binary via `go:embed` and extracted to a temp directory at startup.

| File | Size | Purpose |
|------|------|---------|
| `internal/ai/minirag/models/bge-small-en-v1.5.Q8_0.gguf` | 89 MB | BGE embedding model (GGUF Q8_0 quantised) |
| `internal/ai/minirag/models/adapter_weights.bin` | 576 KB | Optional linear adapter (after training; not present by default) |

> **Note**: The BGE GGUF is NOT committed by default. See "Fetching the BGE Model (Manual)" below.

---

## Build Requirements

### Mandatory
- **Go**: 1.25 (CGO enabled)
- **C++ toolchain**: `gcc`, `g++`, `make`, `cmake`
- **Git**: for submodules

### Native Library Dependencies
- **llama.cpp** → `internal/ai/minirag/llama.cpp/build/libllama.a` (static)
- **FAISS-CPU** → `internal/ai/minirag/faiss/build/libfaiss.so` (or `.dylib`/`.dll`)

CI builds these automatically via `.github/workflows/build.yml`. For local development, run the helper script:

```bash
./scripts/build_deps.sh
```

---

## Fetching the BGE Model (Manual)

The BGE GGUF is NOT committed by default. To add it, use one of these methods:

### Method 1 — Manual GitHub Actions workflow (recommended)

1. Run the manual workflow **Fetch BGE Model** (`.github/workflows/fetch-bge-model.yml`) from the Actions tab
2. Workflow downloads `bge-small-en-v1.5.Q8_0.gguf` from HuggingFace (TheBloke/BGE-smol)
3. Commits the file and opens a PR to `main`
4. After merge, the model is available and embedded in next build

### Method 2 — Manual download

```bash
# Create models directory
mkdir -p internal/ai/minirag/models

# Download from HuggingFace
curl -L -o internal/ai/minirag/models/bge-small-en-v1.5.Q8_0.gguf \
  "https://huggingface.co/TheBloke/bge-small-en-v1.5-GGUF/resolve/main/bge-small-en-v1.5.Q8_0.gguf"
```

Then commit and push the file.

---

## Training the Adapter (Optional, Spanish Legal)

If you have legal contract data in the `minirag_chunks` SQLite table, you can train a linear domain adapter.

### Prerequisites
- `data/minirag.db` exists with populated `minirag_chunks` table (contracts in Spanish)
- Native dependencies built (llama.cpp, FAISS)
- `uv` installed (`pip install uv` or https://github.com/astral-sh/uv)

### Steps

Run the manual GitHub Actions workflow: **Train Adapter** (`.github/workflows/train-adapter.yml`) with inputs:
- `epochs`: default `3`
- `batch_size`: default `32`

Workflow actions:
1. Installs `sentence-transformers` and `torch` via `uv`
2. Generates synthetic queries using regex topic detection over Spanish legal clause content:
   - Topics: `indemnización`, `confidencialidad`, `renovación`, `terminación`, `pago`, `responsabilidad`
3. Trains a linear adapter (384×384) with InfoNCE contrastive loss
4. Saves `models/adapter_weights.bin` and `models/adapter_metadata.json`
5. Commits weights and opens PR to `main`

After merge, the adapter is embedded in the next build.

---

## Adapter Activation

The adapter is **opt-in** via environment variable:

```bash
export MINIRAG_ADAPTER=1
./pacta
```

If `MINIRAG_ADAPTER` is unset, `0`, or any value other than `1`, the base BGE model is used without adaptation.

---

## Architecture

```
[Legal Document PDF/text]
         ↓
  TokenChunker (512 tokens, 50 overlap, llama.cpp tokenizer)
         ↓
    Chunk list (strings)
         ↓
  Embedder (llama.cpp CGo, embedded GGUF model)
         ↓
  L2-normalized 384-dim vector
         ↓
  [Optional: LinearAdapter if MINIRAG_ADAPTER=1]
         ↓
  ┌─────────────────────────────────────┐
  │  FAISS IndexFlatIP (cosine search)  │  ← stored in process memory (rebuilt on restart)
  └─────────────────────────────────────┘
         ↓
  ┌─────────────────────────────────────┐
  │  SQLite — minirag_chunks table      │  ← persistent on disk
  │  (contract_id, chunk_index,         │
  │   vector_id, content, clause_type)  │
  └─────────────────────────────────────┘

Search query flow:
Query text → Embedder (same path) → FAISS.top-k → SQLite lookup by vector_id → return RankedResults
```

### Key Files
| File | Role |
|------|------|
| `service.go` | Orchestrates indexing and search |
| `embedding/cgo_embedder.go` | CGo llama.cpp wrapper; loads embedded GGUF from temp file |
| `vector/faiss_wrapper.go` | FAISS-CPU `IndexFlatIP` wrapper via CGo |
| `storage/sqlite_store.go` | Chunk metadata persistence (SQLite) |
| `chunker.go` | Sliding-window token chunker with configurable overlap |

---

## API Usage (Go)

```go
package main

import (
    "fmt"
    "log"
    "time"

    "github.com/PACTA-Team/pacta/internal/ai/minirag"
    "github.com/PACTA-Team/pacta/internal/models"
)

func main() {
    // Initialise service — modelPath is ignored (embedded in binary)
    // Pass empty string ("") for modelPath; adapter auto-detected via MINIRAG_ADAPTER
    svc, err := minirag.NewService("", "data/minirag.db")
    if err != nil {
        log.Fatal(err)
    }
    defer svc.Close()

    // Index a Spanish legal contract
    doc := &models.LegalDocument{
        ID:            1,
        Title:         "Acuerdo de Confidencialidad",
        DocumentType:  "acuerdo de confidencialidad",
        Content:       "EL PROVEEDOR se obliga a mantener estricta confidencialidad sobre toda la información del CLIENTE...",
        Language:      "es",
        Jurisdiction:  "AR",
        ContentHash:   "sha256:abc123...",
        CreatedAt:     time.Now(),
        UpdatedAt:     time.Now(),
        CompanyID:     1,
        UploadedBy:    1,
        StoragePath:   "/docs/contract1.pdf",
    }

    if err := svc.IndexLegalDocument(doc); err != nil {
        log.Fatal(err)
    }

    // Semantic search
    results, err := svc.SearchLegalDocuments(
        "indemnización por incumplimiento de contrato", // query in Spanish
        nil,                  // no additional filters
        10,                   // top-k
    )
    if err != nil {
        log.Fatal(err)
    }

    // Format and display
    fmt.Println(minirag.FormatRAGResponse("indemnización por incumplimiento", results))
}
```

---

## Configuration

| Environment Variable | Default | Meaning |
|----------------------|---------|---------|
| `MINIRAG_ADAPTER` | `0` | If `1`, load and apply the 384×384 linear adapter weights from `models/adapter_weights.bin` |

No other configuration is currently exposed via environment variables.

---

## Memory & Performance

| Metric | Value |
|--------|-------|
| Model on-disk size | 89 MB (GGUF Q8_0) |
| Model RAM residency | ~89 MB (memory-mapped via llama.cpp) |
| Adapter size | 576 KB (in-binary) |
| Adapter overhead | Single 384×384 matrix multiply (~0.1ms) |
| Context window | 512 tokens |
| Batch size | 32 (configurable in `cgo_embedder.go`) |
| Threads | `runtime.NumCPU() - 1` (configurable) |
| Embedding inference speed | ~10–50 ms per short sentence on modern CPU (AVX2) |
| FAISS index rebuild time | ~N × embedding_time (N = number of chunks) |
| FAISS index RAM | ~384 × num_chunks × 4 bytes (float32) |

### Tuning

To reduce memory or improve throughput, edit `embedding/cgo_embedder.go`:

```go
ctxParams := C.llama_context_default_params()
ctxParams.n_ctx = 512      // max sequence length
ctxParams.n_batch = 32     // batch size (increase for throughput, decrease for RAM)
ctxParams.n_threads = runtime.NumCPU() - 1
```

Rebuild the binary after changes.

---

## Troubleshooting

### `llama_model_load_from_file failed`

**Cause**: Model file missing at expected temp extraction path.

**Fix**:
- Ensure `internal/ai/minirag/models/bge-small-en-v1.5.Q8_0.gguf` exists
- Check temp directory write permissions: `os.TempDir()` must be writable
- Verify llama.cpp is built: `ls internal/ai/minirag/llama.cpp/build/libllama.a`

### `adapter weights size invalid` or `adapter file not found`

**Cause**: Adapter not yet trained or file missing from `models/`.

**Fix**:
- Train adapter via the workflow (see above), or
- Disable adapter: `export MINIRAG_ADAPTER=0`

### `cannot find -lfaiss` / `ld: library not found for -lfaiss`

**Cause**: FAISS shared library not on linker path.

**Fix**:
```bash
# Verify lib exists
ls internal/ai/minirag/faiss/build/libfaiss.*

# Build flags
export CGO_LDFLAGS="-L$(pwd)/internal/ai/minirag/faiss/build -lfaiss"
export CGO_CFLAGS="-I$(pwd)/internal/ai/minirag/faiss/c_api"
go build ./cmd/pacta
```

### `Segmentation fault` during embedding

**Cause**: llama.cpp build mismatch or corrupted GGUF.

**Fix**:
```bash
cd internal/ai/minirag/llama.cpp
rm -rf build
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
```

Verify GGUF version matches llama.cpp headers (re-convert if needed).

### Search returns no results

- Verify indexing succeeded: `svc.Count()` > 0
- Check SQLite directly: `sqlite3 data/minirag.db "SELECT COUNT(*) FROM minirag_chunks;"`
- Ensure query is not empty; Spanish is supported
- Check logs for FAISS index size and embedding dimension mismatch

---

## Development

### Build native dependencies locally

```bash
# Option A: helper script (recommended)
./scripts/build_deps.sh

# Option B: manual
cd internal/ai/minirag/vector/faiss
./build_faiss.sh

cd ../../llama.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
```

### Run tests

```bash
# All MiniRAG tests
go test ./internal/ai/minirag/... -v

# E2E only
go test -v ./internal/ai/minirag -run TestE2E
```

### Build pacta binary (includes embedded model & adapter)

```bash
go build ./cmd/pacta

# Verify binary includes model assets
./pacta --help  # should start without "model not found" errors
```

### Re-index after model change

If you swap the embedding model (different dimensionality), you **must** delete and rebuild the SQLite + FAISS index:

```go
svc.DeleteAllChunks() // or delete the DB file and restart
// Re-index all documents
```

---

## License

Same as project (MIT/Apache 2.0 — check project LICENSE).

---

*Last updated: 2026-05-03 — BGE + adapter refactor complete*
