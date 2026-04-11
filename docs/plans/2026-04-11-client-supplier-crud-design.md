# Client/Supplier Update & Delete Endpoints Design

> **Date:** 2026-04-11
> **Status:** Approved
> **Version Target:** v0.6.0

---

## Problem

Clients and suppliers only support create + list. No way to update or delete existing records, blocking complete party management workflows.

## Solution

Add GET/PUT/DELETE by ID endpoints for both clients and suppliers, following the same patterns used in contracts handlers.

---

## API Design

### Clients

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients/{id}` | Get single client |
| PUT | `/api/clients/{id}` | Update client fields |
| DELETE | `/api/clients/{id}` | Soft delete client |

### Suppliers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/suppliers/{id}` | Get single supplier |
| PUT | `/api/suppliers/{id}` | Update supplier fields |
| DELETE | `/api/suppliers/{id}` | Soft delete supplier |

---

## Implementation Details

### Delete Pattern
Soft delete: `UPDATE clients SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`
Returns 404 if not found or already deleted.

### Update Pattern
Full field update (all fields required except optional ones). Same request struct as create.
Returns 404 if not found.

### Error Handling
- Invalid ID format → 400 Bad Request
- Not found → 404 Not Found
- DB error → 500 with sanitized message

### Files Modified

| File | Change |
|------|--------|
| `internal/handlers/clients.go` | Add HandleClientByID, updateClient, deleteClient |
| `internal/handlers/suppliers.go` | Add HandleSupplierByID, updateSupplier, deleteSupplier |
| `internal/server/server.go` | Add 6 new routes |

---

## Security

- All endpoints require authentication (AuthMiddleware)
- No additional authorization checks (any authenticated user can manage parties)
- Soft delete prevents accidental data loss
