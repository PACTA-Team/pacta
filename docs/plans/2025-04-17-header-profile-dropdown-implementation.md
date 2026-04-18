# Header User Profile Dropdown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `writing-plans` → `executing-plans` or `subagent-driven-development` for task execution.

**Goal:** Mover el perfil de usuario del sidebar al header como dropdown, limpiar navegación, y mejorar responsive/UX

**Architecture:** 
- Nuevo componente `UserDropdown` en header
- Header responsive (mobile/tablet/desktop)
- Sidebar simplificado (sin Users/Settings)
- Mobile: CompanySelector en drawer sidebar, header mínimo

**Tech Stack:**
- React (TypeScript)
- shadcn/ui components: DropdownMenu, Avatar, Button
- Tailwind CSS (responsive utilities)
- Lucide React icons
- Existing AuthContext for user/logout

---

## Pre-Task Setup

**Branch:** `feat/header-profile-dropdown`

**Dependencies check:**
- `src/components/ui/dropdown-menu.tsx` exists (shadcn)
- `src/components/ui/avatar.tsx` exists (shadcn)
- `src/components/ui/button.tsx` exists (shadcn)
- `src/contexts/AuthContext.tsx` provides `user` y `logout`

**Installations:** None (all deps exist)

---

## Task 1: Crear UserDropdown Component

**Files:**
- Create: `src/components/header/UserDropdown.tsx`
- Modify: `src/components/layout/AppLayout.tsx` (importarlo)
- Test: Manual visual + interaction test

**Step 1: Crear directorio y componente base**

```bash
mkdir -p src/components/header
```

Create `src/components/header/UserDropdown.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Users,
  LogOut,
  ChevronDown,
  User,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function UserDropdown() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Handlers
  const handleNavigation = (path: string) => {
    navigate(path);
    // Dropdown se cierra automáticamente por comportamiento de shadcn DropdownMenu
  };

  const handleLogout = async () => {
    await logout();
    // AuthContext maneja redirección a /login al limpiar user
    navigate("/login", { replace: true });
  };

  // User initials for avatar fallback
  const userInitials = useMemo(() => {
    if (!user?.name) return "U";
    const names = user.name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return user.name.slice(0, 2).toUpperCase();
  }, [user?.name]);

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative flex items-center gap-2 px-2 py-1 h-auto rounded-lg hover:bg-muted/50 transition-colors"
          aria-label={t("userMenu") || "User menu"}
          aria-haspopup="true"
          aria-expanded="false"
        >
          <Avatar className="h-8 w-8 ring-2 ring-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start text-left">
            <span className="text-sm font-medium truncate max-w-[100px]">
              {user.name}
            </span>
            <span className="text-[10px] text-muted-foreground capitalize truncate max-w-[100px]">
              {user.role}
            </span>
          </div>
          <ChevronDown className="hidden md:block h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-56 z-50"
        sideOffset={5}
      >
        {/* Header con info del usuario */}
        <DropdownMenuLabel className="flex flex-col items-start gap-1 p-3 bg-muted/30">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-medium truncate">
                {user.name}
              </p>
              <p className="text-xs text-muted-foreground truncate capitalize">
                {user.role}
              </p>
              {user.email && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {user.email}
                </p>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Navegación principal */}
        <DropdownMenuItem
          onClick={() => handleNavigation("/settings")}
          className="cursor-pointer"
        >
          <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{t("settings") || "Settings"}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/users")}
          className="cursor-pointer"
        >
          <Users className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{t("users") || "Users"}</span>
        </DropdownMenuItem>

        {/* Opcional: Mi Perfil (comentado hasta que exista ruta) */}
        {/* <DropdownMenuItem
          onClick={() => handleNavigation("/profile")}
          className="cursor-pointer"
        >
          <User className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{t("profile") || "My Profile"}</span>
        </DropdownMenuItem> */}

        {/* Opcional: Notificaciones (redundante con icono en desktop) */}
        {/* <DropdownMenuItem
          onClick={() => handleNavigation("/notifications")}
          className="cursor-pointer"
        >
          <Bell className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{t("notifications") || "Notifications"}</span>
        </DropdownMenuItem> */}

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
        >
          <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>{t("logout") || "Logout"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Añadir traducciones (si es necesario)**

Verificar que `/public/locales/en/common.json` y `/public/locales/es/common.json` tengan:
```json
{
  "userMenu": "User menu",
  "settings": "Settings",
  "users": "Users",
  "logout": "Logout"
}
```

Si no existen, añadirlas. Si usan claves diferentes (ej: `"navigation.users"`), ajustar en UserDropdown.

**Step 3: Exportar componente (opcional)**

Añadir a `src/components/header/index.ts` (si existe) o crear barrel file:

```ts
export { default as UserDropdown } from "./UserDropdown";
```

**Step 4: Commit**

```bash
git add src/components/header/UserDropdown.tsx
git commit -m "feat(header): add UserDropdown component with navigation and logout"
```

---

## Task 2: Modificar AppLayout para Header Responsive

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`

