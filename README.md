# PACTA

**Contract Lifecycle Management System**

[![Release](https://img.shields.io/github/v/release/PACTA-Team/pacta?sort=semver&color=green)](https://github.com/PACTA-Team/pacta/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go Report Card](https://goreportcard.com/badge/github.com/PACTA-Team/pacta)](https://goreportcard.com/report/github.com/PACTA-Team/pacta)
[![CI](https://github.com/PACTA-Team/pacta/actions/workflows/release.yml/badge.svg)](https://github.com/PACTA-Team/pacta/actions/workflows/release.yml)
[![Downloads](https://img.shields.io/github/downloads/PACTA-Team/pacta/total?color=orange)](https://github.com/PACTA-Team/pacta/releases)

PACTA is a local-first contract management platform designed for organizations that require full control over their data. Distributed as a single binary with zero external dependencies, it runs entirely on your machine — no cloud, no third-party servers, no data leaving your infrastructure.

🇪🇸 [Leer en español →](docs/README-ES.md)

---

## Features

- **Landing Page Experience** — Polished onboarding with animated hero, parallax backgrounds, and smooth scroll interactions
- **AI-Powered Contract Generation & Review (Themis AI — alpha)** — Generate contracts and review existing ones using AI with PDF text extraction, multi-tenant RAG, and per-company rate limiting. Settings in `/settings/ai`. Feature disabled by default.
- **Password Reset Flow** — Secure email-based password reset with time-limited tokens (1 hour expiry). Uses Mailtrap SMTP for development, configurable SMTP for production.
- **Email Notifications** — HTML email templates (Handlebars) for password resets, verification, contract expiry, and admin alerts. Configurable via SMTP.
- **Contract Management** — Full CRUD operations with soft delete, version tracking, and status workflows
- **Hybrid Registration** — Email code verification (via local SMTP) or admin approval with company assignment
- **Party Management** — Centralized registry of clients, suppliers, and authorized signers
- **Approval Workflows** — Structured supplement approvals with draft, approved, and active states
- **Document Attachments** — Link supporting documents directly to contracts and parties
- **Notifications & Alerts** — Automated reminders for expiring contracts and upcoming renewals
- **Audit Trail** — Full-history screen with filtering, pagination, and user activity log; immutable log of all operations for compliance
- **Role-Based Access Control** — Granular permissions across admin, manager, editor, and viewer roles
- **Multi-Company Support** — Full data isolation across companies; contracts scoped by company with FK validation; support for single-company and multi-company modes
- **Admin Approval Dashboard** — Pending user approvals with company assignment and email notifications
- **Setup Wizard** — Enhanced multi-step wizard with company configuration, role selection, signers step, tutorial mode, and route protection for pending setup
- **Profile Page** — User profile with account info, password change, certificate management, and personal activity log
- **Dark/Light Theme** — System-aware theme toggle with persistent preferences
- **Zero External Dependencies** — Single static binary, embedded SQLite, no database server required

---

## Quick Start

### 1. Download

Get the latest release for your platform from the [Releases](https://github.com/PACTA-Team/pacta/releases) page.

### 2. Install

| Platform | Guide |
|----------|-------|
| 🐧 Linux (Production) | [Installation Guide →](docs/INSTALLATION-LINUX.md) |
| 🪟 Windows (Local) | [Installation Guide →](docs/INSTALLATION-WINDOWS.md) |
| 🍎 macOS | Download `.tar.gz` from [Releases](https://github.com/PACTA-Team/pacta/releases), extract, run `./pacta` |

### 3. Run

```bash
./pacta
```

The application starts on `http://127.0.0.1:3000` and opens your browser automatically.

### 4. Set Up

On first run, PACTA opens a **Setup Wizard** in your browser. Navigate to `/setup` (or wait for the automatic redirect) to configure:

1. **Company information** — Basic organization details
2. **Admin account** — Email and password for the primary administrator
3. **Role selection** — Choose user roles and permissions
4. **Signers registration** — Add authorized contract signers
5. **Tutorial mode** — Optional guided walkthrough

Once setup is complete, you'll be redirected to the login page. Use the credentials you created to log in.

> **Note:** The setup wizard only appears on first run. If you need to reconfigure, delete the SQLite database file and restart PACTA.

---

## Supported Platforms

| OS      | Architecture | Format          | Guide |
|---------|-------------|-----------------|-------|
| Linux   | amd64       | `.tar.gz`, `.deb` | [Linux Guide →](docs/INSTALLATION-LINUX.md) |
| Linux   | arm64       | `.tar.gz`, `.deb` | [Linux Guide →](docs/INSTALLATION-LINUX.md) |
| macOS   | amd64       | `.tar.gz`       | Extract and run `./pacta` |
| macOS   | arm64       | `.tar.gz`       | Extract and run `./pacta` |
| Windows | amd64       | `.tar.gz`       | [Windows Guide →](docs/INSTALLATION-WINDOWS.md) |

---

## Architecture

PACTA follows a minimalist, self-contained architecture:

```
┌──────────────────────────────────────────────┐
│  pacta (single Go binary)                    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Embedded React + TypeScript frontend  │  │
│  │  (Vite build, statically generated)    │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  SQLite database (pure Go, no CGO)     │  │
│  │  └─ SQL migrations (auto-applied)      │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  HTTP server (:3000)                   │  │
│  │  ├── GET /*    → static frontend       │  │
│  │  └── /api/*    → REST API (chi router) │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  All data stays local. No internet required. │
└──────────────────────────────────────────────┘
```

### Technology Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Backend      | Go 1.25, chi router                 |
| Database     | SQLite (`modernc.org/sqlite`, pure Go) |
| Frontend     | React 19, TypeScript, Vite, Tailwind CSS |
| UI Components| shadcn/ui                           |
| Animations   | Framer Motion                       |
| Auth         | Cookie-based sessions, bcrypt       |
| Packaging    | GoReleaser, NFPM (.deb)             |

### Database Access

All database queries are type-safe via **sqlc v2** code generation:

- **SQL queries** are defined in `internal/db/queries/*.sql` (organized by domain: system_settings, users, contracts, clients, suppliers, etc.)
- **Code generation**: `sqlc generate` produces `internal/db/queries_gen.go` with type-safe methods
- **Handlers** inject `*db.Queries` (interface) via constructor dependency injection
- **Soft-delete pattern** (`deleted_at IS NULL`) is consistently applied across all entities
- **Transactions** use `queries.WithTx(tx)` when transaction-aware methods are needed

**Architecture**:

```
internal/db/
├── migrations/        # goose migrations (auto-applied on startup)
├── models.go          # Go structs for database rows
├── queries/           # 22 .sql files by domain (source of truth)
│   ├── system_settings.sql
│   ├── users.sql
│   ├── contracts.sql
│   └── ...
├── queries_gen.go     # GENERATED - type-safe query methods (committed)
├── sqlc.yaml          # sqlc configuration
└── db.go              # Open() + Migrate() helpers
```

**Configuration** (`sqlc.yaml`):

```yaml
version: "2"
sql:
  - schema: "internal/db/migrations/*.sql"
    queries: "internal/db/queries/*.sql"
    engine: "sqlite"
    gen:
      go_package:
        mode: "query"
        name: "db"
      emit:
        interface: true  # generates Queries interface for mocking
```

**Workflow for adding a new query**:

1. Create `internal/db/queries/<domain>.sql` (or edit existing)
2. Run `sqlc generate` from `internal/db/` directory
3. Use generated method in handlers: `h.queries.GetXxx(ctx, args)`
4. Commit both the `.sql` file and updated `queries_gen.go`

**Example** (`system_settings.sql`):

```sql
-- name: GetSettingValue :one
SELECT value FROM system_settings
WHERE key = $1 AND deleted_at IS NULL
LIMIT 1;
```

Generates: `func (q *Queries) GetSettingValue(ctx context.Context, key string) (string, error)`

Handler usage:

```go
value, err := h.queries.GetSettingValue(r.Context(), "ai_provider")
```

**Exceptions** (manual SQL, not migrated to sqlc):

- **RLS (Row Level Security)**: Dynamic RLS policies in `internal/db/rls.go` — sqlc cannot generate dynamic policy logic
- **Dynamic parameter count**: Queries needing variable-length `IN` clauses (e.g., `GetSettingsByKeys(keys []string)`) — implemented with manual query building inside generated method
- **Extremely dynamic filters**: Some handlers construct WHERE conditions dynamically; these remain as raw SQL in limited cases

**Testing**: Unit tests can mock `db.Queries` interface, making database testing fast and isolated.

> **Developer note**: After modifying any `.sql` file, always run `sqlc generate` and commit both the `.sql` changes and the regenerated `queries_gen.go`. The CI verifies generated code is up-to-date with `git diff --exit-code`.

[See Architecture Decision Record →](docs/adr/2026-05-02-sqlc-migration.md)

---


## API Reference

### Core API

| Method   | Path                  | Auth | Description            |
|----------|-----------------------|------|------------------------|
| `POST`   | `/api/auth/register`  | No   | Register new user      |
| `POST`   | `/api/auth/login`     | No   | Authenticate user      |
| `POST`   | `/api/auth/logout`    | Yes  | Destroy session        |
| `POST`   | `/api/auth/forgot-password` | No | Request password reset email |
| `POST`   | `/api/auth/reset-password`  | No | Complete password reset with token |
| `GET`    | `/api/auth/validate-token/{token}` | No | Check if reset token is valid |
| `GET`    | `/api/auth/me`        | Yes  | Get current user       |
| `GET`    | `/api/contracts`      | Yes  | List contracts         |
| `POST`   | `/api/contracts`      | Yes  | Create contract        |
| `GET`    | `/api/contracts/{id}` | Yes  | Get contract by ID     |
| `PUT`    | `/api/contracts/{id}` | Yes  | Update contract        |
| `DELETE` | `/api/contracts/{id}` | Yes  | Soft delete contract   |
| `GET`    | `/api/clients`        | Yes  | List clients           |
| `POST`   | `/api/clients`        | Yes  | Create client          |
| `GET`    | `/api/suppliers`      | Yes  | List suppliers         |
| `POST`   | `/api/suppliers`      | Yes  | Create supplier        |
| `GET`    | `/api/signers`        | Yes  | List signers (filter by company_id & company_type) |
| `GET`    | `/api/setup`          | No   | Get setup status       |
| `GET`    | `/api/audit-logs`     | Yes  | List audit logs with filters |
| `GET`    | `/api/audit-logs/contract/{id}` | Yes | Audit history for a contract |

### Local AI with MiniRAG (Alpha — Self-Hosted, Offline-Capable)

PACTA includes **MiniRAG**, a fully local retrieval-augmented generation system
that operates **100% offline** using the `cgo` mode (CGo + llama.cpp). This gives
you contract generation and review capabilities **without any cloud dependency**.

### Features
- **Offline-first**: No internet required once model is downloaded
- **Local vector database**: per-company embeddings stored in SQLite-backed HNSW index
- **Hybrid modes**: combine local inference with external APIs (OpenAI, Groq) for fallback
- **PDF/Word parsing**: built-in document text extraction (with Apache Tika optional)

### Supported Modes

| Mode | Description | Offline? | Requirements |
|------|-------------|----------|--------------|
| `cgo` | Qwen2.5-0.5B-Instruct embedded via llama.cpp (CGo) | ✅ Yes | Model file present, CGO_ENABLED=1, llama.cpp compiled |
| `ollama` | Ollama HTTP API (local server) | ⚠️ Yes, if Ollama installed | Ollama service running locally |
| `external` | Cloud APIs (OpenAI, Groq, etc.) | ❌ No | API key + internet |
| `hybrid` | Combines local + external based on strategy | ✅ Partial | Depends on local mode chosen |

**Note**: The `cgo` mode is the only truly offline option. The model (429 MB `.gguf`
file) is **not embedded in the binary** — it's stored separately under
`internal/ai/minirag/models/`. The binary contains the inference engine
(llama.cpp via CGo), but you must provide the model weights file.

### Quick Start (Local/Offline Setup)

#### Option A: Using Pre-Built Binary (recommended)

1. **Download the latest release** from [Releases](https://github.com/PACTA-Team/pacta/releases)
2. **Download the Qwen2.5-0.5B-Instruct GGUF model** (q4_0 quant, ~429 MB):
   ```bash
   # From Hugging Face:
   wget https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_0.gguf
   ```
3. **Place the model file** in the `models` directory next to the binary:
   ```bash
   mkdir -p internal/ai/minirag/models
   cp qwen2.5-0.5b-instruct-q4_0.gguf internal/ai/minirag/models/
   ```
   **Important**: The release binary expects the model at
   `internal/ai/minirag/models/qwen2.5-0.5b-instruct-q4_0.gguf` relative to the
   current working directory. You can also configure a custom path in Settings → AI.

4. **Run PACTA**:
   ```bash
   ./pacta
   ```
   The app opens at `http://127.0.0.1:3000`.

5. **Enable AI in Settings**:
   - Log in as admin
   - Navigate to **Settings → AI**
   - Set **RAG Mode** to `local`
   - Set **Local Mode** to `cgo`
   - Save

You can now use **contract generation** and **review** features fully offline.

#### Option B: Build from Source (developer)

If you're building from source, the CI automatically downloads the model. For
local development:

```bash
# Clone and build
git clone https://github.com/PACTA-Team/pacta.git
cd pacta

# Install dependencies: Go 1.25+, CMake, C compiler
# On Ubuntu/Debian:
sudo apt-get install build-essential cmake

# Build frontend
cd pacta_appweb && npm ci && npm run build && cd ..

# Build Go binary with CGO enabled
CGO_ENABLED=1 go build ./cmd/pacta

# Download model (if not present)
mkdir -p internal/ai/minirag/models
wget -O internal/ai/minirag/models/qwen2.5-0.5b-instruct-q4_0.gguf \
  https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_0.gguf

# Run
./pacta
```

The build process automatically compiles `llama.cpp` from the vendored source in
`internal/ai/minirag/llama.cpp/` (the repository includes a shallow clone; CI
does a full clone and build).

### Configuration Reference

Settings are stored in the `system_settings` table (accessible via UI → Settings → AI):

| Key | Values | Description | Default |
|-----|--------|-------------|---------|
| `rag_mode` | `local`, `external`, `hybrid` | Top-level RAG mode | `external` |
| `local_mode` | `cgo`, `ollama` | Local engine selection (only for `rag_mode=local|hybrid`) | `cgo` |
| `local_model` | Path to `.gguf` file | Model filename or absolute path | `qwen2.5-0.5b-instruct-q4_0.gguf` |
| `embedding_model` | Model name (Ollama) | Embeddings model served by Ollama | `all-minilm-l6-v2` |
| `hybrid_strategy` | `local-first`, `external-first`, `parallel` | Query strategy for hybrid mode | `local-first` |
| `hybrid_rerank` | `true`, `false` | Enable reranking of combined results | `true` |
| `ai_provider` | `openai`, `groq`, `anthropic`, … | External provider (for `external`/`hybrid`) | — |
| `ai_api_key` | Encrypted key | API credential for external provider | — |
| `ai_model` | Model ID | External model name (e.g. `gpt-4`) | — |
| `ai_endpoint` | URL | Custom endpoint (optional) | — |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  PACTA (Go binary)                                      │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Handlers (/api/ai/*)                            │ │
│  │    ├─ HandleRAGLocal  → LocalClient.Generate()   │ │
│  │    ├─ HandleRAGHybrid → Orchestrator.Query()     │ │
│  │    └─ …                                          │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  MiniRAG Package (internal/ai/minirag)           │ │
│  │    ├─ LocalClient                                │ │
│  │    │   ├─ cgoLLMInference (CGo + llama.cpp)     │ │
│  │    │   └─ OllamaClient (HTTP fallback)          │ │
│  │    ├─ EmbeddingClient → Ollama API / hash fallback│ │
│  │    ├─ VectorDB (HNSW, pure Go, per-company)     │ │
│  │    └─ Indexer (PDF parsing, chunking)           │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Hybrid Orchestrator (internal/ai/hybrid)        │ │
│  │    ├─ Strategy: local-first / external-first     │ │
│  │    └─ Reranking: combine & rank results          │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Runtime dependencies:                                  │
│  - cgo mode: GGUF model file (internal/ai/minirag/models/) │
│  - ollama mode: Ollama HTTP server on localhost:11434   │
│  - external mode: Internet + API key                   │
└─────────────────────────────────────────────────────────┘
```

### Offline Operation Checklist

To run PACTA completely **air-gapped** (no internet):

1. ✅ Build or download the PACTA binary
2. ✅ Obtain the `qwen2.5-0.5b-instruct-q4_0.gguf` model file **in advance**
3. ✅ Place the model at `internal/ai/minirag/models/` (relative to CWD)
4. ✅ Set RAG mode = `local`, Local mode = `cgo` in Settings
5. ✅ Start the app — no network calls are made

**Model size**: ~429 MB (q4_0 quantized). Once downloaded, all inference is local.

### Troubleshooting

**"AI not configured" error**  
→ Go to Settings → AI and enable the feature. Set `rag_mode` to `local` or `hybrid`.

**"Model not found" error**  
→ Ensure the `.gguf` file exists at `internal/ai/minirag/models/qwen2.5-0.5b-instruct-q4_0.gguf` or configure an absolute path in `local_model` setting.

**CGO-related build errors**  
→ Install C toolchain: `sudo apt-get install build-essential` (Linux) or Xcode Command Line Tools (macOS). Build with `CGO_ENABLED=1`.

**Out of memory**  
→ The Qwen2.5-0.5B model uses ~1–2 GB RAM during inference. Ensure your system has at least 4 GB free.

**Want a smaller model?**  
→ You can use any GGUF-format model compatible with llama.cpp. Update the
`local_model` setting to point to your custom `.gguf` file. Recommended: models
≤ 500 MB to keep binary size reasonable.

---

---

## Local AI with MiniRAG (Alpha — Self-Hosted, Offline-Capable)

PACTA includes **MiniRAG**, a fully local retrieval-augmented generation system
that operates **100% offline** using the `cgo` mode (CGo + llama.cpp). This gives
you contract generation and review capabilities **without any cloud dependency**.

### Features
- **Offline-first**: No internet required once model is downloaded
- **Local vector database**: per-company embeddings stored in SQLite-backed HNSW index
- **Hybrid modes**: combine local inference with external APIs (OpenAI, Groq) for fallback
- **PDF/Word parsing**: built-in document text extraction (with Apache Tika optional)

### Supported Modes

| Mode | Description | Offline? | Requirements |
|------|-------------|----------|--------------|
| `cgo` | Qwen2.5-0.5B-Instruct embedded via llama.cpp (CGo) | ✅ Yes | Model file present, CGO_ENABLED=1, llama.cpp compiled |
| `ollama` | Ollama HTTP API (local server) | ⚠️ Yes, if Ollama installed | Ollama service running locally |
| `external` | Cloud APIs (OpenAI, Groq, etc.) | ❌ No | API key + internet |
| `hybrid` | Combines local + external based on strategy | ✅ Partial | Depends on local mode chosen |

**Note**: The `cgo` mode is the only truly offline option. The model (429 MB `.gguf`
file) is **not embedded in the binary** — it's stored separately under
`internal/ai/minirag/models/`. The binary contains the inference engine
(llama.cpp via CGo), but you must provide the model weights file.

### Quick Start (Local/Offline Setup)

#### Option A: Using Pre-Built Binary (recommended)

1. **Download the latest release** from [Releases](https://github.com/PACTA-Team/pacta/releases)
2. **Download the Qwen2.5-0.5B-Instruct GGUF model** (q4_0 quant, ~429 MB):
   ```bash
   # From Hugging Face:
   wget https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_0.gguf
   ```
3. **Place the model file** in the `models` directory next to the binary:
   ```bash
   mkdir -p internal/ai/minirag/models
   cp qwen2.5-0.5b-instruct-q4_0.gguf internal/ai/minirag/models/
   ```
   **Important**: The release binary expects the model at
   `internal/ai/minirag/models/qwen2.5-0.5b-instruct-q4_0.gguf` relative to the
   current working directory. You can also configure a custom path in Settings → AI.

4. **Run PACTA**:
   ```bash
   ./pacta
   ```
   The app opens at `http://127.0.0.1:3000`.

5. **Enable AI in Settings**:
   - Log in as admin
   - Navigate to **Settings → AI**
   - Set **RAG Mode** to `local`
   - Set **Local Mode** to `cgo`
   - Save

You can now use **contract generation** and **review** features fully offline.

#### Option B: Build from Source (developer)

If you're building from source, the CI automatically downloads the model. For
local development:

```bash
# Clone and build
git clone https://github.com/PACTA-Team/pacta.git
cd pacta

# Install dependencies: Go 1.25+, CMake, C compiler
# On Ubuntu/Debian:
sudo apt-get install build-essential cmake

# Build frontend
cd pacta_appweb && npm ci && npm run build && cd ..

# Build Go binary with CGO enabled
CGO_ENABLED=1 go build ./cmd/pacta

# Download model (if not present)
mkdir -p internal/ai/minirag/models
wget -O internal/ai/minirag/models/qwen2.5-0.5b-instruct-q4_0.gguf \
  https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_0.gguf

# Run
./pacta
```

The build process automatically compiles `llama.cpp` from the vendored source in
`internal/ai/minirag/llama.cpp/` (the repository includes a shallow clone; CI
does a full clone and build).

### Configuration Reference

Settings are stored in the `system_settings` table (accessible via UI → Settings → AI):

| Key | Values | Description | Default |
|-----|--------|-------------|---------|
| `rag_mode` | `local`, `external`, `hybrid` | Top-level RAG mode | `external` |
| `local_mode` | `cgo`, `ollama` | Local engine selection (only for `rag_mode=local|hybrid`) | `cgo` |
| `local_model` | Path to `.gguf` file | Model filename or absolute path | `qwen2.5-0.5b-instruct-q4_0.gguf` |
| `embedding_model` | Model name (Ollama) | Embeddings model served by Ollama | `all-minilm-l6-v2` |
| `hybrid_strategy` | `local-first`, `external-first`, `parallel` | Query strategy for hybrid mode | `local-first` |
| `hybrid_rerank` | `true`, `false` | Enable reranking of combined results | `true` |
| `ai_provider` | `openai`, `groq`, `anthropic`, … | External provider (for `external`/`hybrid`) | — |
| `ai_api_key` | Encrypted key | API credential for external provider | — |
| `ai_model` | Model ID | External model name (e.g. `gpt-4`) | — |
| `ai_endpoint` | URL | Custom endpoint (optional) | — |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  PACTA (Go binary)                                      │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Handlers (/api/ai/*)                            │ │
│  │    ├─ HandleRAGLocal  → LocalClient.Generate()   │ │
│  │    ├─ HandleRAGHybrid → Orchestrator.Query()     │ │
│  │    └─ …                                          │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  MiniRAG Package (internal/ai/minirag)           │ │
│  │    ├─ LocalClient                                │ │
│  │    │   ├─ cgoLLMInference (CGo + llama.cpp)     │ │
│  │    │   └─ OllamaClient (HTTP fallback)          │ │
│  │    ├─ EmbeddingClient → Ollama API / hash fallback│ │
│  │    ├─ VectorDB (HNSW, pure Go, per-company)     │ │
│  │    └─ Indexer (PDF parsing, chunking)           │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Hybrid Orchestrator (internal/ai/hybrid)        │ │
│  │    ├─ Strategy: local-first / external-first     │ │
│  │    └─ Reranking: combine & rank results          │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Runtime dependencies:                                  │
│  - cgo mode: GGUF model file (internal/ai/minirag/models/) │
│  - ollama mode: Ollama HTTP server on localhost:11434   │ │
│  - external mode: Internet + API key                   │ │
└─────────────────────────────────────────────────────────┘
```

### Offline Operation Checklist

To run PACTA completely **air-gapped** (no internet):

1. ✅ Build or download the PACTA binary
2. ✅ Obtain the `qwen2.5-0.5b-instruct-q4_0.gguf` model file **in advance**
3. ✅ Place the model at `internal/ai/minirag/models/` (relative to CWD)
4. ✅ Set RAG mode = `local`, Local mode = `cgo` in Settings
5. ✅ Start the app — no network calls are made

**Model size**: ~429 MB (q4_0 quantized). Once downloaded, all inference is local.

### Troubleshooting

**"AI not configured" error**  
→ Go to Settings → AI and enable the feature. Set `rag_mode` to `local` or `hybrid`.

**"Model not found" error**  
→ Ensure the `.gguf` file exists at `internal/ai/minirag/models/qwen2.5-0.5b-instruct-q4_0.gguf` or configure an absolute path in `local_model` setting.

**CGO-related build errors**  
→ Install C toolchain: `sudo apt-get install build-essential` (Linux) or Xcode Command Line Tools (macOS). Build with `CGO_ENABLED=1`.

**Out of memory**  
→ The Qwen2.5-0.5B model uses ~1–2 GB RAM during inference. Ensure your system has at least 4 GB free.

**Want a smaller model?**  
→ You can use any GGUF-format model compatible with llama.cpp. Update the
`local_model` setting to point to your custom `.gguf` file. Recommended: models
≤ 500 MB to keep binary size reasonable.

---

## Themis AI (Alpha — feature flag disabled by default)

| Method   | Path                        | Auth | Description                    |
|----------|-----------------------------|------|--------------------------------|
| `POST`   | `/api/v1/ai/generate`       | Yes  | Generate contract draft using AI (requires AI enabled in settings) |
| `POST`   | `/api/v1/ai/review`         | Yes  | Review existing contract with AI (requires AI enabled in settings) |
| `GET`    | `/api/v1/ai/settings`       | Yes  | Get current AI settings       |
| `PUT`    | `/api/v1/ai/settings`       | Yes  | Update AI provider, API key, model, enable toggle |

> **Note:** Themis AI endpoints return `503 Service Unavailable` until enabled in Settings → AI. Rate limited to 100 requests/day per company.

---

## Changelog

For a complete history of changes, please see the [full changelog →](CHANGELOG.md)

---

## Development

See the [Development Guide](docs/DEVELOPMENT.md) for prerequisites, local setup, and contribution guidelines. For contribution workflow and best practices, see [CONTRIBUTING.md](CONTRIBUTING.md).

Quick start for developers:

```bash
# Terminal 1: Build frontend
cd pacta_appweb
npm ci && npm run build

# Terminal 2: Run Go server
cd ..
go run ./cmd/pacta
```

---

## Security

For security policy and vulnerability disclosure, please see [SECURITY.md](SECURITY.md).

---

## License

MIT License. See [LICENSE](LICENSE) for details.
