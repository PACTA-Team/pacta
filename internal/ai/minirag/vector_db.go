package minirag

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sync"
)

// VectorDB represents a local vector database using HNSW for similarity search
type VectorDB struct {
	mu       sync.RWMutex
	index    *hnswIndex
	metadata map[string]DocumentMeta
	path     string
	dim      int
}

// DocumentMeta stores metadata for a document
type DocumentMeta struct {
	ID          string            `json:"id"`
	Title       string            `json:"title"`
	Type        string            `json:"type"`
	Source      string            `json:"source"`
	Content     string            `json:"content"`
	CreatedAt   string            `json:"created_at"`
	ExtraFields map[string]string `json:"extra_fields,omitempty"`
}

// SearchResult represents a search result with similarity score
type SearchResult struct {
	ID      string  `json:"id"`
	Score   float32 `json:"score"`
	Meta    DocumentMeta
	Content string
}

// hnswIndex is a simple HNSW implementation for vector similarity search
type hnswIndex struct {
	nodes     []*hnswNode
	entryPoint int
	dim       int
	m         int // max connections per node
	ef        int // size of dynamic candidate list
}

type hnswNode struct {
	id       int
	vector   []float32
	neighbors []int
	level    int
}

// NewVectorDB creates a new vector database with the given dimension and path
func NewVectorDB(dim int, path string) (*VectorDB, error) {
	if err := os.MkdirAll(path, 0755); err != nil {
		return nil, fmt.Errorf("failed to create vector db directory: %w", err)
	}

	db := &VectorDB{
		index:    newHNSWIndex(dim, 16, 200),
		metadata: make(map[string]DocumentMeta),
		path:     path,
		dim:      dim,
	}

	// Try to load existing index
	if err := db.load(); err != nil {
		// If no existing index, start fresh
		fmt.Printf("Starting fresh vector index (no existing index found)\n")
	}

	return db, nil
}

// newHNSWIndex creates a new HNSW index
func newHNSWIndex(dim, m, ef int) *hnswIndex {
	return &hnswIndex{
		nodes:     make([]*hnswNode, 0),
		entryPoint: -1,
		dim:       dim,
		m:         m,
		ef:        ef,
	}
}

// AddDocument adds a document embedding to the vector database
func (db *VectorDB) AddDocument(id string, embedding []float32, meta DocumentMeta) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	if len(embedding) != db.dim {
		return fmt.Errorf("embedding dimension mismatch: expected %d, got %d", db.dim, len(embedding))
	}

	// Normalize embedding
	normEmb := normalizeVector(embedding)

	// Add to HNSW index
	nodeID := db.index.insert(normEmb)

	// Store metadata
	meta.ID = id
	db.metadata[id] = meta

	// Persist periodically
	if len(db.metadata)%10 == 0 {
		db.save()
	}

	return nil
}

// Search finds the k most similar documents to the query embedding
func (db *VectorDB) Search(query []float32, k int) []SearchResult {
	db.mu.RLock()
	defer db.mu.RUnlock()

	if len(db.index.nodes) == 0 || k <= 0 {
		return nil
	}

	normQuery := normalizeVector(query)
	neighborIDs := db.index.search(normQuery, k)

	results := make([]SearchResult, 0, len(neighborIDs))
	for _, nodeID := range neighborIDs {
		if nodeID < 0 || nodeID >= len(db.index.nodes) {
			continue
		}
		node := db.index.nodes[nodeID]
		score := cosineSimilarity(normQuery, node.vector)

		// Find metadata (simplified: would need bidirectional mapping in production)
		var meta DocumentMeta
		for _, m := range db.metadata {
			meta = m // In production, use proper ID mapping
			break
		}

		results = append(results, SearchResult{
			ID:      meta.ID,
			Score:   score,
			Meta:    meta,
			Content: meta.Content,
		})

		if len(results) >= k {
			break
		}
	}

	return results
}

// GetDocument retrieves document metadata by ID
func (db *VectorDB) GetDocument(id string) (DocumentMeta, bool) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	meta, ok := db.metadata[id]
	return meta, ok
}

// DeleteDocument removes a document from the index
func (db *VectorDB) DeleteDocument(id string) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	delete(db.metadata, id)
	db.save()
	return nil
}

// Count returns the number of documents in the index
func (db *VectorDB) Count() int {
	db.mu.RLock()
	defer db.mu.RUnlock()

	return len(db.metadata)
}

// insert adds a vector to the HNSW index
func (hi *hnswIndex) insert(vector []float32) int {
	nodeID := len(hi.nodes)
	level := hi.randomLevel()

	node := &hnswNode{
		id:       nodeID,
		vector:   vector,
		neighbors: make([]int, 0, hi.m),
		level:    level,
	}

	if hi.entryPoint < 0 {
		hi.entryPoint = nodeID
		hi.nodes = append(hi.nodes, node)
		return nodeID
	}

	// Find nearest neighbors
	candidates := hi.searchLayer(vector, hi.entryPoint, hi.ef, level)

	// Connect to selected neighbors
	for _, candID := range candidates {
		if candID < 0 || candID >= len(hi.nodes) {
			continue
		}
		node.neighbors = append(node.neighbors, candID)
		// Add reverse connection (simplified)
		candNode := hi.nodes[candID]
		if len(candNode.neighbors) < hi.m {
			candNode.neighbors = append(candNode.neighbors, nodeID)
		}
	}

	hi.nodes = append(hi.nodes, node)

	// Update entry point if new node is higher level
	if level > hi.nodes[hi.entryPoint].level {
		hi.entryPoint = nodeID
	}

	return nodeID
}

