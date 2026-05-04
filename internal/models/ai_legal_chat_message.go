package models

import (
	"time"
)

type LegalChatMessage struct {
	ID              int       `json:"id" db:"id"`
	UserID          int       `json:"user_id" db:"user_id"`
	SessionID       string    `json:"session_id" db:"session_id"`
	MessageType     string    `json:"message_type" db:"message_type"`
	Content         string    `json:"content" db:"content"`
	ContextDocs     string    `json:"context_documents,omitempty" db:"context_documents"`
	Metadata        string    `json:"metadata,omitempty" db:"metadata"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

type LegalChatSession struct {
	SessionID   string    `json:"session_id"`
	UserID      int       `json:"user_id"`
	LastMessage string    `json:"last_message"`
	CreatedAt   time.Time `json:"created_at"`
	MessageCount int      `json:"message_count"`
}
