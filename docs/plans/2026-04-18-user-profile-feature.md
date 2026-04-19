# User Profile Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task.

**Goal:** Create a dedicated `/profile` page where authenticated users can view/edit their profile, change password, and manage digital signatures (P12 certificates).

**Architecture:** Profile page with tabs following existing SettingsPage pattern. User profile data from `/api/auth/me` already works. Need to extend users-api and add backend handlers for password change and digital signature uploads.

**Tech Stack:** React 19, TypeScript, Radix UI (tabs, dialog, toast), Go backend with SQLite, file uploads for certificates.

---

## Task List

### Phase 1: Backend - Extend User API

#### Task 1: Add Profile Update and Password Change Handlers in Go Backend

**Files:**
- Modify: `/home/mowgli/pacta/internal/handlers/users.go`
- Modify: `/home/mowgli/pacta/internal/server/server.go` (register routes)

**Step 1: Write the handler for profile update**

In `users.go`, add after line 382:
```go
type updateProfileRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

func (h *Handler) HandleUserProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		h.getCurrentUserProfile(w, r)
		return
	}
	if r.Method == http.MethodPatch || r.Method == http.MethodPut {
		h.updateUserProfile(w, r)
		return
	}
	h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
}

func (h *Handler) getCurrentUserProfile(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	var u models.User
	err := h.DB.QueryRow(`
		SELECT id, name, email, role, status, last_access, created_at, updated_at
		FROM users WHERE id = ? AND deleted_at IS NULL
	`, userID).Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.Status,
		&u.LastAccess, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}
	h.JSON(w, http.StatusOK, u)
}

func (h *Handler) updateUserProfile(w http.ResponseWriter, r *http.Request) {
	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	userID := h.getUserID(r)

	// Fetch previous state
	var prevName, prevEmail string
	err := h.DB.QueryRow(`
		SELECT name, email FROM users WHERE id = ? AND deleted_at IS NULL
	`, userID).Scan(&prevName, &prevEmail)
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}

	name := req.Name
	if name == "" {
		name = prevName
	}

	email := req.Email
	if email == "" {
		email = prevEmail
	}

	_, err = h.DB.Exec(`
		UPDATE users SET name=?, email=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=? AND deleted_at IS NULL
	`, name, email, userID)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: users.email") {
			h.Error(w, http.StatusConflict, "email already exists")
			return
		}
		h.Error(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	h.auditLog(r, userID, 0, "update_profile", "user", &userID, map[string]interface{}{
		"name":  prevName,
		"email": prevEmail,
	}, map[string]interface{}{
		"name":  name,
		"email": email,
	})

	h.JSON(w, http.StatusOK, map[string]string{"status": "updated"})
}
```

**Step 2: Add password change handler**

After `updateUserProfile` function:
```go
type changePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword    string `json:"new_password"`
}

func (h *Handler) HandleChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req changePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Error(w, http.StatusBadRequest, "invalid request")
		return
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		h.Error(w, http.StatusBadRequest, "current_password and new_password are required")
		return
	}

	if len(req.NewPassword) < 8 {
		h.Error(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	userID := h.getUserID(r)

	var storedHash string
	err := h.DB.QueryRow("SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL", userID).Scan(&storedHash)
	if err != nil {
		h.Error(w, http.StatusNotFound, "user not found")
		return
	}

	if !auth.CheckPassword(req.CurrentPassword, storedHash) {
		h.Error(w, http.StatusUnauthorized, "current password is incorrect")
		return
	}

	newHash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	_, err = h.DB.Exec("UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL", newHash, userID)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to change password")
		return
	}

	h.auditLog(r, userID, 0, "change_password", "user", &userID, nil, nil)

	h.JSON(w, http.StatusOK, map[string]string{"status": "password changed"})
}
```

**Step 3: Register routes in server.go**

In `server.go`, add routes:
```go
r.Patch("/api/user/profile", h.HandleUserProfile)
r.Post("/api/user/change-password", h.HandleChangePassword)
```

Also add after existing user routes:
```go
r.Get("/api/user/profile", h.HandleUserProfile)
```

