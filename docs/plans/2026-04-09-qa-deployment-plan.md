# Pacta QA Deployment & Testing Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the latest Pacta release binary to this VPS, expose via Caddy at pacta.duckdns.org, and run comprehensive QA across all frontend pages, backend API, security controls, and accessibility.

**Architecture:** Download pre-built release binary from GitHub Releases, install to /opt/pacta, run as systemd service, expose via Caddy reverse proxy with TLS, then systematically test every reachable page and API endpoint.

**Tech Stack:** Go binary (modernc.org/sqlite, chi router), React 19 frontend (embedded), Caddy (reverse proxy + TLS), systemd (service management)

---

## Phase 1: Deploy Release Binary

### Task 1: Fetch Latest Release URL

**Files:**
- Terminal commands only

**Step 1: Query GitHub API for latest release**

```bash
curl -s https://api.github.com/repos/PACTA-Team/pacta/releases/latest | grep browser_download_url | grep linux | grep amd64 | grep tar.gz
```

Expected: URL like `https://github.com/PACTA-Team/pacta/releases/download/v0.x.x/pacta_0.x.x_linux_amd64.tar.gz`

**Step 2: Save download URL**

```bash
RELEASE_URL=$(curl -s https://api.github.com/repos/PACTA-Team/pacta/releases/latest | grep browser_download_url | grep linux | grep amd64 | grep tar.gz | head -1 | cut -d'"' -f4)
echo "Download URL: $RELEASE_URL"
```

Expected: Print the download URL

**Step 3: Commit note**

```bash
git add -A && git commit -m "chore: note latest release version for QA"
```

---

### Task 2: Download and Extract Binary

**Files:**
- Download to: `/tmp/pacta-latest.tar.gz`
- Extract to: `/tmp/pacta-extract/`

**Step 1: Create temp directory and download**

```bash
mkdir -p /tmp/pacta-extract && cd /tmp/pacta-extract
curl -L -o pacta-latest.tar.gz "$RELEASE_URL"
```

Expected: Download completes, file size > 10MB

**Step 2: Extract and verify**

```bash
tar xzf pacta-latest.tar.gz
ls -lh pacta
file pacta
```

Expected: Shows ELF 64-bit executable, size matches release notes

**Step 3: Test binary runs**

```bash
./pacta --version 2>&1 || ./pacta --help 2>&1 || echo "No version flag, will test startup"
```

Expected: Shows version or help text, or starts server

---

### Task 3: Install to /opt/pacta

**Files:**
- Install to: `/opt/pacta/pacta`
- Data directory: `/opt/pacta/data/` (SQLite will create here)

**Step 1: Create installation directory**

```bash
sudo mkdir -p /opt/pacta/data
sudo cp /tmp/pacta-extract/pacta /opt/pacta/pacta
sudo chmod +x /opt/pacta/pacta
sudo chown -R root:root /opt/pacta
```

Expected: Files copied with correct permissions

**Step 2: Verify installation**

```bash
ls -la /opt/pacta/
/opt/pacta/pacta --version 2>&1 || echo "Binary present, version check not available"
```

Expected: Shows binary and data directory

---

### Task 4: Create Systemd Service

**Files:**
- Create: `/etc/systemd/system/pacta.service`

**Step 1: Write service file**

```bash
sudo tee /etc/systemd/system/pacta.service > /dev/null << 'EOF'
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
EOF
```

Expected: Service file created

**Step 2: Reload systemd and enable service**

```bash
sudo systemctl daemon-reload
sudo systemctl enable pacta
```

Expected: Service enabled

**Step 3: Start service**

```bash
sudo systemctl start pacta
sleep 3
sudo systemctl status pacta --no-pager
```

Expected: Active (running)

**Step 4: Verify local access**

```bash
curl -I http://127.0.0.1:3000 2>&1 | head -5
```

Expected: HTTP 200 or 302 (redirect to login)

**Step 5: Commit service config note**

