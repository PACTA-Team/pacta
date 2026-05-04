# Design: Fix Undefined SystemPromptCubanLegalExpert in Chat Service

**Date**: 2026-05-01  
**PR**: #301 — feat(ai): complete RAG legal system with Cuban law expert  
**Status**: Draft  
**Author**: Systematic Debugging (CI failure analysis, second error)

---

## Problem Statement

CI build fails after fixing `NewLocalClient` signature. New error:

```
internal/ai/legal/chat_service.go:81:18: undefined: SystemPromptCubanLegalExpert
```

The compiler cannot find the identifier `SystemPromptCubanLegalExpert` at the call site.

---

## Root Cause Analysis

**Phase 1 — Evidence**

- **File**: `internal/ai/legal/chat_service.go`
- **Line**: 81
- **Code**: `systemPrompt := SystemPromptCubanLegalExpert()`
- **Error type**: "undefined" — symbol not found in current scope

**Package structure**:
```
internal/ai/
├── prompts.go              (package ai) — defines SystemPromptCubanLegalExpert()
├── legal/
│   └── chat_service.go     (package legal) — calls SystemPromptCubanLegalExpert()
```

**Import statement** in `chat_service.go` (line 12):
```go
import "github.com/PACTA-Team/pacta/internal/ai"
```
This imports package `ai` with the default alias `ai`.

**Phase 2 — Pattern Analysis**

In the **same file**, all references to symbols from the `ai` package are correctly qualified:
- Line 22: `llm *ai.LLMClient` ✅
- Line 50: `func NewChatService(..., llm *ai.LLMClient)` ✅
- Line 62: `db.CreateLegalChatMessage` — `db` is also imported → ✅
- **Line 81**: `SystemPromptCubanLegalExpert()` ❌ **missing `ai.` prefix**

The function is defined in `internal/ai/prompts.go` (package `ai`):
```go
func SystemPromptCubanLegalExpert() string { ... }  // Exported (capitalized)
```

**Phase 3 — Hypothesis**

> The call to `SystemPromptCubanLegalExpert()` lacks the required package qualifier `ai.`. Go compiler searches the current package (`legal`) and global identifiers, does not find it, and reports "undefined".  
> **Fix**: Change to `ai.SystemPromptCubanLegalExpert()`.

---

## Proposed Solution

Update line 81 in `internal/ai/legal/chat_service.go`:

```diff
-	systemPrompt := SystemPromptCubanLegalExpert()
+	systemPrompt := ai.SystemPromptCubanLegalExpert()
```

This matches the import pattern used elsewhere in the file and correctly references the exported function from package `ai`.

---

## Alternative Approaches Considered

**Option B — Blank import** (`import . "github.com/PACTA-Team/pacta/internal/ai"`):
- Would make all `ai` symbols available without prefix
- **Con**: Anti-pattern; pollutes namespace; makes code ambiguous
- **Decision**: Reject — violates explicitness principle

**Option C — Move function to `legal` package**:
- Would make it directly accessible
- **Con**: Violates separation of concerns; `prompts.go` is in `ai` for a reason; duplicates logic
- **Decision**: Reject — architectural violation

**Option D — Create local alias**:
```go
promptFunc := ai.SystemPromptCubanLegalExpert
```
- Overkill for single call
- **Decision**: Reject — YAGNI

---

## Implementation Plan Summary

1. **Edit** `internal/ai/legal/chat_service.go:81` — add `ai.` prefix
2. **Commit** with clear message
3. **Push** → CI re-run
4. **Verify** build succeeds

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Function does not exist | Low | Low | Already verified: exists in prompts.go, exported |
| Wrong package alias | Low | Low | Import uses default alias `ai`; consistent with other uses in file |
| Missing import | Low | Low | Import already present on line 12 |
| More undefined symbols | Medium | Medium | Compiler will catch any others; fix iteratively |

---

## Success Criteria

- [ ] CI build completes without "undefined" errors
- [ ] Binary compiles successfully with CGo enabled
- [ ] No new errors introduced

---

## Related

- **Follow-up to**: commit `f64c434` — fixed `NewLocalClient` signature
- **Original PR**: #301 (RAG Legal Expert System)
- **Files touched**: `internal/ai/legal/chat_service.go` (1 line)
