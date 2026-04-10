# QA Deployment & Test Plan — Pacta

**Date:** 2026-04-09
**Target:** pacta.duckdns.org
**Version:** Latest GitHub Release
**Reviewer:** mowgli (org admin)

---

## Overview

End-to-end QA process for Pacta Contract Lifecycle Management System. Deploy the latest release binary from GitHub Releases to this VPS, expose via Caddy reverse proxy at `pacta.duckdns.org`, and run systematic QA across all frontend pages, backend API endpoints, security controls, and accessibility requirements.

---

## Phase 1: Deployment

### 1.1 Download Release Binary

```bash
# Fetch latest release from GitHub
curl -s https://api.github.com/repos/PACTA-Team/pacta/releases/latest | grep browser_download_url

# Download linux amd64 tarball
curl -L -o pacta-latest.tar.gz <latest-release-url>

# Extract
tar xzf pacta-latest.tar.gz
```

### 1.2 Install to /opt/pacta

```bash
sudo mkdir -p /opt/pacta
sudo mv pacta /opt/pacta/pacta
sudo chmod +x /opt/pacta/pacta
sudo chown -R root:root /opt/pacta
```

### 1.3 Create Systemd Service

File: `/etc/systemd/system/pacta.service`

```ini
[Unit]
Description=PACTA Contract Management System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/pacta
ExecStart=/opt/pacta/pacta
Restart=on-failure
RestartSec=5
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### 1.4 Configure Caddy Reverse Proxy

Add to `/etc/caddy/Caddyfile`:

```
pacta.duckdns.org {
    reverse_proxy localhost:3000

    encode gzip zstd

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    log {
        output file /var/log/caddy/pacta.log
        format json
    }
}
```

Then:
```bash
sudo systemctl reload caddy
sudo systemctl enable pacta
sudo systemctl start pacta
```

### 1.5 Verify Deployment

```bash
# Check service status
sudo systemctl status pacta

# Check Caddy
sudo systemctl status caddy

# Test local access
curl -I http://127.0.0.1:3000