**Step 4: Commit**

```bash
git add internal/handlers/users.go internal/server/server.go
git commit -m "feat: add user profile and password change endpoints"
```

---

### Phase 2: Frontend - Users API Extension

#### Task 2: Extend users-api.ts with profile functions

**Files:**
- Modify: `/home/mowgli/pacta/pacta_appweb/src/lib/users-api.ts`

**Step 1: Add profile API functions**

After line 76 in `users-api.ts`:
```typescript
export interface ProfileUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'editor' | 'viewer';
  status: 'active' | 'inactive' | 'locked';
  last_access: string | null;
  created_at: string;
  updated_at: string;
}

export const profileAPI = {
  getProfile: (signal?: AbortSignal) =>
    fetchJSON<ProfileUser>('/api/user/profile', { signal }),

  updateProfile: (data: { name?: string; email?: string }, signal?: AbortSignal) =>
    fetchJSON<{ status: string }>('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
      signal,
    }),

  changePassword: (currentPassword: string, newPassword: string, signal?: AbortSignal) =>
    fetchJSON<{ status: string }>('/api/user/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      signal,
    }),
};
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/lib/users-api.ts
git commit -m "feat: add profile API functions"
```

---

### Phase 3: Add Digital Signature Fields to Backend

#### Task 3: Add digital signature columns to database model

**Files:**
- Modify: `/home/mowgli/pacta/internal/models/models.go`
- Modify: `/home/mowgli/pacta/internal/handlers/users.go`

**Step 1: Add digital signature fields to User model**

In `models.go`, add to User struct:
```go
type User struct {
	ID           int        `json:"id"`
	Name         string     `json:"name"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	Role         string     `json:"role"`
	Status       string     `json:"status"`
	CompanyID    *int       `json:"company_id,omitempty"`
	LastAccess   *time.Time `json:"last_access,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	// Digital signature fields
	DigitalSignatureURL  *string `json:"digital_signature_url,omitempty"`
	DigitalSignatureKey *string `json:"-"`
	PublicCertURL       *string `json:"public_cert_url,omitempty"`
	PublicCertKey      *string `json:"-"`
}
```

**Step 2: Add migration SQL**

In `users.go`, add before user queries:
```go
// Add digital signature columns if they don't exist
_, _ = h.DB.Exec(`
	ALTER TABLE users ADD COLUMN digital_signature_url TEXT
`)
_, _ = h.DB.Exec(`
	ALTER TABLE users ADD COLUMN digital_signature_key TEXT
`)
_, _ = h.DB.Exec(`
	ALTER TABLE users ADD COLUMN public_cert_url TEXT
`)
_, _ = h.DB.Exec(`
	ALTER TABLE users ADD COLUMN public_cert_key TEXT
`)
```

Add this in the `HandleUserProfile` or ensure it runs on startup.

**Step 3: Add certificate upload handler**

