# MiniRAG — Offline Embedding-Only RAG

> **Fully offline, embedding-only RAG** for semantic search over legal contracts.
> Uses GGUF-embedded sentence-transformers, FAISS-CPU, and SQLite. No LLM generation.
> Binary target: <100MB, RAM: ~2GB peak.

## Table of Contents
- [System Overview](#system-overview)
- [Architecture](#architecture)
- [Model](#model)
- [Build Requirements](#build-requirements)
- [Local Development Setup](#local-development-setup)
- [Usage](#usage)
- [Memory Tuning](#memory-tuning)
- [Response Formatting](#response-formatting)
- [Troubleshooting](#troubleshooting)
- [Adding New Documents](#adding-new-documents)
- [Production Considerations](#production-considerations)

---

## System Overview

MiniRAG provides **offline semantic search** for legal contract data without any external API calls or Python runtime. It is designed for:

- Contract Q&A and clause retrieval in environments with no internet access
- Low-latency semantic search over thousands of indexed contracts
- Privacy-sensitive deployments where data cannot leave the premises

The system consists of:
- **Embedding inference**: CGo llama.cpp loading a quantised sentence-transformer model from memory
- **Vector search**: FAISS-CPU IndexFlatIP (inner product ≈ cosine on normalised vectors)
- **Metadata persistence**: SQLite for chunk content, document IDs, timestamps, and filters

This is **retrieval only** — no generation, no LLM, no external dependencies.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Go Application                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐         ┌──────────────┐         ┌───────────┐ │
│  │ LegalDocument│───────▶│  Indexer     │───────▶│ Service   │ │
│  │ (models)     │ chunk  │ (chunk.go)   │ embed  │ (service) │ │
│  └──────────────┘ texts  └──────────────┘ vecs   └───────────┘ │
│                                                                    │
│                          ┌───────────┐                            │
│                          │   FAISS   │                            │
│                          │  Index    │◀───── Search(query vec)   │
│                          └───────────┘                            │
│                                                                    │
│                          ┌──────────────┐                          │
│                          │  SQLite Store│◀───── ChunkMetadata     │
│                          │   (chunks)   │                          │
│                          └──────────────┘                          │
│                                                                    │
│  GGUF model (embedded in binary) → llama.cpp CGo → embeddings      │
└─────────────────────────────────────────────────────────────────────┘
```

**Data flow:**
1. `IndexLegalDocument(doc)` → chunk by tokens → generate embeddings (batch) → add vectors to FAISS + store chunk metadata in SQLite
2. `SearchLegalDocuments(query)` → embed query → FAISS top-k search → lookup chunk metadata → filter by jurisdiction → return results

**Key files:**
- `service.go` — orchestrates indexing and search
- `embedding/cgo_embedder.go` — CGo llama.cpp wrapper, loads embedded GGUF from memory
- `vector/faiss_wrapper.go` — FAISS-CPU IndexFlatIP wrapper via CGo
- `storage/sqlite_store.go` — chunk metadata persistence
- `chunker.go` — sliding-window token chunker with overlap

---

## Model

**Model:** `paraphrase-MiniLM-L3-v2` (sentence-transformers)  
**Format:** GGUF Q8_0 (8-bit quantised)  
**Dimensions:** 384  
**Size on disk:** ~65MB  
**Memory footprint at runtime:** ~70MB (model weights loaded in llama.cpp)  
**Embedded in binary:** Yes — via `go:embed` (see `embedding/cgo_embedder.go:23`)

The model is loaded from a temp file extracted from the embedded binary at startup (llama.cpp requires a file path). Extraction is a one-time write to `os.TempDir()` and is reused across restarts.

---

## Build Requirements

### Mandatory
- **Go**: 1.25 (required by project; see `go.mod`)
- **CGO_ENABLED**: `1` (default on Linux/macOS; on Windows install MinGW-w64)
- **C++ toolchain**: `gcc`, `g++`, `make`, `cmake` (llama.cpp & FAISS native builds)
- **Git**: to clone submodules

### Native Library Dependencies
- **llama.cpp** — compiled as static lib `libllama.a` into `internal/ai/minirag/llama.cpp/build/`
- **FAISS-CPU** — compiled as shared lib `libfaiss.so` (or `.dylib`/`.dll`) into `internal/ai/minirag/faiss/build/`

The CI builds these automatically. Locally, use the helper script (see below).

---

## Local Development Setup

### 1. Clone submodules and convert model (one-time)

```bash
# Clone llama.cpp submodule
git submodule update --init --recursive internal/ai/minirag/llama.cpp

# Convert the embedding model to GGUF Q8_0 (requires Python)
pip install transformers torch llama-cpp-python
python3 scripts/convert_embedding_model.py \
  --model "sentence-transformers/paraphrase-MiniLM-L3-v2" \
  --out internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf \
  --quantize q8_0
```

This produces the GGUF file that is embedded into the final Go binary.

### 2. Build native dependencies

**Option A — helper script (recommended):**
```bash
./scripts/build_deps.sh
```

**Option B — manual:**
```bash
# Build FAISS
cd internal/ai/minirag/vector/faiss
./build_faiss.sh  # or follow the script's steps

# Build llama.cpp
cd ../../llama.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)

# Verify both libs exist:
ls -l faiss/build/libfaiss.*
ls -l llama.cpp/build/libllama.a
```

### 3. Build the Go binary

```bash
go build ./cmd/pacta
```

The resulting binary embeds the GGUF model and links against the native libraries statically (where possible). Size should be around 80–100MB.

---

## Usage

### Basic example (in Go code)

```go
package main

import (
	"fmt"
	"log"

	"github.com/PACTA-Team/pacta/internal/ai/minirag"
	"github.com/PACTA-Team/pacta/internal/models"
)

func main() {
	// Initialise service with a temporary (or persistent) SQLite DB
	svc, err := minirag.NewService("", "data/minirag.db")
	if err != nil {
		log.Fatal(err)
	}
	defer svc.Close()

	// Create a legal document
	doc := &models.LegalDocument{
		ID:            1,
		Title:         "Acuerdo de Confidencialidad",
		DocumentType:  "acuerdo de confidencialidad",
		Content:       "EL PROVEEDOR se obliga a mantener la confidencialidad de la información del CLIENTE...",
		Language:      "es",
		Jurisdiction:  "AR",
		ContentHash:   "sha256:...",
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
		CompanyID:     1,
		UploadedBy:    1,
		StoragePath:   "/docs/contract1.pdf",
	}

	// Index it
	if err := svc.IndexLegalDocument(doc); err != nil {
		log.Fatal(err)
	}

	// Search
	results, err := svc.SearchLegalDocuments("indemnización", nil, 5)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(minirag.FormatRAGResponse("indemnización", results))
}
```

### HTTP API (if enabled in your build)

The project may expose an HTTP endpoint (subject to feature flags):

```bash
POST /api/v1/rag/search
Content-Type: application/json

{
  "query": "indemnización por daños",
  "limit": 5,
  "filters": { "jurisdiction": "AR" }
}
```

Check your `cmd/pacta` main for enabled routes.

---

## Memory Tuning

The embedder uses llama.cpp context parameters that can be tuned:

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `n_ctx` | 512 | Max sequence length (tokens) for chunk encoding |
| `n_batch` | 32 | Number of texts processed per batch (affects RAM) |
| `n_threads` | `runtime.NumCPU() - 1` | CPU threads for computation |

**Adjusting batch size:**
In `embedding/cgo_embedder.go`, modify `ctxParams.n_batch`. Larger batches use more RAM but improve throughput.

**Reducing memory footprint:**
- Lower `n_ctx` (but chunks longer than this will be truncated)
- Lower `n_batch` (indexing becomes slower)
- Ensure `CGO_CFLAGS` and `LDFLAGS` point to release-mode builds of llama.cpp/FAISS

---

## Response Format

Results are returned as `[]RAGSearchResult`:

```json
[
  {
    "id": "1",
    "score": 0.923,
    "meta": {
      "contract_id": 1,
      "chunk_index": 0,
      "content": "EL PROVEEDOR se obliga a mantener la confidencialidad...",
      "clause_type": "AR",
      "vector_id": 0,
      "created_at": "2026-05-03T00:00:00Z"
    },
    "content": "EL PROVEEDOR se obliga a mantener la confidencialidad..."
  }
]
```

**Score interpretation:** Inner product (cosine similarity assuming L2-normalised embeddings). Range generally `[-1, 1]` but with normalised embeddings is `[0, 1]`. Higher is more relevant.

A simple formatter (placeholder):

```go
// FormatRAGResponse formats results as a readable string.
// This is a minimal example; customise for your UI.
func FormatRAGResponse(query string, results []RAGSearchResult) string {
	s := ""
	for i, r := range results {
		s += fmt.Sprintf("[%d] Score: %.3f\n%s\n\n", i+1, r.Score, r.Content)
	}
	return s
}
```

---

## Troubleshooting

### `cannot find package github.com/mattn/go-sqlite3` (CGO)

Make sure CGO is enabled and you have a C compiler:
```bash
export CGO_ENABLED=1
go get github.com/mattn/go-sqlite3
```

### `ld: library not found for -lfaiss` (macOS) / `cannot find -lfaiss` (Linux)

FAISS shared library is not on the linker path. Verify:
```bash
ls internal/ai/minirag/faiss/build/libfaiss.*
```

If missing, run `./scripts/build_deps.sh`. If present, ensure the Go build can find it:

```bash
export CGO_LDFLAGS="-L$(pwd)/internal/ai/minirag/faiss/build -lfaiss"
export CGO_CFLAGS="-I$(pwd)/internal/ai/minirag/faiss/c_api"
go build ./cmd/pacta
```

### `llama_model_load_from_file failed`

The embedded GGUF model could not be extracted or loaded:
- Verify `internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf` exists
- Check temp directory write permissions (`os.TempDir()`)
- Ensure llama.cpp was built: `ls internal/ai/minirag/llama.cpp/build/libllama.a`

### `Segmentation fault` during embedding inference

Likely llama.cpp mismatch. Rebuild llama.cpp cleanly:
```bash
cd internal/ai/minirag/llama.cpp
rm -rf build
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
```

Also verify GGUF version compatibility — the model must be converted with the **same llama.cpp version** as the headers used in `cgo_llama.go`.

### `faiss_index_factory failed`

FAISS library not loaded or wrong metric type. Verify binary linkage:
```bash
ldd cmd/pacta | grep faiss   # Linux
otool -L cmd/pacta | grep faiss  # macOS
```

Rebuild FAISS with the `c_api` enabled (default in provided `build_faiss.sh`).

### Search returns no results

- Verify the document was indexed: check `svc.Count()` > 0
- Look at SQLite DB directly: `sqlite3 data/minirag.db "SELECT COUNT(*) FROM minirag_chunks;"`
- Check FAISS index size in logs (if debug logging enabled)
- Ensure query is not empty and is in a language the model supports (Spanish is fine for this multilingual model)

---

## Adding New Documents

Indexing is incremental and thread-safe within a single process. To add more documents:

```go
doc := &models.LegalDocument{ ... }
if err := svc.IndexLegalDocument(doc); err != nil {
    log.Fatal(err)
}
```

**Duplicate prevention:** Check for existing content via `ContentHash` before indexing. The system does not deduplicate automatically.

**Bulk indexing:** Use the `Indexer` type (`internal/ai/minirag/indexer.go`) to fetch from the main DB and index all contracts in batch. chunk size and batch size are configurable but default to 512 tokens and 32, respectively.

**Re-indexing a document:** Call `svc.DeleteDocumentChunks(docID)` first, then re-index.

---

## Production Considerations

1. **Read-only filesystem.** All model data is embedded; no model files need to be readable at runtime except for temp extraction, which happens at startup and requires write access to `os.TempDir()`.

2. **SQLite backups.** The metadata DB is a regular SQLite file. Back it up regularly (or use WAL + checkpoint). The FAISS index lives in process memory and is rebuilt from SQLite on restart.

3. **Model updates.** Changing the embedding model requires:
   - Rebuilding the Go binary (new embedded GGUF)
   - Re-indexing all documents (dimensionality mismatch)
   Plan model upgrades carefully.

4. **Scaling.** This is a **single-node** in-process RAG. For multiple processes:
   - Each process builds its own FAISS index in memory (data duplication).
   - Use a shared vector DB (e.g., Qdrant, Weaviate) if you need multi-process serving.
   - Consider the hybrid service (see `internal/ai/hybrid/`) that can route to remote or local.

5. **Security.** Input queries and document content are handled in-memory only. No network traffic leaves the host. Validate document content before indexing if untrusted.

6. **Monitoring.** Expose metrics via `prometheus.NewRegistry()` if needed: `svc.Count()`, search latency, embedder errors.

---

## Appendix: Build Script (scripts/build_deps.sh)

```bash
#!/usr/bin/env bash
set -euo pipefail

# Build both FAISS and llama.cpp native dependencies for MiniRAG.
# Run from repository root.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Building FAISS-CPU ==="
cd "$REPO_ROOT/internal/ai/minirag/vector/faiss"
./build_faiss.sh

echo "=== Building llama.cpp ==="
cd "$REPO_ROOT/internal/ai/minirag/llama.cpp"
rm -rf build
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)

echo "=== Build complete ==="
echo "FAISS lib: $(ls -1 faiss/build/libfaiss.* 2>/dev/null || true)"
echo "llama.cpp lib: $(ls -1 llama.cpp/build/libllama.a 2>/dev/null || true)"
```

Make executable:
```bash
chmod +x scripts/build_deps.sh
```

---

## Appendix: E2E Test

The end-to-end test (`e2e_test.go`) exercises the full pipeline:
- Indexing a Spanish confidentiality contract
- Semantic search for "indemnización" and "confidencialidad"
- Jurisdiction filtering
- Low-relevance threshold check for unrelated queries

Run:
```bash
go test -v ./internal/ai/minirag -run TestE2E
```

The test requires the native libraries and embedded model to be available (CI handles this automatically).

---

*For questions or updates, see project `AGENTS.md` and `docs/` for design documents.*
