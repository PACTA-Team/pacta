# M-001 Cookie Secure Flag Design

> **Date:** 2026-04-11
> **Status:** Approved
> **Version Target:** v0.5.2

---

## Problem

Session cookies in `internal/handlers/auth.go` are missing the `Secure` flag. This means browsers may transmit session tokens over unencrypted HTTP connections, enabling potential interception via man-in-the-middle attacks.

## Fix

Add `Secure: true` to both `http.SetCookie` calls:

1. **HandleLogin** (line ~36) -- session creation cookie
2. **HandleLogout** (line ~50) -- session deletion cookie

## Impact

- `Secure: true` instructs browsers to only send cookies over HTTPS/TLS
- Local development (`127.0.0.1:3000`) -- modern browsers still send Secure cookies to localhost, no dev breakage
- Production (Caddy + Let's Encrypt) -- already HTTPS, works correctly
- Zero logic changes, zero API contract changes

## Files Modified

| File | Change |
|------|--------|
| `internal/handlers/auth.go` | Add `Secure: true` to 2 SetCookie calls |
