-- ============================================================
-- user_companies queries
-- ============================================================

-- name: GetUserDefaultCompany :one
SELECT company_id FROM user_companies
WHERE user_id = ? AND is_default = 1;

-- name: UserCompanyExists :one
SELECT COUNT(*) FROM user_companies
WHERE user_id = ? AND company_id = ?;

-- name: CreateUserCompany :exec
INSERT INTO user_companies (user_id, company_id, is_default)
VALUES (?, ?, ?);

-- name: CheckUserCompanyAccess :one
SELECT COUNT(*) FROM user_companies
WHERE user_id = ? AND company_id = ?;

-- name: CountUserCompanyAccess :one
SELECT COUNT(*) FROM user_companies
WHERE user_id = ? AND company_id = ? AND deleted_at IS NULL;

-- name: ResetUserDefaultCompanies :exec
UPDATE user_companies SET is_default = 0
WHERE user_id = ?;

-- name: SetDefaultCompany :exec
UPDATE user_companies SET is_default = 1
WHERE user_id = ? AND company_id = ?;

-- name: UpdateUserCompany :exec
UPDATE user_companies SET company_id = ?, is_default = 1
WHERE user_id = ?;