**Step 1: Importar UserDropdown y nuevo icono Menu**

Al inicio del archivo, añadir:
```tsx
import { Menu } from "lucide-react"; // Ya probablemente importado, verificar
import UserDropdown from "@/components/header/UserDropdown";
```

**Step 2: Reestructurar header completo**

Reemplazar líneas 106-118 con:

```tsx
<header
  role="banner"
  className="border-b bg-card px-4 md:px-6 py-3 flex items-center gap-3 md:gap-4"
>
  {/* Mobile: Menu button (visible solo <768px) */}
  <Button
    variant="ghost"
    size="icon"
    className="md:hidden flex-shrink-0"
    onClick={() => {
      // Necesitamos exponer estado del sidebar mobile a AppLayout
      // Opción A: Pasar prop onMobileMenuToggle
      // Opción B: Usar contexto/estado interno
      // Ver Task 3 para integración
    }}
    aria-label="Open navigation menu"
  >
    <Menu className="h-5 w-5" aria-hidden="true" />
  </Button>

  {/* CompanySelector - Desktop/Tablet only (≥768px) */}
  <div className="hidden md:flex flex-shrink-0">
    <CompanySelector />
  </div>

  {/* Título de página - ocupa espacio restante */}
  <h1 className="flex-1 text-base md:text-lg lg:text-xl font-semibold tracking-tight truncate">
    {pathname.startsWith("/contracts/")
      ? "Contract Details"
      : PAGE_TITLES[pathname] || ""}
  </h1>

  {/* Acciones Desktop/Tablet (≥768px) - Notifications, Theme, Language */}
  <div className="hidden md:flex items-center gap-2 flex-shrink-0">
    <NotificationsDropdown />
    <LanguageToggle />
    <ThemeToggle />
  </div>

  {/* UserDropdown - siempre visible (mobile y desktop) */}
  <div className="flex-shrink-0">
    <UserDropdown />
  </div>
</header>
```

**Nota:** El botón menu onClick necesita coordinación con AppSidebar. En Task 3 manejaremos eso.

**Step 3: Ajustar margen izquierdo del contenido principal**

Ya está bien: línea 104 `style={{ marginLeft: isMobile ? 0 : (sidebarCollapsed ? 80 : 256) }}` → No requiere cambios.

**Step 4: Commit**

```bash
git add src/components/layout/AppLayout.tsx
git commit -m "refactor(header): responsive layout with user dropdown"
```

---

## Task 3:Integrar Mobile Menu State en AppLayout

**Problem:** El botón hamburguesa en AppLayout necesita abrir/cerrar el sidebar mobile que está en AppSidebar.

**Solution:** Pasar callback `onMobileMenuToggle` desde AppLayout a AppSidebar via prop.

