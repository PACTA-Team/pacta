# Fix NewLocalLLMClient Signature Mismatch — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or `subagent-driven-development` to implement this plan task-by-task.

**Goal:** Fix the CI build failure by correcting the `minirag.NewLocalClient` call in `NewLocalLLMClient` to use the 3-parameter signature.

**Architecture:** Single-line fix in the AI client wrapper to match the updated LocalClient constructor signature (mode, modelPath, ollamaEndpoint).

**Tech Stack:** Go (no external dependencies), CI build with CGo enabled.

---

## Task Breakdown

### Task 1: Verify the exact code change needed

**Files:**
- Read: `internal/ai/client.go:38-47`
- Read: `internal/ai/minirag/local_client.go:198-210`

**Step 1:** Open and examine the two code sections to confirm parameter mapping.

**Expected:** Confirm that `NewLocalClient` requires `(mode, modelPath, ollamaEndpoint)` and that current call uses `(endpoint, model)`.

**Step 2:** Determine correct arguments for the wrapper:
- `mode`: `"cgo"` (default local mode, matches CI/CGo build)
- `modelPath`: the `model` parameter passed to `NewLocalLLMClient`
- `ollamaEndpoint`: the `endpoint` parameter passed to `NewLocalLLMClient`

**Step 3:** Write the corrected line:
```go
LocalClient: minirag.NewLocalClient("cgo", model, endpoint),
```

**Step 4:** Commit verification — ensure no other changes needed in this function.

---

### Task 2: Apply the fix to internal/ai/client.go

**Files:**
- Modify: `internal/ai/client.go:45`

**Step 1:** Read current content of lines 38–47 to capture context.

**Step 2:** Replace the broken call:
```diff
-		LocalClient: minirag.NewLocalClient(endpoint, model),
+		LocalClient: minirag.NewLocalClient("cgo", model, endpoint),
```

**Step 3:** Save the file and verify syntax by re-reading the modified function.

**Step 4:** Commit with message:
```
fix(ai): correct NewLocalClient call signature in NewLocalLLMClient

The minirag.NewLocalClient signature changed from 2 to 3 parameters
(mode, modelPath, ollamaEndpoint). The backward-compatibility wrapper
was not updated, causing CI build failure.

Change: pass "cgo" as mode (default), then model, then endpoint.
```
```bash
git add internal/ai/client.go
git commit -m "fix(ai): correct NewLocalClient call signature in NewLocalLLMClient"
```

---

### Task 3: Static verification & CI handoff

**Files:**
- Optional: `internal/ai/client.go` (re-read)

**Step 1:** Re-read the modified function to ensure no syntax errors introduced.

**Step 2:** Verify all other files remain unchanged.

**Step 3:** Push the commit to remote:
```bash
git push origin feature/minirag-hybrid-integration
```

**Step 4:** Monitor GitHub Actions workflow for this branch. The build job should now complete successfully.

**Success criteria:**
- GitHub Actions run for this commit shows `Build completed: success`
- No other compilation errors appear
- PR #301 can be merged once other reviews are complete

---

## Testing Notes

No new tests required; this is a signature fix. Existing compilation in CI is the validation.

If desired, a unit test could be added to verify `NewLocalLLMClient` returns a non-nil `LocalClient` with mode "cgo". However, the function is currently unused internally and YAGNI applies.

---

## Rollback Plan

If the fix causes regressions:
```bash
git revert <commit-hash>
```
The change is isolated to one line; rollback is trivial.

---

## Related Context

- **PR**: #301 — feat(ai): complete RAG legal system with Cuban law expert
- **Design doc**: `docs/plans/2026-05-01-fix-newlocalllmclient-signature-design.md`
- **CI run**: 25241396170 (failed with signature mismatch)
- **Local client definition**: `internal/ai/minirag/local_client.go`
- **Other call sites**: `internal/handlers/ai.go`, `internal/ai/hybrid/orchestrator.go`, test files
