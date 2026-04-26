# PACTA Threat Model

**Version:** 1.0  
**Date:** 2026-04-26  
**Scope:** PACTA web application (Go backend, React frontend, SQLite database)  
** Methodology:** STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)

---

## 1. System Overview

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Internet / Users                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS (TLS 1.3)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Reverse Proxy (Caddy)                     │
│              - TLS termination                              │
│              - X-Forwarded-For injection                     │
│              - Rate limiting (future)                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Go Backend (Chi Router)                     │
│  - Handlers (HTTP API)                                      │
│  - Middleware: CSRF, Rate Limit, Security Headers, Sessions │
│  - Auth: Bcrypt, sessions, tenant isolation                 │
│  - DB: SQLite with RLS policies                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   SQLite Database                            │
│  - User, company, contract, document storage                │
│  - Soft deletes, audit logs                                 │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User → Frontend**: React SPA loaded from embedded static files
2. **Frontend → Backend**: API calls with session cookie + CSRF token
3. **Backend → DB**: Parameterized queries via `database/sql`
4. **Authenticated actions**: Audit logged with user ID, company ID, IP, action type

### Trust Boundaries

| Boundary | Components | Trust assumptions |
|----------|------------|-------------------|
| **Internet → Proxy** | TLS 1.3, Caddy | External network untrusted; TLS ensures confidentiality/integrity |
| **Proxy → Backend** | Loopback (127.0.0.1) | Trusted proxy provides real client IP via `X-Forwarded-For` |
| **Backend → DB** | Local filesystem | DB file readable only by app user; OS-level protection |
| **Frontend → User** | Browser | Frontend code visible; secrets never embedded |

---

## 2. STRIDE Threat Analysis

### Spoofing (S)

**Threats:**
- Attacker impersonates legitimate user via session cookie theft
- Attacker forges CSRF token to execute actions on behalf of victim
- Attacker spoofs IP address to bypass rate limiting or audit logging

**Controls:**
- **Sessions**: Secure, HttpOnly, SameSite=Strict cookies; random 32-byte tokens
- **CSRF**: Per-session rotating tokens (gorilla/csrf with patched fork)
- **IP Logging**: `X-Forwarded-For` only trusted from localhost (Caddy); cannot be spoofed externally
- **Bcrypt**: Password hashing with cost factor 12

**Residual Risk:**
- XSS could steal session cookie → mitigated by CSP nonce + sanitization
- Session fixation → mitigated by rotating tokens on login

---

### Tampering (T)

**Threats:**
- Attacker modifies request parameters (e.g., `company_id`, `resource_id`) to access unauthorized data
- Attacker tampers with SQL queries via injection in RLS
- Attacker modifies stored files (documents, certificates)

**Controls:**
- **RLS Middleware**: `EnforceOwnership` validates every query includes `company_id = ? AND deleted_at IS NULL`
- **Table allowlist**: Only known tables allowed; prevents SQLi via table name
- **Parameterized queries**: All DB access via `?` placeholders (no string interpolation)
- **Path validation**: Document storage keys validated to prevent `../` traversal
- **Soft deletes**: `deleted_at` filters exclude deleted records automatically

**Residual Risk:**
- Bugs in RLS logic could expose cross-company data → mitigated by comprehensive tests + code review

---

### Repudiation (R)

**Threats:**
- User denies performing an action (e.g., document deletion, approval)
- Attacker clears logs to hide tracks
- Insufficient audit trail for compliance (SOX, ISO 27001)

**Controls:**
- **Audit Logging**: Every state-changing operation logs: user_id, company_id, action, resource_type, resource_id, timestamp, IP address
- **Immutable Logs**: Audit records stored in database; deletion requires admin privileges and is itself audited
- **Database Transactions**: Critical operations wrapped in transactions to ensure atomicity + audit consistency

**Residual Risk:**
- Database compromise could allow log tampering → mitigated by DB access controls + encryption at rest (future)

---

### Information Disclosure (I)

**Threats:**
- Error messages leak internal SQL structure, file paths, stack traces
- Enumeration of valid user emails via timing/response differences
- Hardcoded credentials in frontend code
- Missing security headers allow browser-side attacks
- Sensitive data (passwords, certs) stored in plain text