**Files:**
- Modify: `src/components/layout/AppLayout.tsx` (añadir estado mobileMenu)
- Modify: `src/components/layout/AppSidebar.tsx` (接受 prop y controlar sidebarOpen)

**Step 1: Añadir estado en AppLayout**

```tsx
// Dentro de AppLayout component, después de la línea 39:
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

// Modificar el botón menu onClick:
onClick={() => setMobileMenuOpen(true)}

// Pasar a AppSidebar:
<AppSidebar
  device={device}
  collapsed={sidebarCollapsed}
  onCollapsedChange={setSidebarCollapsed}
  mobileMenuOpen={mobileMenuOpen}
  onMobileMenuClose={() => setMobileMenuOpen(false)}
/>
```

**Step 2: Modificar AppSidebar props interface**

```tsx
interface AppSidebarProps {
  device?: 'desktop' | 'tablet' | 'mobile';
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  mobileMenuOpen?: boolean;           // NUEVO
  onMobileMenuClose?: () => void;      // NUEVO
}
```

**Step 3: Usar mobileMenuOpen en AppSidebar**

Reemplazar línea 136:
```tsx
// ANTES:
const [sidebarOpen, setSidebarOpen] = useState(false);

// DESPUÉS: usar prop externa si existe
const sidebarOpen = externalMobileMenuOpen ?? internalState
```

Implementación:

```tsx
// En AppSidebar component, después de línea 107:
// Estado interno para mobile drawer (respeta prop externa)
const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
const sidebarOpen = externalMobileMenuOpen !== undefined
  ? externalMobileMenuOpen
  : internalSidebarOpen;

const setSidebarOpen = (open: boolean) => {
  if (externalMobileMenuClose) {
    // Si hay callback externo, usarlo para cambios
    // Pero solo si es un cambio desde el componente padre
    // Simplificar: dejar que el padre controle completamente
  } else {
    setInternalSidebarOpen(open);
  }
};

// Mejor approach: control total desde padre, simplificar:
// Eliminar estado interno completamente y solo usar prop
```

**Simplificado:** AppLayout controla totalmente `mobileMenuOpen`.

AppSidebar cambios:

```tsx
// Línea 136: ELIMINAR `const [sidebarOpen, setSidebarOpen] = useState(false);`
// Usar directamente la prop:
// (Añadir a interface: mobileMenuOpen?: boolean; onMobileMenuClose?: () => void;)

// Reemplazar todos los `setSidebarOpen(...)` con `onMobileMenuClose?.()`
// Y condición `sidebarOpen` directamente con `mobileMenuOpen`

// En el JSX mobile (línea 184):
{mobileMenuOpen && (
  <div
    className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
    onClick={onMobileMenuClose}
  >
    <div
      className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r shadow-xl flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header con CompanySelector */}
      <div className="p-4 border-b">
        <div className="mb-3">
          <CompanySelector compact />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">PACTA</h1>
            <p className="text-xs text-muted-foreground">Contract Management</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileMenuClose}
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Resto del drawer... */}
```

**Step 4: Commit**

```bash
git add src/components/layout/AppLayout.tsx src/components/layout/AppSidebar.tsx
git commit -m "feat(mobile): integrate mobile menu state between layout and sidebar"
```

---

## Task 4: Limpiar Navegación del Sidebar

**Files:**
- Modify: `src/components/layout/AppSidebar.tsx`

**Step 1: Eliminar Users y Settings de navigation array**

Localizar línea 67-80. Eliminar:
```tsx
{ nameKey: 'users', href: '/users', icon: Users, roles: ['admin'] as UserRole[] },
{ nameKey: 'settings', href: '/settings', icon: Settings, roles: ['admin'] as UserRole[] },
```

Ajustar `navLabels` correspondientes (líneas 150-162), eliminar entradas para `users` y `settings` si existen.

**Step 2: Ajuste de espaciado visual**

Eliminar `Separator` redundante si hay dos seguidos, pero mantener estructura:
```tsx
<Separator className="mx-3" />  {/* Después de navegación */}
```

