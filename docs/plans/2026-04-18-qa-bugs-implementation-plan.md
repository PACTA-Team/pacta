# QA Bugs Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Arreglar 6 bugs reportados por usuarios QA: pantallas en blanco en desktop, opciones de Settings amontonadas en móvil, sesión de notificaciones/temas/traducción perdida, traducciones en minúsculas, tradiciones faltantes, y toggle de email verification no funciona.

**Architecture:** 6 fixes independientes que se pueden implementar en paralelo.Cambios menores en archivos existentes. No se requieren nuevas dependencias.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, i18next

---

## Task 1: Fix de pantallas en blanco en desktop

### Causa raíz
El estado `device` se detecta en useEffect después del primer render, causando condición de carrera con el render del sidebar.

### Files a modificar:
- Modify: `pacta_appweb/src/components/layout/AppLayout.tsx:41-60`

### Paso 1: Implementar detección de tamaño inicial antes del render

Reemplazar la inicialización del estado `device`:

```typescript
// REEMPLAZAR líneas 41-60 con:
const getInitialDevice = (): 'desktop' | 'tablet' | 'mobile' => {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth <= MOBILE_BREAKPOINT) return 'mobile';
  if (window.innerWidth <= TABLET_BREAKPOINT) return 'tablet';
  return 'desktop';
};

const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>(getInitialDevice);
const [sidebarCollapsed, setSidebarCollapsed] = useState(device !== 'desktop');

useEffect(() => {
  const handleResize = () => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      setDevice('mobile');
      setSidebarCollapsed(true);
    } else if (window.innerWidth <= TABLET_BREAKPOINT) {
      setDevice('tablet');
      setSidebarCollapsed(true);
    } else {
      setDevice('desktop');
      setSidebarCollapsed(false);
    }
  };
  handleResize();
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### Paso 2: Verificar que compila

```bash
npm run build
```

Expected: Build sin errores

---

## Task 2: Fix de opciones de Settings amontonadas en móvil

### Causa raíz
`grid-cols-6` fuerza 6 columnas, causando stacking en pantallas pequeñas.

### Files a modificar:
- Modify: `pacta_appweb/src/pages/SettingsPage.tsx:100`

### Paso 1: Reemplazar grid con flex responsivo

```typescript
// REEMPLAZAR línea 100:
<TabsList className="flex w-full overflow-x-auto gap-1">
```

### Paso 2: Agregar estilos adicionales para las tabs

```typescript
// Las TabsTrigger también necesitan ajuste:
<TabsTrigger 
  value="smtp"
  className="flex-shrink-0 px-3 py-1.5 text-sm"
>
```

### Paso 3: Verificar compilación

```bash
npm run build
```

---

## Task 3: Mover componentes al UserDropdown en móvil

### Causa raíz
ThemeToggle, LanguageToggle, y NotificationsDropdown tienen `hidden md:flex` y no son accesibles en móvil.

### Files a modificar:
- Modify: `pacta_appweb/src/components/header/UserDropdown.tsx`
- Modify: `pacta_appweb/src/components/layout/AppLayout.tsx:134-143`

### Paso 1: Agregar estados para los menús en UserDropdown

```typescript
// EN UserDropdown.tsx, agregar después de los imports:
import { Bell, Sun, Moon, Globe } from 'lucide-react';
import { useTheme } from 'next-themes';

// Agregar estados:
const { theme, setTheme } = useTheme();
const [lang, setLang] = useState('es');
```

### Paso 2: Agregar items de menú para móvil en UserDropdown

```typescript
// AGREGAR después de línea 103 (DropdownMenuSeparator):
<DropdownMenuSeparator />

<DropdownMenuItem className="cursor-pointer">
  <Bell className="h-4 w-4 mr-2" />
  <span>{t("notifications")}</span>
</DropdownMenuItem>

<DropdownMenuItem 
  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
  className="cursor-pointer"
>
  {theme === 'dark' ? (
    <Sun className="h-4 w-4 mr-2" />
  ) : (
    <Moon className="h-4 w-4 mr-2" />
  )}
  <span>{t("toggleTheme")}</span>
</DropdownMenuItem>

<DropdownMenuItem className="cursor-pointer">
  <Globe className="h-4 w-4 mr-2" />
  <span>{t("changeLanguage")}</span>
</DropdownMenuItem>
```

### Paso 3: Agregar traducciones faltantes

```typescript
// EN es/common.json AGREGAR:
"toggleTheme": "Cambiar tema",
"changeLanguage": "Cambiar idioma"

