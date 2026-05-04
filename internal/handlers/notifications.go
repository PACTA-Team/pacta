package handlers

import (
	"context"
	"database/sql"
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

	var err error
	var notifs []Notification

	if unreadOnly {
		rows, err := h.Queries.ListNotificationsByUser(r.Context(), db.ListNotificationsByUserParams{
			UserID:    int64(userID),
			CompanyID: int64(companyID),
		})
		if err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to list notifications")
			return
		}
		for _, n := range rows {
			notifs = append(notifs, Notification{
				ID:        int(n.ID),
				UserID:    int(n.UserID),
				Type:      n.Type,
				Title:     n.Title,
				Message:   n.Message,
				EntityID:  &n.EntityID.Int64,
				EntityType: &n.EntityType.String,
				ReadAt:    &n.ReadAt.Time,
				CreatedAt: n.CreatedAt,
			})
		}
	} else {
		rows, err = h.Queries.ListAllNotificationsByUser(r.Context(), db.ListAllNotificationsByUserParams{
			UserID:    int64(userID),
			CompanyID: int64(companyID),
		})
		if err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to list notifications")
			return
		}
		for _, n := range rows {
			readAt := (*time.Time)(nil)
			if n.ReadAt.Valid {
				readAt = &n.ReadAt.Time
			}
			entityID := (*int)(nil)
			if n.EntityID.Valid {
				id := int(n.EntityID.Int64)
				entityID = &id
			}
			entityType := (*string)(nil)
			if n.EntityType.Valid {
				entityType = &n.EntityType.String
			}
			notifs = append(notifs, Notification{
				ID:        int(n.ID),
				UserID:    int(n.UserID),
				Type:      n.Type,
				Title:     n.Title,
				Message:   n.Message,
				EntityID:  entityID,
				EntityType: entityType,
				ReadAt:    readAt,
				CreatedAt: n.CreatedAt,
			})
		}
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

	notif, err := h.Queries.CreateNotification(r.Context(), db.CreateNotificationParams{
		UserID:    int64(*targetUserID),
		Type:      req.Type,
		Title:     req.Title,
		Message:   req.Message,
		EntityID:  req.EntityID,
		EntityType: req.EntityType,
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create notification")
		return
	}

	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":     notif.ID,
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
	notif, err := h.Queries.GetNotification(r.Context(), db.GetNotificationParams{
		ID:        int64(id),
		UserID:    int64(userID),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusNotFound, "notification not found")
		return
	}

	n := Notification{
		ID:        int(notif.ID),
		UserID:    int(notif.UserID),
		Type:      notif.Type,
		Title:     notif.Title,
		Message:   notif.Message,
		CreatedAt: notif.CreatedAt,
	}
	if notif.EntityID.Valid {
		id := int(notif.EntityID.Int64)
		n.EntityID = &id
	}
	if notif.EntityType.Valid {
		n.EntityType = &notif.EntityType.String
	}
	if notif.ReadAt.Valid {
		n.ReadAt = &notif.ReadAt.Time
	}
	h.JSON(w, http.StatusOK, n)
}

func (h *Handler) markNotificationRead(w http.ResponseWriter, r *http.Request, id int) {
	userID := h.getUserID(r)
	companyID := h.GetCompanyID(r)

	_, err := h.Queries.MarkNotificationRead(r.Context(), db.MarkNotificationReadParams{
		ID:        int64(id),
		UserID:    int64(userID),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to mark notification as read")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "read"})
}

func (h *Handler) deleteNotification(w http.ResponseWriter, r *http.Request, id int) {
	userID := h.getUserID(r)
	companyID := h.GetCompanyID(r)

	_, err := h.Queries.DeleteNotification(r.Context(), db.DeleteNotificationParams{
		ID:        int64(id),
		UserID:    int64(userID),
		CompanyID: int64(companyID),
	})
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

	_, err := h.Queries.MarkAllNotificationsRead(r.Context(), db.MarkAllNotificationsReadParams{
		UserID:    int64(userID),
		CompanyID: int64(companyID),
	})
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

	count, err := h.Queries.CountUnreadNotifications(r.Context(), db.CountUnreadNotificationsParams{
		UserID:    int64(userID),
		CompanyID: int64(companyID),
	})
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to count notifications")
		return
	}

	h.JSON(w, http.StatusOK, map[string]int{"unread": int(count)})
}
