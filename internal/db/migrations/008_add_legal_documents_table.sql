-- 008_add_legal_documents_table.sql
-- Migration: Add legal_documents table for Cuban legal corpus

CREATE TABLE IF NOT EXISTS legal_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    document_type TEXT NOT NULL, -- 'law', 'decree', 'regulation', 'contract_template'
    source TEXT, -- file path or URL
    content TEXT NOT NULL, -- full text
    content_hash TEXT NOT NULL, -- SHA256 for change detection
    language TEXT DEFAULT 'es',
    jurisdiction TEXT DEFAULT 'Cuba',
    effective_date DATE,
    publication_date DATE,
    gaceta_number TEXT,
    tags TEXT, -- JSON array
    chunk_count INTEGER DEFAULT 0,
    indexed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_type ON legal_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_legal_documents_jurisdiction ON legal_documents(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_legal_documents_tags ON legal_documents(tags);
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_documents_hash ON legal_documents(content_hash);
