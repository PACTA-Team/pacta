package minirag

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"sync"

	"github.com/PACTA-Team/pacta/internal/ai/legal"
)

// VectorDB represents a local vector database using HNSW for similarity search
type VectorDB struct {
	mu        sync.RWMutex
	index     *hnswIndex
	metadata  map[string]DocumentMeta
	nodeToDoc map[int]string // maps HNSW node ID to document ID
	path      string
	dim       int
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

// LegalDocumentMetadata extends DocumentMeta for legal docs
type LegalDocumentMetadata struct {
	DocumentID   int    `json:"document_id"`
	DocumentType string `json:"document_type"`
	Title        string `json:"title"`
	Jurisdiction string `json:"jurisdiction"`
	Language     string `json:"language"`
	ChunkTitle   string `json:"chunk_title,omitempty"`
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
	id            int
	vector        []float32
	neighbors     map[int][]int // key: layer, value: neighbor IDs at that layer
	level         int
}

// NewVectorDB creates a new vector database with the given dimension and path
func NewVectorDB(dim int, path string) (*VectorDB, error) {
	if err := os.MkdirAll(path, 0755); err != nil {
		return nil, fmt.Errorf("failed to create vector db directory: %w", err)
	}

	db := &VectorDB{
		index:     newHNSWIndex(dim, 16, 200),
		metadata:  make(map[string]DocumentMeta),
		nodeToDoc: make(map[int]string),
		path:      path,
		dim:       dim,
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
	db.nodeToDoc[nodeID] = id

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
		score := CosineSimilarity(normQuery, node.vector)

		// Find metadata using nodeToDoc mapping
		var meta DocumentMeta
		if docID, ok := db.nodeToDoc[nodeID]; ok {
			if m, ok := db.metadata[docID]; ok {
				meta = m
			}
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

// AddLegalDocumentChunks adds legal document chunks to vector DB
func (db *VectorDB) AddLegalDocumentChunks(chunks []legal.Chunk, metadata LegalDocumentMetadata, embeddings [][]float32) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	if len(chunks) != len(embeddings) {
		return fmt.Errorf("chunks length %d != embeddings length %d", len(chunks), len(embeddings))
	}

	docID := fmt.Sprintf("legal_%d", metadata.DocumentID)

	for i, chunk := range chunks {
		embedding := embeddings[i]
		if len(embedding) != db.dim {
			return fmt.Errorf("embedding dimension mismatch at chunk %d: expected %d, got %d", i, db.dim, len(embedding))
		}

		// Normalize embedding
		normEmb := normalizeVector(embedding)

		// Add to HNSW index
		nodeID := db.index.insert(normEmb)

		// Create chunk ID
		chunkID := fmt.Sprintf("%s_chunk_%d", docID, i)

		// Store metadata
		meta := DocumentMeta{
			ID:      chunkID,
			Title:   metadata.Title,
			Type:    metadata.DocumentType,
			Source:  "legal",
			Content: chunk.Text,
			ExtraFields: map[string]string{
				"document_id":  fmt.Sprintf("%d", metadata.DocumentID),
				"jurisdiction": metadata.Jurisdiction,
				"language":     metadata.Language,
				"chunk_title":  chunk.Title,
			},
		}

		db.metadata[chunkID] = meta
		db.nodeToDoc[nodeID] = chunkID
	}

	// Persist
	if len(db.metadata)%10 == 0 {
		db.save()
	}

	return nil
}

// SearchLegalDocuments searches within legal document chunks
func (db *VectorDB) SearchLegalDocuments(query []float32, filter map[string]interface{}, limit int) ([]SearchResult, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	if len(db.index.nodes) == 0 || limit <= 0 {
		return nil, nil
	}

	normQuery := normalizeVector(query)
	neighborIDs := db.index.search(normQuery, limit*2)

	var results []SearchResult
	for _, nodeID := range neighborIDs {
		if nodeID < 0 || nodeID >= len(db.index.nodes) {
			continue
		}

		// Find metadata using nodeToDoc mapping
		var meta DocumentMeta
		if docID, ok := db.nodeToDoc[nodeID]; ok {
			if m, ok := db.metadata[docID]; ok {
				meta = m
			}
		}

		// Filter by source
		if meta.Source != "legal" {
			continue
		}

		// Filter by jurisdiction if specified
		if jurisdiction, ok := filter["jurisdiction"].(string); ok && jurisdiction != "" {
			if meta.ExtraFields["jurisdiction"] != jurisdiction {
				continue
			}
		}

		score := CosineSimilarity(normQuery, db.index.nodes[nodeID].vector)

		results = append(results, SearchResult{
			ID:      meta.ID,
			Score:   score,
			Meta:    meta,
			Content: meta.Content,
		})

		if len(results) >= limit {
			break
		}
	}

	return results, nil
}

// DeleteDocument removes a document from the index
func (db *VectorDB) DeleteDocument(id string) error {
	db.mu.Lock()
	defer db.mu.Unlock()

	// Clean up all nodeToDoc mappings for this document
	for nodeID, docID := range db.nodeToDoc {
		if docID == id {
			delete(db.nodeToDoc, nodeID)
		}
	}

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
		id:        nodeID,
		vector:    vector,
		neighbors:  make(map[int][]int),
		level:     level,
	}

	if hi.entryPoint < 0 {
		hi.entryPoint = nodeID
		hi.nodes = append(hi.nodes, node)
		return nodeID
	}

	// Traverse from top layer down to node's level
	ep := hi.entryPoint
	epNode := hi.nodes[ep]
	currentLevel := epNode.level

	for layer := currentLevel; layer > level; layer-- {
		// Greedy search at this layer to find best entry point
		candidates := hi.searchLayer(vector, ep, 1, layer)
		if len(candidates) > 0 {
			ep = candidates[0]
		}
	}

	// For each layer from min(level, currentLevel) down to 0, search and connect
	startLayer := level
	if currentLevel < startLayer {
		startLayer = currentLevel
	}

	for layer := startLayer; layer >= 0; layer-- {
			// Search for neighbors at this layer
		ef := hi.ef
		candidates := hi.searchLayer(vector, ep, ef, layer)

		// Select only best M neighbors (searchLayer returns sorted results)
		selected := candidates
		if len(selected) > hi.m {
			selected = selected[:hi.m]
		}

		// Connect node to selected neighbors at this layer
		node.neighbors[layer] = make([]int, 0, len(selected))
		for _, candID := range selected {
			if candID < 0 || candID >= len(hi.nodes) {
				continue
			}
			node.neighbors[layer] = append(node.neighbors[layer], candID)

			// Add reverse connection and prune to M
			candNode := hi.nodes[candID]
			if candNode.neighbors == nil {
				candNode.neighbors = make(map[int][]int)
			}
			candNode.neighbors[layer] = append(candNode.neighbors[layer], nodeID)
			if len(candNode.neighbors[layer]) > hi.m {
				candNode.neighbors[layer] = candNode.neighbors[layer][:hi.m]
			}
		}

		// Update entry point for next lower layer
		if len(candidates) > 0 {
			ep = candidates[0]
		}
	}

	hi.nodes = append(hi.nodes, node)

	// Update entry point if new node has higher level
	if hi.entryPoint >= 0 && level > hi.nodes[hi.entryPoint].level {
		hi.entryPoint = nodeID
	}

	return nodeID
}

// search finds the k nearest neighbors to the query vector
func (hi *hnswIndex) search(query []float32, k int) []int {
	if hi.entryPoint < 0 || len(hi.nodes) == 0 {
		return nil
	}

	// Start at entry point
	ep := hi.entryPoint
	epNode := hi.nodes[ep]

	// Traverse from top layer down to layer 1 (skip layer 0 in loop)
	currentLevel := epNode.level

	for layer := currentLevel; layer > 0; layer-- {
		// Greedy search at this layer with ef=1 to find best entry point
		candidates := hi.searchLayer(query, ep, 1, layer)

		// Update entry point to the closest node found at this layer
		if len(candidates) > 0 {
			bestID := candidates[0]
			bestDist := CosineSimilarity(query, hi.nodes[bestID].vector)

			for _, candID := range candidates[1:] {
				if candID < 0 || candID >= len(hi.nodes) {
					continue
				}
				dist := CosineSimilarity(query, hi.nodes[candID].vector)
				if dist > bestDist {
					bestDist = dist
					bestID = candID
				}
			}

			ep = bestID
		}
	}

	// Final search at layer 0 with ef=hi.ef to get k nearest neighbors
	finalCandidates := hi.searchLayer(query, ep, hi.ef, 0)

	// Sort by similarity (descending) and return top k
	type distPair struct {
		id   int
		dist float32
	}

	distances := make([]distPair, 0, len(finalCandidates))
	for _, candID := range finalCandidates {
		if candID < 0 || candID >= len(hi.nodes) {
			continue
		}
		distances = append(distances, distPair{
			id:   candID,
			dist: CosineSimilarity(query, hi.nodes[candID].vector),
		})
	}

	// Sort by similarity (descending)
	sort.Slice(distances, func(i, j int) bool {
		return distances[i].dist > distances[j].dist
	})

	result := make([]int, 0, k)
	for i := 0; i < len(distances) && i < k; i++ {
		result = append(result, distances[i].id)
	}

	return result
}

// searchLayer searches at a specific layer using greedy search
func (hi *hnswIndex) searchLayer(query []float32, entryPoint int, ef int, layer int) []int {
	if entryPoint < 0 || entryPoint >= len(hi.nodes) {
		return nil
	}

	visited := make(map[int]bool)

	// Track candidates and results with their similarity scores
	type nodeWithSim struct {
		id  int
		sim float32
	}

	// Start with entry point
	epSim := CosineSimilarity(query, hi.nodes[entryPoint].vector)
	candidates := []nodeWithSim{{id: entryPoint, sim: epSim}}
	visited[entryPoint] = true

	// Results tracking - keep ef best (highest similarity)
	results := []nodeWithSim{{id: entryPoint, sim: epSim}}

	// Find candidate with highest similarity
	findBestCandidate := func(cands []nodeWithSim) (nodeWithSim, []nodeWithSim) {
		if len(cands) == 0 {
			return nodeWithSim{}, cands
		}
		bestIdx := 0
		for i := 1; i < len(cands); i++ {
			if cands[i].sim > cands[bestIdx].sim {
				bestIdx = i
			}
		}
		best := cands[bestIdx]
		cands[bestIdx] = cands[len(cands)-1]
		cands = cands[:len(cands)-1]
		return best, cands
	}

	// Insert into results, keeping only ef best
	insertResult := func(res []nodeWithSim, item nodeWithSim) []nodeWithSim {
		res = append(res, item)
		if len(res) > ef {
			// Find and remove worst (lowest similarity)
			worstIdx := 0
			for i := 1; i < len(res); i++ {
				if res[i].sim < res[worstIdx].sim {
					worstIdx = i
				}
			}
			res[worstIdx] = res[len(res)-1]
			res = res[:len(res)-1]
		}
		return res
	}

	for len(candidates) > 0 {
		// Get candidate with highest similarity
		var curr nodeWithSim
		curr, candidates = findBestCandidate(candidates)

		// Early termination: if current is worse than worst in results, stop
		if len(results) >= ef {
			// Find worst (lowest similarity) in results
			worstInResults := results[0].sim
			for _, r := range results[1:] {
				if r.sim < worstInResults {
					worstInResults = r.sim
				}
			}
			if curr.sim < worstInResults {
				break
			}
		}

		currNode := hi.nodes[curr.id]

		// Explore neighbors at this specific layer
		neighs, ok := currNode.neighbors[layer]
		if !ok {
			continue
		}
		for _, neighborID := range neighs {
			if neighborID < 0 || neighborID >= len(hi.nodes) {
				continue
			}
			if visited[neighborID] {
				continue
			}
			visited[neighborID] = true

			neighborNode := hi.nodes[neighborID]

			neighborSim := CosineSimilarity(query, neighborNode.vector)

			// Add to candidates
			candidates = append(candidates, nodeWithSim{id: neighborID, sim: neighborSim})

			// Add to results
			results = insertResult(results, nodeWithSim{id: neighborID, sim: neighborSim})
		}
	}

	// Sort results by similarity (descending)
	sort.Slice(results, func(i, j int) bool {
		return results[i].sim > results[j].sim
	})

	resultIDs := make([]int, 0, len(results))
	for _, r := range results {
		resultIDs = append(resultIDs, r.id)
	}

	return resultIDs
}

// randomLevel generates a random level for HNSW using exponential distribution
func (hi *hnswIndex) randomLevel() int {
	level := 0
	for level < 16 && rand.Float32() < 0.25 {
		level++
	}
	return level
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

// CosineSimilarity calculates cosine similarity between two vectors
func CosineSimilarity(a, b []float32) float32 {
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

	// Serialize HNSW nodes
	type nodeJSON struct {
		ID       int                  `json:"id"`
		Vector   []float32           `json:"vector"`
		Neighbors map[string][]int    `json:"neighbors"`
		Level    int                  `json:"level"`
	}
	type indexJSON struct {
		Nodes      []nodeJSON `json:"nodes"`
		EntryPoint int        `json:"entryPoint"`
		M          int        `json:"m"`
		Ef         int        `json:"ef"`
		Dim        int        `json:"dim"`
	}

	nodesJSON := make([]nodeJSON, 0, len(db.index.nodes))
	for _, n := range db.index.nodes {
		if n == nil {
			continue
		}
		// Convert map[int][]int to map[string][]int for JSON serialization
		neighborsJSON := make(map[string][]int)
		for layer, neighs := range n.neighbors {
			neighborsJSON[strconv.Itoa(layer)] = neighs
		}
		nodesJSON = append(nodesJSON, nodeJSON{
			ID:       n.id,
			Vector:   n.vector,
			Neighbors: neighborsJSON,
			Level:    n.level,
		})
	}

	data := map[string]interface{}{
		"metadata": db.metadata,
		"nodeToDoc": db.nodeToDoc,
		"index":    indexJSON{
			Nodes:      nodesJSON,
			EntryPoint: db.index.entryPoint,
			M:          db.index.m,
			Ef:         db.index.ef,
			Dim:        db.dim,
		},
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	// Atomic write: write to temp file, then rename
	tmpPath := dbPath + ".tmp"
	if err := os.WriteFile(tmpPath, jsonData, 0644); err != nil {
		return err
	}
	return os.Rename(tmpPath, dbPath)
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

	// Load metadata
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

	// Load nodeToDoc mapping
	if ntd, ok := stored["nodeToDoc"].(map[string]interface{}); ok {
		db.nodeToDoc = make(map[int]string)
		for k, v := range ntd {
			if nodeID, err := strconv.Atoi(k); err == nil {
				if docID, ok := v.(string); ok {
					db.nodeToDoc[nodeID] = docID
				}
			}
		}
	}

	// Load HNSW index
	if idxRaw, ok := stored["index"].(map[string]interface{}); ok {
		// Load index parameters
		m := 16
		ef := 200
		dim := db.dim
		entryPoint := -1
		if v, ok := idxRaw["m"].(float64); ok {
			m = int(v)
		}
		if v, ok := idxRaw["ef"].(float64); ok {
			ef = int(v)
		}
		if v, ok := idxRaw["dim"].(float64); ok {
			dim = int(v)
		}
		if v, ok := idxRaw["entryPoint"].(float64); ok {
			entryPoint = int(v)
		}

		// Load nodes
		var nodes []*hnswNode
		if nodesRaw, ok := idxRaw["nodes"].([]interface{}); ok {
			nodes = make([]*hnswNode, 0, len(nodesRaw))
			for _, nRaw := range nodesRaw {
				if nMap, ok := nRaw.(map[string]interface{}); ok {
					n := &hnswNode{}
					if v, ok := nMap["id"].(float64); ok {
						n.id = int(v)
					}
					if v, ok := nMap["vector"].([]interface{}); ok {
						n.vector = make([]float32, 0, len(v))
						for _, val := range v {
							if f, ok := val.(float64); ok {
								n.vector = append(n.vector, float32(f))
							}
						}
					}
			if v, ok := nMap["neighbors"].(map[string]interface{}); ok {
					n.neighbors = make(map[int][]int)
					for layerStr, neighsRaw := range v {
						if layer, err := strconv.Atoi(layerStr); err == nil {
							if neighsSlice, ok := neighsRaw.([]interface{}); ok {
								neighbors := make([]int, 0, len(neighsSlice))
								for _, val := range neighsSlice {
									if f, ok := val.(float64); ok {
										neighbors = append(neighbors, int(f))
									}
								}
								n.neighbors[layer] = neighbors
							}
						}
					}
				}
					if v, ok := nMap["level"].(float64); ok {
						n.level = int(v)
					}
					nodes = append(nodes, n)
				}
			}
		}

		db.index = &hnswIndex{
			nodes:     nodes,
			entryPoint: entryPoint,
			dim:       dim,
			m:         m,
			ef:        ef,
		}
	}

	return nil
}
