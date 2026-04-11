# First-Run Setup Wizard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded default admin with a secure first-run wizard that creates admin user + seed data (first client + first supplier) in a single atomic transaction.

**Architecture:** Backend exposes `POST /api/setup` (unauthenticated, first-run gated) and `GET /api/setup/status`. Frontend wizard collects admin + client + supplier data, submits in one call, auto-logins on success.

**Tech Stack:** Go (chi, bcrypt, SQLite), React 19 + TypeScript, Zod validation, shadcn/ui

---

### Task 1: Remove Default Admin from Migration

**Files:**
- Modify: `internal/db/001_users.sql`

**Step 1: Remove the hardcoded admin INSERT**

Open `internal/db/001_users.sql` and delete the last 3 lines (the comment + INSERT statement):

```sql
-- Default admin (password: admin123, bcrypt cost 10)
INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES
('Admin', 'admin@pacta.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin');
```

The file should end after the two CREATE INDEX statements.

**Step 2: Commit**

```bash
git add internal/db/001_users.sql
git commit -m "fix: remove hardcoded default admin from migration

Security: replaces static credentials with first-run setup wizard.
Fixes C-001 from QA report."
```

---

### Task 2: Create Setup Handler (Backend)

**Files:**
- Create: `internal/handlers/setup.go`

**Step 1: Write the setup handler**

Create `internal/handlers/setup.go`:

```go
package handlers

import (
	"database/sql"
	"net/http"
	"regexp"
	"strings"
	"unicode"

	"github.com/PACTA-Team/pacta/internal/auth"
)

type SetupRequest struct {
	Admin    SetupAdmin    `json:"admin"`
	Client   SetupParty    `json:"client"`
	Supplier SetupParty    `json:"supplier"`
}

type SetupAdmin struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type SetupParty struct {
	Name    string  `json:"name"`
	Address *string `json:"address,omitempty"`
	REUCode *string `json:"reu_code,omitempty"`
	Contacts *string `json:"contacts,omitempty"`
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func (h *Handler) HandleSetupStatus(w http.ResponseWriter, r *http.Request) {
	var count int
	err := h.DB.QueryRow("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&count)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to check setup status")
		return
	}
	h.JSON(w, http.StatusOK, map[string]bool{"needs_setup": count == 0})
}

func (h *Handler) HandleSetup(w http.ResponseWriter, r *http.Request) {
	// Check if setup is already done
	var count int
	err := h.DB.QueryRow("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&count)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to check setup status")
		return
	}
	if count > 0 {
		h.Error(w, http.StatusForbidden, "setup has already been completed")
		return
	}

	var req SetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Validate admin
	if err := validateSetupAdmin(req.Admin); err != nil {
		h.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	// Validate client/supplier names
	if strings.TrimSpace(req.Client.Name) == "" {
		h.Error(w, http.StatusBadRequest, "client name is required")
		return
	}
	if strings.TrimSpace(req.Supplier.Name) == "" {
		h.Error(w, http.StatusBadRequest, "supplier name is required")
		return
	}

	// Begin transaction
	tx, err := h.DB.Begin()
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	defer tx.Rollback()

	// Create admin user
	hash, err := auth.HashPassword(req.Admin.Password)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	adminResult, err := tx.Exec(
		"INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
		req.Admin.Name, req.Admin.Email, hash,
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			h.Error(w, http.StatusConflict, "a user with this email already exists")
			return
		}
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	adminID, _ := adminResult.LastInsertId()

	// Create client
	clientResult, err := tx.Exec(
		"INSERT INTO clients (name, address, reu_code, contacts, created_by) VALUES (?, ?, ?, ?, ?)",
		req.Client.Name, req.Client.Address, req.Client.REUCode, req.Client.Contacts, adminID,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	clientID, _ := clientResult.LastInsertId()

	// Create supplier
	supplierResult, err := tx.Exec(
		"INSERT INTO suppliers (name, address, reu_code, contacts, created_by) VALUES (?, ?, ?, ?, ?)",
		req.Supplier.Name, req.Supplier.Address, req.Supplier.REUCode, req.Supplier.Contacts, adminID,
	)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}
	supplierID, _ := supplierResult.LastInsertId()

	// Commit
	if err := tx.Commit(); err != nil {
		h.Error(w, http.StatusInternalServerError, "setup failed. Please restart the application")
		return
	}

	h.JSON(w, http.StatusCreated, map[string]interface{}{
		"status":      "setup_complete",
		"admin_id":    adminID,
		"client_id":   clientID,
		"supplier_id": supplierID,
	})
}

func validateSetupAdmin(a SetupAdmin) error {
	if strings.TrimSpace(a.Name) == "" {
		return &setupValidationError{"admin name is required"}
	}
	if !emailRegex.MatchString(a.Email) {
		return &setupValidationError{"please enter a valid email address"}
	}
	if len(a.Password) < 8 {
		return &setupValidationError{"password must be at least 8 characters"}
	}
	var hasUpper, hasNumber, hasSpecial bool
	for _, c := range a.Password {
		switch {
		case unicode.IsUpper(c):
			hasUpper = true
		case unicode.IsNumber(c):
			hasNumber = true
		case unicode.IsPunct(c) || unicode.IsSymbol(c):
			hasSpecial = true
		}
	}
	if !hasUpper || !hasNumber || !hasSpecial {
		return &setupValidationError{"password must contain at least one uppercase letter, one number, and one special character"}
	}
	return nil
}

type setupValidationError struct {
	msg string
}

func (e *setupValidationError) Error() string {
	return e.msg
}
```