# Test public access
curl -I https://pacta.duckdns.org
```

---

## Phase 2: Multi-User Test Data Setup

### 2.1 Default Admin Login

| Field | Value |
|-------|-------|
| Email | admin@pacta.local |
| Password | admin123 |

### 2.2 Create Test Users

Via the application UI (Settings/Users or equivalent), create:

| Email | Role | Purpose |
|-------|------|---------|
| manager@pacta.local | Manager | Test manager permissions |
| editor@pacta.local | Editor | Test editor permissions |
| viewer@pacta.local | Viewer | Test read-only access |

### 2.3 Create Test Data

Create sample data for QA testing:

- **3 Clients:** Test Corp, Sample Inc, Demo LLC
- **3 Suppliers:** Supply Co, Vendor Ltd, Provider SA
- **5 Contracts:** Mix of draft, active, expired, pending renewal
- **2 Signers per party:** Test signer linking
- **1 Supplement:** Test approval workflow
- **2 Document attachments:** Test upload/linking

---

## Phase 3: Full Frontend QA

### 3.1 Page Inventory

Every reachable page must be tested:

| # | Page | URL Pattern | Priority |
|---|------|-------------|----------|
| 1 | Login | `/` or `/login` | Critical |
| 2 | Dashboard | `/dashboard` | Critical |
| 3 | Contracts List | `/contracts` | Critical |
| 4 | Create Contract | `/contracts/new` | Critical |
| 5 | View Contract | `/contracts/:id` | Critical |
| 6 | Edit Contract | `/contracts/:id/edit` | High |
| 7 | Clients List | `/clients` | High |
| 8 | Create Client | `/clients/new` | High |
| 9 | View/Edit Client | `/clients/:id` | High |
| 10 | Suppliers List | `/suppliers` | High |
| 11 | Create Supplier | `/suppliers/new` | High |
| 12 | View/Edit Supplier | `/suppliers/:id` | High |
| 13 | Signers | `/signers` | Medium |
| 14 | Supplements | `/supplements` | Medium |
| 15 | Documents | `/documents` | Medium |
| 16 | Notifications | `/notifications` | Medium |
| 17 | Settings/Profile | `/settings` | Medium |
| 18 | 404 Page | `/nonexistent` | Low |

### 3.2 Per-Page Checklist

For each page:

- [ ] Page loads without errors (visual inspection)
- [ ] Browser console has no JS errors
- [ ] All buttons/links are functional
- [ ] Forms validate (empty submission, invalid data, edge cases)
- [ ] Navigation works (in and out)
- [ ] Empty state displays correctly (no data)
- [ ] Loading state shows during async operations
- [ ] Error states display on failure
- [ ] Mobile viewport (375px) renders correctly
- [ ] Table pagination works (if applicable)
- [ ] Search/filter functionality works (if applicable)

### 3.3 Mobile Responsive Testing

Test at these breakpoints:
- **375px** — iPhone SE (primary mobile)
- **768px** — iPad (tablet)
- **1280px** — Desktop

---

## Phase 4: Backend API QA

### 4.1 Authentication Endpoints

| Test | Endpoint | Expected |
|------|----------|----------|
| Valid login | `POST /api/auth/login` | 200 + session cookie |
| Invalid password | `POST /api/auth/login` | 401 |
| Missing email | `POST /api/auth/login` | 400 |
| Missing password | `POST /api/auth/login` | 400 |
| Logout | `POST /api/auth/logout` | 200 + cookie cleared |
| Get current user | `GET /api/auth/me` | 200 + user JSON |
| Get current user (no session) | `GET /api/auth/me` | 401 |

### 4.2 Contract Endpoints

| Test | Endpoint | Expected |
|------|----------|----------|
| List contracts | `GET /api/contracts` | 200 + array |
| Create contract | `POST /api/contracts` | 201 + created object |
| Create (invalid) | `POST /api/contracts` | 400 |
| Get by ID | `GET /api/contracts/:id` | 200 + object |
| Get nonexistent | `GET /api/contracts/:id` | 404 |
| Update | `PUT /api/contracts/:id` | 200 + updated object |
| Delete | `DELETE /api/contracts/:id` | 200 (soft delete) |
| Verify soft delete | `GET /api/contracts/:id` | Still returns 200 or returns 404 |

### 4.3 Client/Supplier Endpoints

| Test | Endpoint | Expected |
|------|----------|----------|
| List clients | `GET /api/clients` | 200 + array |
| Create client | `POST /api/clients` | 201 |
| List suppliers | `GET /api/suppliers` | 200 + array |
| Create supplier | `POST /api/suppliers` | 201 |

### 4.4 Authorization Tests

For each role (manager, editor, viewer):
- Test which endpoints return 200 vs 403
- Verify viewer cannot create/update/delete
- Verify editor cannot manage users
- Verify manager has appropriate permissions

---

## Phase 5: Security Testing

### 5.1 Cookie Security

```bash
# Login and inspect cookie attributes
curl -v -X POST https://pacta.duckdns.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pacta.local","password":"admin123"}'
```

Verify:
- [ ] `httpOnly` flag present
- [ ] `SameSite=Strict` present
- [ ] `Secure` flag present (HTTPS)
- [ ] `Path=/` set correctly

### 5.2 Session Management

- [ ] Session invalid after logout
- [ ] Session invalid after browser close (if configured)
- [ ] Cannot access API endpoints without valid cookie
- [ ] Cannot access frontend pages without valid session (if protected)

### 5.3 Input Validation

Test these on all forms:
- [ ] SQL injection attempts: `' OR 1=1 --`
- [ ] XSS attempts: `<script>alert('xss')</script>`
- [ ] HTML injection: `<b>bold</b>`
- [ ] Very long strings (buffer overflow check)
- [ ] Unicode/emoji in text fields
- [ ] Special characters in all inputs

### 5.4 CSRF Protection

- [ ] Verify SameSite=Strict cookie prevents cross-site requests
- [ ] Test form submission from external domain (should fail)

---

## Phase 6: Accessibility Testing (WCAG 2.2 AA)

