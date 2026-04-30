package legal

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/PACTA-Team/pacta/internal/ai/minirag"
	"github.com/PACTA-Team/pacta/internal/db"
)

// ChatService maneja el chat con el experto legal
type ChatService struct {
	db       *sql.DB
	vectorDB *minirag.VectorDB
	llm      LLMClient
}

// LLMClient define la interfaz para completaciones de LLM
type LLMClient interface {
	Complete(ctx context.Context, prompt string) (string, error)
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
	DocumentID   int     `json:"document_id"`
	DocumentType string `json:"document_type"`
	Title        string    `json:"title"`
	Relevance    float32 `json:"relevance"`
}

// NewChatService crea un nuevo servicio de chat legal
func NewChatService(db *sql.DB, vectorDB *minirag.VectorDB) *ChatService {
	return &ChatService{
		db:       db,
		vectorDB: vectorDB,
		llm:      NewLocalLLM(),
	}
}

// ProcessMessage procesa un mensaje del usuario y devuelve una respuesta
func (s *ChatService) ProcessMessage(ctx context.Context, msg ChatMessage) (string, error) {
	// 1. Guardar mensaje del usuario
	userMsg := db.LegalChatMessageRow{
		UserID:      msg.UserID,
		SessionID:   msg.SessionID,
		MessageType: "user",
		Content:     msg.Content,
		CreatedAt:   time.Now(),
	}

	_, err := db.CreateLegalChatMessage(ctx, s.db, db.CreateLegalChatMessageParams{
		UserID:      int64(userMsg.UserID),
		SessionID:   userMsg.SessionID,
		MessageType: userMsg.MessageType,
		Content:     userMsg.Content,
		CreatedAt:   userMsg.CreatedAt,
	})
	if err != nil {
		return "", fmt.Errorf("guardar mensaje usuario: %w", err)
	}

	// 2. Buscar documentos legales relevantes (RAG)
	contextDocs, err := s.searchContext(msg.Content, 5)
	if err != nil {
		return "", fmt.Errorf("buscar contexto: %w", err)
	}

	// 3. Construir prompt con contexto
	prompt := s.buildPrompt(msg.Content, contextDocs)

	// 4. Obtener respuesta del LLM
	answer, err := s.llm.Complete(ctx, prompt)
	if err != nil {
		return "", fmt.Errorf("generación LLM: %w", err)
	}

	// 5. Guardar respuesta del asistente
	contextJSON, _ := json.Marshal(contextDocs)
	metadata := map[string]interface{}{
		"sources_count": len(contextDocs),
		"model":         "Qwen2.5-0.5B-Instruct",
		"timestamp":     time.Now().Format(time.RFC3339),
	}
	metadataJSON, _ := json.Marshal(metadata)

	_, err = db.CreateLegalChatMessage(ctx, s.db, db.CreateLegalChatMessageParams{
		UserID:          int64(msg.UserID),
		SessionID:       msg.SessionID,
		MessageType:     "assistant",
		Content:         answer,
		ContextDocuments: string(contextJSON),
		Metadata:        string(metadataJSON),
		CreatedAt:       time.Now(),
	})
	if err != nil {
		// Log pero no fallar
		fmt.Printf("[WARN] No se pudo guardar mensaje asistente: %v\n", err)
	}

	return answer, nil
}

// searchContext busca documentos legales relevantes para la consulta
func (s *ChatService) searchContext(query string, limit int) ([]SourceRef, error) {
	if s.vectorDB == nil {
		return []SourceRef{}, nil
	}

	// Implementación futura:
	// 1. Generar embedding de la consulta
	// 2. Buscar en vector DB con filtro source='legal'
	// 3. Devolver resultados

	return []SourceRef{}, nil
}

// buildPrompt construye el prompt para el LLM
func (s *ChatService) buildPrompt(userQuery string, contextDocs []SourceRef) string {
	systemPrompt := SystemPromptCubanLegalExpert()

	contextSection := ""
	if len(contextDocs) > 0 {
		contextSection = "\n\nDocumentos legales relevantes consultados:\n"
		for _, doc := range contextDocs {
			contextSection += fmt.Sprintf(
				"- %s (%s): %.2f relevancia\n",
				doc.Title, doc.DocumentType, doc.Relevance,
			)
		}
	}

	return fmt.Sprintf(
		"%s%s\n\nPregunta del usuario:\n%s",
		systemPrompt, contextSection, userQuery,
	)
}

