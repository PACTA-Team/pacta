package vector

/*
#cgo CFLAGS: -I../../faiss/c_api
#cgo LDFLAGS: -L../../faiss/build -lfaiss
#include <faiss/c_api.h>
#include <stdlib.h>
*/
import "C"

import (
	"errors"
	"fmt"
	"math"
	"unsafe"
)

// FAISSIndex wraps a FAISS IndexFlatIP (inner product) index via CGo.
type FAISSIndex struct {
	index C.faiss_index
	dim   int
}

// SearchResult represents a search result with similarity score.
type SearchResult struct {
	ID    int64
	Score float32
}

// NewFAISSIndex creates a new FAISS index with the given dimension using
// IndexFlatIP (inner product). Returns an error if index creation fails.
func NewFAISSIndex(dim int) (*FAISSIndex, error) {
	var idx C.faiss_index
	cDim := C.size_t(dim)
	cDesc := C.CString("Flat")
	defer C.free(unsafe.Pointer(cDesc))
	// 0 = INNER_PRODUCT per task specification.
	ret := C.faiss_index_factory(&idx, cDim, cDesc, C.FaissMetricType(0))
	if ret != 0 {
		return nil, fmt.Errorf("faiss_index_factory failed: %d", ret)
	}
	return &FAISSIndex{index: idx, dim: dim}, nil
}

// Add inserts a vector with the given ID into the index.
func (f *FAISSIndex) Add(vec []float32, id int64) error {
	if len(vec) != f.dim {
		return fmt.Errorf("dimension mismatch: expected %d, got %d", f.dim, len(vec))
	}
	cVec := (*C.float)(unsafe.Pointer(&vec[0]))
	cID := C.faiss_id_t(id)
	// Add a single vector (n=1).
	ret := C.faiss_index_add_with_ids(f.index, C.size_t(f.dim), cVec, C.faiss_idx_t(1), &cID)
	if ret != 0 {
		return fmt.Errorf("faiss add failed: %d", ret)
	}
	return nil
}

// Search queries the index for the k most similar vectors.
// It returns up to k results sorted by descending score (inner product).
func (f *FAISSIndex) Search(query []float32, k int) []SearchResult {
	if k <= 0 {
		return nil
	}
	if len(query) != f.dim {
		return nil
	}
	cQuery := (*C.float)(unsafe.Pointer(&query[0]))
	cK := C.size_t(k)
	D := make([]float32, k)
	I := make([]C.faiss_id_t, k)
	cD := (*C.float)(unsafe.Pointer(&D[0]))
	cI := (*C.faiss_id_t)(unsafe.Pointer(&I[0]))
	// Search for a single query (n=1).
	ret := C.faiss_index_search(f.index, C.faiss_idx_t(1), cQuery, cK, cD, cI)
	if ret != 0 {
		return nil
	}
	results := make([]SearchResult, k)
	for i := 0; i < k; i++ {
		results[i] = SearchResult{
			ID:    int64(I[i]),
			Score: float32(D[i]),
		}
	}
	return results
}

// Close frees the underlying FAISS index.
func (f *FAISSIndex) Close() {
	if f.index != nil {
		C.faiss_index_free(f.index)
		f.index = nil
	}
}

// normalizeVector applies L2 normalization to v in-place and returns it.
// If the vector norm is < 1e-12, returns the original vector unchanged.
func normalizeVector(v []float32) []float32 {
	var sumSq float64
	for _, x := range v {
		sumSq += float64(x * x)
	}
	norm := math.Sqrt(sumSq)
	if norm < 1e-12 {
		return v
	}
	invNorm := 1.0 / norm
	for i := range v {
		v[i] *= float32(invNorm)
	}
	return v
}