```bash
cd /home/mowgli/pacta
git add -A && git commit -m "chore: note systemd service created for QA deployment"
```

---

### Task 5: Configure Caddy Reverse Proxy

**Files:**
- Modify: `/etc/caddy/Caddyfile` (append pacta.duckdns.org block)

**Step 1: Read current Caddyfile**

```bash
cat /etc/caddy/Caddyfile
```

Note the structure and where to add the new block.

**Step 2: Append pacta.duckdns.org block**

```bash
sudo tee -a /etc/caddy/Caddyfile > /dev/null << 'EOF'

# PACTA - Contract Management System
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
EOF
```

Expected: Block appended

**Step 3: Validate Caddy config**

```bash
sudo caddy validate --config /etc/caddy/Caddyfile 2>&1
```

Expected: Valid configuration

**Step 4: Reload Caddy**

```bash
sudo systemctl reload caddy
sleep 2
sudo systemctl status caddy --no-pager | head -10
```

Expected: Active (running), no errors

**Step 5: Test public access**

```bash
curl -I https://pacta.duckdns.org 2>&1 | head -10
```

Expected: HTTP 200 or 302, valid TLS certificate

**Step 6: Commit Caddy config note**

```bash
cd /home/mowgli/pacta
git add -A && git commit -m "chore: note Caddy reverse proxy configured for pacta.duckdns.org"
```

---

## Phase 2: Test Data Setup

### Task 6: Verify Default Admin Login

**Files:**
- Test via: Browser QA on `https://pacta.duckdns.org`

**Step 1: Navigate to login page**

Open browser to `https://pacta.duckdns.org`

Expected: Login page loads with email/password fields

**Step 2: Login with default admin**

| Field | Value |
|-------|-------|
| Email | admin@pacta.local |
| Password | admin123 |

Expected: Successful login, redirected to dashboard

**Step 3: Verify session cookie**

```bash
curl -v -X POST https://pacta.duckdns.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pacta.local","password":"admin123"}' 2>&1 | grep -i "set-cookie"
```

Expected: Set-Cookie header with httpOnly, SameSite=Strict

**Step 4: Check current user endpoint**

```bash
curl -s https://pacta.duckdns.org/api/auth/me \
  -H "Cookie: <session-cookie-from-login>"
```

Expected: JSON with admin user info

---

### Task 7: Create Test Users

**Files:**
- Test via: Browser UI or API calls

**Step 1: Check if user management UI exists**

Navigate through settings/admin pages to find user creation interface.

If no UI exists, use API directly:

```bash
# Check available user-related endpoints
# This depends on what the API supports
curl -s https://pacta.duckdns.org/api/auth/me \
  -b "session=<cookie>" | jq .
```

**Step 2: Create test users via API or UI**

Create these users (adjust method based on available API/UI):

| Email | Password | Role |
|-------|----------|------|
| manager@pacta.local | manager123 | Manager |
| editor@pacta.local | editor123 | Editor |
| viewer@pacta.local | viewer123 | Viewer |

**Step 3: Verify each user can login**

Test login for each created user. Expected: Each login succeeds, returns correct role.

---

### Task 8: Create Test Data

**Files:**
- Test via: Browser UI on `https://pacta.duckdns.org`

**Step 1: Create 3 Clients**

Via the Clients page, create:
1. Test Corp - test@testcorp.com
2. Sample Inc - info@sampleinc.com
3. Demo LLC - contact@demollc.com

**Step 2: Create 3 Suppliers**

Via the Suppliers page, create:
1. Supply Co - sales@supplyco.com
2. Vendor Ltd - info@vendorltd.com
3. Provider SA - contact@providersa.com

**Step 3: Create 5 Contracts**

Via the Contracts page, create contracts with varied states:
1. "Active Service Agreement" - Status: Active, with Test Corp
2. "Pending Software License" - Status: Draft, with Sample Inc
3. "Expired Consulting Agreement" - Status: Expired, with Demo LLC
4. "Renewal Pending Support Contract" - Status: Active, renewal date approaching
5. "New Vendor Agreement" - Status: Draft, with Supply Co

