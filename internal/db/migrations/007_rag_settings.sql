-- Add RAG (Retrieval-Augmented Generation) configuration settings
-- This migration adds the necessary system settings for the MiniRAG hybrid system

INSERT OR IGNORE INTO system_settings (key, value, category) VALUES 
('rag_mode', 'external', 'rag'),
('local_model', 'phi-3.5-min-i-instruct', 'rag'),
('embedding_model', 'all-MiniLM-L6-v2', 'rag'),
('vector_db_path', '', 'rag'),
('hybrid_strategy', 'local-first', 'rag'),
('hybrid_rerank', 'true', 'rag');

-- Note: Migration tracking is done via schema_migrations table
-- This migration should be tracked by the application startup
