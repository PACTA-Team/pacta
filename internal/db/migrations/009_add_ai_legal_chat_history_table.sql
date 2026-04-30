-- 009_add_ai_legal_chat_history_table.sql
-- Migration: Add AI legal chat history table

CREATE TABLE IF NOT EXISTS ai_legal_chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    message_type TEXT NOT NULL, -- 'user', 'assistant'
    content TEXT NOT NULL,
    context_documents TEXT, -- JSON array of referenced doc IDs
    metadata TEXT, -- JSON (tokens, model, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_legal_chat_user ON ai_legal_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_legal_chat_session ON ai_legal_chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_legal_chat_created ON ai_legal_chat_history(created_at);
