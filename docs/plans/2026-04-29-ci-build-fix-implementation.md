# CI Build Fix: Missing GGML Headers — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix CI build failure in PR #301 by correcting CGO_CFLAGS and CGO_LDFLAGS to include GGML headers and point to correct library directory.

**Architecture:** The Go binary embeds llama.cpp via CGo. The build workflow clones llama.cpp, builds it with CMake, then compiles the Go binary linking against libllama.a. The error occurs because the include path only covers `llama.cpp/include/` but `llama.h` includes `ggml.h` from `llama.cpp/ggml/include/`. Additionally, libraries are in `build/bin/` not `build/`.

**Tech Stack:** GitHub Actions, Go 1.25, CGo, llama.cpp (CMake build)

---

## Pre-Flight Checklist

**Project constraints from AGENTS.md:**
- ❌ DO NOT run `go build`, `go mod tidy`, `npm run build`, or compile locally
- ✅ CI handles all builds (GitHub Actions)
- ✅ We only edit workflow YAML files and push; CI validates

**Files to modify:**
- `.github/workflows/build.yml` — primary CI workflow
- `.github/workflows/release.yml` — release workflow (same fix)

**No local testing needed** — changes are CI-only. Validation: push → observe CI.

---

## Task 1: Update build.yml — Fix CGO_CFLAGS and CGO_LDFLAGS

**Files:**
- Modify: `.github/workflows/build.yml:71-76` (the "Build with CGo" step)

**Step 1:** Read current build.yml to locate the exact block

```bash
cat .github/workflows/build.yml | sed -n '70,80p'
```

Expected output shows:
```yaml
- name: Build with CGo (embedded Qwen2.5-0.5B)
  run: |
    export CGO_ENABLED=1
    export CGO_CFLAGS="-I$(pwd)/internal/ai/minirag/llama.cpp/include"
    export CGO_LDFLAGS="-L$(pwd)/internal/ai/minirag/llama.cpp/build -llama -lm -lstdc++ -lpthread"
    go build -o pacta ./cmd/pacta
  env:
    CGO_ENABLED: 1
```

**Step 2:** Replace CGO_CFLAGS and CGO_LDFLAGS in build.yml

Edit `.github/workflows/build.yml` lines 74-75:

**Old:**
```yaml
    export CGO_CFLAGS="-I$(pwd)/internal/ai/minirag/llama.cpp/include"
    export CGO_LDFLAGS="-L$(pwd)/internal/ai/minirag/llama.cpp/build -llama -lm -lstdc++ -lpthread"
```

**New:**
```yaml
    export CGO_CFLAGS="-I$(pwd)/internal/ai/minirag/llama.cpp/include \
                       -I$(pwd)/internal/ai/minirag/llama.cpp/ggml/include"
    export CGO_LDFLAGS="-L$(pwd)/internal/ai/minirag/llama.cpp/build/bin \
                        -lllama -lggml -lggml-base"
```

**Notes:**
- Use `\` for line continuation within quotes (YAML-safe)
- Add second `-I` for `ggml/include`
- Change `build/` → `build/bin/` in LDFLAGS
- Replace `-llama -lm -lstdc++ -lpthread` with proper link order: `-lllama -lggml -lggml-base`
  (CMake-built libllama already links system libs; explicit `-lm -lstdc++ -lpthread` unnecessary)

**Step 3:** Verify the edit

```bash
cat .github/workflows/build.yml | sed -n '70,80p'
```

Check that both flags are correctly updated over two lines each.

**Step 4:** Commit

```bash
git add .github/workflows/build.yml
git commit -m "fix(ci): add ggml include path and correct library path for llama.cpp CGo build

- CGO_CFLAGS now includes both llama/include and ggml/include
- CGO_LDFLAGS points to build/bin/ and links llama, ggml, ggml-base in order
- Fixes 'ggml.h: No such file or directory' compilation error in PR #301"
```

---

## Task 2: Update release.yml — Mirror the Same Fix

**Files:**
- Modify: `.github/workflows/release.yml` (find analogous "Build with CGo" step)

**Step 1:** Locate the Build with CGo step in release.yml

```bash
grep -n "Build with CGo" .github/workflows/release.yml
```

Note the line numbers (likely around 60-80).

**Step 2:** Show current block

```bash
sed -n 'START,ENDp'  # replace with actual lines from grep output
```

**Step 3:** Apply identical changes as in Task 1

Replace:
```yaml
    export CGO_CFLAGS="-I$(pwd)/internal/ai/minirag/llama.cpp/include"
    export CGO_LDFLAGS="-L$(pwd)/internal/ai/minirag/llama.cpp/build -llama -lm -lstdc++ -lpthread"
