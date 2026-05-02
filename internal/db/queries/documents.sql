-- ============================================================
-- documents queries
-- Note: documents table does NOT have deleted_at (by design)
-- ============================================================

-- name: GetDocumentByID :one
SELECT id, entity_id, entity_type, filename, storage_path,
       mime_type, size_bytes, company_id, uploaded_by, created_at
FROM documents
WHERE id = $1 AND company_id = $2
LIMIT 1;

-- name: ListDocumentsByEntity :many
SELECT id, filename, storage_path, mime_type, size_bytes,
       uploaded_by, created_at
FROM documents
WHERE entity_id = $1 AND entity_type = $2 AND company_id = $3
ORDER BY created_at DESC;

-- name: CountDocumentsByEntity :one
SELECT COUNT(*) FROM documents
WHERE entity_id = $1 AND entity_type = $2;

-- name: CreateDocument :one
INSERT INTO documents (
  entity_id, entity_type, filename, storage_path,
  mime_type, size_bytes, company_id, uploaded_by, created_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: DeleteDocument :exec
DELETE FROM documents
WHERE id = $1 AND company_id = $2;
