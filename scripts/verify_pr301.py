#!/usr/bin/env python3
"""
Static verification loop for PR #301 Cuban Legal Expert System.
Checks design doc compliance against implementation.
Fails (non-zero exit) if any discrepancy found.
"""

import re
import sys
import json
from pathlib import Path

BASE = Path("/home/mowgli/pacta")

def fail(msg):
    print(f"❌ FAIL: {msg}")
    sys.exit(1)

def check_file(path, desc):
    if not path.exists():
        fail(f"{desc} not found at {path}")
    print(f"✅ {desc} exists")

# ── 1. Verify migrations ────────────────────────────────────────────────────

migration_008 = BASE / "internal/db/migrations/008_add_legal_documents_table.sql"
check_file(migration_008, "Migration 008 (legal_documents)")

migration_008_text = migration_008.read_text()
required_cols = [
    "id INTEGER PRIMARY KEY AUTOINCREMENT",
    "title TEXT NOT NULL",
    "document_type TEXT NOT NULL",
    "source_filename TEXT NOT NULL",
    "storage_path TEXT NOT NULL",
    "mime_type TEXT",
    "size_bytes INTEGER",
    "content_text TEXT NOT NULL",
    "tags TEXT",
    "chunk_config TEXT",
    "is_indexed BOOLEAN DEFAULT 0",
    "indexed_at DATETIME",
    "company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id)",
    "uploaded_by INTEGER NOT NULL REFERENCES users(id)",
    "deleted_at DATETIME",
    "created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
    "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
]

for col in required_cols:
    if col not in migration_008_text:
        fail(f"Migration 008 missing column: {col}")

print("✅ Migration 008 has all required columns (incl. deleted_at, company_id, uploaded_by)")

# Check all required columns and report missing ones
missing_cols = []
required_cols_list = [
    "id INTEGER PRIMARY KEY AUTOINCREMENT",
    "title TEXT NOT NULL",
    "document_type TEXT NOT NULL",
    "source TEXT",
    "content TEXT NOT NULL",
    "content_hash TEXT NOT NULL",
    "language TEXT DEFAULT 'es'",
    "jurisdiction TEXT DEFAULT 'Cuba'",
    "effective_date DATE",
    "publication_date DATE",
    "gaceta_number TEXT",
    "tags TEXT",
    "chunk_count INTEGER DEFAULT 0",
    "indexed_at TIMESTAMP",
    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    "deleted_at DATETIME",              # CRITICAL: soft delete
    "company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id)",  # multi-tenancy
    "uploaded_by INTEGER NOT NULL REFERENCES users(id)",  # audit trail
    "storage_path TEXT NOT NULL",       # file location
    "mime_type TEXT",                   # MIME type
    "size_bytes INTEGER",               # file size
    "chunk_config TEXT",                # chunking strategy
    "is_indexed BOOLEAN DEFAULT 0",     # indexing status flag
]

for col in required_cols_list:
    if col not in migration_008_text:
        missing_cols.append(col)

if missing_cols:
    print("❌ Migration 008 missing columns:")
    for c in missing_cols:
        print(f"   - {c}")
    sys.exit(1)

print("✅ Migration 008 has all required columns (incl. deleted_at, company_id, uploaded_by, storage_path, mime_type, size_bytes, chunk_config, is_indexed)")

# ── 2. Verify chat history migration ────────────────────────────────────────

migration_009 = BASE / "internal/db/migrations/009_add_ai_legal_chat_history_table.sql"
check_file(migration_009, "Migration 009 (ai_legal_chat_history)")

migration_009_text = migration_009.read_text()
if "session_id TEXT NOT NULL" not in migration_009_text:
    fail("Migration 009 missing session_id column")
if "contract_id INTEGER REFERENCES contracts(id)" not in migration_009_text:
    fail("Migration 009 missing contract_id column")

print("✅ Migration 009 structure correct (session_id + contract_id)")

# ── 3. Verify system settings migration ─────────────────────────────────────

migration_010 = BASE / "internal/db/migrations/010_add_ai_legal_settings.sql"
check_file(migration_010, "Migration 010 (system_settings)")