**Step 4: Add Signers**

Add at least 1 signer per client/supplier.

**Step 5: Verify data persistence**

Refresh the page, verify all created data is still present.

---

## Phase 3: Frontend QA

### Task 9: Login Page QA

**Files:**
- Test: `https://pacta.duckdns.org/` (or `/login`)
- Evidence: `.gstack/qa-reports/screenshots/login-*.png`

**Step 1: Screenshot login page**

```bash
mkdir -p .gstack/qa-reports/screenshots
```

Take screenshot of login page at desktop and mobile viewports.

**Step 2: Test valid login**

Login with admin credentials. Expected: Redirects to dashboard.

**Step 3: Test invalid credentials**

Login with wrong password. Expected: Error message displayed, no redirect.

**Step 4: Test form validation**

Submit empty form. Expected: Validation errors shown.

**Step 5: Test console for errors**

Check browser console on login page. Expected: No errors.

**Step 6: Test mobile viewport**

Resize to 375px width. Expected: Form renders correctly, no overflow.

---

### Task 10: Dashboard Page QA

**Files:**
- Test: `https://pacta.duckdns.org/dashboard`
- Evidence: `.gstack/qa-reports/screenshots/dashboard-*.png`

**Step 1: Navigate to dashboard**

After login, verify dashboard loads.

**Step 2: Verify stats display**

Check that contract counts, client counts, supplier counts are correct.

**Step 3: Check console for errors**

Expected: No JS errors.

**Step 4: Test responsive layout**

Resize to 375px, 768px, 1280px. Expected: Layout adapts correctly.

**Step 5: Test navigation links**

Click each navigation link. Expected: Navigates to correct page.

---

### Task 11: Contracts List Page QA

**Files:**
- Test: `https://pacta.duckdns.org/contracts`
- Evidence: `.gstack/qa-reports/screenshots/contracts-list-*.png`

**Step 1: Verify table renders**

Expected: Shows 5 test contracts created earlier.

**Step 2: Test search/filter**

Search for "Active". Expected: Filters to active contracts only.

**Step 3: Test column sorting**

Click column headers. Expected: Sorts ascending/descending.

**Step 4: Test row actions**

Click view/edit/delete on a contract. Expected: Each action works.

**Step 5: Check console**

Expected: No errors.

---

### Task 12: Create Contract Flow QA

**Files:**
- Test: `https://pacta.duckdns.org/contracts/new`
- Evidence: `.gstack/qa-reports/screenshots/contract-create-*.png`

**Step 1: Navigate to create page**

Click "New Contract" button. Expected: Form loads.

**Step 2: Test form validation**

Submit empty form. Expected: Required field errors shown.

**Step 3: Test valid creation**

Fill all required fields, submit. Expected: Contract created, redirected to view page.

**Step 4: Test client/supplier dropdown**

Open dropdowns. Expected: Shows test data created earlier.

**Step 5: Check console**

Expected: No errors.

---

### Task 13: View/Edit Contract QA

**Files:**
- Test: `https://pacta.duckdns.org/contracts/:id`
- Evidence: `.gstack/qa-reports/screenshots/contract-view-*.png`

**Step 1: View contract details**

Open a contract. Expected: All fields display correctly.

**Step 2: Test edit flow**

Click edit, modify a field, save. Expected: Changes persist.

**Step 3: Test status workflow**

If status transitions exist (draft → active), test the transition.

**Step 4: Test delete (soft)**

Delete a contract. Expected: Removed from list but not hard deleted.

**Step 5: Check console**

Expected: No errors.

---

### Task 14: Clients & Suppliers QA

**Files:**
- Test: `https://pacta.duckdns.org/clients`, `https://pacta.duckdns.org/suppliers`
- Evidence: `.gstack/qa-reports/screenshots/clients-*.png`, `.gstack/qa-reports/screenshots/suppliers-*.png`

