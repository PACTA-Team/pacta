# Phase 5 Filters i18n Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar traducciones i18n para los filtros de contratos y suplementos implementados en Phase 5, manteniendo consistencia entre español (base) e inglés.

**Architecture:** Extender los archivos JSON de locale existentes (contracts.json, supplements.json) con las nuevas claves de filtros, luego actualizar los componentes React para usar t() en lugar de textos hardcoded.

**Tech Stack:** react-i18next, JSON de traducciones

---

## Contexto del Proyecto

### Namespace existente
- `contracts`: namespace para página de contratos
- `supplements`: namespace para página de suplementos
- Idioma base: español (`es`)
- Idioma secundario: inglés (`en`)

### Convenciones
- Formato de texto: Título con mayúscula (Opción A)
- Claves: snake_case para valores de tipos, camelCase para UI
- Namespace: `${namespace}:key`

---

### Task 1: Agregar traducciones de tipos de contrato (ES)

**Files:**
- Modify: `pacta_appweb/public/locales/es/contracts.json`

**Step 1: Agregar claves al archivo JSON**

Agregar al final de `contracts.json` (línea 50+, después de "other"):

```json
,
"contractTypes": {
  "compraventa": "Compraventa",
  "suministro": "Suministro",
  "permuta": "Permuta",
  "donacion": "Donación",
  "deposito": "Depósito",
  "prestacion_servicios": "Prest. Servicios",
  "agencia": "Agencia",
  "comision": "Comisión",
  "consignacion": "Consignación",
  "comodato": "Comodato",
  "arrendamiento": "Arrendamiento",
  "leasing": "Leasing",
  "cooperacion": "Cooperación",
  "administracion": "Administración",
  "transporte": "Transporte",
  "otro": "Otro"
},
"partyFilter": {
  "all": "Todas las partes",
  "client": "Contratos como cliente",
  "supplier": "Contratos como proveedor"
}
```

**Step 2: Verificar JSON válido**

Run: `cat pacta_appweb/public/locales/es/contracts.json | python3 -m json.tool > /dev/null && echo "Valid"`
Expected: `Valid`

**Step 3: Commit**

```bash
git add pacta_appweb/public/locales/es/contracts.json
git commit -m "i18n: add contract type translations (es)"
```

---

### Task 2: Agregar traducciones de tipos de contrato (EN)

**Files:**
- Modify: `pacta_appweb/public/locales/en/contracts.json`

**Step 1: Agregar claves al archivo JSON**

Agregar al final de `contracts.json` (línea 50+, después de "other"):

```json
,
"contractTypes": {
  "compraventa": "Purchase and Sale",
  "suministro": "Supply",
  "permuta": "Exchange",
  "donacion": "Donation",
  "deposito": "Deposit",
  "prestacion_servicios": "Service Provision",
  "agencia": "Agency",
  "comision": "Commission",
  "consignacion": "Consignment",
  "comodato": "Loan for Use",
  "arrendamiento": "Lease",
  "leasing": "Leasing",
  "cooperacion": "Cooperation",
  "administracion": "Administration",
  "transporte": "Transport",
  "otro": "Other"
},
"partyFilter": {
  "all": "All Parties",
  "client": "Client Contracts",
  "supplier": "Supplier Contracts"
}
```

**Step 2: Verificar JSON válido**

Run: `cat pacta_appweb/public/locales/en/contracts.json | python3 -m json.tool > /dev/null && echo "Valid"`
Expected: `Valid`

**Step 3: Commit**

```bash
git add pacta_appweb/public/locales/en/contracts.json
git commit -m "i18n: add contract type translations (en)"
```

---

### Task 3: Agregar traducciones de tipos de modificación (ES)

**Files:**
- Modify: `pacta_appweb/public/locales/es/supplements.json`

**Step 1: Leer archivo actual**

Run: `cat pacta_appweb/public/locales/es/supplements.json`
Expected: Ver contenido existente

**Step 2: Agregar claves al archivo JSON**

Agregar al final (después de "addNew"):

```json
,
"modificationTypes": {
  "modificacion": "Modificación",
  "prorroga": "Prórroga",
  "concrecion": "Concreción"
},
"partyFilter": {
  "all": "Todas las partes",
  "client": "Suplementos como cliente",
  "supplier": "Suplementos como proveedor"
}
```

**Step 3: Verificar JSON válido y commit**

```bash
git add pacta_appweb/public/locales/es/supplements.json
git commit -m "i18n: add modification type translations (es)"
```

---

### Task 4: Agregar traducciones de tipos de modificación (EN)

**Files:**
- Modify: `pacta_appweb/public/locales/en/supplements.json`

**Step 1: Agregar claves al archivo JSON**

Agregar al final:

```json
,
"modificationTypes": {
  "modificacion": "Modification",
  "prorroga": "Extension",
  "concrecion": "Concretion"
},
"partyFilter": {
  "all": "All Parties",
  "client": "Client Supplements",
  "supplier": "Supplier Supplements"
}
```

**Step 2: Commit**

