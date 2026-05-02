-- ============================================================
-- contracts queries
-- ============================================================

-- name: GetContractByID :one
SELECT
  c.id, c.internal_id, c.contract_number, c.title,
  c.client_id, c.supplier_id, c.client_signer_id, c.supplier_signer_id,
  c.start_date, c.end_date, c.amount, c.type, c.status,
  c.description, c.object, c.fulfillment_place, c.dispute_resolution,
  c.has_confidentiality, c.guarantees, c.renewal_type,
  c.document_url, c.document_key,
  c.company_id, c.created_by, c.created_at, c.updated_at
FROM contracts c
WHERE c.id = $1 AND c.deleted_at IS NULL AND c.company_id = $2
LIMIT 1;

-- name: GetContractByInternalID :one
SELECT * FROM contracts
WHERE internal_id = $1 AND company_id = $2 AND deleted_at IS NULL
LIMIT 1;

-- name: ListContractsByCompany :many
SELECT id, internal_id, contract_number, title, client_id, supplier_id,
       start_date, end_date, amount, type, status, created_at
FROM contracts
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY created_at DESC;

-- name: GetActiveContracts :many
SELECT id, internal_id, contract_number, title, client_id, supplier_id,
       start_date, end_date, amount, type, status
FROM contracts
WHERE company_id = $1 AND deleted_at IS NULL AND status = 'active'
ORDER BY end_date ASC;

-- name: GetExpiringSoonContracts :many
SELECT id, internal_id, contract_number, title, end_date, client_id, supplier_id
FROM contracts
WHERE company_id = $1 AND deleted_at IS NULL
  AND date(end_date) BETWEEN date('now') AND date('now', '+30 days')
  AND status != 'expired'
ORDER BY end_date ASC;

-- name: CountActiveContracts :one
SELECT COUNT(*) FROM contracts
WHERE company_id = $1 AND deleted_at IS NULL AND status = 'active';

-- name: GetContractCountForCompany :one
SELECT COUNT(*) FROM contracts
WHERE company_id = $1 AND deleted_at IS NULL;

-- name: ContractExists :one
SELECT COUNT(*) FROM contracts
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: CreateContract :one
INSERT INTO contracts (
  internal_id, contract_number, title, client_id, supplier_id,
  client_signer_id, supplier_signer_id, start_date, end_date,
  amount, type, status, description, object, fulfillment_place,
  dispute_resolution, has_confidentiality, guarantees, renewal_type,
  document_url, document_key, company_id, created_by, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
  $11, $12, $13, $14, $15, $16, $17, $18, $19,
  $20, $21, $22, $23, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
RETURNING *;

-- name: UpdateContract :one
UPDATE contracts
SET
  title = $2,
  client_signer_id = $3, supplier_signer_id = $4,
  start_date = $5, end_date = $6, amount = $7,
  description = $8, object = $9, fulfillment_place = $10,
  dispute_resolution = $11, has_confidentiality = $12, guarantees = $13,
  renewal_type = $14, document_url = $15, document_key = $16,
  updated_at = CURRENT_TIMESTAMP
WHERE id = $17 AND company_id = $18 AND deleted_at IS NULL
RETURNING *;

-- name: UpdateContractStatus :exec
UPDATE contracts
SET status = $2, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: DeleteContract :exec
UPDATE contracts
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: GetRecentContracts :many
SELECT id, internal_id, contract_number, title, end_date, status
FROM contracts
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2;

-- name: GetContractsByStatus :many
SELECT id, internal_id, contract_number, title, end_date
FROM contracts
WHERE company_id = $1 AND deleted_at IS NULL AND status = $2
ORDER BY end_date ASC;
