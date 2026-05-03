package embedding

/*
#cgo CFLAGS: -I../../llama.cpp/include
#cgo LDFLAGS: -L../../llama.cpp/build -llama -lm -lstdc++ -lpthread
#include "llama.h"
#include <stdlib.h>
#include <string.h>
*/
import "C"

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"unsafe"

	_ "embed"
)

//go:embed ../../../models/bge-small-en-v1.5.Q8_0.gguf
var embeddedModel []byte

//go:embed ../../../models/adapter_weights.bin
var embeddedAdapter []byte

// Embedder generates embeddings using llama.cpp via CGo.
// It loads a frozen GGUF embedding model (bge-small-en-v1.5.Q8_0) and
// produces normalized L2 vectors of size 384. Optionally applies a linear
// adapter for domain adaptation when useAdapter=true.
type Embedder struct {
	model     *C.struct_llama_model
	ctx       *C.struct_llama_context
	vocab     *C.struct_llama_vocab
	adapterW  [384 * 384]float32
	useAdapter bool
}

// NewEmbedder creates a new CGo-based embedder.
// If useAdapter is true, it loads adapter_weights.bin and applies linear transformation.
// It extracts the embedded GGUF to a temp file (llama.cpp requires a file path),
// loads the model via llama.cpp, and prepares the inference context.
func NewEmbedder(useAdapter bool) (*Embedder, error) {
	// 1. Extract embedded GGUF to temp file
	modelFile := filepath.Join(os.TempDir(), "bge-small-en-v1.5.Q8_0.gguf")

	// Write only if not already present (avoids repeated extraction on restarts)
	if _, err := os.Stat(modelFile); err != nil {
		if err := os.WriteFile(modelFile, embeddedModel, 0644); err != nil {
			return nil, fmt.Errorf("failed to extract model to temp: %w", err)
		}
	}

	// 2. Load model via llama.cpp C API
	modelParams := C.llama_model_default_params()
	modelParams.n_gpu_layers = C.int(0) // CPU only
	modelParams.use_mmap = C.bool(true)

	modelPathC := C.CString(modelFile)
	defer C.free(unsafe.Pointer(modelPathC))

	model := C.llama_model_load_from_file(modelPathC, modelParams)
	if model == nil {
		return nil, fmt.Errorf("failed to load model from %s", modelFile)
	}

	// 3. Create context
	ctxParams := C.llama_context_default_params()
	ctxParams.n_ctx = C.uint(512)    // embedding window
	ctxParams.n_batch = C.uint(32)   // batch size
	ctxParams.n_threads = C.int(runtime.NumCPU() - 1)

	ctx := C.llama_init_from_model(model, ctxParams)
	if ctx == nil {
		C.llama_model_free(model)
		return nil, fmt.Errorf("failed to create llama context")
	}

	// 4. Get vocabulary
	vocab := C.llama_model_get_vocab(model)

	e := &Embedder{
		model:      model,
		ctx:        ctx,
		vocab:      vocab,
		useAdapter: useAdapter,
	}

	if useAdapter {
		if len(embeddedAdapter) != 384*384*4 {
			return nil, fmt.Errorf("adapter weights size invalid: got %d, want %d", len(embeddedAdapter), 384*384*4)
		}
		binary.Read(bytes.NewReader(embeddedAdapter), binary.LittleEndian, e.adapterW[:])
	}

	return e, nil
}

// GenerateEmbedding produces a single embedding vector for the given text.
// It tokenizes the input, runs a forward pass through the model, extracts
// the last token's embedding (sentence-level pooling), L2-normalizes it, and
// returns a []float32 slice.
func (e *Embedder) GenerateEmbedding(text string) ([]float32, error) {
	if text == "" {
		// Return zero vector of correct size
		nEmb := int(C.llama_n_embd(e.model))
		vec := make([]float32, nEmb)
		return vec, nil
	}

	// Tokenize: first call to get required token count
	textC := C.CString(text)
	defer C.free(unsafe.Pointer(textC))

	nTokens := C.llama_tokenize(
		e.vocab,
		textC,
		C.int(len(text)),
		nil, // tokens output (null to get count)
		0,   // token array size (0 = get required size)
		true, // add special tokens
		true, // parse special tokens
	)
	if nTokens < 0 {
		return nil, fmt.Errorf("tokenization failed")
	}

	// Allocate token buffer and tokenize for real
	tokens := make([]C.llama_token, nTokens)
	actualTokens := C.llama_tokenize(
		e.vocab,
		textC,
		C.int(len(text)),
		&tokens[0],
		C.int(nTokens),
		true,
		true,
	)
	if actualTokens < 0 {
		return nil, fmt.Errorf("tokenization failed on second pass")
	}
	nTokens = actualTokens

	// Create batch from tokens
	batch := C.llama_batch_get_one(&tokens[0], C.int(nTokens))

	// Decode: run forward pass
	if C.llama_decode(e.ctx, batch) != 0 {
		return nil, fmt.Errorf("llama_decode failed")
	}

	// Get embeddings pointer
	embData := C.llama_get_embeddings(e.ctx)
	if embData == nil {
		return nil, fmt.Errorf("llama_get_embeddings returned nil")
	}

	// Embedding dimension
	nEmb := C.llama_n_embd(e.model)
	embSize := int(nEmb)

	// Total tokens in cache (last sequence, seq_id=-1)
	totalTokens := int(C.llama_n_seq_elem(e.ctx, -1))
	if totalTokens < 1 {
		return nil, fmt.Errorf("no tokens in context after decode")
	}

	// Use embedding of the last token as sentence vector
	lastTokenIdx := totalTokens - 1
	offset := lastTokenIdx * embSize

	// Copy from C array to Go slice
	vec := make([]float32, embSize)
	for i := 0; i < embSize; i++ {
		vec[i] = *(*C.float)(unsafe.Pointer(uintptr(unsafe.Pointer(embData)) + uintptr(offset+i)*unsafe.Sizeof(C.float(0))))
	}

	// L2 normalize
	vec = normalizeVector(vec)

	// Apply linear adapter if enabled
	if e.useAdapter {
		vec = e.applyAdapter(vec)
	}

	return vec, nil
}

