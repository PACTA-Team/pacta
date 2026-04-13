# i18n Language Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic language detection (es/en) and full app internationalization using react-i18next.

**Architecture:** Install i18next ecosystem packages, configure browser language detection with localStorage persistence, create namespaced translation JSON files (Spanish extracted from existing code, English translated), wrap all 38 components with useTranslation() hooks, add LanguageToggle component mirroring ThemeToggle pattern, update html lang attribute dynamically.

**Tech Stack:** i18next ^24.x, react-i18next ^15.x, i18next-browser-languagedetector ^8.x, React 19, TypeScript, Vite

---

## Phase 1: Infrastructure Setup

### Task 1: Install i18n Dependencies

**Files:**
- Modify: `pacta_appweb/package.json` (dependencies)

**Step 1: Install packages**

Run from `pacta_appweb/`:

```bash
cd /home/mowgli/pacta/pacta_appweb
npm install i18next react-i18next i18next-browser-languagedetector
```

**Step 2: Verify installation**

Run: `npm ls i18next react-i18next i18next-browser-languagedetector`
Expected: All three packages listed with no errors.

**Step 3: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/package.json pacta_appweb/package-lock.json
git commit -m "feat: add i18next dependencies for language detection"
```

---

### Task 2: Create i18n Configuration

**Files:**
- Create: `pacta_appweb/src/i18n/index.ts`
- Create: `pacta_appweb/src/i18n/detector.ts` (optional, for custom detection config)

**Step 1: Create i18n config**

Create `pacta_appweb/src/i18n/index.ts`:

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: {},
        landing: {},
        login: {},
        setup: {},
        contracts: {},
        clients: {},
        suppliers: {},
        supplements: {},
        reports: {},
        settings: {},
        documents: {},
        notifications: {},
        signers: {},
        companies: {},
        pending: {},
        dashboard: {},
      },
      es: {
        common: {},
        landing: {},
        login: {},
        setup: {},
        contracts: {},
        clients: {},
        suppliers: {},
        supplements: {},
        reports: {},
        settings: {},
        documents: {},
        notifications: {},
        signers: {},
        companies: {},
        pending: {},
        dashboard: {},
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'es'],
    ns: ['common', 'landing', 'login', 'setup', 'contracts', 'clients', 'suppliers', 'supplements', 'reports', 'settings', 'documents', 'notifications', 'signers', 'companies', 'pending', 'dashboard'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'pacta-language',
    },
    react: {
      useSuspense: false,
    },
  });

// Detect Spanish from navigator.language on first visit
const detected = i18n.language;
if (!detected || detected === 'en') {
  const browserLang = navigator.language;
  if (browserLang.startsWith('es')) {
    i18n.changeLanguage('es');
  }
}

export default i18n;
```

**Step 2: Import in main.tsx**

Modify `pacta_appweb/src/main.tsx` — add `import './i18n';` at the top (before any other imports):

```typescript
import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
// ... rest unchanged
```

**Step 3: Verify build**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm run build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/i18n/index.ts pacta_appweb/src/main.tsx
git commit -m "feat: configure i18next with browser language detection"
```

---

### Task 3: Create LanguageToggle Component

**Files:**
- Create: `pacta_appweb/src/components/LanguageToggle.tsx`

**Step 1: Create component**

Create `pacta_appweb/src/components/LanguageToggle.tsx` mirroring the ThemeToggle pattern:

```typescript
"use client";

import * as React from "react";
import { Languages } from "lucide-react";
import { useTranslation } from 'react-i18next';

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageToggle() {
  const { i18n } = useTranslation();

  const toggleLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('pacta-language', lang);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Language">
          <Languages className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => toggleLanguage('en')}>
          English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toggleLanguage('es')}>
          Español
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/components/LanguageToggle.tsx
git commit -m "feat: add LanguageToggle component"
```

---

### Task 4: Integrate LanguageToggle into AppLayout and LandingNavbar

**Files:**
- Modify: `pacta_appweb/src/components/layout/AppLayout.tsx` (line ~67)
- Modify: `pacta_appweb/src/components/landing/LandingNavbar.tsx` (lines ~33, ~67)

**Step 1: Add to AppLayout**

In `AppLayout.tsx`, add import and place toggle next to ThemeToggle:

```tsx
import { LanguageToggle } from './LanguageToggle';

// In the header, around line 67:
<header role="banner" className="border-b bg-card px-6 py-4 flex items-center justify-between">
  <h1 className="text-xl font-semibold">
    {pathname.startsWith('/contracts/') ? 'Contract Details' : (PAGE_TITLES[pathname] || '')}
  </h1>
  <div className="flex items-center gap-2">
    <LanguageToggle />
    <ThemeToggle />
  </div>
</header>
```

**Step 2: Add to LandingNavbar**

In `LandingNavbar.tsx`, add import and place toggle in desktop and mobile nav:

```tsx
import { LanguageToggle } from './LanguageToggle';

// Desktop nav (around line 33):
<div className="hidden items-center gap-4 md:flex">
  {navLinks.map((link) => (...))}
  <LanguageToggle />
  <Button onClick={() => navigate('/login')} size="sm">
    Login
  </Button>
</div>

// Mobile nav (around line 67):
<div className="flex flex-col gap-4 px-6 py-6">
  {navLinks.map((link) => (...))}
  <div className="flex items-center justify-between">
    <LanguageToggle />
  </div>
  <Button onClick={() => navigate('/login')} className="w-full">
    Login
  </Button>
</div>
```

**Step 3: Verify build**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/components/layout/AppLayout.tsx pacta_appweb/src/components/landing/LandingNavbar.tsx
git commit -m "feat: integrate LanguageToggle into app layout and landing navbar"
```

---

### Task 5: Dynamic HTML lang Attribute

**Files:**
- Modify: `pacta_appweb/src/App.tsx` (add useEffect for document.lang)

**Step 1: Add lang attribute sync**

In `App.tsx`, add a useEffect that syncs the html lang attribute:

```tsx
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Inside App component, before return:
const { i18n } = useTranslation();

useEffect(() => {
  document.documentElement.lang = i18n.language || 'en';
}, [i18n.language]);
```

