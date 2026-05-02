-- ============================================================
-- user_companies queries
-- ============================================================

-- name: GetUserCompanyCount :one
SELECT COUNT(*) FROM user_companies
WHERE user_id = $1 AND company_id = $2;

-- name: AddUserToCompany :exec
INSERT INTO user_companies (user_id, company_id, is_default, created_at)
VALUES ($1, $2, $3, CURRENT_TIMESTAMP);

-- name: SetDefaultCompany :exec
UPDATE user_companies
SET is_default = $2
WHERE user_id = $1 AND company_id = $2;

-- name: UnsetAllDefaultCompanies :exec
UPDATE user_companies
SET is_default = 0
WHERE user_id = $1;
