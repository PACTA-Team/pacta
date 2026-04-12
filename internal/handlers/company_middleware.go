package handlers

import (
	"context"
	"net/http"
	"strconv"

	"github.com/PACTA-Team/pacta/internal/auth"
)

const ctxCompanyID ctxKey = "companyID"

// CompanyMiddleware resolves the active company from session or X-Company-ID header.
// It validates the user belongs to the requested company and injects companyID into context.
func (h *Handler) CompanyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := h.getUserID(r)
		if userID == 0 {
			h.Error(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		companyID := 0

		// Check if user explicitly requested a company via header
		if headerID := r.Header.Get("X-Company-ID"); headerID != "" {
			id, err := strconv.Atoi(headerID)
			if err != nil {
				h.Error(w, http.StatusBadRequest, "invalid company ID")
				return
			}

			// Verify user belongs to this company
			var exists int
			err = h.DB.QueryRow(
				"SELECT COUNT(*) FROM user_companies WHERE user_id = ? AND company_id = ?",
				userID, id,
			).Scan(&exists)
			if err != nil || exists == 0 {
				h.Error(w, http.StatusForbidden, "access denied to this company")
				return
			}
			companyID = id
		}

		// If no explicit company, use session's company_id
		if companyID == 0 {
			cookie, err := r.Cookie("session")
			if err == nil {
				session, err := auth.GetSession(h.DB, cookie.Value)
				if err == nil && session.CompanyID > 0 {
					companyID = session.CompanyID
				}
			}
		}

		// Fallback: get user's default company
		if companyID == 0 {
			err := h.DB.QueryRow(
				"SELECT company_id FROM user_companies WHERE user_id = ? AND is_default = 1",
				userID,
			).Scan(&companyID)
			if err != nil {
				err = h.DB.QueryRow("SELECT company_id FROM users WHERE id = ?", userID).Scan(&companyID)
			}
			if err != nil || companyID == 0 {
				h.Error(w, http.StatusForbidden, "no company assigned. Contact administrator.")
				return
			}
		}

		ctx := context.WithValue(r.Context(), ctxCompanyID, companyID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetCompanyID extracts company_id from request context.
func (h *Handler) GetCompanyID(r *http.Request) int {
	v := r.Context().Value(ctxCompanyID)
	if v == nil {
		return 0
	}
	return v.(int)
}
