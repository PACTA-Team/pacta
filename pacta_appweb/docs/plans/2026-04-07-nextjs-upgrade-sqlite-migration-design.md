# Design: Next.js Security Upgrade + SQLite Migration

## Summary

Upgrade Next.js from 15.2.4 to 15.5.0 to patch CVE-2025-66478, and replace Supabase/PostgREST with local SQLite using better-sqlite3 and bcrypt-based authentication.

## Decisions Made

- **Auth**: Email/password with bcrypt + JWT via jose (no external auth)
- **Database**: better-sqlite3 with direct SQL queries (no ORM)
- **Data**: Fresh schema with seed data, no Supabase data migration
- **Scope**: Single-server deployment (SQLite file-based)

## Architecture

### Dependency Changes

| Action | Package | Version |
|--------|---------|---------|
| Upgrade | next | 15.2.4 → 15.5.0 |
| Remove | @supabase/postgrest-js | — |
| Remove | @supabase/supabase-js | — |
| Add | better-sqlite3 | latest |
| Add | @types/better-sqlite3 | latest |
| Add | bcrypt | latest |

### File Structure

```
src/lib/
  db.ts              # SQLite client singleton + schema init
  schema.sql         # CREATE TABLE statements
  seed.ts            # Initial data (admin user, sample records)
  auth.ts            # bcrypt + JWT auth (replaces auth-middleware.ts)
  crud-operations.ts # Rewritten for SQLite (same interface)
  api-utils.ts       # Updated: remove SUPABASE_* env validation
```

### Database Initialization

- On first server start, check if `data/pacta.db` exists
- If not, run `schema.sql` then `seed.ts`
- Database file stored in `data/` directory (gitignored)
- Use `:memory:` database for test environment

## Database Schema

### Tables

- **users**: id (PK), name, email (UNIQUE), password_hash, role, status, last_access, created_at
- **clients**: id (PK), name, address, reu_code, contacts, document_url, document_key, document_name, created_by, created_at, updated_at
- **suppliers**: id (PK), name, address, reu_code, contacts, document_url, document_key, document_name, created_by, created_at, updated_at
- **authorized_signers**: id (PK), company_id, company_type, first_name, last_name, position, phone, email, document_url, document_key, document_name, created_by, created_at, updated_at
- **contracts**: id (PK), contract_number, title, client_id (FK→clients), supplier_id (FK→suppliers), client_signer_id, supplier_signer_id, start_date, end_date, amount, type, status, description, created_by, created_at, updated_at
- **supplements**: id (PK), contract_id (FK→contracts), supplement_number, description, effective_date, modifications, status, document_url, document_key, document_name, client_signer_id, supplier_signer_id, created_by, created_at, updated_at
- **documents**: id (PK), contract_id (FK→contracts), file_name, file_type, file_size, file_url, file_key, uploaded_by, uploaded_at
- **notifications**: id (PK), contract_id (FK→contracts), contract_number, contract_title, type, message, status, created_at, read_at
- **audit_logs**: id (PK), contract_id (FK→contracts), user_id, user_name, action, details, timestamp

All foreign keys enforced with `PRAGMA foreign_keys = ON`.

## Auth Flow

1. **Login**: POST `/next_api/auth/login` with `{email, password}` → verify bcrypt hash → return JWT
2. **JWT Structure**: `{sub: userId, role, iat, exp}` with 24h expiry, signed with `JWT_SECRET`
3. **withAuth middleware**: Extract Bearer token → verify JWT with jose → attach `{user, token}` to handler
4. **Password hashing**: bcrypt with cost factor 12

### Environment Variables

- **Remove**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- **Add**: `JWT_SECRET` (required for production, default dev value with warning)

## Error Handling

- `DatabaseError` class wraps better-sqlite3 errors with consistent `{message, code, statusCode}` format
- SQLite constraint violations (UNIQUE, FOREIGN KEY) mapped to 400/409 status codes
- API routes use existing `createErrorResponse` pattern
- No changes to error response format consumed by frontend

## Testing

- Test SQLite CRUD operations with in-memory database (`:memory:`)
- Test auth flow: login → JWT → authenticated request → expired token
- Test API endpoints with authenticated and unauthenticated requests
- Verify `npm run build` passes without `SUPABASE_*` env vars
- Verify `npm run lint` passes

## API Route Changes

- Keep all existing route paths unchanged
- Replace `withAuth` (Supabase JWT) with new `withAuth` (local JWT via jose)
- `CrudOperations` class keeps same interface, swaps PostgREST for SQLite internally
- Upload route unchanged (uses filesystem, not Supabase)
- Health route unchanged (no database dependency)

## CSP Header Updates

Remove `https://api.supabase.co` from `connect-src` in `next.config.ts` Content-Security-Policy headers.
