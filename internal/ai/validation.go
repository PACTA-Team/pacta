package ai

import (
	"database/sql"
	"fmt"
)

// ValidateStartupConfig checks AI configuration on startup.
// Returns nil if OK, or an error warning if misconfigured.
func ValidateStartupConfig(db *sql.DB, encryptionKey string) error {
	// Check if AI is configured in DB
	var provider, apiKey string
	err := db.QueryRow("SELECT value FROM system_settings WHERE key = 'ai_provider' AND deleted_at IS NULL").Scan(&provider)
	if err != nil || provider == "" {
		return nil // AI not configured — okay
	}
	err = db.QueryRow("SELECT value FROM system_settings WHERE key = 'ai_api_key' AND deleted_at IS NULL").Scan(&apiKey)
	if err != nil || apiKey == "" {
		return fmt.Errorf("AI provider configured but API key missing in database")
	}
	if encryptionKey == "" {
		return fmt.Errorf("AI_ENCRYPTION_KEY environment variable is required when AI is configured")
	}
	if len(encryptionKey) != 16 && len(encryptionKey) != 24 && len(encryptionKey) != 32 {
		return fmt.Errorf("AI_ENCRYPTION_KEY must be 16, 24, or 32 bytes; got %d", len(encryptionKey))
	}
	return nil
}
