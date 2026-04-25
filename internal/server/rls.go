package server

import (
	"database/sql"
	"fmt"
)

var ErrAccessDenied = fmt.Errorf("access denied")

func EnforceCompanyAccess(db *sql.DB, userID, companyID int) error {
	var count int
	err := db.QueryRow(`
		SELECT COUNT(*) FROM user_companies 
		WHERE user_id = ? AND company_id = ? AND deleted_at IS NULL
	`, userID, companyID).Scan(&count)
	if err != nil {
		return err
	}
	if count == 0 {
		return ErrAccessDenied
	}
	return nil
}

func EnforceOwnership(db *sql.DB, companyID int, resourceID int, table string) error {
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