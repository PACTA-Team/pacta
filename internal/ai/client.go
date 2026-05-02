package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/PACTA-Team/pacta/internal/ai/minirag"
)

// LLM is the minimal interface required for language model generation.
type LLM interface {
	Generate(ctx context.Context, prompt string, context string) (string, error)
}

// LLMClient handles communication with LLM providers
type LLMClient struct {
	Provider   LLMProvider
	APIKey    string
	Model     string
	Endpoint   string
	HTTPClient *http.Client

	// Local LLM support
	LocalClient *minirag.LocalClient
}

// NewLLMClient creates a new LLM client
func NewLLMClient(provider LLMProvider, apiKey, model, endpoint string) *LLMClient {
	return &LLMClient{
		Provider:   provider,
		APIKey:    apiKey,
		Model:     model,
		Endpoint:   endpoint,
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// NewLocalLLMClient creates a new local LLM client (for backward compatibility)
func NewLocalLLMClient(model, endpoint string) *LLMClient {
	return &LLMClient{
		Provider:   ProviderCustom,
		Model:     model,
		Endpoint:   endpoint,
		HTTPClient: &http.Client{Timeout: 120 * time.Second},
		LocalClient: minirag.NewLocalClient("cgo", model, endpoint),
	}
}

// Generate sends a prompt to the LLM and returns the generated text
func (c *LLMClient) Generate(ctx context.Context, prompt string, context string) (string, error) {
	// Use local LLM if configured
	if c.LocalClient != nil {
		// Build system prompt for local LLM
		var systemPrompt string
		if c.Provider == ProviderCustom || c.Provider == "" {
			systemPrompt = SystemPromptLegal
			if context != "" {
				systemPrompt = context + "\n\n" + systemPrompt
			}
			return c.LocalClient.Generate(ctx, prompt, systemPrompt)
		}
	}

	switch c.Provider {
	case ProviderOpenAI:
		return c.callOpenAI(ctx, prompt, context)
	case ProviderGroq:
		return c.callGroq(ctx, prompt, context)
	case ProviderAnthropic:
		return c.callAnthropic(ctx, prompt, context)
	case ProviderOpenRouter:
		return c.callOpenRouter(ctx, prompt, context)
	case ProviderCustom:
		if c.LocalClient != nil {
			return c.LocalClient.Generate(ctx, prompt, context)
		}
		return c.callCustom(ctx, prompt, context)
	default:
		return "", fmt.Errorf("unsupported provider: %s", c.Provider)
	}
}

// getEndpoint returns the API endpoint for the provider
func (c *LLMClient) getEndpoint() string {
	if c.Endpoint != "" {
		return c.Endpoint
	}

	switch c.Provider {
	case ProviderOpenAI:
		return "https://api.openai.com/v1/chat/completions"
	case ProviderGroq:
		return "https://api.groq.com/openai/v1/chat/completions"
	case ProviderAnthropic:
		return "https://api.anthropic.com/v1/messages"
	case ProviderOpenRouter:
		return "https://openrouter.ai/api/v1/chat/completions"
	default:
		return c.Endpoint
	}
}

type openAIRequest struct {
	Model    string    `json:"model"`
	Messages []message `json:"messages"`
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (c *LLMClient) callOpenAI(ctx context.Context, prompt, context string) (string, error) {
	reqBody := openAIRequest{
		Model: c.Model,
		Messages: []message{
			{Role: "system", Content: SystemPromptLegal},
			{Role: "user", Content: buildFullPrompt(prompt, context)},
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.getEndpoint(), strings.NewReader(string(jsonData)))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	var openAIResp openAIResponse
	if err := json.Unmarshal(body, &openAIResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if openAIResp.Error != nil {
		return "", fmt.Errorf("LLM API error: %s", openAIResp.Error.Message)
	}

	if len(openAIResp.Choices) == 0 {
		return "", fmt.Errorf("no response from LLM")
	}

	return openAIResp.Choices[0].Message.Content, nil
}

func (c *LLMClient) callGroq(ctx context.Context, prompt, context string) (string, error) {
	return c.callOpenAI(ctx, prompt, context)
}

func (c *LLMClient) callAnthropic(ctx context.Context, prompt, context string) (string, error) {
	return "", fmt.Errorf("anthropic not yet implemented")
}

func (c *LLMClient) callOpenRouter(ctx context.Context, prompt, context string) (string, error) {
	return c.callOpenAI(ctx, prompt, context)
}

func (c *LLMClient) callCustom(ctx context.Context, prompt, context string) (string, error) {
	return c.callOpenAI(ctx, prompt, context)
}

func buildFullPrompt(prompt, context string) string {
	if context != "" {
		return context + "\n\n" + prompt
	}
	return prompt
}
