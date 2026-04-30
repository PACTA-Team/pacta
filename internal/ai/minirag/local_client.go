package minirag

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"
)

// LLMInference provides local LLM inference without external dependencies
// This is a placeholder for the actual embedded LLM engine
// In production, this would use:
// - llama.cpp via CGO
// - or pure Go transformer inference (e.g., gorgonia)
// - or ONNX Runtime with Go bindings
type LLMInference struct {
	ModelPath string
	ModelData []byte // Embedded model weights
	Ready     bool
}

// NewLLMInference creates a new embedded LLM inference engine
func NewLLMInference(modelPath string) *LLMInference {
	return &LLMInference{
		ModelPath: modelPath,
		Ready:     false,
	}
}

// LoadModel loads the embedded Qwen2.5-0.5B model into memory
func (l *LLMInference) LoadModel() error {
	// TODO: Implement actual model loading
	// For Qwen2.5-0.5B-Instruct (0.5B parameters, ~429MB Q4_0):
	// 1. Read GGUF file from embedded resources
	// 2. Initialize inference context
	// 3. Load weights into memory
	// 4. Set ready flag
	
	// Placeholder for now
	l.Ready = true
	return nil
}

// Generate performs local inference without external APIs
func (l *LLMInference) Generate(ctx context.Context, prompt string, system string) (string, error) {
	if !l.Ready {
		if err := l.LoadModel(); err != nil {
			return "", fmt.Errorf("failed to load model: %w", err)
		}
	}

	// TODO: Implement actual inference
	// 1. Tokenize input (prompt + system)
	// 2. Run transformer forward pass
	// 3. Sample tokens iteratively
	// 4. Detokenize output
	
	// Placeholder response
	return "Embedded LLM inference not yet implemented. Use Ollama fallback for now.", nil
}

// GenerateEmbedding generates embeddings locally
func (l *LLMInference) GenerateEmbedding(text string) ([]float32, error) {
	// TODO: Implement embedding generation
	// For all-MiniLM-L6-v2 (384 dim):
	// 1. Tokenize text
	// 2. Run through embedding model
	// 3. Pool/normalize output
	
	// Placeholder
	emb := make([]float32, 384)
	// Simple hash-based embedding as fallback
	hash := uint32(0)
	for _, ch := range text {
		hash = hash*31 + uint32(ch)
	}
	for i := range emb {
		hash = hash*31 + uint32(i)
		emb[i] = float32((hash%2000)-1000) / 1000.0
	}
	return normalizeVector(emb), nil
}

// OllamaClient provides fallback to Ollama if embedded inference is not available
type OllamaClient struct {
	Endpoint string
	Model    string
	Timeout  time.Duration
	client   *http.Client
}

// NewOllamaClient creates a client for Ollama fallback
func NewOllamaClient(endpoint, model string) *OllamaClient {
	if endpoint == "" {
		endpoint = "http://localhost:11434"
	}
	if model == "" {
		model = "qwen2.5-0.5b-instruct" // Default: lightest model satisfying <500MB binary size constraint
	}
	return &OllamaClient{
		Endpoint: endpoint,
		Model:    model,
		Timeout:  120 * time.Second,
		client:   &http.Client{Timeout: 120 * time.Second},
	}
}

// NewOllamaClient creates a client for Ollama fallback
func NewOllamaClient(endpoint, model string) *OllamaClient {
	if endpoint == "" {
		endpoint = "http://localhost:11434"
	}
	if model == "" {
		model = "qwen2.5-0.5b-instruct" // Default: lightest model satisfying <500MB constraint
	}
	return &OllamaClient{
		Endpoint: endpoint,
		Model:    model,
		Timeout:  120 * time.Second,
		client:   &http.Client{Timeout: 120 * time.Second},
	}
}