```go
type uploadCertRequest struct {
	CertType string `json:"cert_type"` // "digital_signature" or "public_cert"
}

func (h *Handler) HandleUploadCertificate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	userID := h.getUserID(r)

	// Parse multipart form
	r.ParseMultipartForm(32 << 20) // 32MB max

	file, header, err := r.FormFile("certificate")
	if err != nil {
		h.Error(w, http.StatusBadRequest, "no certificate file provided")
		return
	}
	defer file.Close()

	certType := r.FormValue("cert_type")
	if certType != "digital_signature" && certType != "public_cert" {
		h.Error(w, http.StatusBadRequest, "cert_type must be 'digital_signature' or 'public_cert'")
		return
	}

	// Validate file extension
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if certType == "digital_signature" && ext != ".p12" && ext != ".pfx" {
		h.Error(w, http.StatusBadRequest, "digital signature must be .p12 or .pfx file")
		return
	}
	if certType == "public_cert" && ext != ".cer" && ext != ".crt" && ext != ".pem" && ext != ".der" {
		h.Error(w, http.StatusBadRequest, "public certificate must be .cer, .crt, .pem, or .der file")
		return
	}

	// Read file content
	content, err := io.ReadAll(file)
	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to read certificate")
		return
	}

	// Store using existing document/storage system
	// Generate unique key
	now := time.Now()
	key := fmt.Sprintf("certificates/%d/%s_%s_%d%s", userID, certType, now.Format("20060102150405"), now.Unix(), ext)

	if err := h.Storage.Save(key, content, "application/octet-stream"); err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to save certificate")
		return
	}

	// Update user record
	if certType == "digital_signature" {
		_, err = h.DB.Exec(`
			UPDATE users SET digital_signature_url=?, digital_signature_key=?, updated_at=CURRENT_TIMESTAMP
			WHERE id=?`, "/storage/"+key, key, userID)
	} else {
		_, err = h.DB.Exec(`
			UPDATE users SET public_cert_url=?, public_cert_key=?, updated_at=CURRENT_TIMESTAMP
			WHERE id=?`, "/storage/"+key, key, userID)
	}

	if err != nil {
		h.Error(w, http.StatusInternalServerError, "failed to update certificate")
		return
	}

	h.auditLog(r, userID, 0, "upload_certificate", "user", &userID, nil, map[string]interface{}{
		"cert_type": certType,
		"filename":  header.Filename,
	})

	h.JSON(w, http.StatusOK, map[string]interface{}{
		"status":   "uploaded",
		"certType": certType,
		"filename": header.Filename,
	})
}

func (h *Handler) HandleDeleteCertificate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		h.Error(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	userID := h.getUserID(r)
	certType := chi.URLParam(r, "type")

	if certType != "digital_signature" && certType != "public_cert" {
		h.Error(w, http.StatusBadRequest, "type must be 'digital_signature' or 'public_cert'")
		return
	}

	var key *string
	if certType == "digital_signature" {
		h.DB.QueryRow("SELECT digital_signature_key FROM users WHERE id = ?", userID).Scan(&key)
		if key != nil {
			h.Storage.Delete(*key)
		}
		_, err := h.DB.Exec(`
			UPDATE users SET digital_signature_url=NULL, digital_signature_key=NULL, updated_at=CURRENT_TIMESTAMP
			WHERE id=?`, userID)
	} else {
		h.DB.QueryRow("SELECT public_cert_key FROM users WHERE id = ?", userID).Scan(&key)
		if key != nil {
			h.Storage.Delete(*key)
		}
		_, err := h.DB.Exec(`
			UPDATE users SET public_cert_url=NULL, public_cert_key=NULL, updated_at=CURRENT_TIMESTAMP
			WHERE id=?`, userID)
	}

	h.auditLog(r, userID, 0, "delete_certificate", "user", &userID, nil, map[string]interface{}{
		"cert_type": certType,
	})

	h.JSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
```

**Step 4: Register certificate routes**

In server.go:
```go
r.Post("/api/user/certificate", h.HandleUploadCertificate)
r.Delete("/api/user/certificate/{type}", h.HandleDeleteCertificate)
```

**Step 5: Commit**

```bash
git add internal/models/models.go internal/handlers/users.go internal/server/server.go
git commit -m "feat: add digital signature upload endpoints"
```

---

### Phase 4: Frontend - Certificate Upload API

#### Task 4: Add certificate upload functions to users-api.ts

**Files:**
- Modify: `/home/mowgli/pacta/pacta_appweb/src/lib/users-api.ts`

**Step 1: Add upload functions**

Add after profileAPI:
```typescript
export const certificateAPI = {
  upload: (certType: 'digital_signature' | 'public_cert', file: File, signal?: AbortSignal) => {
    const formData = new FormData();
    formData.append('certificate', file);
    formData.append('cert_type', certType);

    return fetch('/api/user/certificate', {
      method: 'POST',
      body: formData,
      credentials: 'include',
      signal,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Upload failed');
      }
      return res.json();
    });
  },

  delete: (certType: 'digital_signature' | 'public_cert', signal?: AbortSignal) =>
    fetchJSON<{ status: string }>(`/api/user/certificate/${certType}`, {
      method: 'DELETE',
      signal,
    }),
};
```

**Step 2: Update ProfileUser interface**