**Step 2: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/App.tsx
git commit -m "feat: sync html lang attribute with i18n language"
```

---

## Phase 2: Translation Files (Spanish First)

### Task 6: Create Spanish Translation Files

**Files:**
- Create: `pacta_appweb/public/locales/es/common.json`
- Create: `pacta_appweb/public/locales/es/landing.json`
- Create: `pacta_appweb/public/locales/es/login.json`
- Create: `pacta_appweb/public/locales/es/setup.json`
- Create: `pacta_appweb/public/locales/es/contracts.json`
- Create: `pacta_appweb/public/locales/es/clients.json`
- Create: `pacta_appweb/public/locales/es/suppliers.json`
- Create: `pacta_appweb/public/locales/es/supplements.json`
- Create: `pacta_appweb/public/locales/es/reports.json`
- Create: `pacta_appweb/public/locales/es/settings.json`
- Create: `pacta_appweb/public/locales/es/documents.json`
- Create: `pacta_appweb/public/locales/es/notifications.json`
- Create: `pacta_appweb/public/locales/es/signers.json`
- Create: `pacta_appweb/public/locales/es/companies.json`
- Create: `pacta_appweb/public/locales/es/pending.json`
- Create: `pacta_appweb/public/locales/es/dashboard.json`

**Step 1: Create all Spanish translation files**

Create each file with the Spanish strings extracted from the existing codebase. See the translation key mappings below for each namespace.

**common.json** (from AppLayout, AppSidebar, NotFoundPage, ForbiddenPage, App.tsx):

```json
{
  "loading": "Cargando...",
  "loadingPage": "Cargando página...",
  "skipToMain": "Ir al contenido principal",
  "logout": "Cerrar sesión",
  "role": "Rol",
  "goHome": "Ir al inicio",
  "goBack": "Volver",
  "needHelp": "¿Necesitas ayuda?",
  "contactSupport": "Contactar soporte",
  "notFound": "Página no encontrada",
  "notFoundDesc": "La página que buscas no existe o ha sido movida.",
  "accessDenied": "Acceso denegado",
  "setupCompleted": "La configuración ya ha sido completada.",
  "goToHome": "Ir al inicio",
  "login": "Iniciar sesión",
  "cancel": "Cancelar",
  "save": "Guardar",
  "delete": "Eliminar",
  "edit": "Editar",
  "create": "Crear",
  "back": "Volver",
  "next": "Siguiente",
  "search": "Buscar...",
  "noResults": "No se encontraron resultados",
  "areYouSure": "¿Estás seguro?",
  "actionCannotBeUndone": "Esta acción no se puede deshacer.",
  "confirmDelete": "Confirmar eliminación",
  "success": "Éxito",
  "error": "Error",
  "close": "Cerrar",
  "selectCompany": "Seleccionar empresa"
}
```

**landing.json** (from HeroSection, FeaturesSection, LandingNavbar):

```json
{
  "hero": {
    "title": "Sistema de Gestión de Contratos",
    "subtitle": "Gestiona tus contratos con claridad",
    "description": "Realiza seguimiento, aprueba y monitorea todos tus contratos desde un solo lugar.",
    "benefit": "Nunca más pierdas una renovación.",
    "startNow": "Comenzar ahora",
    "learnMore": "Saber más"
  },
  "features": {
    "title": "Funcionalidades",
    "subtitle": "Todo lo que necesitas para mantener el control",
    "description": "PACTA te ofrece las herramientas para gestionar contratos de forma segura y eficiente.",
    "items": [
      {
        "title": "Gestión Completa",
        "description": "Crea, edita y organiza todos tus contratos con seguimiento de versiones y estados."
      },
      {
        "title": "Flujos de Aprobación",
        "description": "Procesos de aprobación estructurados para suplementos y modificaciones contractuales."
      },
      {
        "title": "Alertas Automáticas",
        "description": "Notificaciones automáticas para contratos por vencer y renovaciones próximas."
      }
    ],
    "learnMore": "Saber más"
  },
  "nav": {
    "features": "Funcionalidades",
    "login": "Iniciar sesión"
  }
}
```

**login.json** (from LoginForm, LoginPage):

```json
{
  "createAccount": "Crear cuenta",
  "title": "PACTA Web",
  "subtitle": "Sistema de Gestión de Contratos",
  "setupDesc": "Configura tu cuenta de administrador principal.",
  "fullName": "Nombre completo",
  "email": "Correo electrónico",
  "password": "Contraseña",
  "register": "Registrar",
  "backToLogin": "Volver al inicio de sesión",
  "loginTitle": "Iniciar sesión",
  "loginBtn": "Entrar",
  "loginError": "Error al iniciar sesión. Verifica tus credenciales.",
  "registerSuccess": "Cuenta creada exitosamente. Ahora puedes iniciar sesión.",
  "registerError": "Error al crear la cuenta. Inténtalo de nuevo.",
  "fullNamePlaceholder": "Tu nombre",
  "emailPlaceholder": "tu@correo.com",
  "passwordPlaceholder": "Tu contraseña"
}
```

**setup.json** (from SetupWizard, SetupModeSelector, StepWelcome, StepCompany, StepAdmin, StepClient, StepSupplier, StepReview):

```json
{
  "checkingStatus": "Verificando configuración...",
  "modeSelector": {
    "title": "¿Cómo usará PACTA?",
    "subtitle": "Seleccione el modo de operación que mejor se adapte a su organización.",
    "singleCompany": "Empresa Individual",
    "singleCompanyDesc": "Una sola empresa con clientes, proveedores y contratos.",
    "multiCompany": "Multiempresa",
    "multiCompanyDesc": "Empresa matriz con subsidiarias y datos aislados por empresa.",
    "changeToMulti": "Cambiar a Multiempresa",
    "changeToSingle": "Cambiar a Empresa Individual"
  },
  "welcome": {
    "title": "Bienvenido a PACTA",
    "subtitle": "Vamos a configurar tu sistema de gestión de contratos.",
    "description": "Te ayudaremos a configurar:",
    "bullets": [
      "Tu empresa y datos principales",
      "Tu cuenta de administrador",
      "Tu primer cliente y proveedor (opcional)"
    ],
    "privacy": "Todos los datos se almacenan localmente en tu máquina.",
    "getStarted": "Comenzar"
  },
  "company": {
    "title": "Datos de la Empresa",
    "name": "Nombre de la empresa",
    "namePlaceholder": "Mi Empresa S.A.",
    "taxId": "RUT / NIF / Tax ID",
    "taxIdPlaceholder": "12.345.678-9",
    "address": "Dirección",
    "addressPlaceholder": "Calle Principal 123",
    "city": "Ciudad",
    "cityPlaceholder": "Santiago",
    "country": "País",
    "countryPlaceholder": "Chile"
  },
  "admin": {
    "title": "Cuenta de Administrador",
    "subtitle": "Crea la cuenta del administrador principal del sistema.",
    "name": "Nombre completo",
    "namePlaceholder": "Admin PACTA",
    "email": "Correo electrónico",
    "emailPlaceholder": "admin@empresa.com",
    "password": "Contraseña",
    "passwordPlaceholder": "Mínimo 8 caracteres",
    "weak": "Débil",
    "fair": "Regular",
    "good": "Buena",
    "strong": "Fuerte"
  },
  "client": {
    "title": "Primer Cliente",
    "subtitle": "Agrega tu cliente principal (opcional).",
    "name": "Nombre del cliente",
    "namePlaceholder": "Cliente Principal S.A.",
    "taxId": "RUT / NIF",
    "taxIdPlaceholder": "12.345.678-9",
    "email": "Correo electrónico",
    "emailPlaceholder": "contacto@cliente.com",
    "phone": "Teléfono",
    "phonePlaceholder": "+56 9 1234 5678"
  },
  "supplier": {
    "title": "Primer Proveedor",
    "subtitle": "Agrega tu proveedor principal (opcional).",
    "name": "Nombre del proveedor",
    "namePlaceholder": "Proveedor Principal Ltda.",
    "taxId": "RUT / NIF",
    "taxIdPlaceholder": "12.345.678-9",
    "email": "Correo electrónico",
    "emailPlaceholder": "contacto@proveedor.com",
    "phone": "Teléfono",
    "phonePlaceholder": "+56 9 1234 5678"
  },
  "review": {
    "title": "Revisar y Completar",
    "subtitle": "Verifica tu configuración antes de finalizar.",
    "company": "Empresa",
    "admin": "Administrador",
    "client": "Cliente",
    "supplier": "Proveedor",
    "singleCompany": "Empresa Individual",
    "multiCompany": "Multiempresa",
    "completeSetup": "Completar Configuración",
    "settingUp": "Configurando..."
  }
}
```

**contracts.json** (from ContractsPage, ContractForm, ContractDetailsPage):

```json
{
  "title": "Contratos",
  "searchPlaceholder": "Buscar contratos...",
  "createNew": "Crear nuevo contrato",
  "newContract": "Nuevo contrato",
  "editContract": "Editar contrato",
  "createContract": "Crear contrato",
  "updateContract": "Actualizar contrato",
  "notFound": "Contrato no encontrado",
  "backToList": "Volver a contratos",
  "generalInfo": "Información General",
  "noDescription": "Sin descripción",
  "supplements": "Suplementos asociados",
  "noSupplements": "No se encontraron suplementos",
  "documents": "Repositorio de documentos",
  "noDocuments": "No hay documentos subidos",
  "uploadDocument": "Subir documento",
  "auditTrail": "Registro de auditoría",
  "noAuditLogs": "No se encontraron registros de auditoría",
  "addSupplement": "Agregar suplemento",
  "generateReport": "Generar reporte",
  "edit": "Editar contrato",
  "noContracts": "No se encontraron contratos",
  "deleteConfirm": "¿Estás seguro de eliminar este contrato?",
  "deleteSuccess": "Contrato eliminado exitosamente",
  "createSuccess": "Contrato creado exitosamente",
  "updateSuccess": "Contrato actualizado exitosamente",
  "client": "Cliente",
  "supplier": "Proveedor",
  "status": "Estado",
  "type": "Tipo",
  "amount": "Monto",
  "startDate": "Fecha inicio",
  "endDate": "Fecha fin",
  "description": "Descripción",
  "effectiveDate": "Fecha de vigencia",
  "createdAt": "Creado el",
  "active": "Activo",
  "expired": "Vencido",
  "pending": "Pendiente",
  "cancelled": "Cancelado",
  "draft": "Borrador",
  "approved": "Aprobado",
  "service": "Servicio",
  "purchase": "Compra",
  "lease": "Arriendo",
  "employment": "Empleo",
  "nda": "NDA",
  "other": "Otro"
}
```

**clients.json** (from ClientsPage, ClientForm):

```json
{
  "title": "Clientes",
  "searchPlaceholder": "Buscar clientes...",
  "addNew": "Agregar nuevo cliente",
  "editClient": "Editar cliente",
  "addClient": "Agregar cliente",
  "updateClient": "Actualizar cliente",
  "createClient": "Crear cliente",
  "noClients": "No se encontraron clientes",
  "deleteConfirm": "¿Estás seguro de eliminar este cliente?",
  "clientDetails": "Detalles del cliente",
  "noDocument": "Sin documento",
  "officialDocument": "Documento oficial",
  "viewDocument": "Ver documento",
  "name": "Nombre",
  "taxId": "RUT / NIF",
  "email": "Correo electrónico",
  "phone": "Teléfono",
  "address": "Dirección",
  "createSuccess": "Cliente creado exitosamente",
  "updateSuccess": "Cliente actualizado exitosamente",
  "uploadClick": "Clic para subir documento",
  "uploading": "Subiendo..."
}
```

**suppliers.json** (from SuppliersPage, SupplierForm):

```json
{
  "title": "Proveedores",
  "searchPlaceholder": "Buscar proveedores...",
  "addNew": "Agregar nuevo proveedor",
  "editSupplier": "Editar proveedor",
  "addSupplier": "Agregar proveedor",
  "updateSupplier": "Actualizar proveedor",
  "createSupplier": "Crear proveedor",
  "noSuppliers": "No se encontraron proveedores",
  "deleteConfirm": "¿Estás seguro de eliminar este proveedor?",
  "supplierDetails": "Detalles del proveedor",
  "noDocument": "Sin documento",
  "officialDocument": "Documento oficial",
  "viewDocument": "Ver documento",
  "name": "Nombre",
  "taxId": "RUT / NIF",
  "email": "Correo electrónico",
  "phone": "Teléfono",
  "address": "Dirección",
  "createSuccess": "Proveedor creado exitosamente",
  "updateSuccess": "Proveedor actualizado exitosamente",
  "uploadClick": "Clic para subir documento",
  "uploading": "Subiendo..."
}
```

**supplements.json** (from SupplementsPage, SupplementForm):

```json
{
  "title": "Suplementos",
  "subtitle": "Gestiona los suplementos de contratos",
  "addNew": "Agregar suplemento",
  "editSupplement": "Editar suplemento",
  "addSupplement": "Agregar suplemento",
  "updateSupplement": "Actualizar suplemento",
  "createSupplement": "Crear suplemento",
  "noSupplements": "No se encontraron suplementos",
  "loading": "Cargando suplementos...",
  "retry": "Reintentar",
  "contract": "Contrato",
  "type": "Tipo",
  "status": "Estado",
  "effectiveDate": "Fecha de vigencia",
  "description": "Descripción"
}
```

**reports.json** (from ReportsPage, ReportFilters, ExportButtons):

```json
{
  "title": "Reportes",
  "subtitle": "Genera reportes y análisis de contratos",
  "hideFilters": "Ocultar filtros",
  "showFilters": "Mostrar filtros",
  "savedPresets": "Filtros guardados",
  "savePreset": "Guardar filtro",
  "filters": {
    "title": "Filtros del reporte",
    "fromDate": "Desde",
    "toDate": "Hasta",
    "status": "Estado",
    "allStatus": "Todos los estados",
    "contractType": "Tipo de contrato",
    "allTypes": "Todos los tipos",
    "client": "Cliente",
    "supplier": "Proveedor",
    "minAmount": "Monto mínimo",
    "maxAmount": "Monto máximo",
    "apply": "Aplicar filtros",
    "reset": "Restablecer",
    "save": "Guardar",
    "cancel": "Cancelar"
  },
  "export": {
    "title": "Exportar",
    "pdf": "Exportar como PDF",
    "excel": "Exportar como Excel",
    "csv": "Exportar como CSV"
  },
  "types": {
    "contracts": "Contratos",
    "financial": "Financiero",
    "clientSupplier": "Clientes y Proveedores",
    "status": "Estado de contratos",
    "expirations": "Vencimientos",
    "supplements": "Suplementos",
    "modifications": "Modificaciones"
  }
}
```

**settings.json** (from UsersPage):

```json
{
  "title": "Usuarios",
  "subtitle": "Gestiona usuarios y sus roles",
  "addNew": "Agregar nuevo usuario",
  "editUser": "Editar usuario",
  "addUser": "Agregar usuario",
  "updateUser": "Actualizar usuario",
  "createUser": "Crear usuario",
  "resetPassword": "Restablecer contraseña",
  "newPassword": "Nueva contraseña",
  "noUsers": "No se encontraron usuarios",
  "loading": "Cargando usuarios...",
  "rolePermissions": "Matriz de permisos por rol",
  "role": "Rol",
  "admin": "Administrador",
  "manager": "Gerente",
  "editor": "Editor",
  "viewer": "Visor",
  "active": "Activo",
  "inactive": "Inactivo",
  "pending": "Pendiente",
  "name": "Nombre",
  "email": "Correo electrónico",
  "status": "Estado",
  "permissions": {
    "contracts": "Contratos",
    "parties": "Partes",
    "reports": "Reportes",
    "users": "Usuarios",
    "settings": "Configuración"
  }
}
```

**documents.json** (from DocumentsPage):

```json
{
  "title": "Documentos",
  "searchPlaceholder": "Buscar documentos...",
  "upload": "Subir documento",
  "uploading": "Subiendo...",
  "selectContract": "Selecciona un contrato",
  "selectContractDesc": "Debes seleccionar un contrato antes de subir documentos.",
  "repository": "Repositorio de documentos",
  "noDocuments": "No se encontraron documentos",
  "filename": "Nombre",
  "contract": "Contrato",
  "uploadedAt": "Subido el",
  "size": "Tamaño",
  "actions": "Acciones",
  "uploadSuccess": "Documento subido exitosamente",
  "uploadError": "Error al subir el documento",
  "deleteConfirm": "¿Estás seguro de eliminar este documento?"
}
```

**notifications.json** (from NotificationsPage):

```json
{
  "title": "Notificaciones",
  "unread": "notificación(es) sin leer",
  "markAllRead": "Marcar todas como leídas",
  "empty": "Aún no hay notificaciones",
  "loading": "Cargando notificaciones...",
  "viewContract": "Ver contrato",
  "markRead": "Marcar como leída",
  "read": "Leída",
  "unreadBadge": "Sin leer",
  "markedRead": "Notificación marcada como leída",
  "allMarkedRead": "Todas las notificaciones marcadas como leídas"
}
```

**signers.json** (from AuthorizedSignersPage, AuthorizedSignerForm):

```json
{
  "title": "Firmantes Autorizados",
  "searchPlaceholder": "Buscar firmantes...",
  "addNew": "Agregar firmante autorizado",
  "editSigner": "Editar firmante",
  "addSigner": "Agregar firmante",
  "updateSigner": "Actualizar firmante",
  "createSigner": "Crear firmante",
  "noSigners": "No se encontraron firmantes autorizados",
  "deleteConfirm": "¿Estás seguro de eliminar este firmante?",
  "signerDetails": "Detalles del firmante",
  "noDocument": "Sin documento",
  "authDocument": "Documento de autorización",
  "viewDocument": "Ver documento",
  "name": "Nombre",
  "role": "Cargo",
  "email": "Correo electrónico",
  "phone": "Teléfono",
  "rut": "RUT",
  "createSuccess": "Firmante creado exitosamente",
  "updateSuccess": "Firmante actualizado exitosamente"
}
```

**companies.json** (from CompaniesPage):

```json
{
  "title": "Empresas",
  "addNew": "Agregar empresa",
  "directory": "Directorio de empresas",
  "searchPlaceholder": "Buscar empresas...",
  "noCompanies": "No se encontraron empresas",
  "editCompany": "Editar empresa",
  "createCompany": "Crear empresa",
  "update": "Actualizar",
  "create": "Crear",
  "delete": "Eliminar empresa",
  "deleteConfirm": "¿Estás seguro de eliminar esta empresa?",
  "loading": "Cargando empresas...",
  "name": "Nombre",
  "taxId": "RUT / NIF",
  "type": "Tipo",
  "parent": "Matriz",
  "subsidiary": "Subsidiaria",
  "standalone": "Independiente"
}
```

**pending.json** (from PendingApprovalPage):

```json
{
  "title": "Esperando Aprobación del Administrador",
  "description": "Tu cuenta ha sido creada pero necesita aprobación del administrador antes de poder acceder al sistema.",
  "waitMessage": "Podrás iniciar sesión una vez que tu cuenta sea aprobada."
}
```

**dashboard.json** (from DashboardPage):

```json
{
  "title": "Panel de Control",
  "kpi": {
    "totalContracts": {
      "title": "Total Contratos",
      "desc": "Contratos activos"
    },
    "expiringSoon": {
      "title": "Por Vencer",
      "desc": "Próximos 30 días"
    },
    "activeParties": {
      "title": "Partes Activas",
      "desc": "Clientes y proveedores"
    },
    "pendingApproval": {
      "title": "Pendientes",
      "desc": "Esperando aprobación"
    }
  },
  "expiringTitle": "Contratos por Vencer",
  "daysLeft": "días restantes",
  "statusTitle": "Contratos por Estado",
  "noContracts": "No hay contratos para mostrar",
  "quickActions": "Acciones Rápidas",
  "newContract": "Nuevo contrato",
  "newClient": "Nuevo cliente",
  "newSupplier": "Nuevo proveedor",
  "viewReports": "Ver reportes",
  "manageUsers": "Gestionar usuarios",
  "settings": "Configuración"
}
```

**Step 2: Update i18n config to load from files**

Modify `pacta_appweb/src/i18n/index.ts` — replace the empty `resources: {}` with dynamic loading. Since this is a Vite static export, we'll import the JSON files directly:

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import Spanish translations
import esCommon from '../../public/locales/es/common.json';
import esLanding from '../../public/locales/es/landing.json';
import esLogin from '../../public/locales/es/login.json';
import esSetup from '../../public/locales/es/setup.json';
import esContracts from '../../public/locales/es/contracts.json';
import esClients from '../../public/locales/es/clients.json';
import esSuppliers from '../../public/locales/es/suppliers.json';
import esSupplements from '../../public/locales/es/supplements.json';
import esReports from '../../public/locales/es/reports.json';
import esSettings from '../../public/locales/es/settings.json';
import esDocuments from '../../public/locales/es/documents.json';
import esNotifications from '../../public/locales/es/notifications.json';
import esSigners from '../../public/locales/es/signers.json';
import esCompanies from '../../public/locales/es/companies.json';
import esPending from '../../public/locales/es/pending.json';
import esDashboard from '../../public/locales/es/dashboard.json';

// Import English translations (will be created in Task 7)
import enCommon from '../../public/locales/en/common.json';
import enLanding from '../../public/locales/en/landing.json';
import enLogin from '../../public/locales/en/login.json';
import enSetup from '../../public/locales/en/setup.json';
import enContracts from '../../public/locales/en/contracts.json';
import enClients from '../../public/locales/en/clients.json';
import enSuppliers from '../../public/locales/en/suppliers.json';
import enSupplements from '../../public/locales/en/supplements.json';
import enReports from '../../public/locales/en/reports.json';
import enSettings from '../../public/locales/en/settings.json';
import enDocuments from '../../public/locales/en/documents.json';
import enNotifications from '../../public/locales/en/notifications.json';
import enSigners from '../../public/locales/en/signers.json';
import enCompanies from '../../public/locales/en/companies.json';
import enPending from '../../public/locales/en/pending.json';
import enDashboard from '../../public/locales/en/dashboard.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: {
        common: esCommon,
        landing: esLanding,
        login: esLogin,
        setup: esSetup,
        contracts: esContracts,
        clients: esClients,
        suppliers: esSuppliers,
        supplements: esSupplements,
        reports: esReports,
        settings: esSettings,
        documents: esDocuments,
        notifications: esNotifications,
        signers: esSigners,
        companies: esCompanies,
        pending: esPending,
        dashboard: esDashboard,
      },
      en: {
        common: enCommon,
        landing: enLanding,
        login: enLogin,
        setup: enSetup,
        contracts: enContracts,
        clients: enClients,
        suppliers: enSuppliers,
        supplements: enSupplements,
        reports: enReports,
        settings: enSettings,
        documents: enDocuments,
        notifications: enNotifications,
        signers: enSigners,
        companies: enCompanies,
        pending: enPending,
        dashboard: enDashboard,
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'es'],
    ns: ['common', 'landing', 'login', 'setup', 'contracts', 'clients', 'suppliers', 'supplements', 'reports', 'settings', 'documents', 'notifications', 'signers', 'companies', 'pending', 'dashboard'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'pacta-language',
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
```

