//go:build cgo

// Package minirag provides local LLM and vector search capabilities.
// This file (cgo_llama.go) is a CGo-based implementation using llama.cpp.
// It is OPTIONAL and EXPERIMENTAL — the build tag "cgo" means it only
// compiles when CGO_ENABLED=1 is set.
//
// Production default: Ollama HTTP API (see OllamaClient in local_client.go).
// To use CGo: set CGO_ENABLED=1 and ensure llama.cpp is built in:
//   internal/ai/minirag/llama.cpp/ (built with cmake)
package minirag

/*
#cgo CFLAGS: -I./llama.cpp/include
#cgo LDFLAGS: -L./llama.cpp/build -llama -lm -lstdc++ -lpthread
#include "llama.h"
#include <stdlib.h>
#include <string.h>
*/
import "C"
import (
	"fmt"
	"unsafe"
)

// cgoLLMInference implements LLM inference using llama.cpp via CGo.
// This is optional — LocalClient falls back to Ollama HTTP if CGo is not available.
type cgoLLMInference struct {
	modelPath string
	model     *C.llama_model_t
	ctx       *C.llama_context_t
	vocab     *C.llama_vocab_t
	ready     bool
}

// NewCgoLLMInference creates a new CGo-based LLM inference engine
func NewCgoLLMInference(modelPath string) *cgoLLMInference {
	return &cgoLLMInference{
		modelPath: modelPath,
		ready:     false,
	}
}

// LoadModel loads the GGUF model into memory using llama.cpp
func (l *cgoLLMInference) LoadModel() error {
	if l.ready {
		return nil
	}

	// Initialize backend
	C.ggml_backend_load_all()

	// Configure model parameters
	modelParams := C.llama_model_default_params()
	modelParams.n_gpu_layers = C.int(0) // CPU only (set to >0 for GPU)
	modelParams.use_mmap = C.bool(true)

	// Load model
	modelPathC := C.CString(l.modelPath)
	defer C.free(unsafe.Pointer(modelPathC))

	l.model = C.llama_model_load_from_file(modelPathC, modelParams)
	if l.model == nil {
		return fmt.Errorf("failed to load model from %s", l.modelPath)
	}

	// Configure context parameters
	ctxParams := C.llama_context_default_params()
	ctxParams.n_ctx = C.uint(32768)   // Context window (Qwen2.5 supports 32K)
	ctxParams.n_batch = C.uint(512)   // Batch size
	ctxParams.n_threads = C.int(8)    // CPU threads
	ctxParams.flash_attn = C.bool(true) // Enable flash attention

	l.ctx = C.llama_init_from_model(l.model, ctxParams)
	if l.ctx == nil {
		C.llama_model_free(l.model)
		l.model = nil
		return fmt.Errorf("failed to create context")
	}

	// Get vocabulary
	l.vocab = C.llama_model_get_vocab(l.model)

	l.ready = true
	return nil
}