**Step 1: Test Clients List**

Verify 3 clients display. Test search, create, edit, delete.

**Step 2: Test Suppliers List**

Verify 3 suppliers display. Test search, create, edit, delete.

**Step 3: Test form validation**

Submit invalid data on create/edit forms.

**Step 4: Check console on both pages**

Expected: No errors.

---

### Task 15: Remaining Pages QA

**Files:**
- Test: All remaining reachable pages
- Evidence: `.gstack/qa-reports/screenshots/*.png`

**Step 1: Test Signers page** (if exists)

Verify list, create, link to parties.

**Step 2: Test Supplements page** (if exists)

Verify approval workflow.

**Step 3: Test Documents page** (if exists)

Verify upload/linking.

**Step 4: Test Notifications page** (if exists)

Verify alerts display.

**Step 5: Test Settings/Profile page**

Verify user info display, password change.

**Step 6: Test 404 page**

Navigate to `/nonexistent`. Expected: 404 page displays.

**Step 7: Mobile responsive check on all pages**

Test each page at 375px viewport.

---

## Phase 4: Backend API QA

### Task 16: Authentication API QA

**Files:**
- Test via: curl commands
- Evidence: `.gstack/qa-reports/api-auth-results.txt`

**Step 1: Test valid login**

```bash
curl -s -X POST https://pacta.duckdns.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pacta.local","password":"admin123"}' \
  -c /tmp/pacta-cookies.txt -v 2>&1 | tee .gstack/qa-reports/api-auth-results.txt
```

Expected: 200 OK, session cookie set

**Step 2: Test invalid login**

```bash
curl -s -X POST https://pacta.duckdns.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pacta.local","password":"wrong"}' \
  -w "\nHTTP_CODE:%{http_code}\n"
```

Expected: 401 Unauthorized

**Step 3: Test get current user**

```bash
curl -s https://pacta.duckdns.org/api/auth/me \
  -b /tmp/pacta-cookies.txt
```

Expected: User JSON with admin info

**Step 4: Test logout**

```bash
curl -s -X POST https://pacta.duckdns.org/api/auth/logout \
  -b /tmp/pacta-cookies.txt \
  -w "\nHTTP_CODE:%{http_code}\n"
```

Expected: 200 OK

**Step 5: Test me endpoint after logout**

```bash
curl -s https://pacta.duckdns.org/api/auth/me \
  -b /tmp/pacta-cookies.txt \
  -w "\nHTTP_CODE:%{http_code}\n"
```

Expected: 401 Unauthorized

---

### Task 17: Contracts API QA

**Files:**
- Test via: curl commands
- Evidence: `.gstack/qa-reports/api-contracts-results.txt`

**Step 1: Login and save cookie**

```bash
curl -s -X POST https://pacta.duckdns.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pacta.local","password":"admin123"}' \
  -c /tmp/pacta-cookies.txt
```

**Step 2: List contracts**

```bash
curl -s https://pacta.duckdns.org/api/contracts \
  -b /tmp/pacta-cookies.txt | jq '. | length'
```

Expected: Number >= 5

**Step 3: Get single contract**

```bash
CONTRACT_ID=$(curl -s https://pacta.duckdns.org/api/contracts \
  -b /tmp/pacta-cookies.txt | jq '.[0].id' -r)
curl -s https://pacta.duckdns.org/api/contracts/$CONTRACT_ID \
  -b /tmp/pacta-cookies.txt | jq .
```

Expected: Contract object

**Step 4: Create contract**

```bash
curl -s -X POST https://pacta.duckdns.org/api/contracts \
  -b /tmp/pacta-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"title":"API Test Contract","status":"draft"}' \
  -w "\nHTTP_CODE:%{http_code}\n"
```

Expected: 201 Created

**Step 5: Update contract**

