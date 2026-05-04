-- ============================================================
-- ai_legal queries (legal_documents + ai_legal_chat_history)
-- ============================================================

-- ========== legal_documents ==========

-- name: CreateLegalDocument :one
INSERT INTO legal_documents (
  title, document_type, source, content, content_hash,
  language, jurisdiction, effective_date, publication_date,
  gaceta_number, tags, chunk_count, indexed_at,
  created_at, updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: GetLegalDocument :one
SELECT * FROM legal_documents
WHERE id = ? AND deleted_at IS NULL
LIMIT 1;

-- name: ListLegalDocuments :many
SELECT * FROM legal_documents
WHERE jurisdiction = ? OR ? = ''
ORDER BY created_at DESC;

-- name: UpdateLegalDocumentIndexed :exec
UPDATE legal_documents
SET indexed_at = CURRENT_TIMESTAMP, chunk_count = ?
WHERE id = ? AND deleted_at IS NULL;

-- name: DeleteLegalDocument :exec
UPDATE legal_documents
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = ? AND deleted_at IS NULL;

-- name: CountLegalDocuments :one
SELECT COUNT(*) FROM legal_documents
WHERE deleted_at IS NULL;

-- name: GetLastLegalDocumentIndexTime :one
SELECT MAX(indexed_at) FROM legal_documents
WHERE deleted_at IS NULL;

-- ========== ai_legal_chat_history ==========
-- Note: ai_legal_chat_history does NOT have deleted_at (chat history)

-- name: CreateLegalChatMessage :one
INSERT INTO ai_legal_chat_history (
  user_id, session_id, message_type, content,
  context_documents, metadata, created_at
) VALUES (
  ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: GetLegalChatMessagesBySession :many
SELECT * FROM ai_legal_chat_history
WHERE session_id = ?
ORDER BY created_at ASC;

-- name: GetLegalChatSessionsByUser :many
SELECT
  session_id, user_id, MAX(created_at) as last_message,
  created_at, COUNT(*) as message_count
FROM ai_legal_chat_history
WHERE user_id = ?
GROUP BY session_id, user_id
ORDER BY last_message DESC;

-- name: GetLegalChatHistoryBySession :many
SELECT * FROM ai_legal_chat_history
WHERE session_id = ?
ORDER BY created_at ASC;

-- name: DeleteLegalChatSession :exec
UPDATE ai_legal_chat_history
SET deleted_at = CURRENT_TIMESTAMP
WHERE session_id = ?;