**Note:** The English imports will fail until Task 7 is complete. For now, create empty English JSON files as placeholders:

```bash
cd /home/mowgli/pacta/pacta_appweb
mkdir -p public/locales/en
for f in common landing login setup contracts clients suppliers supplements reports settings documents notifications signers companies pending dashboard; do
  echo '{}' > public/locales/en/$f.json
done
```

**Step 3: Verify build**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/public/locales/ pacta_appweb/src/i18n/index.ts
git commit -m "feat: add Spanish translation files and wire up i18n resources"
```

---

## Phase 3: Component Translation

### Task 7: Create English Translation Files

**Files:**
- Create: `pacta_appweb/public/locales/en/common.json`
- Create: `pacta_appweb/public/locales/en/landing.json`
- Create: `pacta_appweb/public/locales/en/login.json`
- Create: `pacta_appweb/public/locales/en/setup.json`
- Create: `pacta_appweb/public/locales/en/contracts.json`
- Create: `pacta_appweb/public/locales/en/clients.json`
- Create: `pacta_appweb/public/locales/en/suppliers.json`
- Create: `pacta_appweb/public/locales/en/supplements.json`
- Create: `pacta_appweb/public/locales/en/reports.json`
- Create: `pacta_appweb/public/locales/en/settings.json`
- Create: `pacta_appweb/public/locales/en/documents.json`
- Create: `pacta_appweb/public/locales/en/notifications.json`
- Create: `pacta_appweb/public/locales/en/signers.json`
- Create: `pacta_appweb/public/locales/en/companies.json`
- Create: `pacta_appweb/public/locales/en/pending.json`
- Create: `pacta_appweb/public/locales/en/dashboard.json`

**Step 1: Create all English translation files**

Create each file with English translations corresponding to the Spanish keys.

**common.json:**
```json
{
  "loading": "Loading...",
  "loadingPage": "Loading page...",
  "skipToMain": "Skip to main content",
  "logout": "Logout",
  "role": "Role",
  "goHome": "Go home",
  "goBack": "Go back",
  "needHelp": "Need help?",
  "contactSupport": "Contact support",
  "notFound": "Page not found",
  "notFoundDesc": "The page you're looking for doesn't exist or has been moved.",
  "accessDenied": "Access denied",
  "setupCompleted": "Setup has already been completed.",
  "goToHome": "Go to home",
  "login": "Login",
  "cancel": "Cancel",
  "save": "Save",
  "delete": "Delete",
  "edit": "Edit",
  "create": "Create",
  "back": "Back",
  "next": "Next",
  "search": "Search...",
  "noResults": "No results found",
  "areYouSure": "Are you sure?",
  "actionCannotBeUndone": "This action cannot be undone.",
  "confirmDelete": "Confirm deletion",
  "success": "Success",
  "error": "Error",
  "close": "Close",
  "selectCompany": "Select company"
}
```

**landing.json:**
```json
{
  "hero": {
    "title": "Contract Management System",
    "subtitle": "Manage Contracts with Clarity",
    "description": "Track, approve, and monitor all your contracts from one place.",
    "benefit": "Never miss a renewal again.",
    "startNow": "Start Now",
    "learnMore": "Learn More"
  },
  "features": {
    "title": "Features",
    "subtitle": "Everything you need to stay in control",
    "description": "PACTA gives you the tools to manage contracts securely and efficiently.",
    "items": [
      {
        "title": "Complete Management",
        "description": "Create, edit, and organize all your contracts with version tracking and status workflows."
      },
      {
        "title": "Approval Workflows",
        "description": "Structured approval processes for contract supplements and modifications."
      },
      {
        "title": "Automated Alerts",
        "description": "Automatic notifications for expiring contracts and upcoming renewals."
      }
    ],
    "learnMore": "Learn more"
  },
  "nav": {
    "features": "Features",
    "login": "Login"
  }
}
```

**login.json:**
```json
{
  "createAccount": "Create Account",
  "title": "PACTA Web",
  "subtitle": "Contract Management System",
  "setupDesc": "Set up your main admin account.",
  "fullName": "Full Name",
  "email": "Email",
  "password": "Password",
  "register": "Register",
  "backToLogin": "Back to Login",
  "loginTitle": "Login",
  "loginBtn": "Sign In",
  "loginError": "Login failed. Please check your credentials.",
  "registerSuccess": "Account created successfully. You can now log in.",
  "registerError": "Failed to create account. Please try again.",
  "fullNamePlaceholder": "Your name",
  "emailPlaceholder": "you@example.com",
  "passwordPlaceholder": "Your password"
}
```

**setup.json:**
```json
{
  "modeSelector": {
    "title": "How will you use PACTA?",
    "subtitle": "Select the operation mode that best fits your organization.",
    "singleCompany": "Single Company",
    "singleCompanyDesc": "One company with clients, suppliers, and contracts.",
    "multiCompany": "Multi-Company",
    "multiCompanyDesc": "Parent company with subsidiaries and isolated data per company.",
    "changeToMulti": "Switch to Multi-Company",
    "changeToSingle": "Switch to Single Company"
  },
  "welcome": {
    "title": "Welcome to PACTA",
    "subtitle": "Let's set up your contract management system.",
    "description": "We'll help you configure:",
    "bullets": [
      "Your company and main details",
      "Your admin account",
      "Your first client and supplier (optional)"
    ],
    "privacy": "All data stays local on your machine.",
    "getStarted": "Get Started"
  },
  "company": {
    "title": "Company Details",
    "name": "Company name",
    "namePlaceholder": "My Company Inc.",
    "taxId": "Tax ID",
    "taxIdPlaceholder": "12-3456789",
    "address": "Address",
    "addressPlaceholder": "123 Main Street",
    "city": "City",
    "cityPlaceholder": "New York",
    "country": "Country",
    "countryPlaceholder": "United States"
  },
  "admin": {
    "title": "Admin Account",
    "subtitle": "Create the main system administrator account.",
    "name": "Full name",
    "namePlaceholder": "PACTA Admin",
    "email": "Email",
    "emailPlaceholder": "admin@company.com",
    "password": "Password",
    "passwordPlaceholder": "Minimum 8 characters",
    "weak": "Weak",
    "fair": "Fair",
    "good": "Good",
    "strong": "Strong"
  },
  "client": {
    "title": "First Client",
    "subtitle": "Add your primary client (optional).",
    "name": "Client name",
    "namePlaceholder": "Primary Client Inc.",
    "taxId": "Tax ID",
    "taxIdPlaceholder": "12-3456789",
    "email": "Email",
    "emailPlaceholder": "contact@client.com",
    "phone": "Phone",
    "phonePlaceholder": "+1 555 123 4567"
  },
  "supplier": {
    "title": "First Supplier",
    "subtitle": "Add your primary supplier (optional).",
    "name": "Supplier name",
    "namePlaceholder": "Primary Supplier LLC",
    "taxId": "Tax ID",
    "taxIdPlaceholder": "12-3456789",
    "email": "Email",
    "emailPlaceholder": "contact@supplier.com",
    "phone": "Phone",
    "phonePlaceholder": "+1 555 123 4567"
  },
  "review": {
    "title": "Review & Complete",
    "subtitle": "Verify your setup before finalizing.",
    "company": "Company",
    "admin": "Admin",
    "client": "Client",
    "supplier": "Supplier",
    "singleCompany": "Single Company",
    "multiCompany": "Multi-Company",
    "completeSetup": "Complete Setup",
    "settingUp": "Setting up..."
  }
}
```

**contracts.json:**
```json
{
  "title": "Contracts",
  "searchPlaceholder": "Search contracts...",
  "createNew": "Create New Contract",
  "newContract": "New Contract",
  "editContract": "Edit Contract",
  "createContract": "Create Contract",
  "updateContract": "Update Contract",
  "notFound": "Contract not found",
  "backToList": "Back to Contracts",
  "generalInfo": "General Information",
  "noDescription": "No description provided",
  "supplements": "Associated Supplements",
  "noSupplements": "No supplements found",
  "documents": "Document Repository",
  "noDocuments": "No documents uploaded",
  "uploadDocument": "Upload Document",
  "auditTrail": "Audit Trail",
  "noAuditLogs": "No audit logs found",
  "addSupplement": "Add Supplement",
  "generateReport": "Generate Report",
  "edit": "Edit Contract",
  "noContracts": "No contracts found",
  "deleteConfirm": "Are you sure you want to delete this contract?",
  "deleteSuccess": "Contract deleted successfully",
  "createSuccess": "Contract created successfully",
  "updateSuccess": "Contract updated successfully",
  "client": "Client",
  "supplier": "Supplier",
  "status": "Status",
  "type": "Type",
  "amount": "Amount",
  "startDate": "Start date",
  "endDate": "End date",
  "description": "Description",
  "effectiveDate": "Effective date",
  "createdAt": "Created at",
  "active": "Active",
  "expired": "Expired",
  "pending": "Pending",
  "cancelled": "Cancelled",
  "draft": "Draft",
  "approved": "Approved",
  "service": "Service",
  "purchase": "Purchase",
  "lease": "Lease",
  "employment": "Employment",
  "nda": "NDA",
  "other": "Other"
}
```

**clients.json:**
```json
{
  "title": "Clients",
  "searchPlaceholder": "Search clients...",
  "addNew": "Add New Client",
  "editClient": "Edit Client",
  "addClient": "Add Client",
  "updateClient": "Update Client",
  "createClient": "Create Client",
  "noClients": "No clients found",
  "deleteConfirm": "Are you sure you want to delete this client?",
  "clientDetails": "Client Details",
  "noDocument": "No document",
  "officialDocument": "Official Document",
  "viewDocument": "View Document",
  "name": "Name",
  "taxId": "Tax ID",
  "email": "Email",
  "phone": "Phone",
  "address": "Address",
  "createSuccess": "Client created successfully",
  "updateSuccess": "Client updated successfully",
  "uploadClick": "Click to upload document",
  "uploading": "Uploading..."
}
```

**suppliers.json:**
```json
{
  "title": "Suppliers",
  "searchPlaceholder": "Search suppliers...",
  "addNew": "Add New Supplier",
  "editSupplier": "Edit Supplier",
  "addSupplier": "Add Supplier",
  "updateSupplier": "Update Supplier",
  "createSupplier": "Create Supplier",
  "noSuppliers": "No suppliers found",
  "deleteConfirm": "Are you sure you want to delete this supplier?",
  "supplierDetails": "Supplier Details",
  "noDocument": "No document",
  "officialDocument": "Official Document",
  "viewDocument": "View Document",
  "name": "Name",
  "taxId": "Tax ID",
  "email": "Email",
  "phone": "Phone",
  "address": "Address",
  "createSuccess": "Supplier created successfully",
  "updateSuccess": "Supplier updated successfully",
  "uploadClick": "Click to upload document",
  "uploading": "Uploading..."
}
```

**supplements.json:**
```json
{
  "title": "Supplements",
  "subtitle": "Manage contract supplements",
  "addNew": "Add Supplement",
  "editSupplement": "Edit Supplement",
  "addSupplement": "Add Supplement",
  "updateSupplement": "Update Supplement",
  "createSupplement": "Create Supplement",
  "noSupplements": "No supplements found",
  "loading": "Loading supplements...",
  "retry": "Retry",
  "contract": "Contract",
  "type": "Type",
  "status": "Status",
  "effectiveDate": "Effective date",
  "description": "Description"
}
```

**reports.json:**
```json
{
  "title": "Reports",
  "subtitle": "Generate contract reports and analysis",
  "hideFilters": "Hide Filters",
  "showFilters": "Show Filters",
  "savedPresets": "Saved Filter Presets",
  "savePreset": "Save Preset",
  "filters": {
    "title": "Report Filters",
    "fromDate": "From Date",
    "toDate": "To Date",
    "status": "Status",
    "allStatus": "All Status",
    "contractType": "Contract Type",
    "allTypes": "All Types",
    "client": "Client",
    "supplier": "Supplier",
    "minAmount": "Min Amount",
    "maxAmount": "Max Amount",
    "apply": "Apply Filters",
    "reset": "Reset",
    "save": "Save",
    "cancel": "Cancel"
  },
  "export": {
    "title": "Export",
    "pdf": "Export as PDF",
    "excel": "Export as Excel",
    "csv": "Export as CSV"
  },
  "types": {
    "contracts": "Contracts",
    "financial": "Financial",
    "clientSupplier": "Clients & Suppliers",
    "status": "Contract Status",
    "expirations": "Expirations",
    "supplements": "Supplements",
    "modifications": "Modifications"
  }
}
```

**settings.json:**
```json
{
  "title": "Users",
  "subtitle": "Manage users and their roles",
  "addNew": "Add New User",
  "editUser": "Edit User",
  "addUser": "Add User",
  "updateUser": "Update User",
  "createUser": "Create User",
  "resetPassword": "Reset Password",
  "newPassword": "New Password",
  "noUsers": "No users found",
  "loading": "Loading users...",
  "rolePermissions": "Role Permissions Matrix",
  "role": "Role",
  "admin": "Admin",
  "manager": "Manager",
  "editor": "Editor",
  "viewer": "Viewer",
  "active": "Active",
  "inactive": "Inactive",
  "pending": "Pending",
  "name": "Name",
  "email": "Email",
  "status": "Status",
  "permissions": {
    "contracts": "Contracts",
    "parties": "Parties",
    "reports": "Reports",
    "users": "Users",
    "settings": "Settings"
  }
}
```

**documents.json:**
```json
{
  "title": "Documents",
  "searchPlaceholder": "Search documents...",
  "upload": "Upload Document",
  "uploading": "Uploading...",
  "selectContract": "Select a Contract",
  "selectContractDesc": "You must select a contract before uploading documents.",
  "repository": "Document Repository",
  "noDocuments": "No documents found",
  "filename": "Name",
  "contract": "Contract",
  "uploadedAt": "Uploaded",
  "size": "Size",
  "actions": "Actions",
  "uploadSuccess": "Document uploaded successfully",
  "uploadError": "Failed to upload document",
  "deleteConfirm": "Are you sure you want to delete this document?"
}
```

**notifications.json:**
```json
{
  "title": "Notifications",
  "unread": "unread notification(s)",
  "markAllRead": "Mark All Read",
  "empty": "No notifications yet",
  "loading": "Loading notifications...",
  "viewContract": "View Contract",
  "markRead": "Mark as Read",
  "read": "Read",
  "unreadBadge": "Unread",
  "markedRead": "Notification marked as read",
  "allMarkedRead": "All notifications marked as read"
}
```

**signers.json:**
```json
{
  "title": "Authorized Signers",
  "searchPlaceholder": "Search signers...",
  "addNew": "Add Authorized Signer",
  "editSigner": "Edit Signer",
  "addSigner": "Add Signer",
  "updateSigner": "Update Signer",
  "createSigner": "Create Signer",
  "noSigners": "No authorized signers found",
  "deleteConfirm": "Are you sure you want to delete this signer?",
  "signerDetails": "Signer Details",
  "noDocument": "No document",
  "authDocument": "Authorization Document",
  "viewDocument": "View Document",
  "name": "Name",
  "role": "Role",
  "email": "Email",
  "phone": "Phone",
  "rut": "Tax ID",
  "createSuccess": "Signer created successfully",
  "updateSuccess": "Signer updated successfully"
}
```

**companies.json:**
```json
{
  "title": "Companies",
  "addNew": "Add Company",
  "directory": "Company Directory",
  "searchPlaceholder": "Search companies...",
  "noCompanies": "No companies found",
  "editCompany": "Edit Company",
  "createCompany": "Create Company",
  "update": "Update",
  "create": "Create",
  "delete": "Delete Company",
  "deleteConfirm": "Are you sure you want to delete this company?",
  "loading": "Loading companies...",
  "name": "Name",
  "taxId": "Tax ID",
  "type": "Type",
  "parent": "Parent",
  "subsidiary": "Subsidiary",
  "standalone": "Standalone"
}
```

**pending.json:**
```json
{
  "title": "Awaiting Admin Approval",
  "description": "Your account has been created but requires admin approval before you can access the system.",
  "waitMessage": "You will be able to log in once your account is approved."
}
```

**dashboard.json:**
```json
{
  "title": "Dashboard",
  "kpi": {
    "totalContracts": {
      "title": "Total Contracts",
      "desc": "Active contracts"
    },
    "expiringSoon": {
      "title": "Expiring Soon",
      "desc": "Next 30 days"
    },
    "activeParties": {
      "title": "Active Parties",
      "desc": "Clients and suppliers"
    },
    "pendingApproval": {
      "title": "Pending",
      "desc": "Awaiting approval"
    }
  },
  "expiringTitle": "Contracts Expiring Soon",
  "daysLeft": "days left",
  "statusTitle": "Contracts by Status",
  "noContracts": "No contracts to display",
  "quickActions": "Quick Actions",
  "newContract": "New contract",
  "newClient": "New client",
  "newSupplier": "New supplier",
  "viewReports": "View reports",
  "manageUsers": "Manage users",
  "settings": "Settings"
}
```

**Step 2: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/public/locales/en/
git commit -m "feat: add English translation files"
```

