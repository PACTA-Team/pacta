-- ============================================================
-- documents queries
-- Note: documents table does NOT have deleted_at (by design)
-- ============================================================

-- name: CreateDocument :one
INSERT INTO documents (
  entity_id, entity_type, filename, storage_path,
  mime_type, size_bytes, uploaded_by, company_id, created_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: ListDocumentsByEntity :many
SELECT id, entity_id, entity_type, filename, storage_path,
       mime_type, size_bytes, uploaded_by, created_at
FROM documents
WHERE entity_id = ? AND entity_type = ? AND company_id = ?
ORDER BY created_at DESC;

-- name: CountDocumentsByEntity :one
SELECT COUNT(*) FROM documents
WHERE entity_id = ? AND entity_type = ?;

-- name: GetDocument :one
SELECT id, entity_id, entity_type, filename, storage_path,
       mime_type, size_bytes, uploaded_by, created_at
FROM documents
WHERE id = ? AND company_id = ?
LIMIT 1;

-- name: DeleteDocument :exec
DELETE FROM documents
WHERE id = ? AND company_id = ?;
