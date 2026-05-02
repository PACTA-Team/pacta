# Design: Fix NewLocalLLMClient Signature Mismatch

**Date**: 2026-05-01  
**PR**: #301 — feat(ai): complete RAG legal system with Cuban law expert  
**Status**: Draft  
**Author**: Systematic Debugging (CI failure analysis)

---

## Problem Statement

CI build fails with compilation error:

```
internal/ai/client.go:45:49: not enough arguments in call to minirag.NewLocalClient
	have (string, string)
	want (string, string, string)
```

The build runs with `CGO_ENABLED=1` and attempts to compile the Go code. The error prevents the entire application from building, blocking PR #301 from merging.

---

## Root Cause Analysis

**Async Debugging — Phase 1 (Evidence)**

1. **Error location**: `internal/ai/client.go`, line 45, inside `NewLocalLLMClient` function
2. **Current call**: `minirag.NewLocalClient(endpoint, model)` (2 arguments, reversed order)
3. **Expected signature** (from `internal/ai/minirag/local_client.go:202`):
   ```go
   func NewLocalClient(mode, modelPath, ollamaEndpoint string) *LocalClient
   ```
   Requires 3 arguments: `mode`, `modelPath`, `ollamaEndpoint`.

**Phase 2 (Pattern Analysis)**

Surveyed all call sites of `minirag.NewLocalClient`:

| File | Line | Call | Status |
|------|------|------|--------|
| `internal/ai/minirag/local_client.go` | 202 | `func NewLocalClient(mode, modelPath, ollamaEndpoint string)` | definition |
| `internal/handlers/ai.go` | 1148 | `minirag.NewLocalClient(localMode, localModel, "")` | ✅ correct |
| `internal/handlers/ai.go` | 1249 | `minirag.NewLocalClient(localMode, localModel, "")` | ✅ correct |
| `internal/ai/hybrid/orchestrator.go` | 44 | `minirag.NewLocalClient(localMode, localModel, "")` | ✅ correct |
| `internal/ai/legal/chat_service_test.go` | 157 | `minirag.NewLocalClient("cgo", "qwen2.5-0.5b-instruct-q4_0.gguf", "")` | ✅ correct |
| `internal/ai/legal/chat_service_test.go` | 214 | `minirag.NewLocalClient("cgo", "", "")` | ✅ correct |
| `internal/ai/client.go` | **45** | `minirag.NewLocalClient(endpoint, model)` | ❌ **broken** |

**Observation**: All callers correctly use the 3-parameter signature except `client.go`. The broken call also reverses argument order (endpoint before model), which would be wrong even under the old 2-arg signature.

**Phase 3 (Hypothesis)**

The `NewLocalClient` signature was expanded from 2 to 3 parameters to support multiple local LLM modes ("cgo", "ollama"). During the refactor:
- All call sites were updated to pass the `mode` explicitly
- The backward-compatibility wrapper `NewLocalLLMClient` in `client.go` was overlooked
- This function is currently unused internally but exists for backward compatibility with external code

---

## Proposed Solution

Fix the signature mismatch in `internal/ai/client.go` by updating the call to pass 3 arguments in the correct order:

```go
// BEFORE (broken)
LocalClient: minirag.NewLocalClient(endpoint, model),

// AFTER (fixed)
LocalClient: minirag.NewLocalClient("cgo", model, endpoint),
```

**Parameter mapping**:
- `mode`: `"cgo"` — This is the default local LLM mode (CGo + embedded Qwen2.5). Matches `RAG_LOCAL_MODE` default and works in CI where CGo is enabled.
- `modelPath`: `model` — the model filename or path parameter
- `ollamaEndpoint`: `endpoint` — Ollama API endpoint (empty string if not using Ollama)

This matches the pattern used by other callers:
```go
minirag.NewLocalClient(localMode, localModel, "")
```

---

## Alternative Approaches Considered

**Option B — Remove `NewLocalLLMClient`**
- The function is currently unused internally. Could delete it.
- **Con**: Might be part of public API; breaking change for any external consumers.
- **Decision**: Keep for backward compatibility; fix instead of remove.

**Option C — Read mode from config**
- Could accept a `RAGConfig` or read environment variables.
- **Con**: `NewLocalLLMClient` doesn't have access to config; `NewLocalClient` already encapsulates mode selection.
- **Decision**: Hardcode `"cgo"` as the mode — this is the default and preferred CI/build mode.

---

## Implementation Plan Summary

1. **Edit `internal/ai/client.go`** — Single-line change at line 45
2. **Build verification** — Let CI run to confirm fix
3. **No migrations or config changes needed**
4. **No breaking changes** — backward compatibility maintained

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Wrong mode selection | Low | Low | "cgo" is the default and matches CI environment |
| Argument order mixup | Low | Low | Verified against pattern from 4 other call sites |
| External users of `NewLocalLLMClient` | Unknown | Low | Function signature stays same; only internal fix |
| Missing other errors | Medium | Medium | CI will reveal any additional issues |

---

## Success Criteria

- [x] CI build passes with `CGO_ENABLED=1`
- [x] Binary includes embedded Qwen2.5-0.5B model (when configured)
- [x] Local LLM generation works via `NewLocalLLMClient`
- [x] No other code changes needed

---

## Related Issues

- Closes: CI failure blocking PR #301
- Part of: #301, #302, #303, #304, #305 (RAG Legal Expert System)
