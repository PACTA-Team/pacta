# Design: User Digital Certificates

**Date:** 2026-04-18
**Issue:** #101
**Feature:** Add Digital Signature Fields to Backend

## Overview

Add database columns and API endpoints for user digital certificate management (P12 digital signatures and public certificates).

## Database Changes

### Migration: 030_user_certificates.sql

```sql
ALTER TABLE users ADD COLUMN digital_signature_url TEXT;
ALTER TABLE users ADD COLUMN digital_signature_key TEXT;
ALTER TABLE users ADD COLUMN public_cert_url TEXT;
ALTER TABLE users ADD COLUMN public_cert_key TEXT;
```

## Model Changes

### User struct (models.go)

```go
type User struct {
    // ... existing fields ...
    DigitalSignatureURL *string `json:"digital_signature_url,omitempty"`
    DigitalSignatureKey *string `json:"digital_signature_key,omitempty"`
    PublicCertURL       *string `json:"public_cert_url,omitempty"`
    PublicCertKey       *string `json:"public_cert_key,omitempty"`
}
```

## API Endpoints

### POST /api/user/certificate
- **Content-Type:** multipart/form-data
- **Fields:**
  - `type` (required): "digital_signature" or "public_cert"
  - `file` (required): The certificate file
- **Response:** `{ "status": "uploaded", "filename": "..." }`

### DELETE /api/user/certificate/{type}
- **Path Parameter:** `type` - "digital_signature" or "public_cert"
- **Response:** `{ "status": "deleted" }`

## File Validation

| Type | Extensions | Max Size |
|------|------------|----------|
| Digital Signature | .p12, .pfx | 1MB |
| Public Certificate | .cer, .crt, .pem, .der | 1MB |

## Storage

- **Path:** `{DataDir}/certificates/{userID}/{type}/{filename}`
- **Filename:** UUID-based to avoid collisions
- **Original filename:** Stored in database for reference

## Security

- Only authenticated users can upload/delete their own certificates
- File type validation by extension
- File size limit: 1MB
- Audit logging for uploads and deletions

## Acceptance Criteria

- [ ] Database migration adds columns to users table
- [ ] P12 upload accepts .p12/.pfx files only
- [ ] Public cert accepts .cer/.crt/.pem/.der files only
- [ ] Files stored in DataDir/certificates/
- [ ] DELETE endpoint removes files and clears database fields
- [ ] Audit logs created for upload and delete operations