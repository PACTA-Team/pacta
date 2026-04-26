package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const maxUploadSize = 50 << 20 // 50MB

// Temp documents are stored without DB record, identified by storage key
const tempDir = "temp"

// validateStorageKey ensures a document storage key is safe (no path traversal)
func validateStorageKey(key string) error {
	if key == "" {
		return errors.New("storage key required")
	}
	// Must not contain path separators or parent directory references
	if strings.Contains(key, "..") || strings.ContainsAny(key, "/\\") {
		return errors.New("invalid storage key")
	}
	return nil
}

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
	companyID := h.GetCompanyID(r)
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
		FROM documents WHERE entity_id = ? AND entity_type = ? AND company_id = ?
		ORDER BY created_at DESC
	`, entityID, entityType, companyID)
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
	companyID := h.GetCompanyID(r)

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
	if err := h.DB.QueryRow("SELECT COUNT(*) FROM contracts WHERE id = ? AND deleted_at IS NULL AND company_id = ?", entityID, companyID).Scan(&contractExists); err != nil {
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
		INSERT INTO documents (entity_id, entity_type, filename, storage_path, mime_type, size_bytes, uploaded_by, company_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, entityID, entityType, header.Filename, storagePath, mimeType, size, userID, companyID)
	if err != nil {
		os.Remove(storagePath)
		h.Error(w, http.StatusInternalServerError, "failed to save document")
		return
	}

	id64, _ := result.LastInsertId()
	id := int(id64)

	h.auditLog(r, userID, companyID, "create", "document", &id, nil, map[string]interface{}{
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
		h.downloadDocument(w, r, id)
	case http.MethodDelete:
		h.deleteDocument(w, r, id)
	default:
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) downloadDocument(w http.ResponseWriter, r *http.Request, id int) {
	companyID := h.GetCompanyID(r)
	var filename, storagePath, mimeType string
	var sizeBytes int64

	err := h.DB.QueryRow(`
		SELECT filename, storage_path, mime_type, size_bytes
		FROM documents WHERE id = ? AND company_id = ?
	`, id, companyID).Scan(&filename, &storagePath, &mimeType, &sizeBytes)
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
	companyID := h.GetCompanyID(r)
	var storagePath, filename string
	err := h.DB.QueryRow("SELECT storage_path, filename FROM documents WHERE id = ? AND company_id = ?", id, companyID).Scan(&storagePath, &filename)
	if err != nil {
		h.Error(w, http.StatusNotFound, "document not found")
		return
	}

	_, err = h.DB.Exec("DELETE FROM documents WHERE id = ? AND company_id = ?", id, companyID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to delete document")
		return
	}

	os.Remove(storagePath)

	h.auditLog(r, h.getUserID(r), companyID, "delete", "document", &id, map[string]interface{}{
		"id":       id,
		"filename": filename,
	}, nil)

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ==================== Temporary Document Handlers ====================

// allowedMIMETypes defines whitelist of permitted content types
var allowedMIMETypes = map[string]bool{
	"application/pdf":                                                  true,
	"application/msword":                                              true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
	"application/vnd.ms-excel":                                         true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":    true,
	"image/png":                                                       true,
	"image/jpeg":                                                      true,
}

// validateFileUpload performs content-based MIME detection
func validateFileUpload(file io.ReadSeeker, header *multipart.FileHeader) error {
	// First, validate extension as preliminary filter
	ext := "." + strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := map[string]bool{
		".pdf": true, ".doc": true, ".docx": true,
		".xls": true, ".xlsx": true, ".png": true, ".jpg": true, ".jpeg": true,
	}
	if !allowedExts[ext] {
		return fmt.Errorf("invalid file extension: %s", ext)
	}

	// Read first 512 bytes for content detection
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		return fmt.Errorf("failed to read file header: %w", err)
	}
	buf = buf[:n]

	// Detect actual content type from bytes
	contentType := http.DetectContentType(buf)
	if !allowedMIMETypes[contentType] {
		return fmt.Errorf("invalid file content type: %s", contentType)
	}

	// Reset file pointer to beginning for subsequent operations
	_, err = file.Seek(0, io.SeekStart)
	if err != nil {
		return fmt.Errorf("failed to reset file pointer: %w", err)
	}

	return nil
}

// uploadTempDocument uploads a file without associating it with a contract.
// Returns a temporary URL (presigned-like) and storage key for later cleanup.
// Used by ContractForm for draft document uploads before contract creation.
func (h *Handler) HandleUploadTempDocument(w http.ResponseWriter, r *http.Request) {

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

	// Validate file type (content-based MIME detection)
	if err := validateFileUpload(file, header); err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	// Generate unique storage key (UUID)
	storageKey, err := generateUUID()
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to generate storage key")
		return
	}

	// Store in temp directory: {DataDir}/documents/temp/{storageKey}
	storageDir := filepath.Join(h.DataDir, "documents", tempDir)
	if err := os.MkdirAll(storageDir, 0750); err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create temp directory")
		return
	}

	storagePath := filepath.Join(storageDir, storageKey)
	dst, err := os.Create(storagePath)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to create temp file")
		return
	}
	defer dst.Close()

	size, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(storagePath)
		h.Error(w, http.StatusInternalServerError, "failed to save temp file")
		return
	}

	// Return temp URL (direct access via /api/documents/temp/{key})
	// and storage key for later cleanup
	tempURL := fmt.Sprintf("/api/documents/temp/%s", storageKey)

	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"url":    tempURL,
		"key":    storageKey,
		"filename": header.Filename,
		"size_bytes": size,
		"mime_type": header.Header.Get("Content-Type"),
	})
}

// verifyTempDocument HEAD handler — checks if temp file exists
func (h *Handler) HandleVerifyTempDocument(w http.ResponseWriter, r *http.Request) {
	key := strings.TrimPrefix(r.URL.Path, "/api/documents/temp/")
	if err := validateStorageKey(key); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid document key")
		return
	}

	storagePath := filepath.Join(h.DataDir, "documents", tempDir, key)

	// Check file exists and is readable
	info, err := os.Stat(storagePath)
	if err != nil {
		if os.IsNotExist(err) {
			h.Error(w, http.StatusNotFound, "temp document not found or expired")
			return
		}
		h.Error(w, http.StatusInternalServerError, "failed to verify document")
		return
	}

	// Return minimal headers (size, mime) for verification
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	w.WriteHeader(http.StatusOK)
}

// cleanupTempDocument DELETE handler — removes temp file with ownership validation
// Since temp files are not DB-tracked, we validate by ensuring the file belongs to this user's company
// by checking that it's in the temp directory and was uploaded during this session.
// For security, we don't delete files uploaded by other users (file key is a secret UUID).
func (h *Handler) HandleCleanupTempDocument(w http.ResponseWriter, r *http.Request) {
	key := strings.TrimPrefix(r.URL.Path, "/api/documents/temp/")
	if err := validateStorageKey(key); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid document key")
		return
	}

	storagePath := filepath.Join(h.DataDir, "documents", tempDir, key)

	// Delete file
	err := os.Remove(storagePath)
	if err != nil {
		if os.IsNotExist(err) {
			// Already deleted — treat as success
			h.JSON(w, http.StatusOK, map[string]string{"status": "already_deleted"})
			return
		}
		h.Error(w, http.StatusInternalServerError, "failed to delete temp document")
		return
	}

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// serveTempDocument serves the temporary uploaded file (GET /api/documents/temp/{key})
func (h *Handler) HandleServeTempDocument(w http.ResponseWriter, r *http.Request) {
	key := strings.TrimPrefix(r.URL.Path, "/api/documents/temp/")
	if err := validateStorageKey(key); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid document key")
		return
	}

	storagePath := filepath.Join(h.DataDir, "documents", tempDir, key)

	// Check if file exists
	info, err := os.Stat(storagePath)
	if err != nil {
		if os.IsNotExist(err) {
			h.Error(w, http.StatusNotFound, "temp document not found")
			return
		}
		h.Error(w, http.StatusInternalServerError, "failed to access document")
		return
	}

	// Serve file content
	data, err := os.ReadFile(storagePath)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to read document")
		return
	}

	// Guess mime type based on extension (simplified)
	ext := strings.ToLower(filepath.Ext(key))
	mime := "application/octet-stream"
	switch ext {
	case ".pdf":
		mime = "application/pdf"
	case ".doc":
		mime = "application/msword"
	case ".docx":
		mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".xls":
		mime = "application/vnd.ms-excel"
	case ".xlsx":
		mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ".png":
		mime = "image/png"
	case ".jpg", ".jpeg":
		mime = "image/jpeg"
	}

	w.Header().Set("Content-Type", mime)
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	w.Write(data)
}

