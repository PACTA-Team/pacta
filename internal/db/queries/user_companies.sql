-- ============================================================
-- user_companies queries
-- ============================================================

-- name: GetUserDefaultCompany :one
SELECT company_id FROM user_companies
WHERE user_id = $1 AND is_default = 1;

-- name: UserCompanyExists :one
SELECT COUNT(*) FROM user_companies
WHERE user_id = $1 AND company_id = $2;

-- name: CreateUserCompany :exec
INSERT INTO user_companies (user_id, company_id, is_default)
VALUES ($1, $2, $3);

-- name: CheckUserCompanyAccess :one
SELECT COUNT(*) FROM user_companies
WHERE user_id = $1 AND company_id = $2;

-- name: CountUserCompanyAccess :one
SELECT COUNT(*) FROM user_companies
WHERE user_id = $1 AND company_id = $2 AND deleted_at IS NULL;

-- name: ResetUserDefaultCompanies :exec
UPDATE user_companies SET is_default = 0
WHERE user_id = $1;

-- name: SetDefaultCompany :exec
UPDATE user_companies SET is_default = 1
WHERE user_id = $1 AND company_id = $2;

-- name: UpdateUserCompany :exec
UPDATE user_companies SET company_id = $2, is_default = 1
WHERE user_id = $1;