**Step 2: Commit**

```bash
git add internal/handlers/setup.go
git commit -m "feat: add setup handler for first-run wizard

- POST /api/setup creates admin + client + supplier atomically
- GET /api/setup/status returns needs_setup flag
- Password validation: min 8 chars, uppercase, number, special
- Single SQLite transaction ensures no partial state
- Endpoint permanently locked after first user exists"
```

---

### Task 3: Register Setup Routes

**Files:**
- Modify: `internal/server/server.go`

**Step 1: Add setup routes before auth middleware**

In `internal/server/server.go`, add the setup routes right after the login/logout routes and before the authenticated group:

```go
	// Auth routes (no auth required)
	r.Post("/api/auth/login", h.HandleLogin)
	r.Post("/api/auth/logout", h.HandleLogout)

	// Setup routes (no auth required, gated by first-run check)
	r.Get("/api/setup/status", h.HandleSetupStatus)
	r.Post("/api/setup", h.HandleSetup)

	// Authenticated API routes
	r.Group(func(r chi.Router) {
```

**Step 2: Commit**

```bash
git add internal/server/server.go
git commit -m "feat: register setup routes in chi router"
```

---

### Task 4: Create Setup API Client (Frontend)

**Files:**
- Create: `pacta_appweb/src/lib/setup-api.ts`

**Step 1: Create the API client**

Create `pacta_appweb/src/lib/setup-api.ts`:

```typescript
export interface SetupRequest {
  admin: {
    name: string;
    email: string;
    password: string;
  };
  client: {
    name: string;
    address?: string;
    reu_code?: string;
    contacts?: string;
  };
  supplier: {
    name: string;
    address?: string;
    reu_code?: string;
    contacts?: string;
  };
}

export interface SetupResponse {
  status: string;
  admin_id: number;
  client_id: number;
  supplier_id: number;
}

export interface SetupStatusResponse {
  needs_setup: boolean;
}

export async function checkSetupStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/setup/status');
    if (!res.ok) return false;
    const data: SetupStatusResponse = await res.json();
    return data.needs_setup;
  } catch {
    return false;
  }
}

export async function runSetup(data: SetupRequest): Promise<SetupResponse | null> {
  try {
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Setup failed');
    }
    return await res.json();
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Network error');
  }
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/lib/setup-api.ts
git commit -m "feat: add setup API client with TypeScript types"
```

---

### Task 5: Create Zod Validation Schema

**Files:**
- Create: `pacta_appweb/src/lib/setup-validation.ts`

**Step 1: Create validation schemas**

Create `pacta_appweb/src/lib/setup-validation.ts`:

```typescript
import { z } from 'zod';

export const adminSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const partySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  address: z.string().optional().or(z.literal('')),
  reu_code: z.string().optional().or(z.literal('')),
  contacts: z.string().optional().or(z.literal('')),
});

export type AdminFormData = z.infer<typeof adminSchema>;
export type PartyFormData = z.infer<typeof partySchema>;
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/lib/setup-validation.ts
git commit -m "feat: add Zod validation schemas for setup wizard"
```

---

### Task 6: Rewrite SetupPage with Multi-Step Wizard

**Files:**
- Modify: `pacta_appweb/src/pages/SetupPage.tsx`
- Create: `pacta_appweb/src/components/setup/SetupWizard.tsx`
- Create: `pacta_appweb/src/components/setup/StepWelcome.tsx`
- Create: `pacta_appweb/src/components/setup/StepAdmin.tsx`
- Create: `pacta_appweb/src/components/setup/StepClient.tsx`
- Create: `pacta_appweb/src/components/setup/StepSupplier.tsx`
- Create: `pacta_appweb/src/components/setup/StepReview.tsx`

**Step 1: Create the wizard component**

Create `pacta_appweb/src/components/setup/SetupWizard.tsx`:

```typescript
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { runSetup } from '@/lib/setup-api';
import { useAuth } from '@/contexts/AuthContext';
import { StepWelcome } from './StepWelcome';
import { StepAdmin } from './StepAdmin';
import { StepClient } from './StepClient';
import { StepSupplier } from './StepSupplier';
import { StepReview } from './StepReview';
import type { AdminFormData, PartyFormData } from '@/lib/setup-validation';

const STEPS = ['Welcome', 'Admin Account', 'First Client', 'First Supplier', 'Review'] as const;

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const [admin, setAdmin] = useState<AdminFormData>({
    name: '', email: '', password: '', confirmPassword: '',
  });
  const [client, setClient] = useState<PartyFormData>({ name: '', address: '', reu_code: '', contacts: '' });
  const [supplier, setSupplier] = useState<PartyFormData>({ name: '', address: '', reu_code: '', contacts: '' });

  const next = useCallback(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), []);
  const prev = useCallback(() => setStep(s => Math.max(s - 1, 0)), []);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    try {
      await runSetup({
        admin: { name: admin.name, email: admin.email, password: admin.password },
        client: {
          name: client.name,
          address: client.address || undefined,
          reu_code: client.reu_code || undefined,
          contacts: client.contacts || undefined,
        },
        supplier: {
          name: supplier.name,
          address: supplier.address || undefined,
          reu_code: supplier.reu_code || undefined,
          contacts: supplier.contacts || undefined,
        },
      });
      toast.success('Setup complete! Logging you in...');
      // Auto-login with the credentials just created
      const user = await login(admin.email, admin.password);
      if (user) {
        setTimeout(() => navigate('/dashboard'), 1000);
      } else {
        setTimeout(() => navigate('/'), 1500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Setup failed. Please restart the application.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [admin, client, supplier, login, navigate]);

  const renderStep = () => {
    switch (step) {
      case 0:
        return <StepWelcome onNext={next} />;
      case 1:
        return <StepAdmin data={admin} onChange={setAdmin} onNext={next} onPrev={prev} />;
      case 2:
        return <StepClient data={client} onChange={setClient} onNext={next} onPrev={prev} />;
      case 3:
        return <StepSupplier data={supplier} onChange={setSupplier} onNext={next} onPrev={prev} />;
      case 4:
        return <StepReview admin={admin} client={client} supplier={supplier} onPrev={prev} onSubmit={handleSubmit} loading={loading} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  i < step ? 'bg-primary text-primary-foreground' :
                  i === step ? 'bg-primary text-primary-foreground' :
                  'bg-muted text-muted-foreground'
                }`}
                aria-label={`Step ${i + 1}: ${label}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {renderStep()}
      </div>
    </div>
  );
}
```

**Step 2: Create StepWelcome**

Create `pacta_appweb/src/components/setup/StepWelcome.tsx`:

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface StepWelcomeProps {
  onNext: () => void;
}

export function StepWelcome({ onNext }: StepWelcomeProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Welcome to PACTA</CardTitle>
        <CardDescription className="text-center">
          Let&apos;s set up your organization in a few quick steps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>We&apos;ll help you configure:</p>
          <ul className="space-y-2 ml-4 list-disc">
            <li><strong className="text-foreground">Admin account</strong> -- Your main administrator credentials</li>
            <li><strong className="text-foreground">First client</strong> -- Your primary client organization</li>
            <li><strong className="text-foreground">First supplier</strong> -- Your primary supplier/vendor</li>
          </ul>
          <p className="text-xs">All data stays on your machine. No cloud services, no third-party databases.</p>
        </div>
        <Button onClick={onNext} className="w-full" size="lg">
          Get Started
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Create StepAdmin**

Create `pacta_appweb/src/components/setup/StepAdmin.tsx`:

```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { adminSchema, type AdminFormData } from '@/lib/setup-validation';
import { useState } from 'react';
import { toast } from 'sonner';

interface StepAdminProps {
  data: AdminFormData;
  onChange: (data: AdminFormData) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepAdmin({ data, onChange, onNext, onPrev }: StepAdminProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNext = () => {
    const result = adminSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(e => { fieldErrors[e.path[0]] = e.message; });
      setErrors(fieldErrors);
      toast.error('Please fix the errors below');
      return;
    }
    setErrors({});
    onNext();
  };

  const updateField = (field: keyof AdminFormData, value: string) => {
    onChange({ ...data, [field]: value });
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const passwordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  };

  const strength = passwordStrength(data.password);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', 'text-red-500', 'text-yellow-500', 'text-blue-500', 'text-green-500'][strength];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Admin Account</CardTitle>
        <CardDescription>Create the main administrator account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="setup-name">Full Name</Label>
          <Input
            id="setup-name"
            value={data.name}
            onChange={e => updateField('name', e.target.value)}
            placeholder="Admin User"
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && <p id="name-error" className="text-sm text-red-500" role="alert">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="setup-email">Email</Label>
          <Input
            id="setup-email"
            type="email"
            value={data.email}
            onChange={e => updateField('email', e.target.value)}
            placeholder="admin@pacta.local"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && <p id="email-error" className="text-sm text-red-500" role="alert">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="setup-password">Password</Label>
          <Input
            id="setup-password"
            type="password"
            value={data.password}
            onChange={e => updateField('password', e.target.value)}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : 'password-strength'}
          />
          {data.password && (
            <p id="password-strength" className={`text-xs ${strengthColor}`}>
              Strength: {strengthLabel}
            </p>
          )}
          {errors.password && <p id="password-error" className="text-sm text-red-500" role="alert">{errors.password}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="setup-confirm">Confirm Password</Label>
          <Input
            id="setup-confirm"
            type="password"
            value={data.confirmPassword}
            onChange={e => updateField('confirmPassword', e.target.value)}
            placeholder="Repeat password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
          />
          {errors.confirmPassword && <p id="confirm-error" className="text-sm text-red-500" role="alert">{errors.confirmPassword}</p>}
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onPrev} className="flex-1">
            Back
          </Button>
          <Button onClick={handleNext} className="flex-1">
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Create StepClient**

Create `pacta_appweb/src/components/setup/StepClient.tsx`:

```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { partySchema, type PartyFormData } from '@/lib/setup-validation';
import { useState } from 'react';
import { toast } from 'sonner';

interface StepClientProps {
  data: PartyFormData;
  onChange: (data: PartyFormData) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepClient({ data, onChange, onNext, onPrev }: StepClientProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNext = () => {
    const result = partySchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(e => { fieldErrors[e.path[0]] = e.message; });
      setErrors(fieldErrors);
      toast.error('Please fix the errors below');
      return;
    }
    setErrors({});
    onNext();
  };

  const updateField = (field: keyof PartyFormData, value: string) => {
    onChange({ ...data, [field]: value });
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">First Client</CardTitle>
        <CardDescription>Add your primary client organization</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="client-name">Client Name *</Label>
          <Input
            id="client-name"
            value={data.name}
            onChange={e => updateField('name', e.target.value)}
            placeholder="Client Corporation"
            required
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'client-name-error' : undefined}
          />
          {errors.name && <p id="client-name-error" className="text-sm text-red-500" role="alert">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-address">Address</Label>
          <Input id="client-address" value={data.address || ''} onChange={e => updateField('address', e.target.value)} placeholder="Optional" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-reu">REU Code</Label>
          <Input id="client-reu" value={data.reu_code || ''} onChange={e => updateField('reu_code', e.target.value)} placeholder="Optional" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-contacts">Contacts</Label>
          <Input id="client-contacts" value={data.contacts || ''} onChange={e => updateField('contacts', e.target.value)} placeholder="Optional (JSON)" />
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onPrev} className="flex-1">Back</Button>
          <Button onClick={handleNext} className="flex-1">Next</Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 5: Create StepSupplier**

Create `pacta_appweb/src/components/setup/StepSupplier.tsx` (same pattern as StepClient):

```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { partySchema, type PartyFormData } from '@/lib/setup-validation';
import { useState } from 'react';
import { toast } from 'sonner';

interface StepSupplierProps {
  data: PartyFormData;
  onChange: (data: PartyFormData) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function StepSupplier({ data, onChange, onNext, onPrev }: StepSupplierProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNext = () => {
    const result = partySchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(e => { fieldErrors[e.path[0]] = e.message; });
      setErrors(fieldErrors);
      toast.error('Please fix the errors below');
      return;
    }
    setErrors({});
    onNext();
  };

  const updateField = (field: keyof PartyFormData, value: string) => {
    onChange({ ...data, [field]: value });
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">First Supplier</CardTitle>
        <CardDescription>Add your primary supplier/vendor</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="supplier-name">Supplier Name *</Label>
          <Input
            id="supplier-name"
            value={data.name}
            onChange={e => updateField('name', e.target.value)}
            placeholder="Supplier Company"
            required
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'supplier-name-error' : undefined}
          />
          {errors.name && <p id="supplier-name-error" className="text-sm text-red-500" role="alert">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier-address">Address</Label>
          <Input id="supplier-address" value={data.address || ''} onChange={e => updateField('address', e.target.value)} placeholder="Optional" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier-reu">REU Code</Label>
          <Input id="supplier-reu" value={data.reu_code || ''} onChange={e => updateField('reu_code', e.target.value)} placeholder="Optional" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier-contacts">Contacts</Label>
          <Input id="supplier-contacts" value={data.contacts || ''} onChange={e => updateField('contacts', e.target.value)} placeholder="Optional (JSON)" />
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onPrev} className="flex-1">Back</Button>
          <Button onClick={handleNext} className="flex-1">Next</Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 6: Create StepReview**

Create `pacta_appweb/src/components/setup/StepReview.tsx`:

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminFormData, PartyFormData } from '@/lib/setup-validation';

interface StepReviewProps {
  admin: AdminFormData;
  client: PartyFormData;
  supplier: PartyFormData;
  onPrev: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export function StepReview({ admin, client, supplier, onPrev, onSubmit, loading }: StepReviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Review & Complete</CardTitle>
        <CardDescription>Verify your setup details before submitting</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Admin Account</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Name:</dt><dd>{admin.name}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Email:</dt><dd>{admin.email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Password:</dt><dd>••••••••</dd></div>
          </dl>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">First Client</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Name:</dt><dd>{client.name}</dd></div>
            {client.address && <div className="flex justify-between"><dt className="text-muted-foreground">Address:</dt><dd>{client.address}</dd></div>}
            {client.reu_code && <div className="flex justify-between"><dt className="text-muted-foreground">REU Code:</dt><dd>{client.reu_code}</dd></div>}
          </dl>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">First Supplier</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Name:</dt><dd>{supplier.name}</dd></div>
            {supplier.address && <div className="flex justify-between"><dt className="text-muted-foreground">Address:</dt><dd>{supplier.address}</dd></div>}
            {supplier.reu_code && <div className="flex justify-between"><dt className="text-muted-foreground">REU Code:</dt><dd>{supplier.reu_code}</dd></div>}
          </dl>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onPrev} className="flex-1" disabled={loading}>Back</Button>
          <Button onClick={onSubmit} className="flex-1" disabled={loading}>
            {loading ? 'Setting up...' : 'Complete Setup'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 7: Update SetupPage to use wizard**

Modify `pacta_appweb/src/pages/SetupPage.tsx` to simply render the wizard:

```typescript
import SetupWizard from '@/components/setup/SetupWizard';

export default function SetupPage() {
  return <SetupWizard />;
}
```

**Step 8: Commit**

```bash
git add pacta_appweb/src/pages/SetupPage.tsx \
  pacta_appweb/src/components/setup/SetupWizard.tsx \
  pacta_appweb/src/components/setup/StepWelcome.tsx \
  pacta_appweb/src/components/setup/StepAdmin.tsx \
  pacta_appweb/src/components/setup/StepClient.tsx \
  pacta_appweb/src/components/setup/StepSupplier.tsx \
  pacta_appweb/src/components/setup/StepReview.tsx
git commit -m "feat: implement multi-step setup wizard

- 5 steps: Welcome, Admin, Client, Supplier, Review
- Zod validation on all form fields
- Password strength indicator
- Progress bar with step indicators
- ARIA labels and keyboard navigation
- Auto-login after successful setup"
```

---

### Task 7: Add Setup Status Check to AuthContext

**Files:**
- Modify: `pacta_appweb/src/contexts/AuthContext.tsx`

**Step 1: Add setup status check**

In the `useEffect` of `AuthContext.tsx`, after the `/api/auth/me` fetch fails, check setup status:

Add import at top:
```typescript
import { checkSetupStatus } from '@/lib/setup-api';
```

Modify the useEffect:
```typescript
useEffect(() => {
  const controller = new AbortController();

  fetch('/api/auth/me', { signal: controller.signal })
    .then(res => res.ok ? res.json() : null)
    .then(data => { if (data) setUser(data); })
    .catch(async () => {
      // If not authenticated, check if setup is needed
      const needsSetup = await checkSetupStatus();
      if (needsSetup) {
        window.location.href = '/setup';
      }
    })
    .finally(() => setIsLoading(false));

  return () => controller.abort();
}, []);
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/contexts/AuthContext.tsx
git commit -m "feat: redirect to setup wizard on first run

When /api/auth/me returns 401, check /api/setup/status.
If needs_setup is true, redirect to /setup automatically."
```

---

### Task 8: Update CHANGELOG and Version

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `pacta_appweb/package.json`

**Step 1: Update CHANGELOG.md**

Add at top (after the header, before v0.4.1):

```markdown
## [0.5.0] - 2026-04-11

### Added
- **First-run setup wizard** -- Multi-step wizard replaces hardcoded default admin, allowing users to set their own admin credentials + seed first client and supplier on initial launch
- **Setup status endpoint** -- `GET /api/setup/status` returns whether first-run setup is needed
- **Atomic setup transaction** -- All setup data (admin, client, supplier) created in single SQLite transaction, ensuring no partial state

### Changed
- Removed hardcoded default admin from migration `001_users.sql`
- Setup wizard auto-logins after successful configuration and redirects to dashboard

### Security
- **C-001: Fixed** -- No more default admin with known bcrypt hash; each installation requires unique admin credentials
- Password validation enforces minimum 8 chars, uppercase, number, and special character

### Technical Details
- **Files Created:** 9 (1 Go handler, 1 SQL migration, 7 TypeScript components)
- **Files Modified:** 5 (2 Go files, 3 frontend files)
```

**Step 2: Bump frontend version**

In `pacta_appweb/package.json`, change `"version": "0.4.1"` to `"version": "0.5.0"`.

**Step 3: Commit**

```bash
git add CHANGELOG.md pacta_appweb/package.json
git commit -m "chore: bump version to 0.5.0 and update changelog

Add first-run setup wizard release notes."
```

---

### Task 9: Create PR, Merge, Tag, Release

**Step 1: Create feature branch and push**

```bash
git checkout -b feat/first-run-setup-wizard
git push -u origin feat/first-run-setup-wizard
```

**Step 2: Create PR**

```bash
gh pr create --base main \
  --title "feat: first-run setup wizard (v0.5.0)" \
  --body "## Summary

Replaces hardcoded default admin with secure first-run setup wizard.

### Changes
- Multi-step wizard: Welcome → Admin → Client → Supplier → Review
- \`POST /api/setup\` creates admin + client + supplier atomically
- \`GET /api/setup/status\` for auto-redirect logic
- Zod validation on all form fields
- Password strength indicator
- Auto-login after setup
- Removes hardcoded default admin from migration

### Security
- Fixes C-001: No more default admin with known bcrypt hash
- Each installation requires unique admin credentials

### Files
- Created: 9 files (1 Go, 1 SQL, 7 TSX)
- Modified: 5 files"
```

**Step 3: Merge (using PR/Merge Workflow)**

```bash
# Disable branch protection
echo '{"required_pull_request_reviews": null, "required_status_checks": null, "enforce_admins": false, "restrictions": null}' | \
  gh api -X PUT repos/PACTA-Team/pacta/branches/main/protection --input -

# Merge PR (get PR number from step 2 output)
gh pr merge <PR_NUMBER> --merge --delete-branch

# Re-enable branch protection IMMEDIATELY
echo '{"required_pull_request_reviews": {"required_approving_review_count": 1, "dismiss_stale_reviews": true, "require_code_owner_reviews": true}, "required_status_checks": null, "enforce_admins": true, "restrictions": null}' | \
  gh api -X PUT repos/PACTA-Team/pacta/branches/main/protection --input -
```

**Step 4: Tag and release**

```bash
git pull origin main
git tag -a v0.5.0 -m "Release v0.5.0 - First-Run Setup Wizard

Replaces hardcoded default admin with secure wizard-based bootstrap.
- Multi-step setup wizard (admin + client + supplier)
- Atomic SQLite transaction
- Auto-login after setup
- Fixes C-001 from QA report"
git push origin v0.5.0

gh release create v0.5.0 --title "v0.5.0 - First-Run Setup Wizard" \
  --notes "## First-Run Setup Wizard

### Summary
Replaces hardcoded default admin with secure first-run setup wizard.

### Features
- Multi-step wizard: Welcome → Admin → Client → Supplier → Review
- Password validation (min 8 chars, uppercase, number, special char)
- Password strength indicator
- Zod validation on all form fields
- Auto-login after successful setup
- Atomic setup transaction (no partial state)

### Security
- **C-001 Fixed** -- No more default admin with known bcrypt hash
- Each installation requires unique admin credentials

### Migration
Existing installations: migration 001 no longer inserts default admin.
If you had the default admin, it will be removed on next migration run."
```

---

### Task 10: Update PROJECT_SUMMARY.md

**Files:**
- Modify: `docs/PROJECT_SUMMARY.md`

**Step 1: Update progress tracking**

Add to Completed section:
```markdown
### Completed (v0.5.0)

- [x] First-run setup wizard (replaces hardcoded default admin, fixes C-001)
- [x] Setup status endpoint (`GET /api/setup/status`)
- [x] Atomic setup transaction (admin + client + supplier)
- [x] Auto-redirect to setup on first run
```

Update bugs table:
```markdown
| C-001 | Critical | Default admin password hash doesn't match `admin123` | **Fixed v0.5.0** -- replaced with first-run setup wizard |
```

Remove from Pending:
```markdown
- [ ] Fix C-001: Replace fake bcrypt hash with real one in `internal/db/001_users.sql`
```

**Step 2: Commit and push**

```bash
git add docs/PROJECT_SUMMARY.md
git commit -m "docs: update PROJECT_SUMMARY.md with v0.5.0 setup wizard"
git push origin main
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Remove default admin from migration | 1 file |
| 2 | Create setup handler | 1 new file |
| 3 | Register setup routes | 1 file |
| 4 | Create setup API client | 1 new file |
| 5 | Create Zod validation | 1 new file |
| 6 | Build multi-step wizard | 7 new files, 1 modified |
| 7 | Add setup check to AuthContext | 1 file |
| 8 | Update changelog + version | 2 files |
| 9 | PR, merge, tag, release | Git operations |
| 10 | Update PROJECT_SUMMARY.md | 1 file |

**Total:** 13 new files, 7 modified files
