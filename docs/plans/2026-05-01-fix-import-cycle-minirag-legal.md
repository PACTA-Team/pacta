# Fix Import Cycle: Move Legal Chunking to Minirag

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **REQUIRED SUB-SKILL:** Use superpowers:diagnose for any build/test failures encountered during implementation.

**Goal:** Break the import cycle between `internal/ai/minirag` and `internal/ai/legal` by moving chunking infrastructure (Chunk type, ParseByArticles, MergeChunksWithOverlap, and helpers) from legal to minirag package.

**Architecture:** The cycle is:
- `minirag/vector_db.go` imports `legal.Chunk` type
- `minirag/indexer.go` imports `legal.ParseByArticles` and `legal.MergeChunksWithOverlap`
- `legal/chat_service.go` imports `minirag.VectorDB` and `minirag.EmbeddingClient`

Minimal fix: Move chunking code from `legal` → `minirag`. Legal package retains only chat-specific logic and can continue importing minirag (no cycle).

**Tech Stack:** Go (no external dependencies)

---

## Pre-Task Checklist

- [ ] Current branch: `feature/minirag-hybrid-integration`
- [ ] CI status: Failing with "import cycle not allowed"
- [ ] Affected packages: `internal/ai/minirag`, `internal/ai/legal`
- [ ] Build command: `go build ./cmd/pacta` (CGO_ENABLED=1)

---

### Task 1: Create `minirag/parser.go` with chunking infrastructure

**Files:**
- Create: `internal/ai/minirag/parser.go`
- Copy from: `internal/ai/legal/parser.go` (lines 1-373, entire file)
- Modify: Change package from `legal` to `minirag`; update all `legal.` qualified references within file to unqualified (since same package)

**Step 1:** Copy entire content of `legal/parser.go` to `minirag/parser.go`

**Step 2:** Update package declaration: `package minirag`

**Step 3:** Remove `legal.` prefix from all internal function calls within parser.go (functions like `hasArticleMarkers`, `structuredChunking`, etc. are all within same package — they currently have no prefix; check if any use `legal.` qualifier and remove). The type `Chunk` remains as `Chunk` (no prefix needed).

**Step 4:** Commit chunk

```bash
git add internal/ai/minirag/parser.go
git commit -m "feat(minirag): add parser.go with legal document chunking (moved from legal)"
```

---

### Task 2: Update `minirag/indexer.go` to use local parser

**Files:**
- Modify: `internal/ai/minirag/indexer.go`

**Changes:**
- Remove import: `"github.com/PACTA-Team/pacta/internal/ai/legal"`
- Update comment on line 244: "Parse document into chunks using legal.ParseByArticles" → "Parse document into chunks using ParseByArticles"
- Update line 245: `chunks := legal.ParseByArticles(doc.Content)` → `chunks := ParseByArticles(doc.Content)`
- Update line 251 comment: "Add overlap between chunks using legal.MergeChunksWithOverlap" → "Add overlap between chunks using MergeChunksWithOverlap"
- Update line 252: `chunks = legal.MergeChunksWithOverlap(chunks, 50)` → `chunks = MergeChunksWithOverlap(chunks, 50)`

**Step 1:** Edit indexer.go as described

**Step 2:** Verify no `legal.` references remain

```bash
grep "legal\." internal/ai/minirag/indexer.go
# Should produce no output
```

**Step 3:** Commit

```bash
git add internal/ai/minirag/indexer.go
git commit -m "feat(minirag): use local ParseByArticles and MergeChunksWithOverlap"
```

---

### Task 3: Update `minirag/vector_db.go` to use local Chunk type

**Files:**
- Modify: `internal/ai/minirag/vector_db.go`

**Changes:**
- Remove import: `"github.com/PACTA-Team/pacta/internal/ai/legal"`
- Update function signature on line 187:
  From: `func (db *VectorDB) AddLegalDocumentChunks(chunks []legal.Chunk, metadata LegalDocumentMetadata, embeddings [][]float32) error {`
  To: `func (db *VectorDB) AddLegalDocumentChunks(chunks []Chunk, metadata LegalDocumentMetadata, embeddings [][]float32) error {`

**Step 1:** Edit vector_db.go — remove legal import and update parameter type

**Step 2:** Verify no `legal.` references

```bash
grep "legal\." internal/ai/minirag/vector_db.go
# Should produce no output
```

**Step 3:** Commit

```bash
git add internal/ai/minirag/vector_db.go
git commit -m "feat(minirag): use local Chunk type in AddLegalDocumentChunks"
```

---

### Task 4: Update `minirag/vector_db_test.go` to use local Chunk type