No hay cambios mayores ya que `filteredNavigation` se recalcula automáticamente.

**Step 3: Commit**

```bash
git add src/components/layout/AppSidebar.tsx
git commit -m "cleanup(sidebar): remove users and settings from navigation"
```

---

## Task 5: Añadir CompanySelector al Mobile Drawer

**Files:**
- Modify: `src/components/CompanySelector.tsx` (si es necesario)
- Modify: `src/components/layout/AppSidebar.tsx` (insertar en mobile drawer)

**Step 1: Revisar CompanySelector actual**

Leer `src/components/CompanySelector.tsx` para determinar si necesita modo `compact`.

Si no existe prop `compact`, añadir soporte:

```tsx
interface CompanySelectorProps {
  compact?: boolean;  // NUEVO
}

// En el JSX, cambiar clases condicionalmente:
<div className={cn("flex items-center gap-2", compact ? "max-w-[200px]" : "max-w-md")}>
```

**Step 2: Insertar en mobile drawer header**

Ya hecho parcialmente en Task 3. Asegurar que:
- Solo visible en mobile
- Estilo `mb-3` para separación del logo
- Usar `compact` prop si se añadió

**Código final en AppSidebar mobile drawer (línea ~193):**

```tsx
<div className="p-4 border-b">
  {/* Company Selector - Mobile only */}
  <div className="md:hidden mb-3">
    <CompanySelector compact />
  </div>

  {/* Logo + Close */}
  <div className="flex items-center justify-between">
    {/* Logo blocks */}
  </div>
</div>
```

**Step 3: Ajustar responsive visibility**

Asegurar que `CompanySelector` en desktop NO se muestra en mobile (clase `hidden md:flex` aplicada en Task 2). El selector dentro del drawer solo mobile → `md:hidden`.

**Step 4: Commit**

```bash
git add src/components/CompanySelector.tsx src/components/layout/AppSidebar.tsx
git commit -m "feat(mobile): add CompanySelector to mobile drawer sidebar"
```

---

## Task 6: Eliminar Perfil del Sidebar Footer

**Files:**
- Modify: `src/components/layout/AppSidebar.tsx`

**Step 1: Eliminar User Profile Section Desktop**

Líneas 328-353 (aprox). Eliminar desde:
```tsx
{/* User profile section */}
<div className={cn('p-3', collapsed ? 'items-center' : '')}>
  ...
</div>
```

Hasta antes del cierre del `</div>` principal del sidebar (línea 354).

**Step 2: Eliminar User Profile Section Mobile**

Líneas 225-241 (dentro del mobile drawer `sidebarOpen`). Eliminar todo el bloque:
```tsx
<div className="p-4 border-t">
  <div className="flex items-center gap-3 p-2">
    ...avatar info...
  </div>
  <Button ...>Logout</Button>
</div>
```

**Step 3: Commit**

```bash
git add src/components/layout/AppSidebar.tsx
git commit -m "cleanup(sidebar): remove user profile section (moved to header)"
```

---

## Task 7: Tests y Validación Responsive

**No se implementan tests automáticos (no hay test suite configurado para componentes UI).**

**Step 1: Testing manual local (development)**

```bash
# Levantar servidor
npm run dev

# Verificar desktop (>1024px):
# - Todos los elementos del header visibles
# - UserDropdown abre/closes
# - Navegación a /settings y /users funciona
# - Logout cierra sesión y redirige a /login

# Verificar tablet (768-1023px):
# Abrir DevTools → responsive mode → 768px
# - LanguageToggle y ThemeToggle OCULTOS
# - Notifications visible
# - UserDropdown visible
# - CompanySelector visible

# Verificar mobile (<768px):
# - Solo menú hamburguesa + título + avatar UserDropdown
# - Al abrir drawer: CompanySelector en header del drawer
# - Sin perfil en footer (ya eliminado)
# - Navegación completa (9 ítems)
```

