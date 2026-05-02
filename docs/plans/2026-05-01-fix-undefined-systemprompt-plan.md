# Fix Undefined SystemPromptCubanLegalExpert — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or `subagent-driven-development` to implement this plan task-by-task.

**Goal:** Fix the "undefined: SystemPromptCubanLegalExpert" compilation error by adding the missing `ai.` package qualifier.

**Architecture:** Single-line syntax fix — the function is defined in package `internal/ai/prompts.go` but called without the required package qualifier in package `internal/ai/legal/chat_service.go`.

**Tech Stack:** Go (no dependencies), standard compiler error.

---

## Task Breakdown

### Task 1: Verify symbol definition and usage

**Files:**
- Confirm definition: `internal/ai/prompts.go:91-92`
- Confirm usage: `internal/ai/legal/chat_service.go:81`

**Step 1:** Open `prompts.go` at lines 91–92 to verify:
```go
func SystemPromptCubanLegalExpert() string {
```
Expected: Function is **exported** (capitalized) and in package `ai`.

**Step 2:** Open `chat_service.go` at lines 1–15 to verify imports. Expected:
```go
import (
    ...
    "github.com/PACTA-Team/pacta/internal/ai"
    ...
)
```
The alias for this import is `ai`.

**Step 3:** Confirm line 81 currently reads:
```go
systemPrompt := SystemPromptCubanLegalExpert()
```
(no prefix)

**Step 4:** Check for **any other unqualified references** to `ai` package symbols in the same file. Search for `SystemPrompt`, `ValidationPrompt`, `BuildValidation` without `ai.` prefix.

**Expected finding**: Only this one occurrence.

---

### Task 2: Apply the one-line fix

**Files:**
- Modify: `internal/ai/legal/chat_service.go:81`

**Step 1:** Re-read the function context (lines 78–85) to ensure proper replacement scope.

**Step 2:** Replace the line:
```diff
-	systemPrompt := SystemPromptCubanLegalExpert()
+	systemPrompt := ai.SystemPromptCubanLegalExpert()
```

**Step 3:** Save file and re-read to confirm change.

**Step 4:** Commit with message:
```
fix(ai): qualify SystemPromptCubanLegalExpert call with ai. package

The function is defined in internal/ai/prompts.go (package ai). The
legal chat service imports internal/ai with alias "ai", therefore all
references must be qualified as ai.SymbolName. The unqualified call
caused "undefined" compiler error.
```
```bash
git add internal/ai/legal/chat_service.go
git commit -m "fix(ai): qualify SystemPromptCubanLegalExpert call with ai. package"
```

---

### Task 3: Push and monitor CI

**Step 1:** Push the commit to the remote branch:
```bash
git push origin feature/minirag-hybrid-integration
```

**Step 2:** Watch the GitHub Actions workflow start:
```bash
gh run watch --interval 10
```
Or poll with:
```bash
gh run list --limit 1 --json status,conclusion,headBranch
```

**Step 3:** When the Build job completes:
- **If `success`**: Fix resolved. Proceed to next CI task or close debugging cycle.
- **If `failure`**: Download logs (`gh run view <id> --log-failed`) and check for new errors. Return to Task 1 (diagnose next issue).

**Expected**: Build completes without undefined symbol errors.

---

## Testing Notes

No unit test needed — compilation failure is caught by CI. The build itself is the test.

Optional: Run local `go build` to verify before pushing (if Go toolchain available):
```bash
CGO_ENABLED=1 go build ./cmd/pacta
```
But CI is the source of truth (matches project config).

---

## Rollback

If this change introduces issues:
```bash
git revert <commit-hash>
```
One-line change — trivial to revert.

---

## Related

- **Chained after**: `f64c434` — fixed `NewLocalClient` signature mismatch
- **Design doc**: `docs/plans/2026-05-01-fix-undefined-systemprompt-design.md`
- **CI run**: 25241886569 (showed undefined error)
- **Root cause**: Missing package qualifier on external symbol call
