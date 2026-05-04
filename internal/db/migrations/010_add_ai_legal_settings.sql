-- 010_add_ai_legal_settings.sql
-- Migration: Add AI legal system settings

-- Ensure table exists (defensive)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default legal AI settings if not present
INSERT OR IGNORE INTO system_settings (key, value) VALUES 
    ('ai_legal_enabled', '0'),
    ('ai_legal_integration', '0'),
    ('ai_legal_model', 'Qwen2.5-0.5B-Instruct'),
    ('ai_legal_embedding_model', 'all-minilm-l6-v2'),
    ('ai_legal_chunk_size', '1000'),
    ('ai_legal_chunk_overlap', '200'),
    ('ai_legal_max_context_docs', '5');
