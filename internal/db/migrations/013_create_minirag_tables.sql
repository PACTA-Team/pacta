-- +goose Up
-- Migration: 20250502000000_create_minirag_tables
-- Purpose: Create tables for MiniRAG chunk metadata storage
-- Date: 2026-05-02
--
-- Tables: minirag_chunks
-- Indexes: idx_minirag_contract, idx_minirag_vector_id, idx_minirag_clause_type

CREATE TABLE IF NOT EXISTS minirag_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    page_number INTEGER,
    clause_type TEXT,
    vector_id INTEGER NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_minirag_contract ON minirag_chunks(contract_id);
CREATE INDEX IF NOT EXISTS idx_minirag_vector_id ON minirag_chunks(vector_id);
CREATE INDEX IF NOT EXISTS idx_minirag_clause_type ON minirag_chunks(clause_type);

-- +goose Down
DROP INDEX IF EXISTS idx_minirag_clause_type;
DROP INDEX IF EXISTS idx_minirag_vector_id;
DROP INDEX IF EXISTS idx_minirag_contract;
DROP TABLE IF EXISTS minirag_chunks;