migration_010_text = migration_010.read_text()
for key in ["ai_legal_enabled", "ai_legal_integration", "ai_legal_embedding_model", "ai_legal_chat_model"]:
    if key not in migration_010_text:
        fail(f"Migration 010 missing setting key: {key}")

print("✅ Migration 010 includes required settings")

# ── 4. Verify models ─────────────────────────────────────────────────────────

legal_model = BASE / "internal/models/legal_document.go"
check_file(legal_model, "LegalDocument model")

legal_model_text = legal_model.read_text()
model_fields = ["Title", "DocumentType", "Content", "ContentHash", "Jurisdiction", "Language",
                "EffectiveDate", "PublicationDate", "GacetaNumber", "Tags", "ChunkCount",
                "IndexedAt", "CreatedAt", "UpdatedAt", "CompanyID", "UploadedBy", "DeletedAt"]

for field in model_fields:
    # flexible match (case variations)
    pattern = re.compile(fr'`.*?"?{field}"?\s+.*?`', re.IGNORECASE)
    if not pattern.search(legal_model_text):
        fail(f"LegalDocument model missing field: {field}")

print("✅ LegalDocument model has all required fields (including CompanyID, UploadedBy, DeletedAt)")

# ── 5. Verify parser exists ──────────────────────────────────────────────────

parser_file = BASE / "internal/ai/legal/parser.go"
check_file(parser_file, "Legal parser")

parser_text = parser_file.read_text()
if "ParseByArticles" not in parser_text:
    fail("Parser missing ParseByArticles function")
if "CLÁUSULA" not in parser_text.upper() or "ARTÍCULO" not in parser_text.upper():
    fail("Parser missing article/clause detection")

print("✅ Parser implemented with structured chunking")

# ── 6. Verify indexer extension ─────────────────────────────────────────────

indexer_file = BASE / "internal/ai/minirag/indexer.go"
check_file(indexer_file, "MiniRAG indexer")

indexer_text = indexer_file.read_text()
if "IndexLegalDocument" not in indexer_text:
    fail("Indexer missing IndexLegalDocument method")

print("✅ Indexer extended with IndexLegalDocument")

# ── 7. Verify vector DB search returns content ───────────────────────────────

vector_db_file = BASE / "internal/ai/minirag/vector_db.go"
check_file(vector_db_file, "Vector DB")

vector_db_text = vector_db_file.read_text()
# Check that SearchLegalDocuments returns content, not just metadata
if "content" not in vector_db_text.lower() or "dc.content" not in vector_db_text:
    fail("VectorDB.SearchLegalDocuments must return chunk content")

print("✅ VectorDB search returns chunk content (RAG effective)")

# ── 8. Verify chat service builds prompt with content ─────────────────────────

chat_service = BASE / "internal/ai/legal/chat_service.go"
check_file(chat_service, "Chat service")

chat_text = chat_service.read_text()
if "buildPrompt" not in chat_text:
    fail("ChatService missing buildPrompt method")

# Ensure it includes context docs content, not just titles
if "doc.Content" not in chat_text and "chunk.Text" not in chat_text:
    fail("ChatService buildPrompt must include legal text snippets in prompt")

print("✅ ChatService builds prompt with legal content")

# ── 9. Verify API handlers exist ─────────────────────────────────────────────

handlers_file = BASE / "internal/handlers/ai.go"
check_file(handlers_file, "AI handlers")

handlers_text = handlers_file.read_text()
required_handlers = [
    "UploadLegalDocument",
    "HandleLegalChat",
    "HandleValidateContract",
    "HandleListLegalDocuments",
    "HandleDeleteLegalDocument",
    "HandleLegalStatus",
]
for h in required_handlers:
    if h not in handlers_text:
        fail(f"Handler missing: {h}")

print("✅ All required handlers implemented (including DELETE)")

# ── 10. Verify route registration in server.go ───────────────────────────────

server_file = BASE / "internal/server/server.go"
check_file(server_file, "Server router")

server_text = server_file.read_text()
# Legal routes should be registered under /api/ai/legal
if "/api/ai/legal" not in server_text:
    fail("Legal endpoints not registered in router (missing `/api/ai/legal` mount)")

print("✅ Legal routes registered in server.go")

# ── 11. Verify admin role checks ─────────────────────────────────────────────

