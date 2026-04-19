# Contract Forms Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Corregir errores de tipos en ContractsPage (#150) e implementar formularios condicionales basados en el rol de la parte (cliente vs proveedor), siguiendo el DL-304.

**Architecture:** Dos fases - Fase 1: Fix de tipos básicos (#150). Fase 2: Formularios condicionales con campos jurídicos diferentes según rol.

**Tech Stack:** TypeScript, React, Go backend, react-i18next

---

## Fase 1: Fix Errores de Tipo (#150)

### Task 1: Corregir tipos en contracts-api.ts

**Files:**
- Modify: `pacta_appweb/src/lib/contracts-api.ts:17-44`

**Step 1: Leer el archivo actual**

Run: `cat pacta_appweb/src/lib/contracts-api.ts`
Expected: Veriface con tipos actuales

**Step 2: Editar CreateContractRequest**

Cambiar:
```typescript
export interface CreateContractRequest {
  contract_number: string;
  title: string;  // ❌ Esto cause error
  // ...
}
```

A:
```typescript
export interface CreateContractRequest {
  contract_number: string;
  title?: string;  // ✓ Opcional como en backend
  // ...
}
```

**Step 3: Editar UpdateContractRequest**

Cambiar:
```typescript
export interface UpdateContractRequest {
  title: string;  // ❌ Required
  // ...
}
```

A:
```typescript
export interface UpdateContractRequest {
  title?: string;  // ✓ Opcional
  // ...
}
```

**Step 4: Commit**

```bash
git add pacta_appweb/src/lib/contracts-api.ts
git commit -m "fix: make title optional in contract request types

Fixes #150

## Changes
- CreateContractRequest.title: string → title?: string
- UpdateContractRequest.title: string → title?: string
- Matches backend Go types (pointer = optional)"
```

---

### Task 2: Verificar que los errores LSP desaparezcan

**Step 1: Verificar con editor**

Abrir VSCode o verificar con:
```bash
cd pacta_appweb && npx tsc --noEmit 2>&1 | grep -i "contracts" | head -20
```
Expected: Sin errores de tipo en ContractsPage.tsx relacionados con CreateContractRequest/UpdateContractRequest

**Step 2: Commit si hay cambios menores**

```bash
git add -A && git commit -m "chore: verify type fixes"
```

---

## Fase 2: Formularios Condicionales por Rol

### Task 1: Crear plan de diseño para ContractForm.tsx

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractForm.tsx:103-257`

**Step 1: Revisar código actual del selector de rol**

Ejecutar:
```bash
grep -n "ourRole" pacta_appweb/src/components/contracts/ContractForm.tsx | head -10
```
Expected: Ver línea ~103 donde se define ourRole

**Step 2: Crear componente de campos legales para cliente**

Agregar después de línea ~55 (después de `const [legalFieldsOpen, setLegalFieldsOpen]`):

```typescript
// Campos legales que solo ve el CLIENTE (recibe servicio/producto)
const clientOnlyFields = (
  <>
    <div className="space-y-2 col-span-2">
      <Label htmlFor="object">{t('object') || 'Objeto del Contrato'}</Label>
      <Textarea
        id="object"
        value={formData.object}
        onChange={(e) => setFormData({ ...formData, object: e.target.value })}
        rows={3}
      />
      <p className="text-xs text-muted-foreground">Art. 32, DL-304: el objeto debe describir claramente las prestaciones</p>
    </div>

    <div className="space-y-2">
      <Label htmlFor="fulfillmentPlace">{t('fulfillmentPlace') || 'Lugar de Cumplimiento'}</Label>
      <Input
        id="fulfillmentPlace"
        value={formData.fulfillmentPlace}
        onChange={(e) => setFormData({ ...formData, fulfillmentPlace: e.target.value })}
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="disputeResolution">{t('disputeResolution') || 'Resolución de Controversias'}</Label>
      <Input
        id="disputeResolution"
        value={formData.disputeResolution}
        onChange={(e) => setFormData({ ...formData, disputeResolution: e.target.value })}
      />
    </div>
  </>
);
```

**Step 3: Modificar CollapsibleContent para usar condicional**

Cambiar línea ~399:
```typescript
// ANTES
<CollapsibleContent className="space-y-4 pt-4">
  {/* Todos los campos legales siempre visibles */}
</CollapsibleContent>

// DESPUÉS
<CollapsibleContent className="space-y-4 pt-4">
  {ourRole === 'client' && clientOnlyFields}
  {/* Campos comunes (guarantees, renewalType, confidentiality) */}
</CollapsibleContent>
```

**Step 4: Commit**

```bash
git add pacta_appweb/src/components/contracts/ContractForm.tsx
git commit -m "feat: add conditional legal fields for client role

## Changes
- ContractForm.tsx: Show full legal section only for client role
- Client sees: object, fulfillmentPlace, disputeResolution + common
- Supplier sees: basic fields only

DL-304 Article 32-49 compliance"
```

---

### Task 2: Agregar traducciones para nuevos campos

**Files:**
- Modify: `pacta_appweb/public/locales/es/contracts.json`
- Modify: `pacta_appweb/public/locales/en/contracts.json`

**Step 1: Agregar claves al JSON español**

```bash
echo ',"object": "Objeto del Contrato","fulfillmentPlace": "Lugar de Cumplimiento","disputeResolution": "Resolución de Controversias"' >> pacta_appweb/public/locales/es/contracts.json
```

**Step 2: Agregar claves al JSON inglés**

```bash
echo ',"object": "Contract Object","fulfillmentPlace": "Place of Performance","disputeResolution": "Dispute Resolution"' >> pacta_appweb/public/locales/en/contracts.json
```

**Step 3: Validar JSON**

```bash
cat pacta_appweb/public/locales/es/contracts.json | python3 -m json.tool > /dev/null && echo "Valid ES"
cat pacta_appweb/public/locales/en/contracts.json | python3 -m json.tool > /dev/null && echo "Valid EN"
```

**Step 4: Commit**

```bash
git add pacta_appweb/public/locales/es/contracts.json pacta_appweb/public/locales/en/contracts.json
git commit -m "i18n: add legal field translations (ES/EN)"
```

---

### Task 3: Testing visual

**Step 1: Verificar formulario en navegador**

Usar skill /browse para verificar:
- Ir a ContractsPage
- Click "New Contract"
- Seleccionar "Cliente (recibimos el servicio/producto)" → Ver campos legales completos
- Cancelar
- Click "New Contract"  
- Seleccionar "Proveedor (brindamos el servicio/producto)" → Ver campos básicos solo

**Step 2: Commit**

```bash
git add -A && git commit -m "test: verify conditional forms work"
```

---

## Checkpoint: Después de cada Fase

- [ ] Tests pasan: `npm test`
- [ ] Build pasa: `npm run build`
- [ ] Formularios visibles en español e inglés

---

## GitHub Issues a Crear

| Phase | Issue | Título | Labels |
|-------|-------|--------|--------|
| 1 | #150 (existing) | Fix: Type errors in ContractsPage.tsx | bug, frontend, typescript |
| 2 | #151 | Feat: Add conditional legal fields by role | enhancement, frontend |
| 2 | #152 | i18n: Add legal field translations | i18n, frontend |

---

## Dependencies entre Tasks

```
Fase 1 → Fase 2
  Task 1    Task 1 (diseño)
  Task 2    Task 2 (i18n)
            Task 3 (testing)
```

**Orden de ejecución:** Fase 1 tasks → Fase 2 tasks

---

## Ejecución

**Plan complete and saved to `docs/plans/2026-04-19-contract-forms-refactor-implementation.md`. Tres opciones:**

**1. Subagent-Driven (this session)** - Implemento cada task, reviso entre tasks

**2. Parallel Session (separate)** - Nueva sesión con executing-plans

**3. Plan-to-Issues (team workflow)** - Convierte a GitHub issues

**¿Qué enfoque prefieres?**