---

### Task 8: Translate Landing Components

**Files:**
- Modify: `pacta_appweb/src/components/landing/HeroSection.tsx`
- Modify: `pacta_appweb/src/components/landing/FeaturesSection.tsx`
- Modify: `pacta_appweb/src/components/landing/LandingNavbar.tsx`

**Step 1: Translate HeroSection.tsx**

Replace hardcoded strings with `useTranslation('landing')`:

```tsx
import { useTranslation } from 'react-i18next';

// Inside component:
const { t } = useTranslation('landing');

// Replace:
// "Contract Management System" → t('hero.title')
// "Manage Contracts" → t('hero.subtitle')
// "with Clarity" → keep as-is (part of design)
// "Track, approve, and monitor..." → t('hero.description')
// "Never miss a renewal again." → t('hero.benefit')
// "Start Now" → t('hero.startNow')
// "Learn More" → t('hero.learnMore')
```

**Step 2: Translate FeaturesSection.tsx**

```tsx
const { t } = useTranslation('landing');

// "Features" → t('features.title')
// "Everything you need..." → t('features.subtitle')
// "PACTA gives you..." → t('features.description')
// Feature items → t('features.items.0.title'), t('features.items.0.description'), etc.
// "Learn more" → t('features.learnMore')
```

**Step 3: Translate LandingNavbar.tsx**

