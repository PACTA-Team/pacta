# User Setup Flow Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Refactor the registration system to remove company selection from registration, add confirm password field, and create a comprehensive setup wizard for new users after their first login.

**Architecture:** 
- Backend: Modify registration endpoint to remove company/role selection, always set user to pending_approval status
- Frontend: Simplify LoginForm by removing company selector and registration mode; add confirmPassword field; Create new SetupWizard for new users
- Auth Flow: After login, check if user needs setup and redirect to wizard

**Tech Stack:** React (Vite), TypeScript, Go chi router, SQLite

---

## Task 1: Modify Backend Registration Endpoint

**Files:**
- Modify: `internal/handlers/auth.go:32-210`

**Step 1: Read current register handler implementation**

Run: Read `internal/handlers/auth.go` lines 32-210

**Step 2: Modify RegisterRequest struct**

```go
type RegisterRequest struct {
    Name           string `json:"name"`
    Email          string `json:"email"`
    Password       string `json:"password"`
    ConfirmPassword string `json:"confirm_password"`
    Language       string `json:"language"`
}
```

**Step 3: Add password confirmation validation**

In HandleRegister, after password length validation, add:
```go
if req.Password != req.ConfirmPassword {
    h.Error(w, http.StatusBadRequest, "passwords do not match")
    return
}
```

**Step 4: Remove company selection logic**

Remove:
- Mode parameter handling (lines 80-84)
- CompanyID/CompanyName from request
- pending_email status (always pending_approval for new users)

**Step 5: Always set pending_approval status**

```go
status := "pending_approval"
```

**Step 6: Remove auto-login for first user**

Instead of auto-creating session, return pending_approval response:
```go
h.JSON(w, http.StatusCreated, map[string]interface{}{
    "id":      userID,
    "name":    req.Name,
    "email":   req.Email,
    "status":  "pending_approval",
    "message": "Your account is pending admin approval. You will be notified once approved.",
})
```

**Step 7: Commit**

Run: git add internal/handlers/auth.go && git commit -m "refactor: simplify registration - remove company selection, add password confirmation"

---

## Task 2: Update Login Handler for New Setup Flow

**Files:**
- Modify: `internal/handlers/auth.go:212-269`

**Step 1: Modify HandleLogin to check setup_completed**

After authentication, add check:
```go
// Check if user needs setup
var setupCompleted bool
err = h.DB.QueryRow("SELECT setup_completed FROM users WHERE id = ?", user.ID).Scan(&setupCompleted)
if err != nil {
    log.Printf("[login] ERROR checking setup status: %v", err)
}

if user.Status == "pending_approval" || !setupCompleted {
    // Create session but return setup_needed flag
    session, err := auth.CreateSession(h.DB, user.ID, 0) // 0 = no company yet
    // ... rest of session creation
    
    h.JSON(w, http.StatusOK, map[string]interface{}{
        "user": sanitizeUser(user),
        "needs_setup": true,
        "setup_status": "pending_approval",
    })
    return
}
```

**Step 2: Commit**

Run: git add internal/handlers/auth.go && git commit -m "feat: login checks setup_completed status"

---

## Task 3: Add New Database Fields

**Files:**
- Create: `internal/db/migrations/XXX_add_setup_fields.sql`

**Step 1: Create migration file**

```sql
-- Add setup_completed and role_at_company fields
ALTER TABLE users ADD COLUMN setup_completed BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN role_at_company VARCHAR(50) DEFAULT NULL;
ALTER TABLE users ADD COLUMN company_id_temp INTEGER DEFAULT NULL;

-- Create pending_activations table for setup completion
CREATE TABLE IF NOT EXISTS pending_activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    company_id INTEGER,
    company_name TEXT,
    company_address TEXT,
    company_tax_id TEXT,
    company_phone TEXT,
    company_email TEXT,
    role_at_company VARCHAR(50),
    first_supplier_id INTEGER,
    first_client_id INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**Step 2: Update model**

Modify `internal/models/user.go` to add new fields

**Step 3: Commit**

Run: git add internal/db/migrations/ internal/models/user.go && git commit -m "feat: add setup_completed and pending_activations table"

---

## Task 4: Create New API Endpoint for Setup

**Files:**
- Create: `internal/handlers/setup.go`
- Modify: `internal/server/router.go`

**Step 1: Create setup handler**

```go
type SetupRequest struct {
    CompanyID         *int    `json:"company_id,omitempty"`
    CompanyName       string  `json:"company_name"`
    CompanyAddress    string  `json:"company_address"`
    CompanyTaxID      string  `json:"company_tax_id"`
    CompanyPhone      string  `json:"company_phone"`
    CompanyEmail      string  `json:"company_email"`
    RoleAtCompany     string  `json:"role_at_company"`
    FirstSupplierID   *int    `json:"first_supplier_id,omitempty"`
    FirstClientID     *int    `json:"first_client_id,omitempty"`
    AuthorizedSigners []AuthorizedSigner `json:"authorized_signers"`
}

