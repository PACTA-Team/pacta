# Fix: Replace invalid r.Any with r.Handle in chi router

**Date:** 2026-05-02  
**PR:** #301  
**Issue:** CI build failure — `internal/server/server.go:141:6: r.Any undefined (type chi.Router has no field or method Any)`

---

## Problem

CI build for PR #301 fails with:
```
internal/server/server.go:141:6: r.Any undefined (type chi.Router has no field or method Any)
Process completed with exit code 1.
```

Line 141 uses `r.Any("/legal/*", h.HandleAI)` but `chi.Router` does not have an `Any()` method.

---

## Root Cause

API misuse: `Any()` is not a method on `chi.Router` (v5.2.5). The developer likely confused chi with other routers (Gorilla, Express.js, etc.) that have an `Any` or `all` method.

Chi's Router interface provides:
- Specific method handlers: `Get`, `Post`, `Put`, `Patch`, `Delete`, `Head`, `Options`, `Trace`
- Catch-all handlers: `Handle(pattern string, h http.Handler)` and `HandleFunc(pattern string, h http.HandlerFunc)`

The `Handle` method matches any HTTP method — it is the correct way to register a handler that responds to all methods.

---

## Solution

Replace `r.Any("/legal/*", h.HandleAI)` with `r.Handle("/legal/*", h.HandleAI)`.

The `HandleAI` handler internally switches on `r.Method` to route to specific endpoints (GET /legal/status, POST /legal/chat, etc.), so using `Handle` is semantically correct.

---

## Changes

**File:** `internal/server/server.go`

```diff
@@ -138,7 +138,7 @@ func (h *Handler) Start(cfg *config.Config, staticFS fs.FS) error {
 			r.Get("/rag/status", h.HandleRAGStatus)
 
 			// Legal AI endpoints (Cuban expert)
-			r.Any("/legal/*", h.HandleAI)
+			r.Handle("/legal/*", h.HandleAI)
 		})
 
 		// Viewer+ (read-only)
```

---

## Verification

**CI Build:** Should pass after fix (resolves "r.Any undefined" error)  
**Runtime Behavior:** Unchanged — `HandleAI` continues to route based on method and path  
**Chi Documentation:** `Handle()` is the canonical method for catch-all HTTP method routing

---

## Related

- Chi v5.2.5 docs: `Router.Handle(pattern string, h http.Handler)`
- Pattern: Use `Handle` or `HandleFunc` for method-agnostic route registration; use specific methods (Get/Post/etc.) when method constraint is known