**Controls (Phase 1 & 3):**
- **Generic error responses**: All handlers log detailed error server-side but return `"internal server error"` or `"invalid request"` to client
- **Uniform auth errors**: Login returns same message for non-existent vs wrong-password users; registration returns generic conflict
- **CSP Nonce**: Eliminates `unsafe-inline`/`unsafe-eval`; prevents XSS from injecting malicious scripts
- **Security Headers**: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP/COEP/CORP
- **No hardcoded secrets**: Default admin user removed from frontend; passwords never committed

**Residual Risk:**
- Timing attacks on auth endpoints (mitigated by constant-time delays in auth layer)
- Database compromise exposes all PII → encrypt sensitive columns (future enhancement)

---

### Denial of Service (D)

**Threats:**
- Flooding login endpoint with credential stuffing
- Large file uploads exhausting disk space
- Slow database queries causing thread pool exhaustion
- Unbounded memory allocation in request parsing

**Controls (Phase 2):**
- **Rate Limiting**: Global (100 req/min) + Auth-specific (5 req/min) per IP
- **File Size Limits**: Certificate uploads capped at 1MB; temp documents limited
- **Query timeouts**: Database queries should have sensible timeouts (TODO)
- **Request body limits**: Configured via Chi middleware (TODO)

**Residual Risk:**
- Distributed DoS from many IPs → requires external WAF/CDN
- Application-level resource exhaustion via complex queries → need query analysis + limits

---

### Elevation of Privilege (E)

**Threats:**
- User manipulates parameters to access admin-only endpoints
- SQLi to bypass RLS and escalate privileges
- Session hijacking to assume another user's identity
- Missing authentication on sensitive routes

**Controls:**
- **Authentication Middleware**: All protected routes require valid session cookie + CSRF token
- **Authorization Checks**: `GetCompanyID` extracts tenant context; handlers validate ownership before actions
- **Role Checks**: Admin-only endpoints verify `user.Role == "admin"`
- **RLS at DB layer**: Even if handler bug, queries enforce `company_id` filter
- **Password Policy**: Minimum 8 characters + bcrypt hashing

**Residual Risk:**
- Privilege escalation via business logic bugs → requires ongoing security code review
- Session fixation → tokens rotated on login/logout

---

## 3. Data Classification & Handling

| Data Type | Classification | Storage | Transmission | Retention |
|-----------|---------------|---------|--------------|-----------|
| User passwords | **PII / Secret** | Bcrypt hash only | TLS + CSRF-protected | Indefinite (account active) |
| Email addresses | **PII** | Plain text (DB) | TLS | Until user deletion |
| User name | **PII** | Plain text (DB) | TLS | Until user deletion |
| IP addresses | **PII (GDPR)** | Audit logs (DB) | TLS | 90 days (log rotation) |
| Documents / Certificates | **Sensitive** | Encrypted at rest (future) | TLS | Per-document lifecycle |
| Session tokens | **Secret** | HttpOnly cookie | TLS + Secure flag | 8h sliding expiry |

**Encryption at Rest:** Not yet implemented (future: filesystem-level encryption or encrypted DB columns)

**PII Minimization:** Email is only PII collected; no SSN, credit cards, or health data.

---

## 4. Trust Boundaries & Assumptions

### Assumed Trusted
- **Caddy reverse proxy**: Runs on same host, binds to localhost; `X-Forwarded-For` trusted only from `127.0.0.1`
- **Operating system**: Linux with standard security controls (file permissions, isolated users)
- **Network**: Localhost communication between proxy and backend is trusted

### Untrusted (Adversary Model)
- **Internet users**: All external requests are untrusted
- **Client browsers**: JavaScript can be modified; frontend code is public
- **Database files**: If filesystem is compromised, DB can be exfiltrated

---

## 5. Security Controls Summary

| Control | Layer | Status | Notes |
|---------|-------|--------|-------|
| TLS 1.3 | Network | ✅ | Enforced by Caddy |
| CSP with Nonce | Frontend | ✅ | Phase 1 |
| CSRF Protection | App | ✅ | Patched gorilla/csrf fork |
| Rate Limiting | App | ✅ | Per-endpoint (Phase 2) |
| Session Security | App | ✅ | HttpOnly, Secure, SameSite=Strict |
| Password Hashing | App | ✅ | Bcrypt cost 12 |
| Generic Errors | App | ✅ | Phase 3 |
| Audit Logging | App | ✅ | IP, user, action |
| RLS Middleware | DB | ✅ | Company isolation |
| Input Validation | App | ✅ | Table allowlist, path traversal prevention |
| Security Headers | App | ✅ | HSTS, X-Frame, etc. (all phases) |
| Dependency Scanning | CI | ✅ | Dependabot + govulncheck |
| Secrets Management | Ops | ⚠️ | `.env` not in git; TODO: Vault integration |
| Encryption at Rest | Storage | ❌ | Future enhancement |