// Generate performs inference using llama.cpp
func (l *cgoLLMInference) Generate(prompt string) (string, error) {
	if !l.ready {
		if err := l.LoadModel(); err != nil {
			return "", fmt.Errorf("failed to load model: %w", err)
		}
	}

	// Tokenize prompt
	promptC := C.CString(prompt)
	defer C.free(unsafe.Pointer(promptC))

	nTokens := C.llama_tokenize(
		l.vocab,
		promptC,
		C.int(len(prompt)),
		nil, // tokens output
		0,    // token array size (0 = get required size)
		true, // add special tokens
		true, // parse special tokens
	)

	if nTokens < 0 {
		return "", fmt.Errorf("tokenization failed")
	}

	tokens := make([]C.llama_token, nTokens)
	C.llama_tokenize(
		l.vocab,
		promptC,
		C.int(len(prompt)),
		&tokens[0],
		C.int(nTokens),
		true,
		true,
	)

	// Create batch
	batch := C.llama_batch_get_one(&tokens[0], C.int(nTokens))
	if C.llama_decode(l.ctx, batch) != 0 {
		return "", fmt.Errorf("failed to decode prompt")
	}

	// Sampling parameters
	samplerChainParams := C.llama_sampler_chain_default_params()
	sampler := C.llama_sampler_chain_init(samplerChainParams)

	// Add samplers
	C.llama_sampler_chain_add(sampler, C.llama_sampler_init_top_k(40))
	C.llama_sampler_chain_add(sampler, C.llama_sampler_init_top_p(0.95, 1))
	C.llama_sampler_chain_add(sampler, C.llama_sampler_init_temp(0.8))
	C.llama_sampler_chain_add(sampler, C.llama_sampler_init_dist(C.LLAMA_DEFAULT_SEED))

	// Generate tokens
	var outputTokens []C.llama_token
	maxTokens := 2048

	for i := 0; i < maxTokens; i++ {
		// Sample next token
		newToken := C.llama_sampler_sample(sampler, l.ctx, C.int(-1))

		// Check for end of generation
		if C.llama_vocab_is_eog(l.vocab, newToken) {
			break
		}

		outputTokens = append(outputTokens, newToken)

		// Prepare next batch
		batch = C.llama_batch_get_one(&newToken, 1)
		if C.llama_decode(l.ctx, batch) != 0 {
			break
		}
	}

	// Convert tokens to text
	var result []byte
	for _, token := range outputTokens {
		buf := make([]byte, 128)
		n := C.llama_token_to_piece(l.vocab, token, (*C.char)(unsafe.Pointer(&buf[0])), C.int(len(buf)), 1, C.bool(true))
		if n > 0 {
			result = append(result, buf[:n]...)
		}
	}

	// Cleanup sampler
	C.llama_sampler_free(sampler)

	return string(result), nil
}

// Close frees the model and context
func (l *cgoLLMInference) Close() {
	if l.ctx != nil {
		C.llama_free(l.ctx)
		l.ctx = nil
	}
	if l.model != nil {
		C.llama_model_free(l.model)
		l.model = nil
	}
	l.ready = false
}

// CgoLLMLocalClient wraps cgoLLMInference for our LocalClient interface
type CgoLLMLocalClient struct {
	inference *cgoLLMInference
	modelPath string
}

// NewCgoLLMLocalClient creates a new CGo-based local LLM client
func NewCgoLLMLocalClient(modelPath string) *CgoLLMLocalClient {
	return &CgoLLMLocalClient{
		modelPath: modelPath,
		inference: NewCgoLLMInference(modelPath),
	}
}

// Generate generates text using the embedded llama.cpp engine
func (c *CgoLLMLocalClient) Generate(ctx context.Context, prompt, system string) (string, error) {
	// Build Qwen2.5-Instruct chat format
	// Format: <|system|>\n{system}<|end|>\n<|user|>\n{prompt}<|end|>\n<|assistant|>
	var fullPrompt string
	if system != "" {
		fullPrompt = fmt.Sprintf("<|system|>\n%s<|end|>\n<|user|>\n%s<|end|>\n<|assistant|>", system, prompt)
	} else {
		fullPrompt = fmt.Sprintf("<|user|>\n%s<|end|>\n<|assistant|>", prompt)
	}

	result, err := c.inference.Generate(fullPrompt)
	if err != nil {
		return "", err
	}

	return result, nil
}

// CheckHealth checks if the model is loaded
func (c *CgoLLMLocalClient) CheckHealth() bool {
	return c.inference != nil && c.inference.ready
}

// GetModelInfo returns information about the model
func (c *CgoLLMLocalClient) GetModelInfo() map[string]interface{} {
	info := make(map[string]interface{})
	info["model_path"] = c.modelPath
	info["model_ready"] = c.inference != nil && c.inference.ready
	info["engine"] = "llama.cpp (CGo)"
	return info
}

// Note: llama.cpp CGo integration requires:
// 1. llama.cpp cloned and built in internal/ai/minirag/llama.cpp
// 2. Build commands in CI:
//    cd internal/ai/minirag/llama.cpp && mkdir -p build && cd build && cmake .. && make -j4
// 3. Go build with CGo enabled: CGO_ENABLED=1 go build
