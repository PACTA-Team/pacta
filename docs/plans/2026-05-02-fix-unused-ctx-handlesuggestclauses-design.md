# Fix: Remove unused ctx variable in HandleSuggestClauses

**Date:** 2026-05-02
**PR:** #301
**Issue:** CI build failure — `internal/handlers/ai.go:1438:2: declared and not used: ctx`

---

## Problem

CI build for PR #301 fails with:
```
internal/handlers/ai.go:1438:2: declared and not used: ctx
Process completed with exit code 1.
```

The `HandleSuggestClauses` function declares `ctx := r.Context()` but never uses it.

---

## Root Cause

Incomplete refactoring from commit `81558f4` ("fix(handlers): discard unused ctx in RAG handlers").

That commit fixed unused `ctx` in three handlers:
- `HandleRAGLocal`
- `HandleRAGHybrid`
- `HandleRAGIndex`

But missed `HandleSuggestClauses`, which has the same pattern.

---

## Solution

Remove line 1438: `ctx := r.Context()`

The function does not use context for:
- Database queries (all calls use `h.DB` directly)
- Cancellation (no `WithTimeout` or `WithCancel`)
- Passing to downstream functions

Therefore removal is safe and matches the established pattern.

---

## Changes

**File:** `internal/handlers/ai.go`

```diff
@@ -1435,7 +1435,6 @@ func (h *Handler) HandleLegalDocumentsDelete(w http.ResponseWriter, r *http.Reque
 }
 
 // HandleSuggestClauses returns suggested clauses based on contract type
 func (h *Handler) HandleSuggestClauses(w http.ResponseWriter, r *http.Request) {
-	ctx := r.Context()
 	contractType := r.URL.Query().Get("type")
 	if contractType == "" {
 		h.Error(w, http.StatusBadRequest, "Query parameter 'type' is required")
```

---

## Verification

**CI Build:** Pass after fix
**Go vet:** Should show no unused variable warnings
**No functional change:** Runtime behavior identical

---

## Related

- Commit `81558f4` — same fix applied to other RAG handlers
- Pattern: Unused context variables should be removed rather than discarded with `_`
