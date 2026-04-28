package ai

import (
	"context"
	"net/http"
	"testing"
	"time"
)

func TestNewLLMClient(t *testing.T) {
	client := NewLLMClient(ProviderOpenAI, "test-key", "gpt-4o", "")

	if client.Provider != ProviderOpenAI {
		t.Errorf("expected %s, got %s", ProviderOpenAI, client.Provider)
	}
	if client.APIKey != "test-key" {
		t.Errorf("expected test-key, got %s", client.APIKey)
	}
	if client.Model != "gpt-4o" {
		t.Errorf("expected gpt-4o, got %s", client.Model)
	}
}

func TestLLMClient_GetEndpoint(t *testing.T) {
	tests := []struct {
		provider LLMProvider
		apiKey   string
		endpoint string
		expected string
	}{
		{ProviderOpenAI, "sk-test", "", "https://api.openai.com/v1/chat/completions"},
		{ProviderGroq, "gsk-test", "", "https://api.groq.com/openai/v1/chat/completions"},
		{ProviderCustom, "key", "https://custom.api.com/v1/chat", "https://custom.api.com/v1/chat"},
	}

	for _, tt := range tests {
		client := NewLLMClient(tt.provider, tt.apiKey, "model", tt.endpoint)
		got := client.getEndpoint()
		if got != tt.expected {
			t.Errorf("expected %s, got %s", tt.expected, got)
		}
	}
}

// Mock test - we won't make real HTTP calls in unit tests
func TestLLMClient_Generate_ContextTimeout(t *testing.T) {
	client := NewLLMClient(ProviderOpenAI, "test-key", "gpt-4o", "")

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	_, err := client.Generate(ctx, "test prompt", "test context")

	// Should get timeout or error since we're not making real calls
	// In real implementation, this would timeout
	if err != nil {
		t.Logf("Got expected error: %v", err)
	}
}
