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
	Queries   *db.Queries
	vectorDB  *minirag.VectorDB
	embedder *minirag.EmbeddingClient
	llm       ai.LLM
}

// ChatMessage representa un mensaje del usuario
type ChatMessage struct {
	SessionID string
	UserID    int
	Content   string
}

// ChatResponse es la respuesta del servicio
type ChatResponse struct {
	Answer      string
	Sources     []SourceRef
	ContextUsed bool
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

// NewChatService crea un nuevo servicio de chat legal usando sqlc Queries
func NewChatService(queries *db.Queries, vectorDB *minirag.VectorDB, embedder *minirag.EmbeddingClient, llm ai.LLM) *ChatService {
	return &ChatService{
		Queries:   queries,
		vectorDB:  vectorDB,
		embedder: embedder,
		llm:      llm,
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
		UserID:      int64(msg.UserID),
		SessionID:   msg.SessionID,
		MessageType: "user",
		Content:     msg.Content,
		ContextDocs: string(contextJSON),
		Metadata:    string(metadataJSON),
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
				// Truncate for safety
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
		UserID:      int64(msg.UserID),
		SessionID:   msg.SessionID,
		MessageType: "assistant",
		Content:     answer,
		ContextDocs: string(contextJSON),
		Metadata:    string(metadataJSON),
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
	if s.vectorDB == nil || s.embedder == nil {
		return []SourceRef{}, nil
	}

	// Generar embedding de la consulta
	embedding, err := s.embedder.GenerateEmbedding(query)
	if err != nil {
		return nil, fmt.Errorf("failed to generate embedding: %w", err)
	}

	// Buscar en vector DB con filtro jurisdiction=Cuba
	filter := map[string]interface{}{
		"jurisdiction": "Cuba",
	}
	results, err := s.vectorDB.SearchLegalDocuments(embedding, filter, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to search vector DB: %w", err)
	}

	// Mapear a SourceRef
	sources := make([]SourceRef, 0, len(results))
	for _, r := range results {
		// Extraer document_id de metadata ExtraFields
		var docID int
		if idStr, ok := r.Meta.ExtraFields["document_id"]; ok {
			fmt.Sscanf(idStr, "%d", &docID)
		}
		// Extraer chunk_title de metadata ExtraFields
		chunkTitle := ""
		if title, ok := r.Meta.ExtraFields["chunk_title"]; ok {
			chunkTitle = title
		}
		// Truncar contenido a máximo 500 caracteres
		snippet := r.Content
		if len(snippet) > 500 {
			snippet = snippet[:500] + "..."
		}
		sources = append(sources, SourceRef{
			DocumentID:     docID,
			DocumentType:   r.Meta.Type,
			Title:          r.Meta.Title,
			ChunkTitle:     chunkTitle,
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