```bash
curl -s -X PUT https://pacta.duckdns.org/api/contracts/$CONTRACT_ID \
  -b /tmp/pacta-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title"}' \
  -w "\nHTTP_CODE:%{http_code}\n"
```

Expected: 200 OK

**Step 6: Delete contract (soft)**

```bash
curl -s -X DELETE https://pacta.duckdns.org/api/contracts/$CONTRACT_ID \
  -b /tmp/pacta-cookies.txt \
  -w "\nHTTP_CODE:%{http_code}\n"
```

Expected: 200 OK

---

### Task 18: Clients & Suppliers API QA

**Files:**
- Test via: curl commands
- Evidence: `.gstack/qa-reports/api-parties-results.txt`

**Step 1: List clients**

```bash
curl -s https://pacta.duckdns.org/api/clients \
  -b /tmp/pacta-cookies.txt | jq '. | length'
```

Expected: Number >= 3

**Step 2: Create client**

```bash
curl -s -X POST https://pacta.duckdns.org/api/clients \
  -b /tmp/pacta-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"name":"API Test Client","email":"api@test.com"}' \
  -w "\nHTTP_CODE:%{http_code}\n"
```

Expected: 201 Created

**Step 3: List suppliers**

```bash
curl -s https://pacta.duckdns.org/api/suppliers \
  -b /tmp/pacta-cookies.txt | jq '. | length'
```

Expected: Number >= 3

**Step 4: Create supplier**

```bash
curl -s -X POST https://pacta.duckdns.org/api/suppliers \
  -b /tmp/pacta-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"name":"API Test Supplier","email":"supplier@test.com"}' \
  -w "\nHTTP_CODE:%{http_code}\n"
```

Expected: 201 Created

---

## Phase 5: Security QA

### Task 19: Cookie Security Verification

**Files:**
- Evidence: `.gstack/qa-reports/security-cookies.txt`

**Step 1: Login and capture cookie attributes**

```bash
curl -v -X POST https://pacta.duckdns.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pacta.local","password":"admin123"}' 2>&1 \
  | grep -i "set-cookie" | tee .gstack/qa-reports/security-cookies.txt
```

**Step 2: Verify cookie flags**

Check for:
- [ ] `HttpOnly` present
- [ ] `SameSite=Strict` present
- [ ] `Secure` present (HTTPS)
- [ ] `Path=/` set

**Step 3: Document findings**

Write results to `.gstack/qa-reports/security-cookies.txt`

---

### Task 20: Input Validation Testing

**Files:**
- Evidence: `.gstack/qa-reports/security-input-validation.txt`

**Step 1: Test SQL injection on login**

```bash
curl -s -X POST https://pacta.duckdns.org/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"' OR 1=1 --\",\"password\":\"anything\"}" \
  -w "\nHTTP_CODE:%{http_code}\n"
```

Expected: 401 (not 200)

**Step 2: Test XSS on contract creation**

```bash
curl -s -X POST https://pacta.duckdns.org/api/contracts \
  -b /tmp/pacta-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"title":"<script>alert(1)</script>","status":"draft"}' \
  -w "\nHTTP_CODE:%{http_code}\n"
```

Expected: 201 (stored safely, not executed)

**Step 3: Verify stored XSS doesn't execute**

Navigate to contracts list in browser, check console. Expected: No alert popup.

**Step 4: Document findings**

Write results to `.gstack/qa-reports/security-input-validation.txt`

---

## Phase 6: Accessibility QA

### Task 21: Keyboard Navigation Test

**Files:**
- Evidence: `.gstack/qa-reports/accessibility-keyboard.txt`

**Step 1: Test tab navigation**

From login page, press Tab through all elements. Expected: All interactive elements receive focus in logical order.

**Step 2: Test skip navigation**

Press Tab once on page load. Expected: "Skip to main content" link appears.

**Step 3: Test keyboard form submission**

Navigate to login form via keyboard, fill via keyboard, submit via Enter. Expected: Works same as mouse.

