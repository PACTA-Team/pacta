# Fix CI Build Failures — PR #301 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task.
> 
> WORKFLOW: For each task:
> 1. Dispatch implementer subagent with full task text & context
> 2. After commit, run spec-compliance review
> 3. Then run code-quality review
> 4. Fix any issues and re-review until both approve
> 5. Mark task complete in TodoWrite
> After all tasks, run final code review, then `finishing-a-development-branch`.

**Goal:** Resolve all compilation errors in PR #301 (feature/minirag-hybrid-integration) so the Go build succeeds in CI.

**Tech Stack:** Go (handlers, AI, legal), chi router, SQLite, CGo (llama.cpp), TypeScript/React frontend.

**Branch:** `feature/minirag-hybrid-integration`

**CI Run Reference:** 25242344523 (latest failure)

---

## Task 1 — Remove unused `"os"` import from handlers/ai.go

**Files:**
- `internal/handlers/ai.go`

**Step 1:** Delete line 11: `"os"`

**Step 2:** Verify no other references to `os` package exist in the file.

**Commit message:**
```
fix(handlers): remove unused os import in ai.go
```

---

## Task 2 — Fix named return shadowing in `getRAGConfig()`

**Files:**
- `internal/handlers/ai.go`

**Step 1:** Locate line ~136 inside `getRAGConfig()`:
```go
localMode := settings["local_mode"]
```

**Step 2:** Change to assignment to named return:
```go
localMode = settings["local_mode"]
```

**Step 3:** Ensure no other `:=` redeclarations of named returns exist in this function. Confirm all other assignments use `=` (they already do per inspection).

**Commit message:**
```
fix(handlers): assign to named return localMode instead of redeclaring
```

---

## Task 3 — Fix `h.Config` → `h.DataDir` in `getOrCreateVectorDB`

**Files:**
- `internal/handlers/ai.go`

**Step 1:** Locate line ~158:
```go
dataDir := h.Config.DataDir
```

**Step 2:** Replace with:
```go
dataDir := h.DataDir
```

**Step 3:** Verify no other `h.Config` references remain in file (grep confirms only one).

**Commit message:**
```
fix(handlers): use h.DataDir instead of nonexistent h.Config
```

---

## Task 4 — Discard unused `ctx` variables in three handlers

**Files:**
- `internal/handlers/ai.go`

**Changes:**

**HandleRAGLocal** (line ~488):
```diff
- ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
+ _, cancel := context.WithTimeout(r.Context(), 60*time.Second)
```

**HandleRAGHybrid** (line ~558):
```diff
- ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
+ _, cancel := context.WithTimeout(r.Context(), 90*time.Second)
```

**HandleRAGIndex** (line ~657):
```diff
- ctx, cancel := context.WithTimeout(r.Context(), 300*time.Second)
+ _, cancel := context.WithTimeout(r.Context(), 300*time.Second)
```

**Commit message:**
```
fix(handlers): discard unused context in RAG handlers
```

---

## Task 5 — Unified LLM interface abstraction

**Rationale:** `legal.NewChatService` expects `*ai.LLMClient` but handlers store `handlers.LLMClient` (interface). Type mismatch blocks compilation. Introduce a common interface `ai.LLM` to unify.

### **Task 5a — Add `ai.LLM` interface**

**File:** `internal/ai/client.go`

**Step 1:** After imports, before `// LLMClient` comment, add:
```go
// LLM is the minimal interface for language model generation.
type LLM interface {
    Generate(ctx context.Context, prompt string, context string) (string, error)
}
```

**Commit:** (can be separate or combined; combined preferred)

### **Task 5b — Alias `handlers.LLMClient` to `ai.LLM`**

**File:** `internal/handlers/handler.go`

**Step 1:** Replace local interface definition with alias:
```diff
-// LLMClient defines the interface for language model clients.
-type LLMClient interface {
-	Generate(ctx context.Context, prompt string, context string) (string, error)
-}
+// LLMClient is the interface for language model clients (aliased from ai.LLM).
+type LLMClient = ai.LLM
```

**Step 2:** Ensure imports include `"github.com/PACTA-Team/pacta/internal/ai"` (already present at line 11).

**Commit:** (same combined commit)

### **Task 5c — Change `legal.NewChatService` to accept `ai.LLM`**

**File:** `internal/ai/legal/chat_service.go`

**Step 1:** Update struct field and constructor:
```diff
 type ChatService struct {
 	db       *sql.DB
 	vectorDB *minirag.VectorDB
 	embedder *minirag.EmbeddingClient
-	llm      *ai.LLMClient
+	llm      ai.LLM
 }
 
-func NewChatService(db *sql.DB, vectorDB *minirag.VectorDB, embedder *minirag.EmbeddingClient, llm *ai.LLMClient) *ChatService {
+func NewChatService(db *sql.DB, vectorDB *minirag.VectorDB, embedder *minirag.EmbeddingClient, llm ai.LLM) *ChatService {
```

**Note:** Inside `ProcessMessage`, call `s.llm.Generate(...)` remains unchanged.

**Commit:** (same combined commit)

---

## Task 6 — Fix int → int64 conversion in `HandleLegalChatHistory`

**File:** `internal/handlers/ai.go`

**Step 1:** Locate the loop constructing `outMsg` (lines ~1519–1527).

**Step 2:** Change:
```diff
-		ID:          m.ID,
-		UserID:      m.UserID,
+		ID:          int64(m.ID),
+		UserID:      int64(m.UserID),
```

**Commit message:**
```
fix(handlers): convert int to int64 for JSON API in chat history
```

---

## Task 7 — Final integration check

**Actions:**
1. Ensure all tasks are committed on `feature/minirag-hybrid-integration`.
2. Push branch to remote.
3. Monitor CI workflow until completion.
4. If any new error appears, diagnose and fix iteratively (may require additional tasks).

**Success criteria:**
- Build job completes without errors.
- No new errors introduced.
- Binary compiled successfully.

---

## Rollback

For any task, if integration fails:
```bash
git revert <commit-hash>
```
Or use `git reset --hard HEAD~n` if still pending push.

---

## Notes

- All changes are source-level only; no schema or frontend changes.
- The LLM interface unification is backward-compatible: `*ai.LLMClient` still works where `ai.LLM` is expected.
- Tests rely on mockLLMClient; its method set matches `ai.LLM` implicitly, so no changes needed.
- No CGo changes; build remains identical.
