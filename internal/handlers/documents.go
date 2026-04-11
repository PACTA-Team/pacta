package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const maxUploadSize = 50 << 20 // 50MB

type Document struct {
	ID         int       `json:"id"`
	EntityID   int       `json:"entity_id"`
	EntityType string    `json:"entity_type"`
	Filename   string    `json:"filename"`
	MimeType   *string   `json:"mime_type,omitempty"`
	SizeBytes  *int64    `json:"size_bytes,omitempty"`
	CreatedBy  *int      `json:"created_by,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

func (h *Handler) HandleDocuments(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listDocuments(w, r)
	case http.MethodPost:
		h.createDocument(w, r)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) listDocuments(w http.ResponseWriter, r *http.Request) {
	entityIDStr := r.URL.Query().Get("entity_id")
	entityType := r.URL.Query().Get("entity_type")

	if entityIDStr == "" || entityType == "" {
		h.Error(w, http.StatusBadRequest, "entity_id and entity_type are required")
		return
	}

	entityID, err := strconv.Atoi(entityIDStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid entity_id")
		return
	}

	rows, err := h.DB.Query(`
		SELECT id, entity_id, entity_type, filename, mime_type, size_bytes, created_at
		FROM documents WHERE entity_id = ? AND entity_type = ?
		ORDER BY created_at DESC
	`, entityID, entityType)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to list documents")
		return
	}
	defer rows.Close()

	var docs []Document
	for rows.Next() {
		var d Document
		if err := rows.Scan(&d.ID, &d.EntityID, &d.EntityType, &d.Filename,
			&d.MimeType, &d.SizeBytes, &d.CreatedAt); err != nil {
			h.Error(w, http.StatusInternalServerError, "failed to list documents")
			return
		}
		docs = append(docs, d)
	}
	if docs == nil {
		docs = []Document{}
	}
	h.JSON(w, http.StatusOK, docs)
}

func (h *Handler) createDocument(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		if strings.Contains(err.Error(), "request body too large") {
			h.Error(w, http.StatusRequestEntityTooLarge, "file size exceeds 50MB limit")
			return
		}
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		h.Error(w, http.StatusBadRequest, "no file uploaded")
		return
	}
	defer file.Close()

	entityIDStr := r.FormValue("entity_id")
	entityType := r.FormValue("entity_type")

	if entityIDStr == "" {
		h.Error(w, http.StatusBadRequest, "entity_id is required")
		return
	}
	if entityType == "" {
		h.Error(w, http.StatusBadRequest, "entity_type is required")
		return
	}
	if entityType != "contract" {
		h.Error(w, http.StatusBadRequest, "entity_type must be 'contract'")
		return
	}

	entityID, err := strconv.Atoi(entityIDStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid entity_id")
		return
	}

	var contractExists int
	if err := h.DB.QueryRow("SELECT COUNT(*) FROM contracts WHERE id = ? AND deleted_at IS NULL", entityID).Scan(&contractExists); err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to upload document")
		return
	}
	if contractExists == 0 {
		h.Error(w, http.StatusBadRequest, "contract not found")
		return
	}

	storageName, err := generateUUID()
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to generate storage name")
		return
	}

	storageDir := filepath.Join(h.DataDir, "documents", entityType, strconv.Itoa(entityID))
	if err := os.MkdirAll(storageDir, 0750); err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to save document")
		return
	}

	storagePath := filepath.Join(storageDir, storageName)
	dst, err := os.Create(storagePath)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to save document")
		return
	}
	defer dst.Close()

	size, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(storagePath)
		h.Error(w, http.StatusInternalServerError, "failed to save document")
		return
	}

	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	userID := h.getUserID(r)
	result, err := h.DB.Exec(`
		INSERT INTO documents (entity_id, entity_type, filename, storage_path, mime_type, size_bytes, uploaded_by)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, entityID, entityType, header.Filename, storagePath, mimeType, size, userID)
	if err != nil {
		os.Remove(storagePath)
		h.Error(w, http.StatusInternalServerError, "failed to save document")
		return
	}

	id64, _ := result.LastInsertId()
	id := int(id64)

	h.auditLog(r, userID, "create", "document", &id, nil, map[string]interface{}{
		"id":          id,
		"entity_id":   entityID,
		"entity_type": entityType,
		"filename":    header.Filename,
		"size_bytes":  size,
	})

	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":          id,
		"entity_id":   entityID,
		"entity_type": entityType,
		"filename":    header.Filename,
		"mime_type":   mimeType,
		"size_bytes":  size,
		"created_at":  time.Now().UTC().Format(time.RFC3339),
	})
}

func generateUUID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (h *Handler) HandleDocumentByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/documents/")
	idStr = strings.TrimSuffix(idStr, "/download")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		h.Error(w, http.StatusBadRequest, "invalid id")
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.downloadDocument(w, id)
	case http.MethodDelete:
		h.deleteDocument(w, r, id)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) downloadDocument(w http.ResponseWriter, id int) {
	var filename, storagePath, mimeType string
	var sizeBytes int64

	err := h.DB.QueryRow(`
		SELECT filename, storage_path, mime_type, size_bytes
		FROM documents WHERE id = ?
	`, id).Scan(&filename, &storagePath, &mimeType, &sizeBytes)
	if err != nil {
		h.Error(w, http.StatusNotFound, "document not found")
		return
	}

	data, err := os.ReadFile(storagePath)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "document file corrupted")
		return
	}

	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", strconv.FormatInt(sizeBytes, 10))
	w.Write(data)
}

func (h *Handler) deleteDocument(w http.ResponseWriter, r *http.Request, id int) {
	var storagePath, filename string
	err := h.DB.QueryRow("SELECT storage_path, filename FROM documents WHERE id = ?", id).Scan(&storagePath, &filename)
	if err != nil {
		h.Error(w, http.StatusNotFound, "document not found")
		return
	}

	_, err = h.DB.Exec("DELETE FROM documents WHERE id = ?", id)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete document")
		return
	}

	os.Remove(storagePath)

	h.auditLog(r, h.getUserID(r), "delete", "document", &id, map[string]interface{}{
		"id":       id,
		"filename": filename,
	}, nil)

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