func (h *Handler) HandleSetup(w http.ResponseWriter, r *http.Request) {
    userID := h.getUserID(r)
    
    var req SetupRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.Error(w, http.StatusBadRequest, "invalid request")
        return
    }
    
    // Validate role
    validRoles := []string{"manager_empresa", "editor", "viewer"}
    if !contains(validRoles, req.RoleAtCompany) {
        h.Error(w, http.StatusBadRequest, "invalid role")
        return
    }
    
    // Create or get company
    companyID := req.CompanyID
    if companyID == nil || *companyID == 0 {
        // Create new company
        result, err := h.DB.Exec(
            "INSERT INTO companies (name, address, tax_id, phone, email) VALUES (?, ?, ?, ?, ?)",
            req.CompanyName, req.CompanyAddress, req.CompanyTaxID, req.CompanyPhone, req.CompanyEmail,
        )
        // ... handle result
    }
    
    // Update user with company and role
    h.DB.Exec("UPDATE users SET company_id_temp = ?, role_at_company = ?, setup_completed = 1 WHERE id = ?",
        companyID, req.RoleAtCompany, userID)
    
    // Insert authorized signers
    for _, signer := range req.AuthorizedSigners {
        h.DB.Exec("INSERT INTO authorized_signers (company_id, name, position, email) VALUES (?, ?, ?, ?)",
            companyID, signer.Name, signer.Position, signer.Email)
    }
    
    // Record in pending_activations
    h.DB.Exec(`INSERT INTO pending_activations (user_id, company_id, company_name, role_at_company, status) 
        VALUES (?, ?, ?, ?, 'pending_activation')`,
        userID, companyID, req.CompanyName, req.RoleAtCompany)
    
    // Update user status
    h.DB.Exec("UPDATE users SET status = 'pending_activation' WHERE id = ?", userID)
    
    // Notify admins
    // ... send notification
    
    h.JSON(w, http.StatusOK, map[string]interface{}{
        "success": true,
        "message": "Setup completed. Your account is pending activation by an administrator.",
    })
}
```

**Step 2: Add route in router.go**

```go
r.MethodFunc("PATCH", "/api/setup", h.RequireAuth(h.HandleSetup))
```

**Step 3: Commit**

Run: git add internal/handlers/setup.go internal/server/router.go && git commit -m "feat: add setup API endpoint"

---

## Task 5: Simplify LoginForm - Remove Company Selector

**Files:**
- Modify: `pacta_appweb/src/components/auth/LoginForm.tsx`

**Step 1: Remove company-related state and effects**

Remove lines 20-23 (companyName, companies, selectedCompanyId)
Remove lines 32-39 (useEffect fetching companies)

**Step 2: Add confirmPassword field**

Add after password field:
```tsx
<div className="space-y-2">
  <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
  <Input
    id="confirmPassword"
    type="password"
    placeholder={t('confirmPasswordPlaceholder')}
    value={confirmPassword}
    onChange={(e) => setConfirmPassword(e.target.value)}
    required
  />