// search finds the k nearest neighbors to the query vector
func (hi *hnswIndex) search(query []float32, k int) []int {
	if hi.entryPoint < 0 {
		return nil
	}

	candidates := hi.searchLayer(query, hi.entryPoint, hi.ef, hi.nodes[hi.entryPoint].level)

	// Sort by distance and return top k
	type distPair struct {
		id   int
		dist float32
	}

	distances := make([]distPair, 0, len(candidates))
	for _, candID := range candidates {
		if candID < 0 || candID >= len(hi.nodes) {
			continue
		}
		distances = append(distances, distPair{
			id:   candID,
			dist: cosineSimilarity(query, hi.nodes[candID].vector),
		})
	}

	// Sort by distance (descending for similarity)
	for i := 0; i < len(distances); i++ {
		for j := i + 1; j < len(distances); j++ {
			if distances[j].dist > distances[i].dist {
				distances[i], distances[j] = distances[j], distances[i]
			}
		}
	}

	result := make([]int, 0, k)
	for i := 0; i < len(distances) && i < k; i++ {
		result = append(result, distances[i].id)
	}

	return result
}

// searchLayer searches at a specific level
func (hi *hnswIndex) searchLayer(query []float32, entryPoint int, ef int, level int) []int {
	visited := make(map[int]bool)
	candidates := []int{entryPoint}
	visited[entryPoint] = true

	for len(candidates) > 0 {
		// Get current candidate
		currID := candidates[0]
		candidates = candidates[1:]

		if currID < 0 || currID >= len(hi.nodes) {
			continue
		}

		currNode := hi.nodes[currID]

		// Check neighbors at this level
		for _, neighborID := range currNode.neighbors {
			if neighborID < 0 || neighborID >= len(hi.nodes) {
				continue
			}

			neighborNode := hi.nodes[neighborID]

			// Check level
			if neighborNode.level < level {
				continue
			}

			if !visited[neighborID] {
				visited[neighborID] = true
				candidates = append(candidates, neighborID)
			}
		}

		if len(candidates) > ef*2 {
			candidates = candidates[:ef*2]
		}
	}

	result := make([]int, 0, len(visited))
	for id := range visited {
		result = append(result, id)
	}

	return result
}

// randomLevel generates a random level for HNSW
func (hi *hnswIndex) randomLevel() int {
	level := 0
	for level < 16 && (level == 0 || hashInt(level) < 0.25) {
		level++
	}
	return level
}

func hashInt(seed int) float32 {
	h := seed*2654435761 + 12345
	return float32(h&0x7fffffff) / float32(0x7fffffff)
}

// normalizeVector normalizes a vector to unit length
func normalizeVector(v []float32) []float32 {
	norm := float32(0.0)
	for _, val := range v {
		norm += val * val
	}
	norm = float32(math.Sqrt(float64(norm)))

	if norm < 1e-12 {
		return v
	}

	result := make([]float32, len(v))
	for i, val := range v {
		result[i] = val / norm
	}
	return result
}

// cosineSimilarity calculates cosine similarity between two vectors
func cosineSimilarity(a, b []float32) float32 {
	if len(a) != len(b) {
		return 0
	}

	var dot, normA, normB float32
	for i := range a {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	denom := float32(math.Sqrt(float64(normA)) * math.Sqrt(float64(normB)))
	if denom < 1e-12 {
		return 0
	}

	return dot / denom
}

// save persists the index and metadata to disk
func (db *VectorDB) save() error {
	dbPath := filepath.Join(db.path, "index.json")
	data := map[string]interface{}{
		"metadata": db.metadata,
		"dim":      db.dim,
		"entryPoint": db.index.entryPoint,
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(dbPath, jsonData, 0644)
}

// load loads the index and metadata from disk
func (db *VectorDB) load() error {
	dbPath := filepath.Join(db.path, "index.json")
	data, err := os.ReadFile(dbPath)
	if err != nil {
		return err
	}

	var stored map[string]interface{}
	if err := json.Unmarshal(data, &stored); err != nil {
		return err
	}

	if meta, ok := stored["metadata"].(map[string]interface{}); ok {
		db.metadata = make(map[string]DocumentMeta)
		for k, v := range meta {
			if m, ok := v.(map[string]interface{}); ok {
				meta := DocumentMeta{ID: k}
				if title, ok := m["title"].(string); ok {
					meta.Title = title
				}
				if ctype, ok := m["type"].(string); ok {
					meta.Type = ctype
				}
				if src, ok := m["source"].(string); ok {
					meta.Source = src
				}
				if content, ok := m["content"].(string); ok {
					meta.Content = content
				}
				db.metadata[k] = meta
			}
		}
	}

	return nil
}
