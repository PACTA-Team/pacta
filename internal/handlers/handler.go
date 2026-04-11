package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/PACTA-Team/pacta/internal/auth"
)

type ctxKey string

const ctxUserID ctxKey = "userID"

type Handler struct {
	DB      *sql.DB
	DataDir string
}

func (h *Handler) JSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *Handler) Error(w http.ResponseWriter, status int, message string) {
	h.JSON(w, status, map[string]string{"error": message})
}

func (h *Handler) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session")
		if err != nil {
			h.Error(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		userID, err := auth.GetUserID(h.DB, cookie.Value)
		if err != nil {
			h.Error(w, http.StatusUnauthorized, "session expired")
			return
		}
		ctx := context.WithValue(r.Context(), ctxUserID, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (h *Handler) getUserID(r *http.Request) int {
	v := r.Context().Value(ctxUserID)
	if v == nil {
		return 0
	}
	return v.(int)
}
