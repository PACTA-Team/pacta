# Design: Fix Windows Build Pipeline - goversioninfo Icon Path

**Date:** 2026-04-08
**Status:** Approved

## Problem

The `Build PACTA Launcher` step in the Windows build workflow fails because `goversioninfo` cannot resolve relative paths with `..` traversal on Windows GitHub Actions runners.

### Failure Chain (5 iterations)

| # | Error | Root Cause |
|---|-------|------------|
| 1 | `goversioninfo: command not found` (exit 127) | `$HOME/go/bin` not in PATH |
| 2 | `Cannot open "versioninfo.json"` (exit 1) | File named `version.json` |
| 3 | `../../src/images/contract_icon.ico: not found` (exit 3) | Forward slashes on Windows |
| 4 | `..\..\src\images\contract_icon.ico: not found` (exit 3) | Backslashes also fail |
| 5 | Same as #4 | Path traversal unreliable |

## Solution

Two coordinated changes:

### 1. `versioninfo.json` - Simplify icon path
- **Before:** `"IconPath": "..\\..\\src\\images\\contract_icon.ico"`
- **After:** `"IconPath": "contract_icon.ico"`

### 2. `build-binaries.yml` - Copy icon before build
Add step before `goversioninfo`:
```bash
cp src/images/contract_icon.ico package/windows/launcher/contract_icon.ico
```

## Files Changed
- `package/windows/launcher/versioninfo.json` (1 line)
- `.github/workflows/build-binaries.yml` (2 lines added)

## Risk Assessment
- **Low risk**: Build-time only changes
- **No runtime impact**: Icon path only affects compilation
- **Idempotent**: Safe to run repeatedly