</div>
```

**Step 3: Add validation for password match**

In handleRegister:
```tsx
if (password !== confirmPassword) {
  toast.error(t('passwordMismatch'));
  return;
}
```

**Step 4: Remove registration mode selector**

Remove lines 152-177 (registrationMode radio buttons)

**Step 5: Remove company selector from form**

Remove lines 178-215 (company select and companyName input)

**Step 6: Update registrationAPI call**

Change to:
```tsx
const data = await registrationAPI.register(name, email, password, currentLang) as { status: string };
```

**Step 7: Update state reset on back to login**

```tsx
setShowRegister(false);
setConfirmPassword('');
```

**Step 8: Commit**

Run: git add pacta_appweb/src/components/auth/LoginForm.tsx && git commit -m "refactor: simplify registration form - remove company selector, add confirm password"

---

## Task 6: Update AuthContext for Setup Flow

**Files:**
- Modify: `pacta_appweb/src/contexts/AuthContext.tsx`

**Step 1: Add setup state to context**

```tsx
interface AuthState {
  // ... existing
  needsSetup: boolean;
  setupStatus: string;
}
```

**Step 2: Update login response handling**

In login function, handle needs_setup flag:
```tsx
if (response.needs_setup) {
  setNeedsSetup(true);
  setSetupStatus(response.setup_status);
  navigate('/setup');
}
```

**Step 3: Add setup update function**

```tsx
const updateSetup = async (setupData: SetupData) => {
  const response = await fetch('/api/setup', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(setupData),
  });
  // handle response
};
```

**Step 4: Commit**

Run: git add pacta_appweb/src/contexts/AuthContext.tsx && git commit -m "feat: add setup flow to AuthContext"

---

## Task 7: Create New Setup Wizard Components

**Files:**
- Create: `pacta_appweb/src/components/setup/StepSelectCompany.tsx`
- Create: `pacta_appweb/src/components/setup/StepRoleSelection.tsx`
- Create: `pacta_appweb/src/components/setup/StepAuthorizedSigners.tsx`
- Modify: `pacta_appweb/src/components/setup/SetupWizard.tsx`

**Step 1: Create StepSelectCompany.tsx**

```tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { companiesAPI } from '@/lib/companies-api';

export default function StepSelectCompany({ data, onUpdate, onNext }) {
  const [companies, setCompanies] = useState([]);
  const [mode, setMode] = useState<'existing' | 'new'>(data.mode || 'existing');
  
  useEffect(() => {
    companiesAPI.getAll().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t('selectOrCreateCompany')}</h2>
      
      <div className="flex gap-4">
        <Button variant={mode === 'existing' ? 'default' : 'outline'} onClick={() => setMode('existing')}>
          {t('selectExisting')}
        </Button>
        <Button variant={mode === 'new' ? 'default' : 'outline'} onClick={() => setMode('new')}>
          {t('createNew')}
        </Button>
      </div>

      {mode === 'existing' ? (
        <Select value={data.companyId?.toString()} onValueChange={(v) => onUpdate({ companyId: parseInt(v) })}>
          <SelectTrigger><SelectValue placeholder={t('selectCompany')} /></SelectTrigger>
          <SelectContent>
            {companies.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <div className="space-y-4">
          <Input placeholder={t('companyName')} value={data.companyName} onChange={(e) => onUpdate({ companyName: e.target.value })} />
        </div>
      )}

      <Button onClick={onNext} disabled={!data.companyId && !data.companyName}>{t('next')}</Button>
    </div>
  );
}
```

**Step 2: Create StepRoleSelection.tsx**

```tsx
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const ROLES = [
  { value: 'manager_empresa', label: 'companyManager', description: 'managerCompanyDesc' },
  { value: 'editor', label: 'editor', description: 'editorDesc' },
  { value: 'viewer', label: 'viewer', description: 'viewerDesc' },
];

export default function StepRoleSelection({ data, onUpdate, onNext }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t('selectRole')}</h2>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <p className="text-sm text-yellow-700">{t('roleWarning')}</p>
      </div>

      <RadioGroup value={data.role} onValueChange={(v) => onUpdate({ role: v })}>
        {ROLES.map(role => (
          <div key={role.value} className="flex items-start space-x-3">
            <RadioGroupItem value={role.value} id={role.value} />
            <Label htmlFor={role.value} className="cursor-pointer">
              <div className="font-medium">{t(role.label)}</div>
              <div className="text-sm text-muted-foreground">{t(role.description)}</div>
            </Label>
          </div>
        ))}
      </RadioGroup>

      <Button onClick={onNext} disabled={!data.role}>{t('next')}</Button>
    </div>
  );
}
```

**Step 3: Create StepAuthorizedSigners.tsx**

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function StepAuthorizedSigners({ data, onUpdate, onNext }) {
  const { t } = useTranslation();
  const signers = data.authorizedSigners || [];

  const addSigner = () => {
    onUpdate({ authorizedSigners: [...signers, { name: '', position: '', email: '' }] });
  };

  const updateSigner = (index: number, field: string, value: string) => {
    const updated = [...signers];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate({ authorizedSigners: updated });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t('authorizedSigners')}</h2>
      <p className="text-sm text-muted-foreground">{t('authorizedSignersDesc')}</p>

      {signers.map((signer, i) => (
        <Card key={i}>
          <CardContent className="pt-4 space-y-3">
            <Input placeholder={t('name')} value={signer.name} onChange={(e) => updateSigner(i, 'name', e.target.value)} />
            <Input placeholder={t('position')} value={signer.position} onChange={(e) => updateSigner(i, 'position', e.target.value)} />
            <Input placeholder={t('email')} type="email" value={signer.email} onChange={(e) => updateSigner(i, 'email', e.target.value)} />
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={addSigner}>{t('addSigner')}</Button>
      <div className="flex gap-2">
        <Button onClick={onNext}>{t('next')}</Button>
      </div>
    </div>
  );
}
```