**Step 4: Test modal/ dialog keyboard**

Open any modal dialog. Expected: Focus trapped inside, Escape closes.

**Step 5: Document findings**

Write results to `.gstack/qa-reports/accessibility-keyboard.txt`

---

### Task 22: Screen Reader & ARIA Test

**Files:**
- Evidence: `.gstack/qa-reports/accessibility-aria.txt`

**Step 1: Check ARIA landmarks**

Inspect HTML for `role="banner"`, `role="main"`, `role="navigation"`. Expected: All present.

**Step 2: Check icon button labels**

Find all icon-only buttons. Expected: Each has `aria-label`.

**Step 3: Check form label associations**

Inspect each form input. Expected: Each has associated `<label>` or `aria-label`.

**Step 4: Check active navigation indicator**

Expected: Current page link has `aria-current="page"`.

**Step 5: Document findings**

Write results to `.gstack/qa-reports/accessibility-aria.txt`

---

### Task 23: Color Contrast Test

**Files:**
- Evidence: `.gstack/qa-reports/accessibility-contrast.txt`

**Step 1: Check muted text contrast**

Use browser DevTools to check contrast of `.text-muted-foreground` or equivalent. Expected: >= 4.5:1 ratio.

**Step 2: Check link/button contrast**

Check contrast of all interactive elements. Expected: >= 4.5:1.

**Step 3: Check focus indicator contrast**

Tab to element, check focus ring contrast. Expected: >= 3:1 against background.

**Step 4: Document findings**

Write results to `.gstack/qa-reports/accessibility-contrast.txt`

---

## Phase 7: Compile Report

### Task 24: Calculate Health Score

**Files:**
- Create: `.gstack/qa-reports/qa-report-pacta-duckdns-2026-04-09.md`

**Step 1: Aggregate all findings**

Collect results from all previous phases.

**Step 2: Count issues by severity**

| Severity | Count |
|----------|-------|
| Critical | |
| High | |
| Medium | |
| Low | |

**Step 3: Calculate category scores**

| Category | Score (0-100) | Deductions |
|----------|---------------|------------|
| Console (15%) | | |
| Links (10%) | | |
| Visual (10%) | | |
| Functional (20%) | | |
| UX (15%) | | |
| Performance (10%) | | |
| Content (5%) | | |
| Accessibility (15%) | | |

**Step 4: Calculate weighted final score**

```
Final = (Console × 0.15) + (Links × 0.10) + (Visual × 0.10) + 
        (Functional × 0.20) + (UX × 0.15) + (Performance × 0.10) + 
        (Content × 0.05) + (Accessibility × 0.15)
```

**Step 5: Write full report**

Create `.gstack/qa-reports/qa-report-pacta-duckdns-2026-04-09.md` with:
- Executive summary
- Health score
- Top 3 things to fix
- All issues documented with screenshots
- Test coverage matrix
- Security findings
- Accessibility findings

---

### Task 25: Commit All QA Artifacts

**Files:**
- All files in `.gstack/qa-reports/`

**Step 1: Stage all QA artifacts**

```bash
cd /home/mowgli/pacta
git add .gstack/qa-reports/
```

**Step 2: Commit QA report**

```bash
git commit -m "test: QA deployment report for pacta.duckdns.org

- Deployed release binary to /opt/pacta
- Configured Caddy reverse proxy
- Tested all frontend pages
- Tested all API endpoints
- Verified security controls
- Verified accessibility
- Health score: X/100"
```

---

## Success Criteria

- [ ] Pacta accessible at https://pacta.duckdns.org
- [ ] All pages load without errors
- [ ] All CRUD operations work
- [ ] Role-based access control enforced
- [ ] No critical or high severity issues
- [ ] Health score >= 80/100
- [ ] Cookie security verified
- [ ] Keyboard navigation works
- [ ] No console errors
- [ ] Mobile responsive at 375px
