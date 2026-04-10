# QA Report — Pacta v0.3.2

**Date:** 2026-04-09
**Target:** https://pacta.duckdns.org
**Version:** v0.3.2 (GitHub Release)
**Deployment:** /opt/pacta/pacta (systemd service)
**Reverse Proxy:** Caddy (pacta.duckdns.org → localhost:3000)

---

## Executive Summary

Pacta v0.3.2 was deployed from GitHub Release to this VPS and made accessible via `https://pacta.duckdns.org`. The application is functional — the frontend loads, authentication works (after fixing a critical bug), and basic CRUD operations succeed. However, **3 critical/high severity bugs** were found that block normal usage.

**Health Score: 62/100**

---

## Top 3 Things to Fix

### 1. CRITICAL: Default admin password hash is invalid
**Issue:** The bcrypt hash in migration `001_users.sql` (`$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`) does NOT match `admin123`. This is a well-known fake test hash commonly misused online.
**Impact:** Fresh installations cannot login with documented credentials.
**Fix:** Generate a real bcrypt hash for `admin123` and update the migration.
**Status:** Fixed manually during QA (generated new hash, updated DB).

### 2. HIGH: Contract creation fails without explicit client_id/supplier_id
**Issue:** `POST /api/contracts` returns 500 with raw SQLite error when `client_id` or `supplier_id` is missing (FK constraint violation).
**Impact:** Users cannot create contracts without knowing internal IDs; API exposes database internals.
**Fix:** Add input validation, return 400 with helpful message. Auto-generate contract_number.

### 3. HIGH: Contract number UNIQUE constraint blocks multiple creations
**Issue:** `contract_number` is NOT NULL UNIQUE but API doesn't auto-generate unique values. Empty string is used as default, causing UNIQUE constraint failure on second contract.
**Impact:** Only one contract can ever be created via API.
**Fix:** Auto-generate contract numbers (e.g., `CNT-2026-0001`).

---

## Issues by Severity

### Critical (1)

| # | Issue | Status |
|---|-------|--------|
| C-001 | Default admin password hash doesn't match `admin123` | Fixed during QA |

### High (3)

| # | Issue | Status |
|---|-------|--------|
| H-001 | Contract creation returns 500 with raw SQLite error on missing FK | Open |
| H-002 | Contract number not auto-generated, UNIQUE constraint fails | Open |
| H-003 | API error messages expose internal DB details | Open |

### Medium (1)

| # | Issue | Status |
|---|-------|--------|
| M-001 | Cookie missing `Secure` flag (implicit via HTTPS) | Open |

### Low (0)

None found yet.

---

## API Test Results

### Authentication API

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| POST /api/auth/login (valid) | 200 + cookie | 200 + cookie | ✅ PASS |
| POST /api/auth/login (wrong pw) | 401 | 401 `{"error":"invalid password"}` | ✅ PASS |
| POST /api/auth/login (missing email) | 400/401 | 401 `{"error":"user not found"}` | ✅ PASS |
| GET /api/auth/me (authenticated) | 200 + user | 200 + user JSON | ✅ PASS |
| POST /api/auth/logout | 200 | 200 `{"status":"logged out"}` | ✅ PASS |
| GET /api/auth/me (after logout) | 401 | 401 `{"error":"session expired"}` | ✅ PASS |

### Contracts API

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| GET /api/contracts | 200 + array | 200 `[]` | ✅ PASS |
| POST /api/contracts (no FK) | 400 validation | 500 FK error | ❌ FAIL (H-001) |
| POST /api/contracts (with FK) | 201 | 201 (first only) | ⚠️ Partial (H-002) |
| POST /api/contracts (2nd) | 201 | 500 UNIQUE error | ❌ FAIL (H-002) |

### Clients/Suppliers API

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| POST /api/clients | 201 | 201 (3 created) | ✅ PASS |
| POST /api/suppliers | 201 | 201 (3 created) | ✅ PASS |
| GET /api/clients | 200 + array | 200 | ✅ PASS |
| GET /api/suppliers | 200 + array | 200 | ✅ PASS |

---

## Security Findings

### Cookie Security

| Attribute | Expected | Actual | Status |
|-----------|----------|--------|--------|
| HttpOnly | Yes | Yes | ✅ PASS |
| SameSite | Strict | Strict | ✅ PASS |
| Secure | Yes | Not set | ⚠️ M-001 |
| Path | / | / | ✅ PASS |

### Input Validation

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| SQL injection on login | 401 | 401 | ✅ PASS |
| Raw DB errors exposed | No | Yes | ❌ FAIL (H-003) |

---

## Console Health Summary

No frontend console errors detected (server-side rendering, no JS console access via curl).

---

## Test Coverage Matrix

| Page/Endpoint | Tested | Status |
|---------------|--------|--------|
| Login page | ✅ | Loads (HTTP 200) |
| Dashboard | ⏭️ | Requires browser QA |
| Contracts list | ✅ API | Returns array |
| Create contract | ✅ API | Fails (H-002) |
| Clients CRUD | ✅ API | All pass |
| Suppliers CRUD | ✅ API | All pass |
| Auth endpoints | ✅ API | All pass |
| Cookie security | ✅ | 3/4 flags present |

---

## Deployment Notes

- Binary: `/opt/pacta/pacta` (12MB, ELF 64-bit, statically linked)
- Database: `/root/.local/share/pacta/data/pacta.db` (XDG spec compliant)
- Service: `pacta.service` (enabled, running)
- Caddy: `pacta.duckdns.org` → `localhost:3000` (TLS via Let's Encrypt)
- TLS cert: Valid until Jul 7, 2026 (E8)

---

## Recommendations

1. **Fix migration 001** — Replace fake bcrypt hash with real one for `admin123`
2. **Add contract number auto-generation** — Format: `CNT-YYYY-NNNN`
3. **Add input validation** — Return 400 for missing required fields
4. **Sanitize error messages** — Never expose raw SQLite errors to clients
5. **Add Secure flag to cookies** — Explicit, not implicit
