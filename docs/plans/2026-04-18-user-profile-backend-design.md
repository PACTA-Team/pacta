# Design: User Profile API Endpoints

**Date:** 2026-04-18
**Issue:** #99
**Feature:** Backend Profile and Password Change Handlers

## Overview

Add Go backend handlers for user profile management and password change functionality.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/profile` | Get current user profile |
| PATCH | `/api/user/profile` | Update current user profile |
| POST | `/api/user/change-password` | Change password with validation |

## Data Models

### User (existing in models.go)
```go
type User struct {
    ID           int
    Name         string
    Email        string
    PasswordHash string // never exposed
    Role         string
    Status       string
    CompanyID    *int
    LastAccess   *time.Time
    CreatedAt    time.Time
    UpdatedAt    time.Time
}
```

## Request/Response Formats

### GET /api/user/profile
**Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role": "admin",
  "status": "active",
  "last_access": "2026-04-18T10:00:00Z",
  "created_at": "2026-01-01T00:00:00Z"
}
```

### PATCH /api/user/profile
**Request:**
```json
{
  "name": "New Name",
  "email": "newemail@example.com"
}
```
**Response:**
```json
{
  "status": "updated"
}
```

### POST /api/user/change-password
**Request:**
```json
{
  "current_password": "oldpass123",
  "new_password": "newpass456"
}
```
**Response:**
```json
{
  "status": "password changed"
}
```

## Validation Rules

1. **Profile Update:**
   - Name: required, non-empty
   - Email: required, valid email format
   - Email uniqueness check (exclude current user)

2. **Password Change:**
   - current_password: required
   - new_password: required, min 8 characters
   - Must validate current password before updating

## Security

- All endpoints require authentication (session cookie)
- Passwords hashed with bcrypt
- Audit logs created for:
  - Profile updates
  - Password changes

## Files to Modify

1. `internal/handlers/users.go` - Add handlers
2. `internal/server/server.go` - Register routes

## Route Registration

```go
r.Get("/api/user/profile", h.HandleUserProfile)
r.Patch("/api/user/profile", h.HandleUserProfile)
r.Post("/api/user/change-password", h.HandleChangePassword)
```

## Acceptance Criteria

- [ ] GET /api/user/profile returns current user data
- [ ] PATCH /api/user/profile updates name and email
- [ ] Password change validates current password
- [ ] Audit logs created for profile and password changes