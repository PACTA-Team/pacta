package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Notification struct {
	ID         int        `json:"id"`
	UserID     int        `json:"user_id"`
	Type       string     `json:"type"`
	Title      string     `json:"title"`
	Message    *string    `json:"message,omitempty"`
	EntityID   *int       `json:"entity_id,omitempty"`
	EntityType *string    `json:"entity_type,omitempty"`
	ReadAt     *time.Time `json:"read_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

func (h *Handler) HandleNotifications(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listNotifications(w, r)
	case http.MethodPost:
		h.createNotification(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) listNotifications(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	companyID := h.GetCompanyID(r)

	unreadOnly := r.URL.Query().Get("unread") == "true"

	var rows interface {
		Next() bool
		Scan(...interface{}) error
		Close() error
	}
	var err error

	if unreadOnly {
		rows, err = h.DB.Query(`
			SELECT id, user_id, type, title, message, entity_id, entity_type, read_at, created_at
			FROM notifications WHERE user_id = ? AND company_id = ? AND read_at IS NULL
			ORDER BY created_at DESC
		`, userID, companyID)
	} else {
		rows, err = h.DB.Query(`
			SELECT id, user_id, type, title, message, entity_id, entity_type, read_at, created_at
			FROM notifications WHERE user_id = ? AND company_id = ?
			ORDER BY created_at DESC
			LIMIT 100
		`, userID, companyID)
	}
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list notifications")
		return
	}
	defer rows.Close()

	var notifs []Notification
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message,
			&n.EntityID, &n.EntityType, &n.ReadAt, &n.CreatedAt); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to list notifications")
			return
		}
		notifs = append(notifs, n)
	}
	if notifs == nil {
		notifs = []Notification{}
	}
	h.JSON(w, http.StatusOK, notifs)
}

type createNotificationRequest struct {
	Type       string  `json:"type"`
	Title      string  `json:"title"`
	Message    *string `json:"message"`
	EntityID   *int    `json:"entity_id"`
	EntityType *string `json:"entity_type"`
	UserID     *int    `json:"user_id"`
}

func (h *Handler) createNotification(w http.ResponseWriter, r *http.Request) {
	var req createNotificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}
	if req.Type == "" {
		h.Error(w, http.StatusBadRequest, "type is required")
		return
	}
	if req.Title == "" {
		h.Error(w, http.StatusBadRequest, "title is required")
		return
	}

	targetUserID := req.UserID
	if targetUserID == nil {
		uid := h.getUserID(r)
		targetUserID = &uid
	}

	companyID := h.GetCompanyID(r)

	result, err := h.DB.Exec(`
		INSERT INTO notifications (user_id, type, title, message, entity_id, entity_type, company_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, targetUserID, req.Type, req.Title, req.Message, req.EntityID, req.EntityType, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create notification")
		return
	}

	id64, _ := result.LastInsertId()
	id := int(id64)

	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":     id,
		"type":   req.Type,
		"title":  req.Title,
		"status": "created",
	})
}

func (h *Handler) HandleNotificationByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/notifications/")
	idStr = strings.TrimSuffix(idStr, "/read")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getNotification(w, r, id)
	case http.MethodPatch:
		h.markNotificationRead(w, r, id)
	case http.MethodDelete:
		h.deleteNotification(w, r, id)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) getNotification(w http.ResponseWriter, r *http.Request, id int) {
	userID := h.getUserID(r)
	companyID := h.GetCompanyID(r)
	var n Notification
	err := h.DB.QueryRow(`
		SELECT id, user_id, type, title, message, entity_id, entity_type, read_at, created_at
		FROM notifications WHERE id = ? AND user_id = ? AND company_id = ?
	`, id, userID, companyID).Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message,
		&n.EntityID, &n.EntityType, &n.ReadAt, &n.CreatedAt)
	if err != nil {
		h.Error(w, http.StatusNotFound, "notification not found")
		return
	}
	h.JSON(w, http.StatusOK, n)
}

func (h *Handler) markNotificationRead(w http.ResponseWriter, r *http.Request, id int) {
	userID := h.getUserID(r)
	companyID := h.GetCompanyID(r)

	_, err := h.DB.Exec(`
		UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND company_id = ?
	`, id, userID, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to mark notification as read")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "read"})
}

func (h *Handler) deleteNotification(w http.ResponseWriter, r *http.Request, id int) {
	userID := h.getUserID(r)
	companyID := h.GetCompanyID(r)

	_, err := h.DB.Exec("DELETE FROM notifications WHERE id = ? AND user_id = ? AND company_id = ?", id, userID, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete notification")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// HandleMarkAllNotificationsRead marks all notifications as read for the current user
func (h *Handler) HandleMarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	userID := h.getUserID(r)
	companyID := h.GetCompanyID(r)

	_, err := h.DB.Exec(`
		UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND company_id = ? AND read_at IS NULL
	`, userID, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to mark all notifications as read")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "all read"})
}

// HandleNotificationCount returns the count of unread notifications for the current user
func (h *Handler) HandleNotificationCount(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	userID := h.getUserID(r)
	companyID := h.GetCompanyID(r)

	var count int
	err := h.DB.QueryRow(`
		SELECT COUNT(*) FROM notifications WHERE user_id = ? AND company_id = ? AND read_at IS NULL
	`, userID, companyID).Scan(&count)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to count notifications")
		return
	}

	h.JSON(w, http.StatusOK, map[string]int{"unread": count})
}