// EN en/common.json AGREGAR:
"toggleTheme": "Toggle theme",
"changeLanguage": "Change language"
```

---

## Task 4: Fix de capitalización en traducciones

### Causa raíz
Valores en archivos JSON están en minúsculas sin capitalize CSS.

### Files a modificar:
- Modify: `pacta_appweb/src/pages/SettingsPage.tsx` (labels)
- Modify: `pacta_appweb/public/locales/es/settings.json`

### Paso 1: Aplicar capitalize CSS a los Labels

```typescript
// En SettingsPage.tsx, agregar className="capitalize" a los Labels que usan t():
<Label className="capitalize" htmlFor={key}>
  {LABELS.smtp[key]}
</Label>
```

Opcional: Corregir manualmente en el JSON:

```json
// EN es/settings.json - cambiar todos los títulos a Title Case:
// "title": "Configuración del Sistema" (ya está correcto)
// "smtpTitle": "Configuración SMTP" (ya está correcto)
```

---

## Task 5: Agregar traducciones faltantes a common.json

### Causa raíz
"settings" y "users" no existen en common.json pero UserDropdown los usa.

### Files a modificar:
- Modify: `pacta_appweb/public/locales/es/common.json`
- Modify: `pacta_appweb/public/locales/en/common.json`

### Paso 1: Agregar a es/common.json

```json
// AGREGAR después de línea 38:
"settings": "Configuración",
"users": "Usuarios",
```

### Paso 2: Agregar a en/common.json

```json
// AGREGAR después de línea对应:
"settings": "Settings",
"users": "Users",
```

---

## Task 6: Agregar toggle de email_verification en Settings

### Causa raíz
No hay opción en la UI para deshabilitar el inicio de sesión por verificación de correo.

### Files a modificar:
- Modify: `pacta_appweb/src/pages/SettingsPage/EmailSettingsTab.tsx`
- Modify: `pacta_appweb/public/locales/es/settings.json`
- Modify: `pacta_appweb/public/locales/en/settings.json`

### Paso 1: Agregar nuevo setting al EmailSettingsTab

```typescript
// EN EmailSettingsTab.tsx, AGREGAR después de línea 17:
"email_verification_required",
```

### Paso 2: Agregar nuevo toggle

```typescript
// AGREGAR después de línea 146 (después del toggle de brevo_enabled):
<div className="flex items-center justify-between">
  <div>
    <Label>{t("email_verification_required")}</Label>
    <p className="text-xs text-muted-foreground">
      {t("email_verification_requiredTooltip")}
    </p>
  </div>
  <Switch
    checked={settings.email_verification_required === "true"}
    onCheckedChange={(checked) =>
      handleToggle("email_verification_required", checked)
    }
    disabled={saving}
  />
</div>
```

### Paso 3: Agregar traducciones

```json
// EN es/settings.json AGREGAR:
"email_verification_required": "Verificación de correo requerida",
"email_verification_requiredTooltip": "Requerir verificación de correo antes del primer inicio de sesión"

// EN en/settings.json AGREGAR:
"email_verification_required": "Email verification required",
"email_verification_requiredTooltip": "Require email verification before first login"
```

---

## Checklist de Testing

Después de implementar todos los fixes:

1. ✅ Verificar desktop carga sin pantalla en blanco
2. ✅ Verificar móvil muestra tabs de Settings correctamente
3. ✅ Verificar Theme/Language/Notifications accesibles en móvil
4. ✅ Verificar traducciones aparecen capitalizadas
5. ✅ Verificar "settings" y "users" se traducen correctamente
6. ✅ Verificar toggle de email_verification funciona

---

## Orden de Implementación Recomendada

1. Task 5 (traducciones) - más simple, necesario para otros tasks
2. Task 4 (capitalización) - cambio simple
3. Task 1 (blank page) - crítico 
4. Task 2 (Settings mobile) - UX
5. Task 3 (componentes ocultos) - funcionalidad
6. Task 6 (email verification) - más complejo

---

## Ejecución

**Opción 1: Subagent-Driven (esta sesión)** - Dispachar un subagent por task, revisar entre tasks

**Opción 2: Parallel Session (separada)** - Abrir nueva sesión para ejecución en batch

**Opción 3: Plan-to-Issues** - Convertir a GitHub issues para el equipo

**¿Qué enfoque prefieres?**