```tsx
const { t } = useTranslation('landing');

// "Features" → t('nav.features')
// "Login" → t('nav.login')
```

**Step 4: Verify build and test**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/components/landing/
git commit -m "feat: translate landing page components"
```

---

### Task 9: Translate Auth Components (Login + Setup)

**Files:**
- Modify: `pacta_appweb/src/components/auth/LoginForm.tsx`
- Modify: `pacta_appweb/src/pages/LoginPage.tsx`
- Modify: `pacta_appweb/src/components/setup/SetupWizard.tsx`
- Modify: `pacta_appweb/src/components/setup/SetupModeSelector.tsx`
- Modify: `pacta_appweb/src/components/setup/StepWelcome.tsx`
- Modify: `pacta_appweb/src/components/setup/StepCompany.tsx`
- Modify: `pacta_appweb/src/components/setup/StepAdmin.tsx`
- Modify: `pacta_appweb/src/components/setup/StepClient.tsx`
- Modify: `pacta_appweb/src/components/setup/StepSupplier.tsx`
- Modify: `pacta_appweb/src/components/setup/StepReview.tsx`
- Modify: `pacta_appweb/src/pages/SetupPage.tsx`

**Step 1: Translate LoginForm.tsx**

```tsx
const { t } = useTranslation('login');

