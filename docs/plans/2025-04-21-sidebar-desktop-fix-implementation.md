# Sidebar Desktop Fix - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix sidebar en Desktop para que sea expandible por usuario, estilo integrado (no flotante), y muestre el logo SVG correctamente.

**Architecture:** Modificar AppSidebar.tsx para comportarse como sidebar integrado, no flotante. En Desktop: sidebar fijo al borde, expandible por usuario, mostrar logo SVG. Modificar AppLayout.tsx para calcular el margin correcto para sidebar integrado.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide React

---

### Task 1: Importar Logo SVG en AppSidebar

**Files:**
- Modify: `pacta_appweb/src/components/layout/AppSidebar.tsx:1-30`

**Step 1: Agregar import del logo SVG**

```tsx
import contractIconSvg from '@/images/contract_icon.svg?react';
```

Necesitamos verificar que Vite mendukung SVGs como componentes React. El import con `?react` sollte funcionar.

**Step 2: Commit**

---

### Task 2: Modificar Logo Rendering en AppSidebar

**Files:**
- Modify: `pacta_appweb/src/components/layout/AppSidebar.tsx:238-268`

**Step 1: Reemplazar renderizado de logo**

El logo actual en líneas 248-257 usa `FileText` como icono cuando está contraído. Reemplazar con:

```tsx
{!collapsed ? (
  <div className="min-w-0 flex items-center gap-2">
    <img src={contractIconSvg} alt="PACTA" className="h-8 w-8" />
    <div>
      <h1 className="text-xl font-bold text-primary">PACTA</h1>
      <p className="text-xs text-muted-foreground truncate">Contract Management</p>
    </div>
  </div>
) : (
  <img src={contractIconSvg} alt="PACTA" className="h-10 w-10" />
)}
```

**Step 2: Commit**

---

### Task 3: Hacer Botón Toggle Siempre Visible

**Files:**
- Modify: `pacta_appweb/src/components/layout/AppSidebar.tsx:258-269`

**Step 1: Modificar estilos del botón toggle**

El botón actual tiene `collapsed && 'hidden'` que lo oculta cuando está contraído. Cambiar a:

```tsx
<button
  onClick={() => handleCollapsedChange(!collapsed)}
  className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
>
```

**Step 2: Commit**

---

### Task 4: Cambiar Estilo de Flotante a Integrado

**Files:**
- Modify: `pacta_appweb/src/components/layout/AppSidebar.tsx:238-245`

**Step 1: Cambiar estilos del contenedor**

El sidebar actual usa `fixed left-4 top-4 bottom-4` con glassmorphism. Cambiar a:

```tsx
<div
  className={cn(
    'flex flex-col border-r bg-background transition-all duration-300',
    collapsed ? 'w-20' : 'w-64'
  )}
>
```

**Step 2: Commit**

---

### Task 5: Modificar AppLayout para Sidebar Integrado

**Files:**
- Modify: `pacta_appweb/src/components/layout/AppLayout.tsx:108-118`

**Step 1: Eliminar el marginLeft que era para sidebar flotante**

El código actual:
```tsx
style={{ marginLeft: isMobile ? 0 : (sidebarCollapsed ? 80 : 256) }}
```

Para sidebar integrado, NO se necesita marginLeft porque el sidebar ya forma parte del flujo del layout. Pero el layout usa flexbox:
```tsx
<div className="flex h-screen overflow-hidden">
  <AppSidebar ... />
  <div className="flex-1 flex flex-col overflow-hidden">
```

**Step 2: Eliminar el style={{ marginLeft: ... }}**

Cambiar a:
```tsx
<AppSidebar 
  device={device} 
  collapsed={sidebarCollapsed} 
  onCollapsedChange={setSidebarCollapsed}
  mobileMenuOpen={mobileMenuOpen}
  onMobileMenuClose={() => setMobileMenuOpen(false)}
/>
<div className="flex-1 flex flex-col overflow-hidden">
```

**Step 3: Commit**

---

### Task 6: Testing Manual

**Files:**
- Test: Abrir en browser la app

**Step 1: Verificar Desktop**
- Abrir browser en `/dashboard`
- Sidebar debe estar fijo al borde izquierdo (no flotante)
- Logo SVG visible siempre
- Botón para colapsar/expandir funcional
- Al hacer click en botón, sidebar colapsa/expande

**Step 2: Commit si todo funciona**

---

## Opciones de Ejecución

**1. Subagent-Driven (this session)** - Fresh subagent per task, review between tasks

**2. Parallel Session (separate)** - Open new session with executing-plans

**3. Plan-to-Issues (team workflow)** - Convert to GitHub issues

**Which approach?**