```bash
git add pacta_appweb/public/locales/en/supplements.json
git commit -m "i18n: add modification type translations (en)"
```

---

### Task 5: Actualizar ContractsPage para usar i18n

**Files:**
- Modify: `pacta_appweb/src/pages/ContractsPage.tsx:238-278`

**Step 1: Revisar estado actual del componente**

 grep para ver los SelectItem actuales:
```bash
grep -n "SelectItem value=" pacta_appweb/src/pages/ContractsPage.tsx | head -20
```

**Step 2: Actualizar Select de tipo de contrato**

Reemplazar los SelectItem hardcoded con valores i18n:

```tsx
<SelectContent>
  <SelectItem value="all">{t('status') === 'Estado' ? 'Todos' : 'All'}</SelectItem>
  <SelectItem value="compraventa">{t('contractTypes.compraventa')}</SelectItem>
  <SelectItem value="suministro">{t('contractTypes.suministro')}</SelectItem>
  <SelectItem value="permuta">{t('contractTypes.permuta')}</SelectItem>
  <SelectItem value="donacion">{t('contractTypes.donacion')}</SelectItem>
  <SelectItem value="deposito">{t('contractTypes.deposito')}</SelectItem>
  <SelectItem value="prestacion_servicios">{t('contractTypes.prestacion_servicios')}</SelectItem>
  <SelectItem value="agencia">{t('contractTypes.agencia')}</SelectItem>
  <SelectItem value="comision">{t('contractTypes.comision')}</SelectItem>
  <SelectItem value="consignacion">{t('contractTypes.consignacion')}</SelectItem>
  <SelectItem value="comodato">{t('contractTypes.comodato')}</SelectItem>
  <SelectItem value="arrendamiento">{t('contractTypes.arrendamiento')}</SelectItem>
  <SelectItem value="leasing">{t('contractTypes.leasing')}</SelectItem>
  <SelectItem value="cooperacion">{t('contractTypes.cooperacion')}</SelectItem>
  <SelectItem value="administracion">{t('contractTypes.administracion')}</SelectItem>
  <SelectItem value="transporte">{t('contractTypes.transporte')}</SelectItem>
  <SelectItem value="otro">{t('contractTypes.otro')}</SelectItem>
</SelectContent>
```

**Step 3: Actualizar Select de party filter**

```tsx
<SelectContent>
  <SelectItem value="all">{t('partyFilter.all')}</SelectItem>
  <SelectItem value="client">{t('partyFilter.client')}</SelectItem>
  <SelectItem value="supplier">{t('partyFilter.supplier')}</SelectItem>
</SelectContent>
```

**Step 4: Commit**

```bash
git add pacta_appweb/src/pages/ContractsPage.tsx
git commit -m "i18n: use t() for contract type and party filters"
```

---

### Task 6: Actualizar SupplementsPage para usar i18n

**Files:**
- Modify: `pacta_appweb/src/pages/SupplementsPage.tsx:255-285`

**Step 1: Revisar estado actual**

```bash
grep -n "SelectItem value=" pacta_appweb/src/pages/SupplementsPage.tsx
```

**Step 2: Actualizar Select de modification type**

Reemplazar con:

```tsx
<SelectContent>
  <SelectItem value="all">{t('status') === 'Estado' ? 'Todos los tipos' : 'All Types'}</SelectItem>
  <SelectItem value="modificacion">{t('modificationTypes.modificacion')}</SelectItem>
  <SelectItem value="prorroga">{t('modificationTypes.prorroga')}</SelectItem>
  <SelectItem value="concrecion">{t('modificationTypes.concrecion')}</SelectItem>
</SelectContent>
```

**Step 3: Actualizar Select de party filter**

```tsx
<SelectContent>
  <SelectItem value="all">{t('partyFilter.all')}</SelectItem>
  <SelectItem value="client">{t('partyFilter.client')}</SelectItem>
  <SelectItem value="supplier">{t('partyFilter.supplier')}</SelectItem>
</SelectContent>
```

**Step 4: Commit**

```bash
git add pacta_appweb/src/pages/SupplementsPage.tsx
git commit -m "i18n: use t() for modification type and party filters"
```

---

## Checkpoint: Después de Task 6

- [ ] Tests de i18n pasan: `npm test -- --grep i18n`
- [ ] Build pasa: `npm run build`
- [ ] Filtros visibles en español e inglés

---

## Dependencies entre Tasks

```
Task 1 → Task 2 → Task 5 (ContractsPage necesita ES+EN)
Task 3 → Task 4 → Task 6 (SupplementsPage necesita ES+EN)
```

**Orden de ejecución:** Task 1 → 2 → 3 → 4 → 5 → 6

---

## Ejecución

**Plan complete and saved to `docs/plans/2026-04-19-i18n-filters-phase-5.md`. Tres opciones:**

**1. Subagent-Driven (this session)** - Implemento cada task, reviso entre tasks

**2. Parallel Session (separate)** - Nueva sesión con executing-plans

**3. Plan-to-Issues (team workflow)** - Convierte a GitHub issues

**¿Qué enfoque prefieres?**