// GetChatHistory recupera el historial de chat para una sesión
func (s *ChatService) GetChatHistory(sessionID string) ([]db.LegalChatMessageRow, error) {
	ctx := context.Background()
	return db.ListLegalChatMessages(ctx, s.db, sessionID)
}

// LocalLLM implementa LLMClient usando llamadas a modelo local
type LocalLLM struct{}

func NewLocalLLM() *LocalLLM {
	return &LocalLLM{}
}

func (l *LocalLLM) Complete(ctx context.Context, prompt string) (string, error) {
	// NOTA: Integración real se hará conectando al CGo bindings o API local
	// Por ahora, placeholder con respuestas simuladas

	if strings.Contains(strings.ToLower(prompt), "contrato") ||
		strings.Contains(strings.ToLower(prompt), "cláusula") {
		return "Basándome en la Ley de Contratos cubana, los elementos esenciales son: consentimiento, objeto cierto y causa lícita. ¿Podría especificar qué tipo de contrato le interesa?", nil
	}
	if strings.Contains(strings.ToLower(prompt), "usd") ||
		strings.Contains(strings.ToLower(prompt), "divisa") ||
		strings.Contains(strings.ToLower(prompt), "moneda") {
		return "⚠️ Según la Ley 173/2022 (Sistema de Pagos), los precios en contratos deben expresarse en pesos cubanos (CUP) o pesos cubanos convertibles (CUC). Para contratos con extranjeros puede usarse USD/EUR si se incluye cláusula de conversión al tipo de cambio oficial.\n\n📚 Fundamento: Ley 173/2022, Artículo 12, y Circular 209/2023 del Banco Central.\n\n🔧 Recomendación: Incluya una cláusula como: 'El precio se fija en USD, pero se pagará en CUP al tipo de cambio oficial publicado por el Banco Central de Cuba.'", nil
	}
	if strings.Contains(strings.ToLower(prompt), "inversión") ||
		strings.Contains(strings.ToLower(prompt), "extranjera") {
		return "La inversión extranjera en Cuba se rige por la Ley No. 118/2022. Esta ley establece las formas de inversión (empresa mixta, contrato de asociación económica internacional, etc.) y garantías a los inversores.\n\n📚 Fundamento: Ley 118/2022, Gaceta Oficial No. 52 Extraordinaria de 2022.\n\n⚠️ Importante: Todas las inversiones requieren aprobación del Consejo de Ministros o de la autoridad designada.", nil
	}
	// Respuesta por defecto
	return "Como experto legal cubano, puedo ayudarte con consultas sobre legislación, contratos, y derecho mercantil cubano. Especifica tu pregunta para darte una respuesta más precisa citando lanormativa aplicable.", nil
}


// LLMClient define la interfaz para completaciones de LLM
type LLMClient interface {
	Complete(ctx context.Context, prompt string) (string, error)
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
	DocumentID   int     `json:"document_id"`
	DocumentType string `json:"document_type"`
	Title        string    `json:"title"`
	Relevance    float32 `json:"relevance"`
}

// NewChatService crea un nuevo servicio de chat legal
func NewChatService(db *sql.DB, vectorDB *minirag.VectorDB) *ChatService {
	return &ChatService{
		db:       db,
		vectorDB: vectorDB,
		llm:      NewLocalLLM(),
	}
}

