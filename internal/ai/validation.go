package ai

import (
	"context"
	"fmt"

	"github.com/PACTA-Team/pacta/internal/db"
)

// ValidateStartupConfig checks AI configuration on startup.
// Returns nil if OK, or an error warning if misconfigured.
func ValidateStartupConfig(queries *db.Queries, encryptionKey string) error {
	// Check if AI is configured in DB
	provider, err := queries.GetSettingValue(context.Background(), "ai_provider")
	if err != nil || provider == "" {
		return nil // AI not configured — okay
	}
	apiKey, err := queries.GetSettingValue(context.Background(), "ai_api_key")
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
