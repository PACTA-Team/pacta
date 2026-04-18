# Frontend UX Redesign: Header User Profile Dropdown

## 📋 Resumen

Rediseño de la interfaz de PACTA para mejorar la experiencia de usuario (UX) mediante:
1. **Reubicación del perfil de usuario**: Mover del sidebar al header como dropdown
2. **Limpieza de navegación**: Eliminar "Users" y "Settings" del sidebar
3. **Responsive mejorado**: Ocultar automáticamente elementos del header en mobile (patrón similar al sidebar)
4. **Mejora visual**: Aplicar sistema de diseño "Enterprise Dashboard" con paleta Indigo/Emerald

---

## 🎯 Problema Actual

- **Perfil en sidebar**: Ocupa espacio valioso en la navegación principal
- **Navegación desordenada**: Users y Settings son accesos rápidos pero no navegación primaria
- **Header desbalanceado**: Solo contiene CompanySelector + Título + iconos, falta perfil
- **Mobile inconsistente**: CompanySelector visible en header desktop pero no en mobile

---

## ✨ Solución Propuesta

### **Principios de Diseño**

1. **Jerarquía clara**: Logo → Empresa → Página → Acciones → Perfil
2. **Progresive disclosure**: Mobile muestra solo lo esencial
3. **Consistencia**: Mismo patrón responsive que el sidebar (ocultar en mobile)
4. **Profesionalidad**: Estilo empresarial con paleta Indigo (#6366F1)

---

### **Nuevo Header Layout**

#### **Desktop (≥1024px)**
```
┌─────────────────────────────────────────────────────────────────┐
│ [PACTA]  Contracts Management        [🔔] [🌐] [🎨] [👤 ▼]   │
├─────────────────────────────────────────────────────────────────┤
│ [CompanySelector]                         Título de Página     │
└─────────────────────────────────────────────────────────────────┘
     Izquierda                         Centro                  Derecha
```

**Elementos derecha (Desktop):**
1. NotificationsDropdown (con badge)
2. LanguageToggle
3. ThemeToggle
4. **UserDropdown** (NUEVO)

#### **Tablet (768-1023px)**
- Mismo layout que desktop pero:
  - ThemeToggle y LanguageToggle ocultos (solo Notifications + UserDropdown)
  - Título puede truncarse con `truncate`

#### **Mobile (<768px)**
```
┌────────────────────────────┐
│ [☰]  Contracts      [👤 ▼]│
└────────────────────────────┘
  Menú        Título      Perfil
```

**Elementos mobile:**
- ✅ Botón hamburguesa (abre drawer)
- ✅ Título página (truncado, `flex-1 truncate`)
- ✅ UserDropdown (solo avatar sin texto)
- ❌ CompanySelector → al drawer del sidebar
- ❌ Notifications, Theme, Language → en UserDropdown como ítems

---

### **UserDropdown Contenido**

```
┌─────────────────────────────────┐
│ avatar ✓ Juan Pérez             │
│ 🔘 admin@empresa.com            │
├─────────────────────────────────┤
│ ⚙️ Configuración                │ → /settings
│ 👥 Usuarios                     │ → /users
│ (📋 Mi Perfil)                  │ → /profile (si existe)
│ (🔔 Notificaciones)             │ → /notifications
├─────────────────────────────────┤
│ 🚪 Cerrar Sesión                │ → logout + confirm?
└─────────────────────────────────┘
```

**Características:**
- Header fijo con avatar + nombre + rol + email (si hay espacio)
- Separadores visuales claros entre grupos
- Iconos Lucide consistentes (4×4)
- Hover: `bg-muted transition-colors duration-200`
- Items navegación: `cursor-pointer` + `router.push()` + `close dropdown`
- Logout: sin confirmación (patrón estándar) —opcional: confirm dialog—

---

### **Limpieza de Sidebar**

**Navegación actual (11 ítems):**
```
1. Dashboard
2. Contracts
3. Supplements
4. Clients
5. Suppliers
6. Authorized Signers
7. Documents
8. Reports
9. ❌ Users → eliminar
10. Companies
11. ❌ Settings → eliminar
```

**Navegación nueva (9 ítems):**
```
1-8. [igual que arriba]
9. Companies
-------
[Footer mobile: CompanySelector + Perfil]
```

**Mobile drawer:**
- Header: Logo + CompanySelector + Close button
- Nav: 9 ítems (sin Users/Settings)
- Footer: User info + Logout (igual que desktop sidebar)

---

## 🎨 Sistema de Diseño Aplicado

### **Paleta de Colores (Enterprise Dashboard)**

| Rol | Hex | Uso |
|-----|-----|-----|
| Primary | `#6366F1` | Botones primarios, enlaces activos, focus rings |
| Secondary | `#818CF8` | Hover states, backgrounds sutiles |
| CTA | `#10B981` | Acciones principales (crear, guardar) |
| Background | `#F5F3FF` | Fondo modo claro (alternativa: `#FFFFFF`) |
| Text | `#1E1B4B` | Texto principal |
| Muted | `#64748B` | Textos secundarios |

**Modo oscuro** (mantener tema actual):
- Primary: `#818CF8`
- Background: `#0F172A`
- Text: `#F1F5F9`

### **Tipografía**
- **Headings**: `Fira Code` (tecnológico, preciso)
- **Body**: `Fira Sans` (legible, neutral)

```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

**Aplicación:**
- Header height: `min-h-[3.5rem]` (56px)
- Font size header: `text-sm` para iconos, `text-base` para títulos
- Dropdown: `text-sm` para ítems

### **Efectos**

1. **Glassmorphism sutil**:
   ```tsx
   dropdown-menu: "bg-background/80 backdrop-blur-md border shadow-lg"
   header: "bg-card/80 backdrop-blur-sm border-b"
   ```

2. **Hover transitions**:
   ```tsx
   "transition-colors duration-200 hover:bg-muted"
   ```

3. **Focus states**:
   ```tsx
   "focus:ring-2 focus:ring-primary focus:ring-offset-2"
   ```

4. **Badge notificaciones**:
   ```tsx
   "absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-red-500 text-white text-[10px] font-bold"
   ```

---

## 📱 Responsive Breakpoints

| Breakpoint | Ancho | Aplicación |
|------------|-------|------------|
| Mobile | `<768px` | Header simplificado, drawer sidebar |
| Tablet | `768-1023px` | Header sin Theme/Language, sidebar colapsado opcional |
| Desktop | `≥1024px` | Header completo, sidebar expandido |

**Clases CSS utilitarias:**
- `hidden md:flex` → oculto en mobile, visible tablet+
- `flex md:hidden` → visible solo mobile
- `truncate` → texto largo con ellipsis
- `sm:hidden` → oculto en mobile/tablet pequeño

---

## 🧩 Componentes Detallados

### **1. UserDropdown (NUEVO)**

**Ubicación:** `src/components/header/UserDropdown.tsx`

**Props:** Ningunas (usa `useAuth` context)

**Estado interno:**
- `open` (boolean) → controla dropdown
- `loading` (boolean) → opcional (si se needs fetch user details)

**Estructura:**
```tsx
<DropdownMenu open={open} onOpenChange={setOpen}>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" className="relative">
      <Avatar className="h-8 w-8">
        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <ChevronDown className="absolute -bottom-1 -right-1 h-3 w-3" />
    </Button>
  </DropdownMenuTrigger>

  <DropdownMenuContent align="end" className="w-56">
    {/* Header con info usuario */}
    <div className="flex items-center gap-3 p-2 border-b">
      <Avatar className="h-10 w-10">
        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{user.name}</p>
        <p className="text-xs text-muted-foreground truncate capitalize">{user.role}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
    </div>

    {/* Navegación */}
    <DropdownMenuItem onClick={() => { router.push('/settings'); close(); }}>
      <Settings className="h-4 w-4 mr-2" />
      Configuración
    </DropdownMenuItem>

    <DropdownMenuItem onClick={() => { router.push('/users'); close(); }}>
      <Users className="h-4 w-4 mr-2" />
      Usuarios
    </DropdownMenuItem>

    {/* Opcionales */}
    {/* <DropdownMenuItem onClick={() => { router.push('/profile'); close(); }}>
      <User className="h-4 w-4 mr-2" />
      Mi Perfil
    </DropdownMenuItem> */}

    <DropdownMenuSeparator />

    <DropdownMenuItem onClick={logout} className="text-red-600">
      <LogOut className="h-4 w-4 mr-2" />
      Cerrar Sesión
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Accesibilidad:**
- `aria-label="User menu"`
- `aria-haspopup="true"` (automático de shadcn)
- Focus management (automático de shadcn)

---

### **2. AppLayout Modificaciones**

**Archivo:** `src/components/layout/AppLayout.tsx`

**Cambios:**

```tsx
// ANTES (líneas 106-118):
<header className="border-b bg-card px-6 py-3 flex items-center justify-between">
  <div className="flex items-center gap-4">
    <CompanySelector />
    <h1>Título</h1>
  </div>
  <div className="flex items-center gap-2">
    <LanguageToggle />
    <ThemeToggle />
    <NotificationsDropdown />
  </div>
</header>

// DESPUÉS:
<header className="border-b bg-card px-4 md:px-6 py-3 flex items-center gap-4">
  {/* Mobile: Menu button */}
  <Button
    variant="ghost"
    size="icon"
    className="md:hidden"
    onClick={() => setMobileMenuOpen(true)}
    aria-label="Open menu"
  >
    <Menu className="h-5 w-5" />
  </Button>

  {/* CompanySelector - desktop only */}
  <div className="hidden md:flex">
    <CompanySelector />
  </div>

  {/* Título */}
  <h1 className="flex-1 text-lg md:text-xl font-semibold truncate">
    {pathname.startsWith('/contracts/') ? 'Contract Details' : (PAGE_TITLES[pathname] || '')}
  </h1>

  {/* Acciones Desktop */}
  <div className="hidden md:flex items-center gap-2">
    <NotificationsDropdown />
    <LanguageToggle />
    <ThemeToggle />
  </div>

  {/* UserDropdown - siempre visible */}
  <UserDropdown />
</header>
```

**Notas:**
- Mobile: `px-4` (menos padding), `md:px-6`
- Título: `flex-1 truncate` para ocupar espacio y truncar si es largo
- Menú hamburguesa: `md:hidden` (solo mobile)
- CompanySelector: `hidden md:flex` (solo desktop/tablet)
- Acciones: `hidden md:flex` (tablet y desktop)

---

### **3. AppSidebar Modificaciones**

**Archivo:** `src/components/layout/AppSidebar.tsx`

#### **Cambios en navigation array:**

```tsx
// ELIMINAR estas entradas:
{ nameKey: 'users', href: '/users', icon: Users, roles: ['admin'] },
{ nameKey: 'settings', href: '/settings', icon: Settings, roles: ['admin'] },

// RESULTADO:
const navigation = [
  { nameKey: 'dashboard', ... },
  { nameKey: 'contracts', ... },
  { nameKey: 'supplements', ... },
  { nameKey: 'clients', ... },
  { nameKey: 'suppliers', ... },
  { nameKey: 'signers', ... },
  { nameKey: 'documents', ... },
  { nameKey: 'reports', ... },
  // Users ELIMINADO
  // Settings ELIMINADO
  { nameKey: 'companies', ... },
];
```

#### **Mobile Drawer Header (añadir CompanySelector):**

```tsx
// En el mobile drawer, línea 193-200 actual:
<div className="p-4 flex items-center justify-between border-b">
  <div>
    <h1 className="text-xl font-bold text-primary">PACTA</h1>
    <p className="text-xs text-muted-foreground">Contract Management</p>
  </div>
  <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
    <X className="h-5 w-5" />
  </Button>
</div>

// CAMBIAR a:
<div className="p-4 border-b">
  {/* CompanySelector para mobile */}
  <div className="mb-3">
    <CompanySelector compact /> {/* o prop para versión mobile */}
  </div>
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-xl font-bold text-primary">PACTA</h1>
      <p className="text-xs text-muted-foreground">Contract Management</p>
    </div>
    <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
      <X className="h-5 w-5" />
    </Button>
  </div>
</div>
```

**Nota:** `CompanySelector` puede necesitar modificación para soportar modo `compact` (reducir padding/ancho).

#### **Eliminar perfil del footer sidebar:**

```tsx
// Líneas 328-353 actual: ELIMINAR COMPLETAMENTE
// Esto se repite en mobile (225-241) y desktop (328-353)
```

**Resultado:** Sidebar solo navegación. El cierre de sesión ahora está en UserDropdown del header.

---

## 🗺️ Flujo de Navegación

```
Usuario hace clic en "Configuración" (dropdown)
  → router.push('/settings')
  → dropdown se cierra automáticamente
  → loading + renderizado de SettingsPage

Usuario hace clic en "Usuarios"
  → router.push('/users')
  → dropdown.close()
  → UsersPage cargado

Usuario hace clic en "Cerrar Sesión"
  → logout() desde AuthContext
  → redirect automático a /login (ya manejado en AuthContext)
```

---

## 🧪 Testing & Validación

### **Unit/Integration Tests**
- [ ] UserDropdown: abre/cierra con click y Escape
- [ ] Navegación: rutas correctas al hacer clic
- [ ] Logout: llama a `logout()` y redirige
- [ ] Responsive: elementos ocultos/shown basados en `window.innerWidth`

### **E2E (Cypress/Playwright)**
- [ ] Desktop: Header con todos los elementos visibles
- [ ] Tablet: Sin Theme/Language, solo Notifications + UserDropdown
- [ ] Mobile: Solo menú + título + avatar
- [ ] Mobile drawer: CompanySelector visible dentro del drawer
- [ ] Dropdown: items clickeables y cerrar al navegar

### **Accesibilidad (axe-core / Lighthouse)**
- [ ] Contraste ≥ 4.5:1 en todos los textos
- [ ] Navegación por teclado: Tab order lógico
- [ ] Screen reader: aria-labels en botones icon-only
- [ ] Focus visible: anillo visible en todos los elementos focusables
- [ ] Skip link funcional (ya existe)

### **Performance**
- [ ] UserDropdown: lazy load si necesita datos extra (no necesario actualmente)
- [ ] Sin re-renders innecesarios: `useCallback` para handlers
- [ ] Bundle size: UserDropdown ~2-3KB gzipped (componente liviano)

---

## 📦 Dependencias

**Nuevas dependencias:** Ninguna (usa componentes existentes: DropdownMenu, Avatar, Button)

**Componentes reutilizados:**
- `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem` (shadcn/ui)
- `Avatar`, `AvatarFallback` (shadcn/ui)
- `Button` (shadcn/ui)
- Iconos de `lucide-react`: `Settings`, `Users`, `LogOut`, `ChevronDown`

---

## ⚠️ Consideraciones

### **1. Ruta /profile**
- Actualmente no existe `/profile` en la app
- Opción "Mi Perfil" se deja como comentario en el diseño
- Si se necesita en el futuro: añadir fácilmente

### **2. Confirmación de logout**
- **Decisión**: No confirmar (UX estándar empresarial)
- Razonamiento: Redundante; usuario puede cancelar si hace clic accidental
- Si cliente lo requiere: añadir `<AlertDialog>` antes de logout

### **3. Badge notificaciones en UserDropdown**
- **Plus opcional**: Mostrar contador de no leídas junto a "Notificaciones" en el dropdown
- Implementación: `notificationsAPI.count()` o pasar `unreadCount` como prop
- **Decisión**: No implementar en v1 (redundante con NotificationsDropdown visible en desktop)

### **4. CompanySelector mobile**
- Necesita adaptarse a ancho reducido (mobile drawer width: `w-72` = 288px)
- Solución: Añadir prop `compact` que truncate el texto de empresa
- O usar `className="w-full"` y selector responsivo internamente

---

## 🗓️ Timeline Estimado

| Fase | Tiempo | Entregable |
|------|--------|-----------|
| Diseño + UX spec | ✅ 30min (este doc) | `docs/plans/2025-04-17-header-profile-dropdown-design.md` |
| Plan detallado | 🔄 10min | `docs/plans/2025-04-17-header-profile-dropdown-implementation.md` |
| UserDropdown component | ⏱️ 1h | `UserDropdown.tsx` |
| AppLayout changes | ⏱️ 1h | responsive header + mobile menu button |
| AppSidebar cleanup | ⏱️ 1h | eliminar users/settings, mover CompanySelector a mobile |
| Testing & bugfix | ⏱️ 1h | E2E, accesibilidad, responsive testing |
| **Total** | **~5h** | **Frontend rediseño completo** |

---

## 📁 Archivos Modificados

1. **Nuevo:**
   - `src/components/header/UserDropdown.tsx`

2. **Modificados:**
   - `src/components/layout/AppLayout.tsx`
   - `src/components/layout/AppSidebar.tsx`
   - `src/components/CompanySelector.tsx` (ajuste responsive si es necesario)

3. **Documentación:**
   - `docs/plans/2025-04-17-header-profile-dropdown-design.md` (este archivo)
   - `docs/plans/2025-04-17-header-profile-dropdown-implementation.md` (plan detallado)

---

## 🎯 Criterios de Éxito

- [ ] UserDropdown visible en header (todos los breakpoints)
- [ ] Users y Settings eliminados del sidebar
- [ ] Desktop: header con 5 elementos (Company + Título + 3 iconos + UserDropdown)
- [ ] Tablet: header con 3 elementos (Company + Título + Notifications + UserDropdown)
- [ ] Mobile: header con 3 elementos (Menu + Título + UserDropdown avatar)
- [ ] CompanySelector accesible en mobile (dentro del drawer)
- [ ] Dropdown items navegan correctamente
- [ ] Logout funciona y redirige a login
- [ ] WCAG AA: contraste, focus states, keyboard nav
- [ ] Sin regresiones en navegación existente

---

## 📚 Referencias

- **Sistema de diseño**: ui-ux-pro-max → "Enterprise Gateway" pattern
- **Componentes shadcn/ui**: DropdownMenu, Avatar, Button
- **Patrón responsive**: Progressive disclosure, mobile-first
- **Accesibilidad**: WCAG 2.1 AA, WAI-ARIA Authoring Practices

---

**Estado:** ✅ Diseño aprobado — esperando green light para implementación
