-- Add RAG (Retrieval-Augmented Generation) configuration settings
-- This migration adds the necessary system settings for the MiniRAG hybrid system
-- Supports 3 local modes: "cgo" (Qwen2.5-0.5B-Instruct EMBEDDED), "ollama" (HTTP API), "external"

INSERT OR IGNORE INTO system_settings (key, value, category) VALUES 
('rag_mode', 'external', 'rag'),
('local_mode', 'cgo', 'rag'),
('local_model', 'qwen2.5-0.5b-instruct-q4_0.gguf', 'rag'),
('embedding_model', 'all-MiniLM-L6-v2', 'rag'),
('vector_db_path', '', 'rag'),
('hybrid_strategy', 'local-first', 'rag'),
('hybrid_rerank', 'true', 'rag');

-- Note: Migration tracking is done via schema_migrations table
-- This migration should be tracked by the application startup
