# Document Attachments Design

> **Status:** Approved for Implementation
> **Date:** 2026-04-11
> **Priority:** Critical -- Schema exists since v0.4.0, blocks contract detail pages

## Problem

Contracts need supporting documents (PDFs, scans, signed copies) attached to them. The database schema (`007_documents.sql`) exists but has no API endpoints or handlers.

## Design Decisions

### 1. Storage Strategy: Local Filesystem

**Decision:** Store uploaded files on the local filesystem under `{data_dir}/documents/`, not in the database as BLOBs.

**Rationale:**
- SQLite is not designed for large binary storage
- Filesystem allows direct backup/restore of documents
- Simpler streaming downloads without loading entire file into memory
- Follows PACTA's zero-dependency principle (no S3, no cloud storage)

**Path structure:** `{data_dir}/documents/{entity_type}/{entity_id}/{filename}`

Example: `/home/user/.local/share/pacta/data/documents/contract/12/signed_contract.pdf`

### 2. Upload Mechanism: Multipart Form Data

**Decision:** Use `multipart/form-data` for uploads, not base64-in-JSON.

**Rationale:**
- Standard HTTP file upload pattern
- Browser-native `<input type="file">` support
- No base64 overhead (33% size increase)
- Go's `r.FormFile()` handles streaming

### 3. Entity Types: Contract Only (For Now)

**Decision:** Support `entity_type = 'contract'` only in this iteration.

**Rationale:**
- YAGNI -- contracts are the primary use case
- Schema supports any entity type, so extension is trivial later
- Keeps validation logic focused

### 4. File Size Limit: 50MB

**Decision:** Enforce 50MB max file size per upload.

**Rationale:**
- Contracts are typically PDFs under 10MB
- 50MB provides headroom for scanned documents with images
- Prevents disk exhaustion attacks
- Configurable via `ParseMultipartForm(50 << 20, ...)`

### 5. No File Type Restriction (For Now)

**Decision:** Accept any file type, store `mime_type` from client hint.

**Rationale:**
- Contracts may include various formats (PDF, DOCX, images, scans)
- Server-side MIME detection adds complexity (magic number parsing)
- Trust client for now; can add validation later
- Store `mime_type` for proper `Content-Type` on download

## API Design

### Create Document (Upload)

```
POST /api/documents
Content-Type: multipart/form-data

Form fields:
- file: <binary file> (required)
- entity_id: integer (required)
- entity_type: string (required, must be "contract")

Response 201:
{
  "id": 1,
  "entity_id": 12,
  "entity_type": "contract",
  "filename": "signed_contract.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 245678,
  "created_at": "2026-04-11T10:30:00Z"
}

Response 400: "entity_type must be 'contract'"
Response 400: "contract not found"
Response 413: "file size exceeds 50MB limit"
Response 400: "no file uploaded"
```

### List Documents

```
GET /api/documents?entity_id=12&entity_type=contract

Response 200:
[
  {
    "id": 1,
    "entity_id": 12,
    "entity_type": "contract",
    "filename": "signed_contract.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 245678,
    "created_at": "2026-04-11T10:30:00Z"
  }
]
```

### Get Document (Download)

```
GET /api/documents/{id}/download

Response 200:
Content-Type: application/pdf
Content-Disposition: attachment; filename="signed_contract.pdf"
Content-Length: 245678
<binary file content>

Response 404: "document not found"
```

### Delete Document

```
DELETE /api/documents/{id}

Response 200: {"status": "deleted"}
Response 404: "document not found"
```

**Note:** No update endpoint -- documents are immutable. To replace a document, delete and re-upload.

## Data Flow

```
Browser → POST /api/documents (multipart)
  → Handler validates entity_type = "contract"
  → Handler validates contract exists (FK check)
  → Handler saves file to {data_dir}/documents/contract/{entity_id}/{filename}
  → Handler INSERT into documents table
  → Handler audit log entry
  → Response 201 with metadata

Browser → GET /api/documents/{id}/download
  → Handler SELECT from documents table
  → Handler reads file from filesystem
  → Handler streams file with proper headers

Browser → DELETE /api/documents/{id}
  → Handler SELECT to get filename
  → Handler DELETE from documents table
  → Handler deletes file from filesystem
  → Handler audit log entry
```

## Error Handling

| Error | HTTP Status | Message |
|-------|-------------|---------|
| No file in request | 400 | "no file uploaded" |
| Missing entity_id | 400 | "entity_id is required" |
| Invalid entity_type | 400 | "entity_type must be 'contract'" |
| Contract not found | 400 | "contract not found" |
| File too large | 413 | "file size exceeds 50MB limit" |
| File not found on disk | 500 | "document file corrupted" (sanitized) |
| DB error | 500 | "failed to save document" (sanitized) |

## Security Considerations

1. **Path traversal prevention:** Use UUID for storage filename, keep original filename only in DB
2. **Authentication required:** All routes behind `AuthMiddleware`
3. **File size limit:** 50MB max to prevent disk exhaustion
4. **No executable execution:** Files stored outside web root, served only via handler
5. **Audit logging:** All uploads and deletions logged

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Modify | `internal/models/models.go` | Add `Document` struct |
| Create | `internal/handlers/documents.go` | CRUD handlers |
| Modify | `internal/server/server.go` | Register document routes |
| Modify | `docs/PROJECT_SUMMARY.md` | Update progress tracking |

## Storage Path Strategy

```
{data_dir}/documents/
├── contract/
│   ├── 12/
│   │   ├── {uuid}.pdf          # Actual file
│   │   └── {uuid}.docx
│   └── 15/
│       └── {uuid}.pdf
└── supplier/                    # Future expansion
    └── ...
```

**UUID storage** prevents:
- Filename collisions
- Path traversal attacks (`../../../etc/passwd`)
- Filesystem enumeration