// applyAdapter applies the linear transformation W (384×384) to v.
// W is stored in row-major order: W[j*384 + i] = W_ji such that out[i] = sum_j v[j] * W[j,i].
func (e *Embedder) applyAdapter(v []float32) []float32 {
	out := make([]float32, 384)
	for i := 0; i < 384; i++ {
		var sum float32
		for j := 0; j < 384; j++ {
			sum += v[j] * e.adapterW[j*384+i]
		}
		out[i] = sum
	}
	return out
}

// Tokenize converts text into a slice of llama tokens.
func (e *Embedder) Tokenize(text string) ([]C.llama_token, error) {
	textC := C.CString(text)
	defer C.free(unsafe.Pointer(textC))

	nTokens := C.llama_tokenize(
		e.vocab,
		textC,
		C.int(len(text)),
		nil,
		0,
		true,
		true,
	)
	if nTokens < 0 {
		return nil, fmt.Errorf("tokenization failed")
	}
	if nTokens == 0 {
		return []C.llama_token{}, nil
	}
	tokens := make([]C.llama_token, nTokens)
	actual := C.llama_tokenize(
		e.vocab,
		textC,
		C.int(len(text)),
		&tokens[0],
		C.int(nTokens),
		true,
		true,
	)
	if actual < 0 {
		return nil, fmt.Errorf("tokenization failed on second pass")
	}
	return tokens, nil
}

// TokensToText converts a slice of tokens back into a string.
func (e *Embedder) TokensToText(tokens []C.llama_token) (string, error) {
	var result []byte
	for _, token := range tokens {
		buf := make([]byte, 128)
		n := C.llama_token_to_piece(
			e.vocab,
			token,
			(*C.char)(unsafe.Pointer(&buf[0])),
			C.int(len(buf)),
			1,
			C.bool(true),
		)
		if n > 0 {
			result = append(result, buf[:n]...)
		}
	}
	return string(result), nil
}

// CheckHealth returns true if the embedder is ready (model and context loaded).
func (e *Embedder) CheckHealth() bool {
	return e != nil && e.model != nil && e.ctx != nil
}

// GetModelInfo returns information about the loaded embedding model.
func (e *Embedder) GetModelInfo() map[string]interface{} {
	info := make(map[string]interface{})
	if e != nil {
		info["model_path"] = e.modelPath
		info["model_ready"] = e.model != nil && e.ctx != nil
	} else {
		info["model_ready"] = false
	}
	info["engine"] = "llama.cpp (CGo)"
	return info
}

// GenerateBatch generates embeddings for multiple texts, calling GenerateEmbedding
// for each item. batchSize is currently ignored (sequential implementation).
// Returns a [][]float32 where each inner slice is an embedding vector.
func (e *Embedder) GenerateBatch(texts []string, batchSize int) ([][]float32, error) {
	if batchSize <= 0 {
		batchSize = 32
	}
	embeddings := make([][]float32, len(texts))
	for i, text := range texts {
		emb, err := e.GenerateEmbedding(text)
		if err != nil {
			return nil, fmt.Errorf("failed to generate embedding for text %d: %w", i, err)
		}
		embeddings[i] = emb
	}
	return embeddings, nil
}

// Close frees the llama context and model. It is safe to call multiple times.
func (e *Embedder) Close() {
	if e.ctx != nil {
		C.llama_free(e.ctx)
		e.ctx = nil
	}
	if e.model != nil {
		C.llama_model_free(e.model)
		e.model = nil
	}
	e.vocab = nil
}

// normalizeVector applies L2 normalization to v in-place and returns it.
// If the vector norm is < 1e-12, returns a zero vector unchanged to avoid div-by-zero.
func normalizeVector(v []float32) []float32 {
	var sumSq float64
	for _, x := range v {
		sumSq += float64(x * x)
	}
	norm := math.Sqrt(sumSq)
	if norm < 1e-12 {
		return v // degenerate case: leave as-is (zero vector)
	}
	invNorm := 1.0 / norm
	for i := range v {
		v[i] *= float32(invNorm)
	}
	return v
}