**Step 4: Modify SetupWizard.tsx to add new steps**

Add new steps to the wizard with conditional rendering based on user status

**Step 5: Commit**

Run: git add pacta_appweb/src/components/setup/ && git commit -m "feat: create new setup wizard components for company, role, and signers"

---

## Task 8: Update Setup API and Add Tutorial Mode

**Files:**
- Modify: `pacta_appweb/src/lib/setup-api.ts`
- Modify: `pacta_appweb/src/components/setup/StepSupplier.tsx`
- Modify: `pacta_appweb/src/components/setup/StepClient.tsx`

**Step 1: Update setup-api.ts**

```ts
export const setupAPI = {
  submitSetup: async (data: SetupData) => {
    const response = await fetch('/api/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Setup failed');
    return response.json();
  },
};
```

**Step 2: Add tutorial mode to StepSupplier and StepClient**

Add a "tutorial" prop and conditional rendering for help tooltips/highlights

**Step 3: Commit**

Run: git add pacta_appweb/src/lib/setup-api.ts pacta_appweb/src/components/setup/ && git commit -m "feat: update setup API and add tutorial mode to supplier/client steps"

---

## Task 9: Add Route Protection and Profile Limitation

**Files:**
- Modify: `pacta_appweb/src/App.tsx`
- Modify: `pacta_appweb/src/components/auth/ProtectedRoute.tsx`

**Step 1: Update ProtectedRoute**

```tsx
export default function ProtectedRoute({ children }) {
  const { user, needsSetup, setupStatus } = useAuth();
  
  if (!user) return <Navigate to="/login" />;
  
  if (needsSetup || setupStatus === 'pending_approval' || setupStatus === 'pending_activation') {
    return <Navigate to="/setup" />;
  }
  
  return children;
}
```

**Step 2: Add profile route for pending users**

Create a simplified profile view that shows only basic info and pending status message

**Step 3: Commit**

Run: git add pacta_appweb/src/App.tsx pacta_appweb/src/components/auth/ProtectedRoute.tsx && git commit -m "feat: add route protection for users pending setup"

---

## Task 10: Test End-to-End Flow

**Step 1: Test registration flow**
- Fill registration form with name, email, password, confirmPassword
- Verify user is created with pending_approval status

**Step 2: Test login for new user**
- Login with new credentials
- Verify redirect to /setup

**Step 3: Test setup wizard**
- Complete all wizard steps
- Verify pending_activation status

**Step 4: Test admin approval**
- Verify admin can see pending users
- Test approval action

**Step 5: Commit**

Run: git commit -m "test: add e2e tests for new registration and setup flow"

---

## Execution Options

**Plan complete and saved to `docs/plans/2026-04-22-user-setup-flow-design.md`. Three execution options:**

1. **Subagent-Driven (Recommended)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session** - Open new session with executing-plans, batch execution with checkpoints

3. **Plan-to-Issues** - Convert plan tasks to GitHub issues for team distribution

**Which approach?**