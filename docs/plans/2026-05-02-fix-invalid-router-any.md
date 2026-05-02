# Implementation Plan: Fix Invalid chi Router Any() Method

## Overview

Fix CI build failure in PR #301 caused by using non-existent `r.Any()` method on `chi.Router`. Replace with `r.Handle()` and ensure proper code style/indentation.

## Problem Statement

CI build fails with:
```
internal/server/server.go:141:6: r.Any undefined (type chi.Router has no field or method Any)
```

## Root Cause

- `chi.Router` v5.2.5 does not have an `Any()` method
- Incorrect method used: `r.Any("/legal/*", h.HandleAI)`
- Correct approach: Use `r.Handle()` for catch-all HTTP method routing
- The `HandleAI` handler internally switches on `r.Method`, so `Handle` is semantically correct

## Architecture Context

- **File:** `internal/server/server.go`
- **Router:** chi/v5 v5.2.5
- **Handler:** `HandleAI` signature: `func (h *Handler) HandleAI(w http.ResponseWriter, r *http.Request)`
- **Pattern:** `/legal/*` (wildcard path under `/api/ai/legal/` route group)
- **Scope:** Single-line fix, no API changes, no runtime behavior change

## Prerequisites

- Repository: `/home/mowgli/pacta`
- Current branch: `feature/minirag-hybrid-integration`
- Chi version: v5.2.5 (confirmed in go.mod)
- **Constraint:** No local Go builds (CI-only per AGENTS.md); verification via CI after push
- Tooling: `git`, `gh` CLI configured

---

## Implementation Steps

### Phase 1: Code Fix (1 file, 1 line)

#### Task 1: Inspect current state and verify the issue

**Objective:** Confirm the problematic code and understand the surrounding context.

**Actions:**
1. Read `internal/server/server.go` around line 141
2. Verify that line currently reads: `r.Any("/legal/*", h.HandleAI)`
3. Note indentation pattern: Should be 3 tabs (consistent with surrounding `r.Post`, `r.Get` lines)

**Expected:** 
- Line 141 contains `r.Any`
- Indentation is `^I^I^I` (3 tabs) like other route registrations in the block

**Risk:** Low — pure inspection

---

#### Task 2: Apply the fix — replace `r.Any` with `r.Handle` (correct indentation)

**Objective:** Change method call while preserving project's tab-based indentation style.

**File:** `internal/server/server.go:141`

**Step 1:** Locate the exact line:
```go
			r.Any("/legal/*", h.HandleAI)  // Current (incorrect)
```

The line uses 3 tabs (`^I^I^I`) for indentation followed by `r.Any(...)`.

**Step 2:** Replace with correct method:
```go
			r.Handle("/legal/*", h.HandleAI)  // Fixed (correct indentation)
```

**Important:** Preserve the 3-tab indentation. Do NOT change to spaces or reduce tabs.

**Step 3:** Verify that the surrounding lines maintain consistent indentation:
```go
			r.Post("/rag/status", h.HandleRAGStatus)

			// Legal AI endpoints (Cuban expert)
			r.Handle("/legal/*", h.HandleAI)  ← should be 3 tabs
		})
```

**Step 4:** Save file

**Expected:** 
- Only change is `.Any` → `.Handle`
- Indentation unchanged (3 tabs)
- No other modifications

**Risk:** Low — single-line change, straightforward

---

### Phase 2: Validation & Safety Checks

#### Task 3: Search for any other `.Any(` usage in Go codebase

**Objective:** Ensure no other occurrences of this error exist.

**Actions:**
1. Run: `grep -r "\.Any(" --include="*.go" /home/mowgli/pacta`
2. Verify output is empty
3. If any matches found, flag for separate fix (out of scope for this plan)

**Expected:** No matches in `.go` files

**Risk:** Low — quick grep search

---

#### Task 4: Verify `HandleAI` handler signature matches `r.Handle` requirements

**Objective:** Ensure handler type compatibility.

**Actions:**
1. Open `internal/handlers/ai.go`
2. Confirm `HandleAI` signature: `func (h *Handler) HandleAI(w http.ResponseWriter, r *http.Request)`
3. This matches `http.HandlerFunc` — compatible with `r.Handle()`

**Expected:** Signature confirmed, no changes needed

**Risk:** None — verification only

---

### Phase 3: Commit & Push

#### Task 5: Stage and commit the fix

**Objective:** Create a clean, descriptive commit.

**Actions:**
```bash
# Stage the modified file
git add internal/server/server.go

# Create commit with clear message
git commit -m "fix(server): replace invalid r.Any with r.Handle for chi v5 compatibility

The chi v5.2.5 Router does not have an Any() method.
Use Handle() for catch-all HTTP method routing.
The HandleAI handler internally dispatches by method, so this is semantically correct.

Fixes CI build failure in PR #301:
  internal/server/server.go:141:6: r.Any undefined"
```