// ProcessMessage procesa un mensaje del usuario y devuelve una respuesta
func (s *ChatService) ProcessMessage(ctx context.Context, msg ChatMessage) (string, error) {
	// 1. Guardar mensaje del usuario
	userMsg := models.LegalChatMessageRow{
		UserID:      msg.UserID,
		SessionID:   msg.SessionID,
		MessageType: "user",
		Content:     msg.Content,
		CreatedAt:   time.Now(),
	}

	_, err := db.CreateLegalChatMessage(ctx, s.db, db.CreateLegalChatMessageParams{
		UserID:      int64(userMsg.UserID),
		SessionID:   userMsg.SessionID,
		MessageType: userMsg.MessageType,
		Content:     userMsg.Content,
		CreatedAt:   userMsg.CreatedAt,
	})
	if err != nil {
		return "", fmt.Errorf("guardar mensaje usuario: %w", err)
	}

	// 2. Buscar documentos legales relevantes (RAG)
	contextDocs, err := s.searchContext(msg.Content, 5)
	if err != nil {
		return "", fmt.Errorf("buscar contexto: %w", err)
	}

	// 3. Construir prompt con contexto
	prompt := s.buildPrompt(msg.Content, contextDocs)

	// 4. Obtener respuesta del LLM
	answer, err := s.llm.Complete(ctx, prompt)
	if err != nil {
		return "", fmt.Errorf("generación LLM: %w", err)
	}

	// 5. Guardar respuesta del asistente
	contextJSON, _ := json.Marshal(contextDocs)
	metadata := map[string]interface{}{
		"sources_count": len(contextDocs),
		"model":         "Qwen2.5-0.5B-Instruct",
		"timestamp":     time.Now().Format(time.RFC3339),
	}
	metadataJSON, _ := json.Marshal(metadata)

	_, err = db.CreateLegalChatMessage(ctx, s.db, db.CreateLegalChatMessageParams{
		UserID:          int64(msg.UserID),
		SessionID:       msg.SessionID,
		MessageType:     "assistant",
		Content:         answer,
		ContextDocuments: string(contextJSON),
		Metadata:        string(metadataJSON),
		CreatedAt:       time.Now(),
	})
	if err != nil {
		// Log pero no fallar
		fmt.Printf("[WARN] No se pudo guardar mensaje asistente: %v\n", err)
	}

	return answer, nil
}

// searchContext busca documentos legales relevantes para la consulta
func (s *ChatService) searchContext(query string, limit int) ([]SourceRef, error) {
	if s.vectorDB == nil {
		return []SourceRef{}, nil
	}

	// Generar embedding de la consulta (simplificado - en producción usar embedder real)
	// Por ahora retornamos resultados dummy o desde DB
	// En una implementación completa, aquí se haría:
	// 1. Embed query con modelo de embeddings
	// 2. Vector search en document_chunks con source='legal'
	// 3. Filtrar por jurisdiction y fecha vigente
	// 4. Devolver los top-k resultados

	// Placeholder: retornar vacío hasta integrar embedding completo
	return []SourceRef{}, nil
}

// buildPrompt construye el prompt para el LLM
func (s *ChatService) buildPrompt(userQuery string, contextDocs []SourceRef) string {
	systemPrompt := SystemPromptCubanLegalExpert()

	contextSection := ""
	if len(contextDocs) > 0 {
		contextSection = "\n\nDocumentos legales relevantes consultados:\n"
		for _, doc := range contextDocs {
			contextSection += fmt.Sprintf(
				"- %s (%s): %.2f relevancia\n",
				doc.Title, doc.DocumentType, doc.Relevance,
			)
		}
	}

	return fmt.Sprintf(
		"%s%s\n\nPregunta del usuario:\n%s",
		systemPrompt, contextSection, userQuery,
	)
}

// GetChatHistory recupera el historial de chat para una sesión
func (s *ChatService) GetChatHistory(sessionID string) ([]models.LegalChatMessageRow, error) {
	ctx := context.Background()
	return db.ListLegalChatMessages(ctx, s.db, sessionID)
}

// LocalLLM implementa LLMClient usando llamadas a modelo local
type LocalLLM struct{}

func NewLocalLLM() *LocalLLM {
	return &LocalLLM{}
}

func (l *LocalLLM) Complete(ctx context.Context, prompt string) (string, error) {
	// NOTA: Integración real se hará en Task 8 con el CGo bindings existente
	// Por ahora, placeholder
	// En producción, aquí se llamaría a:
	// - internal/ai/minirag/cgo_llama.go (modo cgo)
	// - Ollama API (modo ollama)
	// - OpenAI/Anthropic (modo external)

	if strings.Contains(strings.ToLower(prompt), "contrato") {
		return "Basándome en la Ley de Contratos cubana, los elementos esenciales son: consentimiento, objeto cierto y causa lícita. ¿Podría especificar qué tipo de contrato le interesa?", nil
	}
	return "Como experto legal cubano, puedo ayudarte con consultas sobre legislación, contratos, y derecho mercantil cubano. ¿En qué tema necesitas orientación?", nil
}

// --- Future: Real LLM integration helper ---
// Una vez finalizado el chat_service, en Task 8 (handlers) se conectará con:
// - minirag.NewLocalClient() para modo cgo
// - Ollama HTTP para modo ollama
// - HTTP client para modo external
