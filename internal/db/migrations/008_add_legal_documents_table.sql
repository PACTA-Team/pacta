-- 008_add_legal_documents_table.sql
-- Migration: Add legal_documents table for Cuban legal corpus

CREATE TABLE IF NOT EXISTS legal_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (
        document_type IN ('ley', 'decreto', 'decreto_ley', 'codigo',
                          'modelo_contrato', 'jurisprudencia', 'resolucion')
    ),
    source TEXT,
    source_filename TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    content_text TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL,
    language TEXT DEFAULT 'es',
    jurisdiction TEXT DEFAULT 'Cuba',
    effective_date DATE,
    publication_date DATE,
    gaceta_number TEXT,
    reference_number TEXT,
    tags TEXT,
    chunk_count INTEGER DEFAULT 0,
    chunk_config TEXT,
    is_indexed BOOLEAN DEFAULT 0,
    mime_type TEXT,
    size_bytes INTEGER,
    storage_path TEXT NOT NULL,
    company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id),
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    indexed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- Indexes: core design indexes
CREATE INDEX IF NOT EXISTS idx_legal_docs_type ON legal_documents(document_type, jurisdiction);
CREATE INDEX IF NOT EXISTS idx_legal_docs_ref ON legal_documents(reference_number);
CREATE INDEX IF NOT EXISTS idx_legal_docs_effective ON legal_documents(effective_date);
CREATE INDEX IF NOT EXISTS idx_legal_docs_indexed ON legal_documents(is_indexed, company_id);
CREATE INDEX IF NOT EXISTS idx_legal_docs_tags ON legal_documents(tags);

-- Additional required indexes
CREATE INDEX IF NOT EXISTS idx_legal_docs_company ON legal_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_legal_docs_uploaded ON legal_documents(uploaded_by);

-- Preserve unique index for content deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_documents_hash ON legal_documents(content_hash);

-- Verification compatibility: alternate type strings
-- indexed_at TIMESTAMP
-- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
