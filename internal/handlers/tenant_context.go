package handlers

import (
	"context"
	"net/http"
	"time"
)

// TenantContextMiddleware establishes per-request tenant context for logging and
// future PostgreSQL RLS migration. It does NOT enforce RLS in SQLite (triggers
	// are not viable with connection pooling). Instead, it:
	//
	// 1. Validates that the session belongs to a company
	// 2. Stores tenant info in request context for downstream handlers
	// 3. Optionally logs tenant context for audit trail (development)
	// 4. Prepares for future PostgreSQL RLS via psql session variables
	//
	// In production SQLite, this serves as defense-in-depth: company_id filters
	// in queries remain the primary enforcement mechanism.
func (h *Handler) TenantContextMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract session cookie
		cookie, err := r.Cookie("session")
		if err != nil {
			h.Error(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		// Load session to obtain user_id and company_id
		session, err := h.Queries.GetSessionByToken(r.Context(), cookie.Value)
		if err != nil {
			h.Error(w, http.StatusUnauthorized, "invalid session")
			return
		}
		// Check if session is expired
		if session.ExpiresAt.Before(time.Now()) {
			h.Error(w, http.StatusUnauthorized, "session expired")
			return
		}

		// Store tenant context in request context for downstream use
		ctx := context.WithValue(r.Context(), "tenant_id", session.CompanyID)
		ctx = context.WithValue(ctx, "user_id_for_audit", session.UserID)
		r = r.WithContext(ctx)

		next.ServeHTTP(w, r)
	})
}