// "Create Account" → t('createAccount')
// "PACTA Web" → t('title')
// "Contract Management System" → t('subtitle')
// "Set up your account..." → t('setupDesc')
// "Full Name" → t('fullName')
// "Email" → t('email')
// "Password" → t('password')
// "Register" → t('register')
// "Back to Login" → t('backToLogin')
// "Login" → t('loginTitle')
// Placeholders → t('fullNamePlaceholder'), etc.
// Toast messages → t('loginError'), t('registerSuccess'), t('registerError')
```

**Step 2: Translate all setup components**

Use `useTranslation('setup')` for all setup components. Map each hardcoded string to the corresponding key in setup.json.

**Step 3: Verify build**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/components/auth/ pacta_appweb/src/components/setup/ pacta_appweb/src/pages/LoginPage.tsx pacta_appweb/src/pages/SetupPage.tsx
git commit -m "feat: translate login and setup components"
```

---

### Task 10: Translate Layout Components (AppLayout, AppSidebar)

**Files:**
- Modify: `pacta_appweb/src/components/layout/AppLayout.tsx`
- Modify: `pacta_appweb/src/components/layout/AppSidebar.tsx`

**Step 1: Translate AppLayout.tsx**

```tsx
const { t } = useTranslation('common');

// PAGE_TITLES dict → replace values with t() calls
// "Loading..." → t('loading')
// "Skip to main content" → t('skipToMain')
// "Contract Details" → t('contracts.editContract') or add to common
```