auth_checks_present = 0
for pattern in ["RequireRole", "RoleAdmin", "auth.RequireRole"]:
    if pattern in handlers_text:
        auth_checks_present += 1

if auth_checks_present == 0:
    fail("No admin role checks found in AI handlers (upload/delete should be admin-only)")

print("✅ Admin role checks present in handlers")

# ── 12. Verify file upload validation (magic bytes) ───────────────────────────

if "pdfcpu" not in handlers_text and "ValidateFileHeader" not in handlers_text:
    fail("Upload handler lacks magic bytes validation")

print("✅ File upload includes magic bytes validation")

# ── 13. Verify frontend components exist ─────────────────────────────────────

settings_page = BASE / "pacta_appweb/src/pages/SettingsPage.tsx"
check_file(settings_page, "SettingsPage (admin UI)")

settings_text = settings_page.read_text()
if "⚖️" not in settings_text and "LegalSection" not in settings_text:
    fail("SettingsPage missing LegalSection/tab")

print("✅ SettingsPage includes LegalSection")

# Chat route
chat_page = BASE / "pacta_appweb/src/app/ai-legal/chat/page.tsx"
check_file(chat_page, "Chat page")

# Chat panel component
chat_panel = BASE / "pacta_appweb/src/components/ChatPanel.tsx"
check_file(chat_panel, "ChatPanel component")

# Validation modal
validation_modal = BASE / "pacta_appweb/src/components/ValidationModal.tsx"
check_file(validation_modal, "ValidationModal component")

# Contract form wrapper
contract_form = BASE / "pacta_appweb/src/components/ContractFormWrapper.tsx"
check_file(contract_form, "ContractFormWrapper")

print("✅ All frontend components present")

# ── 14. Verify frontend API calls match backend ───────────────────────────────

# Check validation modal expects structured risks
validation_modal_text = validation_modal.read_text()
if "risks" not in validation_modal_text.lower() or "missing_clauses" not in validation_modal_text.lower():
    fail("ValidationModal does not expect structured risks/missing_clauses")

print("✅ ValidationModal expects structured output")

# Check chat expects sources
chat_panel_text = chat_panel.read_text()
if "sources" not in chat_panel_text.lower() and "citation" not in chat_panel_text.lower():
    fail("ChatPanel does not display source citations")

print("✅ ChatPanel displays sources")

# ── 15. Verify header icon linking to chat ────────────────────────────────────

app_layout = BASE / "pacta_appweb/src/components/AppLayout.tsx"
check_file(app_layout, "AppLayout header")

layout_text = app_layout.read_text()
if "/ai-legal/chat" not in layout_text and "⚖️" not in layout_text:
    fail("AppLayout header missing link to /ai-legal/chat")

print("✅ Header includes link to chat")

# ── 16. Verify DELETE endpoint used in frontend ───────────────────────────────

legal_doc_list = BASE / "pacta_appweb/src/components/LegalDocumentList.tsx"
check_file(legal_doc_list, "LegalDocumentList")

list_text = legal_doc_list.read_text()
if "DELETE" not in list_text.upper() and "delete" not in list_text.lower():
    fail("LegalDocumentList does not call DELETE endpoint")

print("✅ LegalDocumentList calls DELETE")

# ── 17. Verify preview endpoint call ─────────────────────────────────────────

if "preview" not in list_text.lower():
    fail("LegalDocumentList missing preview endpoint call")

print("✅ LegalDocumentList calls preview endpoint")

# ── 18. Verify toggle state management ────────────────────────────────────────

if "ai_legal_enabled" not in settings_text:
    fail("SettingsPage missing ai_legal_enabled toggle")

print("✅ Settings include ai_legal_enabled toggle")

# ── 19. Verify test coverage ──────────────────────────────────────────────────

# Backend tests
parser_test = BASE / "internal/ai/legal/parser_test.go"
check_file(parser_test, "Parser tests")

chat_test = BASE / "internal/ai/legal/chat_service_test.go"
check_file(chat_test, "Chat service tests")

handler_test = BASE / "internal/handlers/legal_test.go"
check_file(handler_test, "Handler tests")

print("✅ Test files present")

# ──────────────────────────────────────────────────────────────────────────────

print("\n" + "="*60)
print("✅ ALL VERIFICATION CHECKS PASSED")
print("="*60)
sys.exit(0)
