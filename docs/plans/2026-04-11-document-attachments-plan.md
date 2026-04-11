# Document Attachments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement document attachment CRUD API endpoints for contracts with file upload/download, local filesystem storage, and audit logging.

**Architecture:** Follow existing handler patterns (contracts.go, supplements.go). Store files on local filesystem under `{data_dir}/documents/{entity_type}/{entity_id}/{uuid}` with metadata in SQLite. All routes behind AuthMiddleware. UUID storage filenames prevent path traversal attacks.

**Tech Stack:** Go 1.25, stdlib `mime/multipart`, `crypto/rand`, `path/filepath`, SQLite (`modernc.org/sqlite`), chi router.

**Design Reference:** `docs/plans/2026-04-11-document-attachments-design.md`

---

### Task 1: Add Document Model Struct

**Files:**
- Modify: `internal/models/models.go`

**Step 1: Add Document struct to models.go**

Add after the `Supplement` struct (end of file):

```go
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
```

**Step 2: Verify compilation**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/models/models.go
git commit -m "feat: add Document model struct"
```

---

### Task 2: Create Document Handlers File

**Files:**
- Create: `internal/handlers/documents.go`

**Step 1: Create the file with package, imports, and list handler**

```go
package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const maxUploadSize = 50 << 20 // 50MB

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
```

**Step 2: Add Document struct import reference**

The handler uses `Document` from `models` package. Since `handler.go` is in the same `handlers` package and `models` is imported elsewhere, we need to add a local type alias or import. Check how other handlers reference models -- they don't. Handlers define their own row structs.

**Add Document struct directly in documents.go** (not in models.go -- revise Task 1):

```go
type Document struct {
	ID         int        `json:"id"`
	EntityID   int        `json:"entity_id"`
	EntityType string     `json:"entity_type"`
	Filename   string     `json:"filename"`
	MimeType   *string    `json:"mime_type,omitempty"`
	SizeBytes  *int64     `json:"size_bytes,omitempty"`
	CreatedBy  *int       `json:"created_by,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}
```

**Step 3: Add createDocument handler (upload)**

Append to `documents.go`:

```go
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

	// Validate contract exists
	var contractExists int
	if err := h.DB.QueryRow("SELECT COUNT(*) FROM contracts WHERE id = ? AND deleted_at IS NULL", entityID).Scan(&contractExists); err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to upload document")
		return
	}
	if contractExists == 0 {
		h.Error(w, http.StatusBadRequest, "contract not found")
		return
	}

	// Generate UUID for storage filename
	storageName, err := generateUUID()
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to generate storage name")
		return
	}

	// Create storage directory
	cfg := h.getConfig()
	storageDir := filepath.Join(cfg.DataDir, "documents", entityType, strconv.Itoa(entityID))
	if err := os.MkdirAll(storageDir, 0750); err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to save document")
		return
	}

	// Create storage file
	storagePath := filepath.Join(storageDir, storageName)
	dst, err := os.Create(storagePath)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to save document")
		return
	}
	defer dst.Close()

	size, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(storagePath) // Clean up on failure
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
		os.Remove(storagePath) // Clean up on DB failure
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
```

**Step 4: Add import for `time` package**

At the top of `documents.go`, add `"time"` to the import block.

**Step 5: Add getConfig method to Handler**

The `createDocument` handler needs access to `DataDir`. Check how other handlers access config -- they don't. The `Handler` struct only has `DB`.

**Revise approach:** Pass `dataDir` to Handler struct. Modify `handler.go`:

```go
type Handler struct {
	DB      *sql.DB
	DataDir string
}
```

Then in `server.go`, update the handler initialization:

```go
h := &handlers.Handler{DB: database, DataDir: cfg.DataDir}
```

**Step 6: Fix createDocument to use h.DataDir**

Replace `cfg := h.getConfig()` and `cfg.DataDir` with `h.DataDir`:

```go
storageDir := filepath.Join(h.DataDir, "documents", entityType, strconv.Itoa(entityID))
```

**Step 7: Verify compilation**

Run: `go build ./...`
Expected: No errors

**Step 8: Commit**

```bash
git add internal/handlers/documents.go internal/handlers/handler.go
git commit -m "feat: add document list and upload handlers"
```

---

### Task 3: Add Document Download Handler

**Files:**
- Modify: `internal/handlers/documents.go`

**Step 1: Add HandleDocumentByID and download handler**

Append to `documents.go`:

```go
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
		h.deleteDocument(w, id)
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

	// Read file from filesystem
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
```

**Step 2: Verify compilation**

Run: `go build ./...`
Expected: No errors

**Step 3: Commit**

```bash
git add internal/handlers/documents.go
git commit -m "feat: add document download handler"
```

---

### Task 4: Add Document Delete Handler

**Files:**
- Modify: `internal/handlers/documents.go`

**Step 1: Add deleteDocument handler**

Append to `documents.go`:

```go
func (h *Handler) deleteDocument(w http.ResponseWriter, id int) {
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

	// Delete file from filesystem (best effort, ignore errors)
	os.Remove(storagePath)

	h.auditLog(r, h.getUserID(r), "delete", "document", &id, map[string]interface{}{
		"id":       id,
		"filename": filename,
	}, nil)

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
```

**Step 2: Fix auditLog `r` reference**

The `deleteDocument` method receives `w` and `id` but not `r`. Update the signature:

```go
func (h *Handler) deleteDocument(w http.ResponseWriter, r *http.Request, id int) {
```

And update the call in `HandleDocumentByID`:

```go
case http.MethodDelete:
    h.deleteDocument(w, r, id)
```

**Step 3: Verify compilation**

Run: `go build ./...`
Expected: No errors

**Step 4: Commit**

```bash
git add internal/handlers/documents.go
git commit -m "feat: add document delete handler with audit logging"
```

---

### Task 5: Register Document Routes

**Files:**
- Modify: `internal/server/server.go`

**Step 1: Add document routes in the authenticated group**

Add after the supplements routes, before the static files section:

```go
r.Get("/api/documents", h.HandleDocuments)
r.Post("/api/documents", h.HandleDocuments)
r.Get("/api/documents/{id}/download", h.HandleDocumentByID)
r.Delete("/api/documents/{id}", h.HandleDocumentByID)
```

**Step 2: Update handler initialization**

Change:
```go
h := &handlers.Handler{DB: database}
```

To:
```go
h := &handlers.Handler{DB: database, DataDir: cfg.DataDir}
```

**Step 3: Verify compilation**

Run: `go build ./...`
Expected: No errors

**Step 4: Commit**

```bash
git add internal/server/server.go
git commit -m "feat: register document routes with DataDir config"
```

---

### Task 6: Build Full Binary and Verify

**Step 1: Build the complete binary**

Run: `go build -o /tmp/pacta-test ./cmd/pacta`
Expected: No errors, binary created at `/tmp/pacta-test`

**Step 2: Verify binary size is reasonable**

Run: `ls -lh /tmp/pacta-test`
Expected: ~15-25MB (typical for Go binary with embedded frontend)

**Step 3: Clean up test binary**

Run: `rm /tmp/pacta-test`

**Step 4: Commit if all passes**

All changes already committed per-task. Run: `git status`
Expected: Working tree clean

---

### Task 7: Update Project Documentation

**Files:**
- Modify: `docs/PROJECT_SUMMARY.md`

**Step 1: Update Current Status table**

Change:
```
| Document Attachments | **Schema only** -- No API endpoints or routes implemented |
```

To:
```
| Document Attachments | Complete (v0.10.0 -- upload, download, list, delete with audit logging) |
```

**Step 2: Update Pending -- Backend section**

Remove:
```
- [ ] **Document attachment endpoints** — Schema exists (`007_documents.sql`), no handlers or routes
```

**Step 3: Add to Version Summary**

Add row before v0.9.0:
```
| v0.10.0 | - | Document attachments (upload, download, list, delete, audit logging) |
```

**Step 4: Add to Completed section**

Add:
```
### Completed (v0.10.0)

- [x] Document upload endpoint (`POST /api/documents` with multipart/form-data)
- [x] Document list endpoint (`GET /api/documents?entity_id=X&entity_type=contract`)
- [x] Document download endpoint (`GET /api/documents/{id}/download`)
- [x] Document delete endpoint (`DELETE /api/documents/{id}`)
- [x] Local filesystem storage with UUID filenames (path traversal prevention)
- [x] 50MB file size limit
- [x] FK validation (contract existence check)
- [x] Audit logging on upload and delete
```

**Step 5: Commit**

```bash
git add docs/PROJECT_SUMMARY.md
git commit -m "docs: update project summary for document attachments v0.10.0"
```

---

### Task 8: Run GoReleaser Build Check

**Step 1: Verify Go module is clean**

Run: `go mod tidy && go mod verify`
Expected: All modules verified

**Step 2: Run full build**

Run: `go build ./...`
Expected: No errors

**Step 3: Final git status**

Run: `git status`
Expected: Working tree clean

**Step 4: Push to remote**

Run: `git push`
Expected: Everything up-to-date or successful push
