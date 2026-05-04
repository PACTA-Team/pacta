package server

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/PACTA-Team/pacta/internal/db"
)

var ErrAccessDenied = fmt.Errorf("access denied")

var allowedTables = map[string]bool{
	"contracts":       true,
	"clients":         true,
	"suppliers":       true,
	"documents":       true,
	"users":           true,
	"companies":       true,
	"user_companies":  true,
	"pending_approvals": true,
	"audit_logs":      true,
}

func validateTableName(table string) bool {
	return allowedTables[table]
}

func EnforceCompanyAccess(queries *db.Queries, userID, companyID int) error {
	count, err := queries.CountUserCompanyAccess(context.Background(), userID, companyID)
	if err != nil {
		return err
	}
	if count == 0 {
		return ErrAccessDenied
	}
	return nil
}

func EnforceOwnership(db *sql.DB, companyID int, resourceID int, table string) error {
	if !validateTableName(table) {
		return fmt.Errorf("invalid table name: %s", table)
	}

	query := fmt.Sprintf(`
		SELECT COUNT(*) FROM %s 
		WHERE id = ? AND company_id = ? AND deleted_at IS NULL
	`, table)

	var count int
	err := db.QueryRow(query, resourceID, companyID).Scan(&count)
	if err != nil {
		return err
	}
	if count == 0 {
		return ErrAccessDenied
	}
	return nil
}