```

With:
```yaml
    export CGO_CFLAGS="-I$(pwd)/internal/ai/minirag/llama.cpp/include \
                       -I$(pwd)/internal/ai/minirag/llama.cpp/ggml/include"
    export CGO_LDFLAGS="-L$(pwd)/internal/ai/minirag/llama.cpp/build/bin \
                        -lllama -lggml -lggml-base"
```

**Step 4:** Verify

```bash
grep -A 3 "CGO_CFLAGS" .github/workflows/release.yml
grep -A 3 "CGO_LDFLAGS" .github/workflows/release.yml
```

**Step 5:** Commit

```bash
git add .github/workflows/release.yml
git commit -m "fix(ci): sync release workflow with build fixes for llama.cpp CGo

- Added ggml/include to CGO_CFLAGS
- Corrected library path to build/bin/ and link order
- Ensures release builds use same configuration as CI"
```

---

## Task 3: Push Branch and Observe CI

**Files:** None — git operations only

**Step 1:** Check branch and remote status

```bash
git branch -v
git remote -v
```

Expected: on `feature/minirag-hybrid-integration`, remote `origin` points to `PACTA-Team/pacta`

**Step 2:** Push commits to remote

```bash
git push origin feature/minirag-hybrid-integration
```

Expected: both commits pushed successfully.

**Step 3:** Verify PR #301 exists and includes new commits

```bash
gh pr view 301 --json number,title,headRefName,commits
```

Expected output: list of commits including the two new ones.

**Step 4:** Open CI runs page

```bash
gh run list --branch feature/minirag-hybrid-integration --limit 3
```

Observe new workflow runs triggered. Should show:
- Build workflow (running → completed)
- Check conclusion: SUCCESS (not FAILURE)

**Step 5:** Monitor until completion

```bash
# Poll until status changes
watch -n 10 'gh run list --branch feature/minirag-hybrid-integration --limit 3'
```

Or check specific run:
```bash
gh run view <run-id> --log
```

**Expected outcome:** 
- Build job completes without `ggml.h` error
- No linker errors about `-lllama`
- Binary `pacta` produced (confirmed by build log)
- All checks pass → PR mergeable

**Step 6:** Document result in terminal

If success:
```bash
echo "✅ CI PASSED — Fix validated"
```

If failure:
- Capture error log
- Return to systematic debugging (new hypothesis needed)
- Do NOT iterate fixes blindly

---

## Task 4: Update PR Description (Optional but Helpful)

**Files:** PR #301 description (via `gh` CLI)

**Step 1:** Append fix note to PR body

```bash
CURRENT_BODY=$(gh pr view 301 --json body -q .body)
NEW_BODY="$CURRENT_BODY

---

**CI Fix Applied** (2026-04-29)
- Fixed CGO_CFLAGS to include `ggml/include/` (ggml.h wasn't found)
- Corrected CGO_LDFLAGS to `build/bin/` with proper link order
- CI now passes ✅"
```

```bash
echo "$NEW_BODY" | gh pr edit 301 --body "$(cat)"
```

*Alternative:* Skip this; commit messages are sufficient.

**Step 2:** Close loop in implementation-summ Doc

If `docs/IMPLEMENTATION-SUMMARY.md` references this PR, ensure it notes the fix. But per YAGNI, skip unless already there.

---

## Verification Checklist

Before marking done:

- [ ] `build.yml` CGO_CFLAGS has **two** `-I` paths (include/ + ggml/include/)
- [ ] `build.yml` CGO_LDFLAGS uses `build/bin/` and `-lllama -lggml -lggml-base`
- [ ] `release.yml` has **same exact** changes
- [ ] Both files committed with clear messages
- [ ] Pushed to `feature/minirag-hybrid-integration`
- [ ] CI runs triggered on PR #301
- [ ] Build job completes successfully (check `gh run list`)
- [ ] No new failures introduced

✅ **If all checked:** Implementation complete.

---

## Rollback

If CI still fails after this fix:

```bash
# Revert both commits
git revert HEAD~2..HEAD
git push origin feature/minirag-hybrid-integration

# Start new debugging cycle with updated error logs
```

Do not stack additional fixes on top of failed attempt. Return to systematic-debugging.

---

## Notes for Engineer

- **No local build needed** — per AGENTS.md: "Local environment not configured; Go, Node, and all tooling only available in GitHub Actions"
- **Do not run `go build` locally** — it will fail due to missing llama.cpp build artifacts
- **Trust CI** — push changes and wait for GitHub Actions
- **Commit granularity:** One workflow file per commit (as shown above) keeps reverts clean
- **YAML syntax:** Ensure `\` line continuation stays **inside** the quotes; YAML multiline strings with `|` not needed here

---

**Design doc:** `docs/plans/2026-04-29-ci-build-fix-design.md`  
**Plan created:** 2026-04-29  
**Estimate:** 5 min implementation + CI wait time (~5 min)