**Step 2: Accesibilidad (axe DevTools)**

Instalar axe DevTools extension o correr lighthouse:
```bash
# Si hay script de a11y:
npm run lighthouse:accessibility
```

Verificar:
- Contrast ratio >= 4.5:1
- No `aria-hidden` en elementos interactivos
- Focus visible en todos los botones

**Step 3: Cross-browser check (opcional)**

Chrome, Firefox, Safari mobile emulation.

**Step 4: Commit (si hay hotfixes)**

```bash
git add .
git commit -m "fix: responsive tweaks and a11y improvements"
```

---

## Task 8: Actualizar Docs y Finalizar

**Files:**
- Create: `docs/plans/2025-04-17-header-profile-dropdown-implementation.md` (este archivo)
- Already created: `docs/plans/2025-04-17-header-profile-dropdown-design.md`

**Step 1: Documentar arquitectura final**

Añadir al design doc si hay desviaciones:
- ¿CompanySelector necesitó prop `compact`?
- ¿Se añadió confirm dialog para logout?
- ¿Se añadió ruta `/profile`?

**Step 2: Actualizar README o docs de componentes (opcional)**

Si hay un `docs/components/Header.md` o similar, documentar:
- UserDropdown API (props, handlers)
- Responsive behavior de AppLayout

**Step 3: Final commit**

```bash
git add docs/plans/2025-04-17-header-profile-dropdown-implementation.md
git commit -m "docs: add implementation plan for header profile dropdown"
```

---

## Task 9: PR y Code Review

**Step 1: Push branch**

```bash
git push -u origin feat/header-profile-dropdown
```

**Step 2: Crear Pull Request**

```bash
gh pr create --title "feat(header): move user profile to dropdown in header" \
  --body "## Summary

- Add UserDropdown component (header)
- Responsive header: mobile shows only menu + title + avatar
- Hide Theme/Language toggles on tablet/mobile
- Remove Users/Settings from sidebar navigation
- Add CompanySelector to mobile drawer

## Test plan
- [ ] Desktop: all header elements visible
- [ ] Tablet: only Notifications + UserDropdown
- [ ] Mobile: minimal header + drawer has CompanySelector
- [ ] UserDropdown items navigate correctly
- [ ] Logout works

Fixes #XXX" \
  --base main
```

**Step 3: Solicitar review**

Tag reviewers: `@team/frontend`

**Step 4: Address feedback** → iterate until mergeable

---

## Post-Merge Checklist

- [ ] Eliminar branch local: `git branch -d feat/header-profile-dropdown`
- [ ] Verificar que CI pasa en GitHub Actions
- [ ] Desplegar a staging y hacer smoke test
- [ ] Actualizar CHANGELOG.md (si aplica)
- [ ] Cerrar issues relacionados (si aplica)

---

## Contingencia

| Problema | Solución |
|----------|----------|
| `CompanySelector` no cabe en mobile drawer | Añadir `compact` prop o truncar texto con `text-ellipsis` |
| Dropdown se cierra mal en navegación | Asegurar `onClick={() => { navigate(); close(); }}` |
| Logout no redirige | Verificar `AuthContext` maneja `user = null` → redirect en `AppLayout` |
| Iconos no alineados | Ajustar `flex items-center gap-2` en DropdownMenuItem |
| Mobile menu button no abre drawer | Verificar prop `mobileMenuOpen` se pasa correctamente |

---

## Contact & Help

- **Design doc:** `docs/plans/2025-04-17-header-profile-dropdown-design.md`
- **Frontend stack:** React + TypeScript + Tailwind + shadcn/ui
- **Key files:** AppLayout.tsx, AppSidebar.tsx, AuthContext.tsx

---

**Estimated effort:** ~5 hours (1 dev)
**Risk:** Low — components existentes, solo reestructuración layout
**Confidence:** High — patrón probado en otros dashboards empresariales
