# MiniRAG — Offline Embedding-Only RAG

This module implements a fully offline, embedding-only RAG system for semantic search over documents. It uses a GGUF-embedded sentence-transformer model for embeddings, FAISS-CPU for vector search, and SQLite for metadata storage.

## Architecture

- **Embedding**: GGUF-embedded `paraphrase-MiniLM-L3-v2` (Q8_0 quantised) via CGo llama.cpp bindings
- **Vector DB**: FAISS-CPU (HNSW index) for approximate nearest neighbour search
- **Metadata**: SQLite for document chunk metadata, timestamps, and source tracking
- **LLM**: NONE — this is embedding-only; no generation, no external API dependencies
- **Binary size target**: <100MB (including the embedded model)

## Directory Structure

```
internal/ai/minirag/
├── cgo_llama.go       # CGo bindings to llama.cpp (embedding inference)
├── local_client.go    # LocalClient — three modes: cgo | ollama | external
├── embeddings.go      # Embedding interface & CGo implementation
├── vector_db.go       # FAISS-CPU HNSW wrapper (to be implemented)
├── indexer.go         # Chunk-and-index pipeline (to be implemented)
├── parser.go          # Document parsers: PDF, plain text, markdown
├── models/            # GGUF embedding model (committed to repo)
│   └── paraphrase-MiniLM-L3-v2-Q8_0.gguf
└── llama.cpp/         # llama.cpp submodule (C++ inference engine)

scripts/
└── convert_embedding_model.py  # One-time model conversion script
```

## Model Conversion (One-Time)

To embed `paraphrase-MiniLM-L3-v2` as GGUF Q8_0:

1. **Install Python dependencies**:
   ```bash
   pip install transformers torch llama-cpp-python
   ```

2. **Clone llama.cpp** (if not already present):
   ```bash
   git clone https://github.com/ggerganov/llama.cpp internal/ai/minirag/llama.cpp
   ```

3. **Run the conversion script**:
   ```bash
   python3 scripts/convert_embedding_model.py
   ```

   The script will:
   - Download `sentence-transformers/paraphrase-MiniLM-L3-v2` from Hugging Face
   - Convert it to GGUF Q8_0 format using `llama.cpp/convert.py`
   - Output to `internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf` (~65MB)

4. **Commit the model file**:
   ```bash
   git add internal/ai/minirag/models/paraphrase-MiniLM-L3-v2-Q8_0.gguf
   git commit -m "chore(minirag): add embedding model"
   ```

### Re-conversion (Overwrite)

To re-convert (e.g., with different quantisation):
```bash
python3 scripts/convert_embedding_model.py --force
```

## Build Integration

The GGUF model file is embedded into the Go binary via `go:embed`:

```go
//go:embed models/paraphrase-MiniLM-L3-v2-Q8_0.gguf
var embeddingModelGGUF []byte
```

At runtime, the CGo llama.cpp bindings load the model from memory (or a temp file) and perform embedding inference without any external dependencies.

## Phase 0 — Refactor Plan

| Task | Description | Status |
|------|-------------|--------|
| 0.1 | Add model conversion script & README | ✅ Pending |
| 0.2 | Implement GGUF loader via CGo (memory-load path) | ⏳ |
| 0.3 | Add FAISS-CPU wrapper (HNSW, top-k search) | ⏳ |
| 0.4 | SQLite metadata store (chunks, docs) | ⏳ |
| 0.5 | Indexer pipeline (parse → embed → store) | ⏳ |
| 0.6 | Basic CLI & HTTP API (query endpoint) | ⏳ |
| 0.7 | CI: verify model presence + build test | ⏳ |

Target binary size (Linux amd64): <100MB (includes embedded model, FAISS static lib, SQLite).

## Notes

- **No LLM generation** — this is pure embedding + retrieval
- **No external services** — model is embedded; no Ollama HTTP or external APIs
- **No Python runtime needed at runtime** — Python is only for one-time conversion
- **Offline-first** — works entirely without internet after model is embedded