Add certificate fields:
```typescript
export interface ProfileUser {
  // ... existing fields
  digital_signature_url?: string;
  public_cert_url?: string;
}
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/lib/users-api.ts
git commit -m "feat: add certificate upload API functions"
```

---

### Phase 5: Profile Page UI

#### Task 5: Create ProfilePage.tsx

**Files:**
- Create: `/home/mowgli/pacta/pacta_appweb/src/pages/ProfilePage.tsx`

**Step 1: Write ProfilePage component**

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileSection } from "./ProfilePage/ProfileSection";
import { PasswordSection } from "./ProfilePage/PasswordSection";
import { CertificateSection } from "./ProfilePage/CertificateSection";

export default function ProfilePage() {
  const { t } = useTranslation("profile");
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto gap-1">
          <TabsTrigger value="profile" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.profile")}
          </TabsTrigger>
          <TabsTrigger value="password" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.password")}
          </TabsTrigger>
          <TabsTrigger value="certificates" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.certificates")}
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="profile">
            <ProfileSection />
          </TabsContent>

          <TabsContent value="password">
            <PasswordSection />
          </TabsContent>

          <TabsContent value="certificates">
            <CertificateSection />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
```

**Step 2: Register route in App.tsx**

In `App.tsx`, add after SettingsPage import:
```typescript
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
```

Add route:
```typescript
<Route path="/profile" element={
  <ProtectedRoute>
    <Suspense fallback={<PageLoadingFallback />}>
      <AppLayout><ProfilePage /></AppLayout>
    </Suspense>
  </ProtectedRoute>
} />
```

**Step 3: Commit**

```bash
git add pacta_appweb/src/pages/ProfilePage.tsx pacta_appweb/src/App.tsx
git commit -m "feat: add profile page with tabs structure"
```

---

#### Task 6: Create ProfileSection.tsx

**Files:**
- Create: `/home/mowgli/pacta/pacta_appweb/src/pages/ProfilePage/ProfileSection.tsx`

**Step 1: Write ProfileSection component**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { profileAPI, ProfileUser } from "@/lib/users-api";
import { toast } from "sonner";

export function ProfileSection() {
  const { t } = useTranslation("profile");
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });

  useEffect(() => {
    profileAPI
      .getProfile()
      .then((data) => {
        setProfile(data);
        setFormData({ name: data.name, email: data.email });
      })
      .catch(() => {
        toast.error(t("loadError"));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await profileAPI.update({
        name: formData.name,
        email: formData.email,
      });
      toast.success(t("saveSuccess"));
      setHasChanges(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("profileTitle")}</CardTitle>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? t("saving") : t("save")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("name")}</Label>
            <Input
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder={t("namePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("email")}</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder={t("emailPlaceholder")}
            />
          </div>
        </div>

        {profile && (
          <div className="mt-6 pt-4 border-t">
            <h3 className="text-sm font-medium mb-3">{t("accountInfo")}</h3>
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <p className="text-muted-foreground">{t("role")}</p>
                <p className="font-medium capitalize">{profile.role}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("status")}</p>
                <p className="font-medium capitalize">{profile.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("lastAccess")}</p>
                <p className="font-medium">
                  {profile.last_access
                    ? new Date(profile.last_access).toLocaleString()
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("createdAt")}</p>
                <p className="font-medium">
                  {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/pages/ProfilePage/ProfileSection.tsx
git commit -m "feat: add profile section component"
```

---

#### Task 7: Create PasswordSection.tsx

**Files:**
- Create: `/home/mowgli/pacta/pacta_appweb/src/pages/ProfilePage/PasswordSection.tsx`

**Step 1: Write PasswordSection component**

```typescript
"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { profileAPI } from "@/lib/users-api";
import { toast } from "sonner";

export function PasswordSection() {
  const { t } = useTranslation("profile");
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = t("required");
    }
    if (!formData.newPassword) {
      newErrors.newPassword = t("required");
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = t("passwordMinLength");
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t("required");
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = t("passwordsDoNotMatch");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await profileAPI.changePassword(
        formData.currentPassword,
        formData.newPassword
      );
      toast.success(t("passwordChangeSuccess"));
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("passwordChangeError"));
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("passwordTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t("currentPassword")}</Label>
          <Input
            type="password"
            value={formData.currentPassword}
            onChange={(e) => handleChange("currentPassword", e.target.value)}
            placeholder={t("currentPasswordPlaceholder")}
          />
          {errors.currentPassword && (
            <p className="text-sm text-red-500">{errors.currentPassword}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t("newPassword")}</Label>
          <Input
            type="password"
            value={formData.newPassword}
            onChange={(e) => handleChange("newPassword", e.target.value)}
            placeholder={t("newPasswordPlaceholder")}
          />
          {errors.newPassword && (
            <p className="text-sm text-red-500">{errors.newPassword}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t("confirmPassword")}</Label>
          <Input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => handleChange("confirmPassword", e.target.value)}
            placeholder={t("confirmPasswordPlaceholder")}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-red-500">{errors.confirmPassword}</p>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving} className="mt-4">
          {saving ? t("changing") : t("changePassword")}
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/pages/ProfilePage/PasswordSection.tsx
git commit -m "feat: add password change section"
```

---

#### Task 8: Create CertificateSection.tsx

**Files:**
- Create: `/home/mowgli/pacta/pacta_appweb/src/pages/ProfilePage/CertificateSection.tsx`

**Step 1: Write CertificateSection component**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { profileAPI, certificateAPI, ProfileUser } from "@/lib/users-api";
import { toast } from "sonner";
import { FileKey, Upload, Trash2, AlertCircle } from "lucide-react";

export function CertificateSection() {
  const { t } = useTranslation("profile");
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    profileAPI
      .getProfile()
      .then((data) => {
        setProfile(data);
      })
      .catch(() => {
        toast.error(t("loadError"));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleFileUpload = async (
    certType: "digital_signature" | "public_cert",
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await certificateAPI.upload(certType, file);
      toast.success(t("certUploadSuccess"));

      const updated = await profileAPI.getProfile();
      setProfile(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("certUploadError"));
    }
    setUploading(false);
  };

  const handleDelete = async (certType: "digital_signature" | "public_cert") => {
    try {
      await certificateAPI.delete(certType);
      toast.success(t("certDeleteSuccess"));

      const updated = await profileAPI.getProfile();
      setProfile(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("certDeleteError"));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Digital Signature Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileKey className="h-5 w-5" />
            {t("digitalSignature")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("digitalSignatureDescription")}
          </p>

          {profile?.digital_signature_url ? (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <FileKey className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{t("certInstalled")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("certInstalledDate", {
                      date: new Date(profile.updated_at).toLocaleDateString(),
                    })}
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete("digital_signature")}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("remove")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                type="file"
                accept=".p12,.pfx"
                onChange={(e) => handleFileUpload("digital_signature", e)}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                {t("p12FormatHelp")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Public Certificate Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t("publicCertificate")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("publicCertificateDescription")}
          </p>

          {profile?.public_cert_url ? (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <Upload className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{t("certInstalled")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("certInstalledDate", {
                      date: new Date(profile.updated_at).toLocaleDateString(),
                    })}
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete("public_cert")}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("remove")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                type="file"
                accept=".cer,.crt,.pem,.der"
                onChange={(e) => handleFileUpload("public_cert", e)}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                {t("certFormatHelp")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warning notice */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">{t("securityWarning")}</p>
          <p className="mt-1">{t("securityWarningDescription")}</p>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/pages/ProfilePage/CertificateSection.tsx
git commit -m "feat: add certificate upload section"
```

---

### Phase 6: Navigation

#### Task 9: Add Profile link to UserDropdown

**Files:**
- Modify: `/home/mowgli/pacta/pacta_appweb/src/components/header/UserDropdown.tsx`

**Step 1: Add profile navigation**

In `UserDropdown.tsx`, add import for a user icon:
```typescript
import {
  // ... existing icons
  User,
} from "lucide-react";
```

Add after the Settings menu item (after line 128):
```typescript
<DropdownMenuItem
  onClick={() => handleNavigation("/profile")}
  className="cursor-pointer"
>
  <User className="h-4 w-4 mr-2" aria-hidden="true" />
  <span>{t("profile") || "Profile"}</span>
</DropdownMenuItem>
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/components/header/UserDropdown.tsx
git commit -m "feat: add profile link to user dropdown"
```

---

### Phase 7: Internationalization

#### Task 10: Add translation keys

**Files:**
- Modify: `/home/mowgli/pacta/pacta_appweb/src/i18n/index.ts` (or create locale files)

**Step 1: Add profile translations**

Add to locale files (create if not exists `profile` namespace):
```json
{
  "profile": {
    "title": "Profile",
    "tabs": {
      "profile": "Profile",
      "password": "Password",
      "certificates": "Certificates"
    },
    "profileTitle": "Personal Information",
    "name": "Name",
    "email": "Email",
    "namePlaceholder": "Enter your name",
    "emailPlaceholder": "Enter your email",
    "accountInfo": "Account Information",
    "role": "Role",
    "status": "Status",
    "lastAccess": "Last Access",
    "createdAt": "Created",
    "save": "Save",
    "saving": "Saving...",
    "saveSuccess": "Profile updated successfully",
    "saveError": "Failed to update profile",
    "loadError": "Failed to load profile",
    "passwordTitle": "Change Password",
    "currentPassword": "Current Password",
    "newPassword": "New Password",
    "confirmPassword": "Confirm Password",
    "currentPasswordPlaceholder": "Enter current password",
    "newPasswordPlaceholder": "Enter new password",
    "confirmPasswordPlaceholder": "Confirm new password",
    "changePassword": "Change Password",
    "changing": "Changing...",
    "passwordChangeSuccess": "Password changed successfully",
    "passwordChangeError": "Failed to change password",
    "required": "This field is required",
    "passwordMinLength": "Password must be at least 8 characters",
    "passwordsDoNotMatch": "Passwords do not match",
    "digitalSignature": "Digital Signature (P12)",
    "digitalSignatureDescription": "Upload your PKCS#12 certificate (.p12 or .pfx) to sign contracts digitally.",
    "publicCertificate": "Public Certificate",
    "publicCertificateDescription": "Upload your public certificate (.cer, .crt, .pem, or .der) for verification.",
    "certUploadSuccess": "Certificate uploaded successfully",
    "certUploadError": "Failed to upload certificate",
    "certDeleteSuccess": "Certificate removed successfully",
    "certDeleteError": "Failed to remove certificate",
    "certInstalled": "Certificate installed",
    "certInstalledDate": "Installed on {date}",
    "remove": "Remove",
    "p12FormatHelp": "Accepted formats: .p12, .pfx",
    "certFormatHelp": "Accepted formats: .cer, .crt, .pem, .der",
    "securityWarning": "Security Notice",
    "securityWarningDescription": "Your certificates are stored securely and are only used for signing contracts. Keep your P12 password safe."
  }
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/src/i18n/
git commit -m "feat: add profile translations"
```

---

## Checkpoint: After Task 9
- [ ] Backend has profile update, password change, certificate upload endpoints
- [ ] Frontend has profile API with certificate functions
- [ ] Profile page loads at /profile

## Checkpoint: After Task 11
- [ ] Full flow works: view profile, edit profile, change password
- [ ] Certificate upload/download works
- [ ] Build passes: `npm run build`

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Storage for certificates | High | Use existing document storage system; ensure encryption |
| Certificate validation | Medium | Validate file extensions and types on upload |
| Password security | High | Never log or expose passwords; use bcrypt |
| Self-password change requires current password | Low | Security best practice already implemented |

---

## Open Questions

1. **Storage encryption**: Should certificates be encrypted at rest? (Recommended: yes with encryption at rest)
2. **Certificate password**: Should we also prompt for P12 password when signing? (Yes, will need additional UI)
3. **Mobile responsive**: Need to verify certificate upload works on mobile.

---

**Plan complete and saved.**

**Three execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

3. **Plan-to-Issues (team workflow)** - Convert plan tasks to GitHub issues for team distribution

**Which approach?**