---

## 6. Attack Scenarios & Mitigations

| Scenario | Likelihood | Impact | Mitigation |
|----------|------------|--------|------------|
| **SQL injection via `EnforceOwnership`** | Low (fixed) | Critical | Table allowlist + parameterized queries |
| **XSS via inline scripts** | Medium (fixed) | High | CSP nonce eliminates `unsafe-inline` |
| **CSRF token bypass** | Low (patched) | High | Upgraded to filippo.io/csrf fork |
| **User enumeration via login** | Medium (fixed) | Medium | Generic error messages + constant-time delay |
| **Session hijacking** | Medium | High | Secure+HttpOnly+SameSite cookies; 8h sliding expiry |
| **Rate limit bypass** | Low | Medium | Per-endpoint limits; IP-based |
| **Audit log tampering** | Low | High | DB access controls; logs append-only (future) |
| **File upload malware** | Medium | High | Extensions whitelist; size limits; stored outside webroot |
| **Dependency compromise** | Low | Critical | Automated scanning + pinned versions |

---

## 7. Security Testing & Verification

### Completed Phase 1 & 2 Tasks
- ✅ SQLi validation in RLS
- ✅ CSP nonce implementation
- ✅ CSRF fork upgrade
- ✅ User enumeration fixes
- ✅ Hardcoded credentials removed
- ✅ React patched to 19.2.4
- ✅ Localhost bind by default
- ✅ Auth rate limiting (5 req/min)
- ✅ Client IP middleware (X-Forwarded-For from trusted proxy)
- ✅ Storage key validation centralization
- ✅ Environment variable unification (`ENVIRONMENT`)
- ✅ CORS origins configurable
- ✅ Sliding session expiration (8h)

### Phase 3 In Progress
- 🔄 Error message sanitization (this commit)
- 🔄 Additional security headers
- 🔄 Threat model documentation (this document)

### Manual Testing Checklist
- [ ] Verify CSP header includes nonce and excludes `unsafe-inline`
- [ ] Test login with wrong credentials → same response time/message as non-existent user
- [ ] Attempt SQLi payload in `company_id` → rejected by RLS
- [ ] Send 6 consecutive login requests → 429 on 6th
- [ ] Access document with `../../../etc/passwd` key → 400 Bad Request
- [ ] Check headers: `Expect-CT`, `X-Download-Options`, `X-Permitted-Cross-Domain-Policies` present
- [ ] Verify session cookie: Secure, HttpOnly, SameSite=Strict
- [ ] Audit log entries include correct IP from `X-Forwarded-For`

---

## 8. Open Risks & Future Work

### Medium Priority
- **Encryption at Rest**: Certificate files and PII columns should be encrypted
- **WAF Integration**: External CDN/WAF for DDoS protection
- **Penetration Testing**: External security firm review
- **Security.txt**: Add PGP key for encrypted vulnerability reports
- **Vulnerability Disclosure Policy**: Publish SECURITY.md (Task 14 already done)

### Low Priority
- **HSTS Preload**: Submit `pacta.local` (or production domain) to Chrome preload list
- **Certificate Pinning**: Not applicable (self-signed dev certs)
- **SIEM Integration**: Forward audit logs to centralized logging

---

## 9. Incident Response

If a security incident occurs:

1. **Containment**: Disable affected accounts, revoke session tokens, take system offline if needed
2. **Investigation**: Query audit logs for anomalous activity; check `security_audit` table
3. **Notification**: Contact `security@pacta.local` (per `security.txt`)
4. **Remediation**: Apply patches, rotate credentials, update firewall rules
5. **Post-mortem**: Document root cause and preventive measures

**Key Contacts:**
- Security Team: security@pacta.local
- On-call Engineer: (to be defined)

---

## 10. References

- **OWASP Top 10 2021**: Mapping to implemented controls
- **STRIDE Threat Modeling**: Microsoft threat modeling methodology
- **Security Audit**: `docs/security/SECURITY_AUDIT_CSO.md` — original findings
- **Remediation Plan**: `docs/plans/2026-04-26-security-remediation-plan.md`
- **Go Security**: `https://pkg.go.dev/crypto/*`, `golang.org/x/vuln`

---

**Document Maintainer:** PACTA Security Team  
**Next Review:** 2026-10-26 (6-month cycle)