**Files:**
- Modify: `internal/ai/minirag/vector_db_test.go`

**Changes:**
- Line 77: `chunks := []legal.Chunk{` → `chunks := []Chunk{`
- Line 115: `chunks := []legal.Chunk{` → `chunks := []Chunk{`

**Step 1:** Edit vector_db_test.go with two replacements

**Step 2:** Verify no `legal.` references

```bash
grep "legal\." internal/ai/minirag/vector_db_test.go
# Should produce no output
```

**Step 3:** Commit

```bash
git add internal/ai/minirag/vector_db_test.go
git commit -m "test(minirag): use local Chunk type in vector_db tests"
```

---

### Task 5: Remove now-empty `legal/parser.go`

**Files:**
- Delete: `internal/ai/legal/parser.go`

**Reason:** All chunking logic moved to minirag. The legal package no longer needs parser.go. If legal package still requires any constants (MinChunkSize, etc.), they should import minirag if needed — but check first if legal uses any of those.

**Step 1:** Check if any file in `internal/ai/legal/` references the constants or functions from parser.go:

```bash
grep -r "MinChunkSize\|MaxChunkSize\|ParseByArticles\|MergeChunksWithOverlap" internal/ai/legal/
```

Expected: No matches (only chat_service.go exists besides parser.go and its test).

**Step 2:** If no references, delete parser.go

```bash
git rm internal/ai/legal/parser.go
git commit -m "remove: delete unused legal/parser.go after moving chunking to minirag"
```

**Step 3:** If references exist, note them and do NOT delete yet — bring to review.

---

### Task 6: Verify build locally (if Go available) or trust CI

**Build verification:**

If Go is available:

```bash
CGO_ENABLED=1 go build ./cmd/pacta
```

Expected: Success (no import cycle)

If Go not available locally, proceed to Task 7 (CI push will verify).

---

### Task 7: Push and monitor CI

**Commands:**

```bash
git push origin feature/minirag-hybrid-integration
gh run watch --branch feature/minirag-hybrid-integration --workflow build.yml
```

**Expected outcome:** All CI jobs pass (Build with CGo, Build without CGo, Test, Lint, etc.)

**If CI fails:** Pause and re-run diagnose workflow — new error will be different (likely unrelated type errors after move). Document and fix.

---

### Task 8: Run unit tests for affected packages

**Commands:**

```bash
go test ./internal/ai/minirag/... -v
go test ./internal/ai/legal/... -v
```

**Expected:** All tests pass. Pay special attention to:
- `indexer_test.go` — may reference parser functions (should still work)
- `vector_db_test.go` — updated to use Chunk
- `chat_service_test.go` — should still compile (legal imports minirag types, now no cycle)

---

### Task 9: Update documentation (if needed)

Check `docs/plans/2026-04-29-cuban-legal-expert-implementation.md` — architecture diagram may show parser in legal package. Update to reflect new location if necessary.

**Files to modify:**
- `docs/plans/2026-04-29-cuban-legal-expert-implementation.md` (search for "parser.go" or "Chunk struct")

**Commit:**

```bash
git add docs/plans/2026-04-29-cuban-legal-expert-implementation.md
git commit -m "docs: update architecture to reflect chunking moved to minirag"
```

---

### Task 10: Create regression test for import cycle prevention

**Optional but recommended:** Add a test that verifies no import cycles exist in `internal/ai` packages. Use `go list -f '{{if or (eq .DepsErrors []) (not (eq .DepsErrors nil))}}{{.ImportPath}}{{end}}'` or a simple build test.

Simpler: The CI build already catches cycles. No extra test needed.

---

### Task 11: Final verification and PR ready state

**Checklist:**
- [ ] Branch builds successfully locally (or CI passing)
- [ ] All package tests pass
- [ ] No `legal.` qualified references remain in minirag codebase
- [ ] `legal/parser.go` removed
- [ ] `minirag/parser.go` exists with correct package declaration
- [ ] No stale imports in other files

**Ready to merge:** Update PR description to note "Import cycle fixed: moved chunking infrastructure from legal to minirag".

---

## Rollback Plan

If build still fails after Task 7:
1. `git log --oneline -5` to see recent commits
2. Identify specific error (new cycle or type mismatch)
3. Re-run diagnose — likely missing reference or wrong type conversion
4. If stuck, revert last commit: `git revert HEAD` and re-evaluate

---

## Notes

- **No breaking changes to public API** — all chunking was internal to minirag
- Legal chat endpoints unchanged
- Database schema unchanged
- Frontend unaffected

**Plan saved to `docs/plans/2026-05-01-fix-import-cycle-minirag-legal.md`**
