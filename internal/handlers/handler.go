package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/PACTA-Team/pacta/internal/ai"
	"github.com/PACTA-Team/pacta/internal/auth"
	"github.com/PACTA-Team/pacta/internal/db"
)

// LLMClient is the interface for language model clients (aliased from ai.LLM).
type LLMClient = ai.LLM

type ctxKey string

const (
	ctxUserID   ctxKey = "userID"
	ctxUserRole ctxKey = "userRole"
)

type Handler struct {
	Queries     *db.Queries
	DataDir     string
	RateLimiter *ai.RateLimiter
	LLMClient   LLMClient
}


func (h *Handler) JSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// ApiResponse is the standard JSON envelope for all API responses.
type ApiResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// success sends a successful JSON response with envelope {success: true, data: ...}
func (h *Handler) success(w http.ResponseWriter, status int, data interface{}) {
	h.JSON(w, status, ApiResponse{Success: true, Data: data})
}

func (h *Handler) Error(w http.ResponseWriter, status int, message string) {
	// Map tenant isolation violations to 403 Forbidden instead of 500
	if status == http.StatusInternalServerError && strings.Contains(message, "Tenant isolation violation") {
		status = http.StatusForbidden
		message = "access denied"
	}
	h.JSON(w, status, map[string]string{"error": message})
}

func (h *Handler) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session")
		if err != nil {
			h.Error(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		userID, err := auth.GetUserID(h.Queries, cookie.Value)
		if err != nil {
			h.Error(w, http.StatusUnauthorized, "session expired")
			return
		}

		// Update last_access asynchronously (non-blocking)
		go func() {
			h.Queries.UpdateUserLastAccess(r.Context(), userID)
		}()

		var role string
		if err := h.Queries.GetUserRole(r.Context(), userID); err != nil {
			h.Error(w, http.StatusForbidden, "account inactive or not found")
			return
		}

		ctx := context.WithValue(r.Context(), ctxUserID, userID)
		ctx = context.WithValue(ctx, ctxUserRole, role)
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

func (h *Handler) getUserRole(r *http.Request) string {
	v := r.Context().Value(ctxUserRole)
	if v == nil {
		return ""
	}
	return v.(string)
}

func (h *Handler) getCompanyID(r *http.Request) int {
	userID := h.getUserID(r)
	if userID == 0 {
		return 0
	}
	var companyID int
	err := h.Queries.GetUserCompanyID(r.Context(), userID)
	if err != nil {
		return 0
	}
	return companyID
}

// DB returns the underlying *sql.DB from Queries.
// This is a helper method to eliminate direct h.DB field access.
func (h *Handler) DB() *sql.DB {
	return h.Queries.DB()
}

// roleLevel returns the numeric permission level for a role.
// Higher = more permissions. admin=4, manager=3, editor=2, viewer=1.
func roleLevel(role string) int {
	switch role {
	case "admin":
		return 4
	case "manager":
		return 3
	case "editor":
		return 2
	case "viewer":
		return 1
	default:
		return 0
	}
}

// RequireRole returns a middleware that checks if the user's role meets
// the minimum required level.
func (h *Handler) RequireRole(minLevel int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role := h.getUserRole(r)
			if roleLevel(role) < minLevel {
				h.Error(w, http.StatusForbidden, "insufficient permissions")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