For PAGE_TITLES, since it's a static dict used before the hook is available, convert to a function or use the translation inside the render:

```tsx
// Before:
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/contracts': 'Contracts',
  // ...
};

// After:
const getPageTitle = (t: (key: string) => string, pathname: string): string => {
  if (pathname.startsWith('/contracts/')) return t('contracts.editContract');
  const titles: Record<string, string> = {
    '/dashboard': t('dashboard.title'),
    '/contracts': t('contracts.title'),
    '/clients': t('clients.title'),
    '/suppliers': t('suppliers.title'),
    '/authorized-signers': t('signers.title'),
    '/documents': t('documents.title'),
    '/notifications': t('notifications.title'),
    '/pending-approval': t('pending.title'),
    '/reports': t('reports.title'),
    '/supplements': t('supplements.title'),
    '/users': t('settings.title'),
    '/companies': t('companies.title'),
  };
  return titles[pathname] || '';
};
```

**Step 2: Translate AppSidebar.tsx**

```tsx
const { t } = useTranslation('common');

// "PACTA Web" → t('login.title')
// "Contract Management" → t('login.subtitle')
// Nav items → t('contracts.title'), t('clients.title'), etc.
// "Logout" → t('logout')
// "Role:" → t('role')
```

**Step 3: Verify build**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/components/layout/
git commit -m "feat: translate layout components (AppLayout, AppSidebar)"
```

---

### Task 11: Translate Contract Management Components

**Files:**
- Modify: `pacta_appweb/src/pages/ContractsPage.tsx`
- Modify: `pacta_appweb/src/pages/ContractDetailsPage.tsx`
- Modify: `pacta_appweb/src/components/contracts/ContractForm.tsx`

**Step 1: Translate ContractsPage.tsx**

```tsx
const { t } = useTranslation('contracts');

// Search placeholder → t('searchPlaceholder')
// "Create New Contract" → t('createNew')
// Table headers → t('client'), t('supplier'), t('status'), t('type'), t('amount'), t('startDate'), t('endDate')
// "No contracts found" → t('noContracts')
// Delete dialog → t('areYouSure'), t('actionCannotBeUndone'), t('deleteConfirm')
// Toast messages → t('deleteSuccess'), t('createSuccess'), t('updateSuccess')
// Status/type dropdown options → t('active'), t('expired'), t('pending'), t('cancelled'), t('service'), t('purchase'), etc.
```

**Step 2: Translate ContractDetailsPage.tsx**

```tsx
const { t } = useTranslation('contracts');

// "Contract not found" → t('notFound')
// "Back to Contracts" → t('backToList')
// "Edit Contract" → t('edit')
// "Add Supplement" → t('addSupplement')
// "Generate Report" → t('generateReport')
// "General Information" → t('generalInfo')
// Field labels → t('client'), t('supplier'), t('status'), etc.
// "No description provided" → t('noDescription')
// "Associated Supplements" → t('supplements')
// "No supplements found" → t('noSupplements')
// "Document Repository" → t('documents')
// "No documents uploaded" → t('noDocuments')
// "Upload Document" → t('uploadDocument')
// "Audit Trail" → t('auditTrail')
// "No audit logs found" → t('noAuditLogs')
// Date formatting → toLocaleDateString(i18n.language)
```

**Step 3: Translate ContractForm.tsx**

```tsx
const { t } = useTranslation('contracts');

// "Edit Contract"/"Create New Contract" → t('editContract')/t('newContract')
// Form labels → t('client'), t('supplier'), t('status'), t('type'), t('amount'), t('startDate'), t('endDate'), t('description')
// Select options → t('active'), t('expired'), etc.
// "Cancel" → t('cancel', { ns: 'common' })
// "Update Contract"/"Create Contract" → t('updateContract')/t('createContract')
// Toast errors → t('error', { ns: 'common' })
```

**Step 4: Verify build**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/pages/ContractsPage.tsx pacta_appweb/src/pages/ContractDetailsPage.tsx pacta_appweb/src/components/contracts/ContractForm.tsx
git commit -m "feat: translate contract management components"
```

---

### Task 12: Translate Clients and Suppliers Components

**Files:**
- Modify: `pacta_appweb/src/pages/ClientsPage.tsx`
- Modify: `pacta_appweb/src/components/clients/ClientForm.tsx`
- Modify: `pacta_appweb/src/pages/SuppliersPage.tsx`
- Modify: `pacta_appweb/src/components/suppliers/SupplierForm.tsx`

**Step 1: Translate ClientsPage.tsx**

```tsx
const { t } = useTranslation('clients');
const { t: tCommon } = useTranslation('common');

// Search placeholder → t('searchPlaceholder')
// "Add New Client" → t('addNew')
// Table headers → t('name'), t('taxId'), t('email'), t('phone'), t('address')
// "No clients found" → t('noClients')
// Delete dialog → tCommon('areYouSure'), tCommon('actionCannotBeUndone'), t('deleteConfirm')
// "Client Details" → t('clientDetails')
// "No document" → t('noDocument')
// "Official Document" → t('officialDocument')
// "View Document" → t('viewDocument')
```

**Step 2: Translate ClientForm.tsx, SuppliersPage.tsx, SupplierForm.tsx**

Same pattern with respective namespaces (`clients` and `suppliers`).