// Generate uses Ollama as fallback
func (c *OllamaClient) Generate(ctx context.Context, prompt, system string) (string, error) {
	reqBody := map[string]interface{}{
		"model":  c.Model,
		"prompt": prompt,
		"stream": false,
		"options": map[string]interface{}{
			"temperature":   0.7,
			"top_p":         0.9,
			"num_predict":   2048,
		},
	}

	if system != "" {
		reqBody["system"] = system
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST",
		c.Endpoint+"/api/generate",
		bytes.NewReader(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Ollama error (status %d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Response string `json:"response"`
		Done     bool   `json:"done"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return result.Response, nil
}

// LocalClient is the main interface for local LLM.
// Supports 3 modes (configurable from frontend):
//   - "cgo": CGo + llama.cpp with Qwen2.5-0.5B-Instruct embedded in binary (PREFERRED)
//   - "ollama": Ollama HTTP API (alternative local option)
//   - "external": External APIs (OpenAI, Groq, etc.)
// The mode is selected via RAG settings in the frontend admin panel.
type LocalClient struct {
	inference *cgoLLMInference // CGo mode (Qwen2.5-0.5B-Instruct embedded)
	ollama    *OllamaClient    // Ollama HTTP mode (alternative local)
	mode      string           // "cgo" | "ollama" | "external"
	modelPath string
}

// NewLocalClient creates a new local LLM client.
// - mode: "cgo" for embedded (Qwen2.5-0.5B-Instruct), "ollama" for HTTP API
// - modelPath: path to GGUF model (for CGo mode)
// - ollamaEndpoint: Ollama API endpoint (for Ollama mode)
func NewLocalClient(mode, modelPath, ollamaEndpoint string) *LocalClient {
	c := &LocalClient{
		mode:      mode,
		modelPath: modelPath,
	}

	// Initialize based on mode
	switch mode {
	case "cgo":
		// CGo + llama.cpp with Qwen2.5-0.5B-Instruct embedded
		if modelPath == "" {
			modelPath = "qwen2.5-0.5b-instruct-q4_0.gguf"
		}
		// Normalize: if just a filename, prepend models directory
		if !strings.ContainsAny(modelPath, "/\\") {
			modelPath = filepath.Join("internal", "ai", "minirag", "models", modelPath)
		}
		c.inference = NewCgoLLMInference(modelPath)
	case "ollama":
		// Ollama HTTP API
		c.ollama = NewOllamaClient(ollamaEndpoint, "")
	default:
		// Fallback: try Ollama
		c.ollama = NewOllamaClient(ollamaEndpoint, "")
	}

	return c
}

	// Initialize based on mode
	switch mode {
	case "cgo":
		// CGo + llama.cpp with Qwen2.5-0.5B-Instruct embedded
		if modelPath == "" {
			modelPath = "qwen2.5-0.5b-instruct-q4_0.gguf"
		}
		c.inference = NewCgoLLMInference(modelPath)
	case "ollama":
		// Ollama HTTP API
		c.ollama = NewOllamaClient(ollamaEndpoint, "")
	default:
		// Fallback: try Ollama
		c.ollama = NewOllamaClient(ollamaEndpoint, "")
	}

	return c
}

// NewLocalClient creates a new local LLM client.
// - If modelPath is provided and CGo is enabled, it tries llama.cpp first.
// - Ollama HTTP client is always set up as fallback.
// - Production recommendation: use Ollama only (set modelPath="").
func NewLocalClient(modelPath, ollamaEndpoint string) *LocalClient {
	c := &LocalClient{
		modelPath: modelPath,
		useCGo:   false,
	}

	// Try CGo inference if model path provided and CGo is available
	// (cgoLLMInference will be nil if CGO_ENABLED=0)
	if modelPath != "" {
		// Normalize: if just a filename, prepend models directory
		normPath := modelPath
		if !strings.ContainsAny(normPath, "/\\") {
			normPath = filepath.Join("internal", "ai", "minirag", "models", normPath)
		}
		c.inference = NewCgoLLMInference(normPath)
		if c.inference != nil {
			c.useCGo = true
		}
	}

	// Always setup Ollama as fallback (production path)
	c.ollama = NewOllamaClient(ollamaEndpoint, "")

	return c
}

// Generate generates text using the configured local method
// Mode "cgo": uses llama.cpp embedded inference (Qwen2.5-0.5B-Instruct)
// Mode "ollama": uses Ollama HTTP API
// Mode "external": falls back to external APIs (handled by orchestrator)
func (c *LocalClient) Generate(ctx context.Context, prompt, system string) (string, error) {
	switch c.mode {
	case "cgo":
		// CGo + llama.cpp with Qwen2.5-0.5B-Instruct embedded
		if c.inference != nil {
			result, err := c.inference.Generate(prompt)
			if err == nil {
				return result, nil
			}
			return "", fmt.Errorf("cgo inference failed: %w", err)
		}
		return "", fmt.Errorf("cgo mode selected but inference not initialized")

	case "ollama":
		// Ollama HTTP API
		if c.ollama != nil {
			return c.ollama.Generate(ctx, prompt, system)
		}
		return "", fmt.Errorf("ollama mode selected but client not initialized")

	default:
		// Unknown mode, try Ollama as fallback
		if c.ollama != nil {
			return c.ollama.Generate(ctx, prompt, system)
		}
		return "", fmt.Errorf("no local LLM available (mode=%s)", c.mode)
	}
}

// CheckHealth checks if local LLM is available based on configured mode
func (c *LocalClient) CheckHealth() bool {
	switch c.mode {
	case "cgo":
		return c.inference != nil && c.inference.ready
	case "ollama":
		if c.ollama != nil {
			return c.ollama.CheckHealth()
		}
		return false
	default:
		// Try Ollama as fallback
		if c.ollama != nil {
			return c.ollama.CheckHealth()
		}
		return false
	}
}

// GetModelInfo returns information about the local model
func (c *LocalClient) GetModelInfo() map[string]interface{} {
	info := make(map[string]interface{})
	info["mode"] = c.mode

	switch c.mode {
	case "cgo":
		if c.inference != nil {
			info["engine"] = "llama.cpp (CGo) - Qwen2.5-0.5B-Instruct embedded"
			info["model_path"] = c.inference.modelPath
			info["model_ready"] = c.inference.ready
		}
	case "ollama":
		if c.ollama != nil {
			info["engine"] = "Ollama HTTP API"
			info["ollama_endpoint"] = c.ollama.Endpoint
			info["ollama_model"] = c.ollama.Model
		}
	}

	return info
}