**Expected:** Commit created locally with message as above

**Risk:** Low — standard git workflow

---

#### Task 6: Push to remote branch

**Objective:** Push commit to GitHub for CI.

**Actions:**
```bash
# Verify branch
git branch

# Push to same branch (already on feature/minirag-hybrid-integration)
git push origin feature/minirag-hybrid-integration
```

**Expected:** Push succeeds, CI workflow triggered automatically

**Risk:** Low — standard push

---

#### Task 7: Monitor CI build

**Objective:** Verify build passes.

**Actions:**
```bash
# Watch CI checks for the PR
gh pr checks --watch

# OR list recent runs
gh run list --branch feature/minirag-hybrid-integration --limit 3
```

**Expected:** Build workflow completes with `success` status

**If failure:** 
- Review logs: `gh run view <run-id> --log`
- If same error persists, fix and repeat Tasks 5-7
- If new error, investigate separately (out of scope)

**Risk:** Medium — may require iteration if fix incomplete

---

### Phase 4: PR Completion (Optional, if ready to merge)

**Note:** PR #301 may not be ready for full merge yet if other work remains. This step is informational.

#### Task 8: Prepare PR for merge (if all CI passes and approvals in place)

**Actions:**
1. Ensure all required reviews approved
2. Ensure all CI checks green
3. Squash merge via GitHub UI or:
   ```bash
   gh pr merge --squash --delete-branch
   ```

**Expected:** PR merged to main, branch deleted

---

## Testing Strategy

**No new tests added** — fix is a one-line API correction, existing handler tests cover `HandleAI` behavior.

**Compilation as test:**
- `go build ./...` must succeed (enforced by CI)
- `go vet ./...` must not report errors on changed file

**CI verification:**
- Build workflow passes (frontend build + Go build + Go vet)
- No "undefined method" errors

---

## Commits

**Single commit expected:**
```
fix(server): replace invalid r.Any with r.Handle for chi v5 compatibility
```

**Files changed:**
- `internal/server/server.go` (1 line modified, indentation preserved)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Indentation regression | Low | Low | Explicitly preserve 3-tab indentation; verify against surrounding lines |
| Other `.Any(` usage missed | Low | Medium | Grep search Task 3; if found, create separate issue/plan |
| CI fails for unrelated reasons | Medium | Low | Check logs; if unrelated to this change, investigate separately |
| Handler signature mismatch | None | None | Verified in Task 4 — signature is correct |

---

## Success Criteria

- [ ] `internal/server/server.go` line 141 changed from `r.Any` to `r.Handle`
- [ ] Indentation matches surrounding route registrations (3 tabs)
- [ ] No other `.Any(` calls in any `.go` file
- [ ] Commit pushed to `feature/minirag-hybrid-integration`
- [ ] CI Build workflow passes (Green check on PR)
- [ ] No new compiler warnings or vet issues introduced

---

## Rollback

If the change causes unexpected issues:

```bash
# Revert the commit
git revert <commit-hash>
git push origin feature/minirag-hybrid-integration

# Or reset to pre-change state (if merge not yet done)
git reset --hard HEAD~1
git push --force-with-lease origin feature/minirag-hybrid-integration
```

Given the minimal change and CI verification, rollback likelihood is very low.

---

## Related References

- Chi router docs: `github.com/go-chi/chi/v5` — `Router.Handle(pattern string, h http.Handler)`
- chi v5 migration guide: No `Any()` method exists; use `Handle` or `HandleFunc`
- Current chi version: v5.2.5 (go.mod)
- Handler code: `internal/handlers/ai.go:164` (`HandleAI`)

---

## Appendix: Chi Router Method Comparison

| Method | Purpose | Signature |
|--------|---------|-----------|
| `Get` | Register GET only | `Get(string, http.HandlerFunc)` |
| `Post` | Register POST only | `Post(string, http.HandlerFunc)` |
| `Handle` | Register ANY method (catch-all) | `Handle(string, http.Handler)` |
| `HandleFunc` | Register ANY method with func | `HandleFunc(string, http.HandlerFunc)` |
| `Any` | **Does not exist** | — |

**Pattern used in this codebase:** `HandleAI` switches on `r.Method`, so parent route should use `Handle` (method-agnostic).

---

**Plan created:** 2026-05-02  
**Author:** Kilo  
**Design Ref:** `docs/plans/2026-05-02-fix-invalid-router-any-design.md`  
**Related PR:** #301