**Step 3: Verify build**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/pages/ClientsPage.tsx pacta_appweb/src/components/clients/ClientForm.tsx pacta_appweb/src/pages/SuppliersPage.tsx pacta_appweb/src/components/suppliers/SupplierForm.tsx
git commit -m "feat: translate clients and suppliers components"
```

---

### Task 13: Translate Remaining Pages (Dashboard, Reports, Documents, Notifications, Users, Companies, Signers, Supplements, Pending)

**Files:**
- Modify: `pacta_appweb/src/pages/DashboardPage.tsx`
- Modify: `pacta_appweb/src/pages/ReportsPage.tsx`
- Modify: `pacta_appweb/src/components/reports/ReportFilters.tsx`
- Modify: `pacta_appweb/src/components/reports/ExportButtons.tsx`
- Modify: `pacta_appweb/src/pages/DocumentsPage.tsx`
- Modify: `pacta_appweb/src/pages/NotificationsPage.tsx`
- Modify: `pacta_appweb/src/pages/UsersPage.tsx`
- Modify: `pacta_appweb/src/pages/CompaniesPage.tsx`
- Modify: `pacta_appweb/src/pages/PendingApprovalPage.tsx`
- Modify: `pacta_appweb/src/pages/AuthorizedSignersPage.tsx`
- Modify: `pacta_appweb/src/components/authorized-signers/AuthorizedSignerForm.tsx`
- Modify: `pacta_appweb/src/pages/SupplementsPage.tsx`
- Modify: `pacta_appweb/src/components/supplements/SupplementForm.tsx`
- Modify: `pacta_appweb/src/pages/NotFoundPage.tsx`
- Modify: `pacta_appweb/src/pages/ForbiddenPage.tsx`

**Step 1: Translate each page with its respective namespace**

Apply the same pattern: `useTranslation('<namespace>')`, replace all hardcoded strings with `t('key')` calls.

For components that use multiple namespaces (e.g., ReportFilters uses both `reports` and `common`):

```tsx
const { t } = useTranslation('reports');
const { t: tCommon } = useTranslation('common');
```

**Step 2: Update date/number formatting**

In components using `toLocaleDateString()` or `toLocaleString()` without a locale argument, pass `i18n.language`:

```tsx
import { useTranslation } from 'react-i18next';

// Inside component:
const { i18n } = useTranslation();

// Before:
new Date(contract.end_date).toLocaleDateString()
// After:
new Date(contract.end_date).toLocaleDateString(i18n.language)

// Before:
contract.amount.toLocaleString()
// After:
contract.amount.toLocaleString(i18n.language)
```

Files to update:
- `ContractDetailsPage.tsx` (lines 161, 173, 177, 210, 212)

**Step 3: Verify build**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/pages/ pacta_appweb/src/components/reports/ pacta_appweb/src/components/authorized-signers/ pacta_appweb/src/components/supplements/
git commit -m "feat: translate remaining pages and update date/number formatting"
```

---

## Phase 4: Testing & Polish

### Task 14: Write i18n Unit Tests

**Files:**
- Create: `pacta_appweb/src/__tests__/i18n.test.ts`

**Step 1: Create test file**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import i18n from '../i18n';

describe('i18n configuration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with English as fallback', () => {
    expect(i18n.options.fallbackLng).toBe('en');
    expect(i18n.options.supportedLngs).toContain('en');
    expect(i18n.options.supportedLngs).toContain('es');
  });

  it('should have Spanish translations loaded', () => {
    expect(i18n.exists('common:loading', { lng: 'es' })).toBe(true);
    expect(i18n.exists('landing:hero.title', { lng: 'es' })).toBe(true);
  });

  it('should have English translations loaded', () => {
    expect(i18n.exists('common:loading', { lng: 'en' })).toBe(true);
    expect(i18n.exists('landing:hero.title', { lng: 'en' })).toBe(true);
  });

  it('should detect Spanish from localStorage', () => {
    localStorage.setItem('pacta-language', 'es');
    // Note: i18n is already initialized, so we test the detection config
    expect(i18n.options.detection?.lookupLocalStorage).toBe('pacta-language');
    expect(i18n.options.detection?.order).toContain('localStorage');
    expect(i18n.options.detection?.order).toContain('navigator');
  });

  it('should change language and persist to localStorage', () => {
    i18n.changeLanguage('es');
    expect(localStorage.getItem('pacta-language')).toBe('es');
    expect(i18n.language).toBe('es');

    i18n.changeLanguage('en');
    expect(localStorage.getItem('pacta-language')).toBe('en');
  });

  it('should have all namespaces configured', () => {
    const expectedNs = [
      'common', 'landing', 'login', 'setup', 'contracts', 'clients',
      'suppliers', 'supplements', 'reports', 'settings', 'documents',
      'notifications', 'signers', 'companies', 'pending', 'dashboard'
    ];
    expectedNs.forEach(ns => {
      expect(i18n.options.ns).toContain(ns);
    });
  });
});
```

**Step 2: Run tests**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm test`
Expected: All 6 tests pass.

**Step 3: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/__tests__/i18n.test.ts
git commit -m "test: add i18n unit tests"
```

---

### Task 15: Component Render Tests

**Files:**
- Create: `pacta_appweb/src/__tests__/i18n-components.test.tsx`

**Step 1: Create component test file**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { HeroSection } from '../components/landing/HeroSection';
import { LoginForm } from '../components/auth/LoginForm';

function renderWithI18n(ui: React.ReactElement, lng: string) {
  const i18nInstance = i18n.cloneInstance({ lng, initImmediate: false });
  return render(
    <I18nextProvider i18n={i18nInstance}>
      {ui}
    </I18nextProvider>
  );
}

describe('i18n component rendering', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('HeroSection', () => {
    it('renders in English', () => {
      renderWithI18n(<HeroSection />, 'en');
      expect(screen.getByText('Contract Management System')).toBeInTheDocument();
      expect(screen.getByText('Start Now')).toBeInTheDocument();
    });

    it('renders in Spanish', () => {
      renderWithI18n(<HeroSection />, 'es');
      expect(screen.getByText('Sistema de Gestión de Contratos')).toBeInTheDocument();
      expect(screen.getByText('Comenzar ahora')).toBeInTheDocument();
    });
  });

  describe('LoginForm', () => {
    it('renders in English', () => {
      renderWithI18n(<LoginForm />, 'en');
      expect(screen.getByText('PACTA Web')).toBeInTheDocument();
      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });

    it('renders in Spanish', () => {
      renderWithI18n(<LoginForm />, 'es');
      expect(screen.getByText('PACTA Web')).toBeInTheDocument();
      expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run tests**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm test`
Expected: All 4 tests pass.

**Step 3: Commit**

```bash
cd /home/mowgli/pacta
git add pacta_appweb/src/__tests__/i18n-components.test.tsx
git commit -m "test: add i18n component render tests"
```

---

### Task 16: Final Build Verification and CHANGELOG Update

**Files:**
- Modify: `CHANGELOG.md`

**Step 1: Final build verification**

Run: `cd /home/mowgli/pacta/pacta_appweb && npm run build`
Expected: Build succeeds with no errors.

Run: `cd /home/mowgli/pacta/pacta_appweb && npm test`
Expected: All 10 tests pass.

**Step 2: Update CHANGELOG.md**

Add entry at the top:

```markdown
| [v0.23.0](...) | 2026-04-12 | 🌍 Feature | Automatic language detection (es/en), full app i18n, language toggle |
```

**Step 3: Update version in package.json**

Bump version from `0.23.0` to `0.24.0`.

**Step 4: Commit everything**

```bash
cd /home/mowgli/pacta
git add CHANGELOG.md pacta_appweb/package.json
git commit -m "chore: bump version to 0.24.0, update changelog for i18n feature"
```

---

## Summary

| Phase | Tasks | Commits | Description |
|-------|-------|---------|-------------|
| 1 | 1-5 | 5 | Infrastructure: deps, config, toggle, integration |
| 2 | 6-7 | 2 | Translation files: Spanish + English JSON |
| 3 | 8-13 | 6 | Component translation: all 38 files |
| 4 | 14-16 | 3 | Tests, build verification, changelog |
| **Total** | **16** | **16** | **~446 translation keys, 38 components** |
