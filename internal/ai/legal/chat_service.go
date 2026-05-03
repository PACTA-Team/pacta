package legal

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/PACTA-Team/pacta/internal/ai"
	"github.com/PACTA-Team/pacta/internal/ai/minirag"
	"github.com/PACTA-Team/pacta/internal/db"
)

// ChatService maneja el chat con el experto legal
type ChatService struct {
	Queries *db.Queries
	Service *minirag.Service
	llm     ai.LLM
}

// ChatMessage representa un mensaje del usuario
type ChatMessage struct {
	SessionID string
	UserID    int
	Content   string
}

// ChatResponse es la respuesta del servicio
type ChatResponse struct {
	Answer      string     `json:"answer"`
	Sources     []SourceRef `json:"sources"`
	ContextUsed bool       `json:"context_used"`
}

// SourceRef es una fuente citada en la respuesta
type SourceRef struct {
	DocumentID     int     `json:"document_id"`
	DocumentType   string  `json:"document_type"`
	Title          string  `json:"title"`
	ChunkTitle     string  `json:"chunk_title,omitempty"`
	Relevance      float32 `json:"relevance"`
	ContentSnippet string  `json:"content_snippet,omitempty"`
}

// NewChatService crea un nuevo servicio de chat legal usando sqlc Queries.
func NewChatService(queries *db.Queries, svc *minirag.Service, llm ai.LLM) *ChatService {
	return &ChatService{
		Queries: queries,
		Service: svc,
		llm:     llm,
	}
}

// ProcessMessage procesa un mensaje del usuario y devuelve una respuesta
func (s *ChatService) ProcessMessage(ctx context.Context, msg ChatMessage) (ChatResponse, error) {
	// 1. Guardar mensaje del usuario
	contextJSON, _ := json.Marshal([]SourceRef{})
	metadata := map[string]interface{}{
		"sources_count": 0,
		"timestamp":     time.Now().Format(time.RFC3339),
	}
	metadataJSON, _ := json.Marshal(metadata)

	_, err := s.Queries.CreateLegalChatMessage(ctx, db.CreateLegalChatMessageParams{
		UserID:       int64(msg.UserID),
		SessionID:    msg.SessionID,
		MessageType:  "user",
		Content:      msg.Content,
		ContextDocs:  string(contextJSON),
		Metadata:     string(metadataJSON),
	})
	if err != nil {
		return ChatResponse{}, fmt.Errorf("guardar mensaje usuario: %w", err)
	}

	// 2. Buscar documentos legales relevantes (RAG)
	contextDocs, err := s.searchContext(ctx, msg.Content, 5)
	if err != nil {
		log.Printf("[Legal Chat] searchContext error: %v", err)
		// Continuar sin contexto
	}

	// 3. Construir system prompt con contexto RAG
	systemPrompt := ai.SystemPromptCubanLegalExpert()
	if len(contextDocs) > 0 {
		var sb strings.Builder
		sb.WriteString("Documentos legales relevantes consultados:\n")
		for _, doc := range contextDocs {
			fmt.Fprintf(&sb, "- %s (%s): relevancia %.2f", doc.Title, doc.DocumentType, doc.Relevance)
			if doc.DocumentID > 0 {
				fmt.Fprintf(&sb, " [ID:%d]", doc.DocumentID)
			}
			sb.WriteString("\n")
			if doc.ChunkTitle != "" {
				fmt.Fprintf(&sb, "  %s\n", doc.ChunkTitle)
			}
			if doc.ContentSnippet != "" {
				snippet := doc.ContentSnippet
				if len(snippet) > 500 {
					snippet = snippet[:500] + "..."
				}
				sb.WriteString("  Fragmento: \"")
				sb.WriteString(snippet)
				sb.WriteString("\"\n")
			}
		}
		systemPrompt = sb.String() + "\n\n" + systemPrompt
	}

	// 4. Obtener respuesta del LLM
	answer, err := s.llm.Generate(ctx, msg.Content, systemPrompt)
	if err != nil {
		return ChatResponse{}, fmt.Errorf("generación LLM: %w", err)
	}

	// 5. Guardar respuesta del asistente
	contextJSON, _ = json.Marshal(contextDocs)
	metadata = map[string]interface{}{
		"sources_count": len(contextDocs),
		"timestamp":     time.Now().Format(time.RFC3339),
	}
	metadataJSON, _ = json.Marshal(metadata)

	_, err = s.Queries.CreateLegalChatMessage(ctx, db.CreateLegalChatMessageParams{
		UserID:       int64(msg.UserID),
		SessionID:    msg.SessionID,
		MessageType:  "assistant",
		Content:      answer,
		ContextDocs:  string(contextJSON),
		Metadata:     string(metadataJSON),
	})
	if err != nil {
		fmt.Printf("[WARN] No se pudo guardar mensaje asistente: %v\n", err)
	}

	return ChatResponse{
		Answer:      answer,
		Sources:     contextDocs,
		ContextUsed: len(contextDocs) > 0,
	}, nil
}

// searchContext busca documentos legales relevantes para la consulta usando RAG
func (s *ChatService) searchContext(ctx context.Context, query string, limit int) ([]SourceRef, error) {
	if s.Service == nil {
		return []SourceRef{}, nil
	}
	// Search with jurisdiction filter for Cuba
	results, err := s.Service.SearchLegalDocuments(query, map[string]interface{}{
		"jurisdiction": "Cuba",
	}, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to search vector DB: %w", err)
	}
	// Convert to SourceRef, enriching with contract metadata
	sources := make([]SourceRef, 0, len(results))
	contractCache := make(map[int64]db.GetContractForRAGRow)
	for _, r := range results {
		meta := r.Meta
		row, ok := contractCache[meta.ContractID]
		if !ok {
			row, err = s.Queries.GetContractForRAG(ctx, meta.ContractID)
			if err != nil {
				continue
			}
			contractCache[meta.ContractID] = row
		}
		snippet := meta.Content
		if len(snippet) > 500 {
			snippet = snippet[:500] + "..."
		}
		sources = append(sources, SourceRef{
			DocumentID:     int(meta.ContractID),
			DocumentType:   row.Type,
			Title:          row.Title,
			ChunkTitle:     "", // not stored
			Relevance:      r.Score,
			ContentSnippet: snippet,
		})
	}
	return sources, nil
}

// GetChatHistory recupera el historial de chat para una sesión
func (s *ChatService) GetChatHistory(sessionID string) ([]db.LegalChatMessageRow, error) {
	ctx := context.Background()
	return db.ListLegalChatMessages(ctx, s.Queries, sessionID)
}
