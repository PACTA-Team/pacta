# Design Document: Fix CI Build Failure - Missing GGML Headers

**PR:** #301 — feat(ai): replace Phi-3.5 with Qwen2.5-0.5B-Instruct  
**Date:** 2026-04-29  
**Status:** Approved  
**Problem:** CI build fails with `fatal error: ggml.h: No such file or directory`

---

## Problem Statement

The GitHub Actions workflow for PR #301 fails during the "Build with CGo (embedded Qwen2.5-0.5B)" step with the error:

```
internal/ai/minirag/llama.cpp/include/llama.h:4:10: fatal error: ggml.h: No such file or directory
```

The Go code uses CGo to interface with llama.cpp, but the compiler cannot find required GGML headers that `llama.h` includes.

---

## Root Cause Analysis

### Investigation
- **Build workflow** successfully clones and builds llama.cpp via CMake
- **CGO_CFLAGS** only specifies: `-I$(pwd)/internal/ai/minirag/llama.cpp/include`
- **llama.h** (located in `include/`) contains: `#include "ggml.h"` and other GGML includes
- **ggml.h** resides in `llama.cpp/ggml/include/`, not in `include/`
- **Additional headers needed:** `ggml-cpu.h`, `ggml-backend.h`, `ggml-opt.h`, `gguf.h`

### Directory Structure (llama.cpp)
```
llama.cpp/
├── include/llama.h              ← found by CGO_CFLAGS ✓
├── ggml/include/ggml.h          ← MISSING from CGO_CFLAGS ❌
├── ggml/include/ggml-cpu.h      ← MISSING
├── ggml/include/ggml-backend.h  ← MISSING
├── ggml/include/ggml-opt.h      ← MISSING
├── ggml/include/gguf.h          ← MISSING
└── build/bin/libllama.a         ← built libraries (not in CGO_LDFLAGS path)
```

### Secondary Issue
`CGO_LDFLAGS` points to `build/` but CMake outputs libraries to `build/bin/`:
- Current: `-L$(pwd)/internal/ai/minirag/llama.cpp/build`
- Correct: `-L$(pwd)/internal/ai/minirag/llama.cpp/build/bin`

This would cause linker errors after fixing includes.

---

## Proposed Solution

### Changes Required

Update **both** `.github/workflows/build.yml` and `.github/workflows/release.yml`:

#### 1. Fix CGO_CFLAGS (include paths)
```yaml
- name: Build with CGo (embedded Qwen2.5-0.5B)
  run: |
    export CGO_ENABLED=1
    export CGO_CFLAGS="-I$(pwd)/internal/ai/minirag/llama.cpp/include \
                       -I$(pwd)/internal/ai/minirag/llama.cpp/ggml/include"
    export CGO_LDFLAGS="-L$(pwd)/internal/ai/minirag/llama.cpp/build/bin \
                        -lllama -lggml -lggml-base"
    go build -o pacta ./cmd/pacta
```

#### 2. Linker flags (library path and order)
- Path: `build/bin/` (not `build/`)
- Libraries: `-lllama -lggml -lggml-base` (dependency order)

### Why This Works

1. **Two include directories** satisfy all header imports from `llama.h`
2. **Correct library path** matches CMake's output location
3. **Proper link order** resolves dependencies (llama → ggml → ggml-base)

---

## Alternatives Considered

| Option | Description | Reason Rejected |
|--------|-------------|-----------------|
| 1: Fix includes only | Only add `ggml/include` to CGO_CFLAGS | Would fail at link step (wrong library path) |
| 2: Fix both includes + lib path | Full fix (recommended) | ✅ |
| 3: Add validation step | Check library existence before build | Unnecessary; CI failure is clear enough |

---

## Implementation Steps

1. Update `.github/workflows/build.yml` — CGO_CFLAGS and CGO_LDFLAGS
2. Update `.github/workflows/release.yml` — same changes
3. Commit and push to `feature/minirag-hybrid-integration`
4. Verify CI passes on PR #301
5. No local testing needed (can't build CGo locally per project rules)

---

## Rollback Plan

If issues arise:
- Revert the two workflow file changes
- Original CI state (pre-fix) is known and recoverable

---

## Success Criteria

✅ **Build completes** without header or linker errors  
✅ **Binary produced** at `./pacta`  
✅ **All CI checks** pass on PR #301  
✅ **No changes** to Go source code required  

---

## References

- [llama.cpp include structure](https://github.com/ggml-org/llama.cpp/blob/master/include/llama.h)
- [CMake configuration](https://github.com/ggml-org/llama.cpp/blob/master/CMakeLists.txt)
- [Project AGENTS.md — CGo embedding procedure](/home/mowgli/pacta/AGENTS.md#cgo-embedding-qwen25-05b-instruct)