### 6.1 Keyboard Navigation

- [ ] Tab through all interactive elements
- [ ] Enter/Space activates buttons
- [ ] Arrow keys work in dropdowns
- [ ] Escape closes modals/dropdowns
- [ ] Focus trap in modal dialogs
- [ ] Skip navigation link works

### 6.2 Screen Reader

- [ ] Page title announced on navigation
- [ ] Form labels associated with inputs
- [ ] Error messages announced
- [ ] Icon buttons have aria-label
- [ ] Table headers announced
- [ ] Loading states announced

### 6.3 Visual Accessibility

- [ ] Color contrast ratio >= 4.5:1 (normal text)
- [ ] Color contrast ratio >= 3:1 (large text)
- [ ] Focus indicators visible (3:1 contrast)
- [ ] Not relying on color alone for information
- [ ] Text resizable to 200% without loss of content

### 6.4 ARIA

- [ ] ARIA landmarks present (banner, main, navigation)
- [ ] ARIA roles correct on custom components
- [ ] aria-hidden on decorative elements
- [ ] aria-live regions for dynamic content
- [ ] No ARIA conflicts with native semantics

---

## Phase 7: Health Score & Reporting

### 7.1 Health Score Calculation

Using weighted rubric:

| Category | Weight | Score (0-100) | Notes |
|----------|--------|---------------|-------|
| Console | 15% | | JS errors across all pages |
| Links | 10% | | Broken internal links |
| Visual | 10% | | Layout/rendering issues |
| Functional | 20% | | Broken features/flows |
| UX | 15% | | Usability issues |
| Performance | 10% | | Load times, responsiveness |
| Content | 5% | | Typos, missing text |
| Accessibility | 15% | | WCAG violations |

**Final Score = Σ(category × weight)**

### 7.2 Issue Classification

| Severity | Definition | Examples |
|----------|-----------|----------|
| Critical | Blocks core functionality | Login fails, data loss |
| High | Major feature broken | Contract CRUD fails |
| Medium | Partial functionality | Filter doesn't work |
| Low | Cosmetic/minor | Typo, alignment |

### 7.3 Report Structure

```
docs/plans/qa-report-pacta-2026-04-09.md
├── Executive Summary
├── Health Score
├── Top 3 Things to Fix
├── Issues by Severity
│   ├── Critical (if any)
│   ├── High
│   ├── Medium
│   └── Low
├── Console Health Summary
├── Accessibility Findings
├── Security Findings
├── Test Coverage Matrix
└── Screenshots Directory
```

---

## Execution Order

1. **Deploy** (Phase 1) — Get binary running with Caddy
2. **Setup** (Phase 2) — Create test users and data
3. **Frontend QA** (Phase 3) — Test all pages systematically
4. **Backend QA** (Phase 4) — Test API endpoints
5. **Security QA** (Phase 5) — Test security controls
6. **Accessibility QA** (Phase 6) — Test WCAG compliance
7. **Report** (Phase 7) — Compile findings, calculate health score

---

## Success Criteria

- [ ] Pacta accessible at https://pacta.duckdns.org
- [ ] All 18 pages load without errors
- [ ] All CRUD operations work for contracts, clients, suppliers
- [ ] Role-based access control enforced correctly
- [ ] No critical or high severity issues
- [ ] Health score >= 80/100
- [ ] Cookie security attributes verified
- [ ] Keyboard navigation works end-to-end
- [ ] No console errors on any page
- [ ] Mobile responsive at 375px viewport

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Release binary doesn't start | High | Fall back to building from source |
| Caddy TLS cert fails | High | Check DNS propagation, retry |
| Default credentials don't work | Medium | Check migration ran correctly |
| Frontend has broken routes | Medium | Document as issues, fix in source |
| SQLite file permissions | Low | Ensure proper ownership on /opt/pacta |

---

## Notes

- The binary binds to `127.0.0.1:3000` by default — Caddy handles public exposure
- All data stays local — SQLite file location determined by config
- Default credentials should be changed after first login
- QA will be performed from mobile browser for realistic testing
- Screenshot evidence required for every issue found
