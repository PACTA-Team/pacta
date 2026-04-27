package handlers

import (
	"testing"
)

// TestValidateAIProvider validates the provider validation helper
func TestValidateAIProvider(t *testing.T) {
	validProviders := []string{"openai", "groq", "anthropic", "openrouter", "custom"}

	for _, provider := range validProviders {
		if !isValidAIProvider(provider) {
			t.Errorf("provider %s should be valid", provider)
		}
	}

	if isValidAIProvider("invalid") {
		t.Error("invalid provider should not be valid")
	}
}

// isValidAIProvider checks if a provider string is valid
func isValidAIProvider(provider string) bool {
	valid := map[string]bool{
		"openai":     true,
		"groq":       true,
		"anthropic":  true,
		"openrouter": true,
		"custom":     true,
	}
	return valid[provider]
}
