# Contratos Multiempresa - Implementation Plan v2

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical bugs in contract form (company_id missing, reset on company change) and add filters to other pages

**Architecture:** Three fixes in ContractForm + three page extensions. Each task is independent.

**Tech Stack:** React, TypeScript, Go (handlers), chi router

---

## Fase 1: Fixes Críticos (ContractForm)

### Task 1: Enviar company_id al crear contrato

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractForm.tsx:44-62`

**Step 1: Localizar onSubmit**

El submit actual no envía company_id. Buscar la función que llama a onSubmit.

```typescript
// Encontrar around línea 550-600
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  onSubmit(formData);  // FALTA company_id
};
```

**Step 2: Modificar para incluir company_id**

Reemplazar:
```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  onSubmit({
    ...formData,
    company_id: selectedOwnCompany?.id,
  });
};
```

**Step 3: Verificar que selectedOwnCompany tiene valor**

Asegurar que la línea de useState existe:
```typescript
const [selectedOwnCompany, setSelectedOwnCompany] = useState<Company | null>(null);
```

---

### Task 2: Reset contraparte al cambiar empresa

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractForm.tsx:275-297`

**Step 1: Localizar el onValueChange del selector de empresa**

Encontrar el Select que updates selectedOwnCompany:

```typescript
<Select
  value={selectedOwnCompany?.id?.toString()}
  onValueChange={(value) => {
    const company = ownCompanies.find(c => c.id === parseInt(value));
    setSelectedOwnCompany(company);
    // FALTA: reset de contraparte
  }}
>
```

**Step 2: Agregar cleanup**

Reemplazar onValueChange:
```typescript
onValueChange={(value) => {
  const company = ownCompanies.find(c => c.id === parseInt(value));
  setSelectedOwnCompany(company || null);
  // Resetear contraparte y firmantes
  setFormData(prev => ({
    ...prev,
    client_id: '',
    supplier_id: '',
    client_signer_id: '',
    supplier_signer_id: ''
  }));
  setClientSigners([]);
  setSupplierSigners([]);
}}
```

**Step 3: Verificar estados existen**

Buscar que estos estados están definidos:
```typescript
const [clientSigners, setClientSigners] = useState<any[]>([]);
const [supplierSigners, setSupplierSigners] = useState<any[]>([]);
```

---

### Task 3: Validar FK en backend al crear contrato

**Files:**
- Modify: `internal/handlers/contracts.go:190-220`

**Step 1: Localizar createContract handler**

Encontrar función createContract (NEW or POST).

**Step 2: Añadir validación FK**

Después de recibir req.ClientID y req.SupplierID, agregar:

```go
// Validar que client pertenece a la empresa
if req.ClientID != nil && *req.ClientID > 0 {
    var clientCompanyID int
    err := h.DB.QueryRow("SELECT company_id FROM clients WHERE id = ?", *req.ClientID).Scan(&clientCompanyID)
    if err != nil || clientCompanyID != companyID {
        h.Error(w, http.StatusBadRequest, "client does not belong to selected company")
        return
    }
}

// Validar que supplier pertenece a la empresa
if req.SupplierID != nil && *req.SupplierID > 0 {
    var supplierCompanyID int
    err := h.DB.QueryRow("SELECT company_id FROM suppliers WHERE id = ?", *req.SupplierID).Scan(&supplierCompanyID)
    if err != nil || supplierCompanyID != companyID {
        h.Error(w, http.StatusBadRequest, "supplier does not belong to selected company")
        return
    }
}
```

**Step 3: Verificar estructura del request**

Asegurar que ClientID y SupplierID tienen punteros en el struct de request.

---

## Fase 2: Extensions a Otras Páginas

### Task 4: ContractsPage - Filter por empresa

**Files:**
- Modify: `pacta_appweb/src/pages/ContractsPage.tsx:42-45`

**Step 1: Añadir estado para filter**

Ya existe companyFilter en línea 45:
```typescript
const [companyFilter, setCompanyFilter] = useState<string>('all');
```

**Step 2: Añadir opciones de dropdown para cada empresa propia**

En el Select de companyFilter (línea 279), añadir:
```typescript
{ownCompanies && ownCompanies.map((company) => (
  <SelectItem key={company.id} value={company.id.toString()}>
    {company.name}
  </SelectItem>
))}
```

**Step 3: Verificar que ownCompanies se carga**

Buscar useEffect que carga empresas:
```typescript
const [ownCompanies, setOwnCompanies] = useState<Company[]>([]);
```

Si no existe, añadir importación y estado.

---

### Task 5: SupplementsPage - Filter por empresa

**Files:**
- Modify: `pacta_appweb/src/pages/SupplementsPage.tsx:45-49`

**Step 1: Verificar estado existente**

Ya debería existir companyFilter.

**Step 2: Añadir opciones de dropdown**

Mismo patrón que Task 4.

**Step 3: Asegurar que ownCompanies se carga**

Añadir si no existe.

---

### Task 6: ReportsPage - Filter por empresa

**Files:**
- Modify: `pacta_appweb/src/pages/ReportsPage.tsx:50-54`

**Step 1: Verificar estado existente**

Ya debería existir companyFilter.

**Step 2: Añadir opciones de dropdown**

Mismo patrón que Task 4.

**Step 3: Asegurar que ownCompanies se carga**

Añadir si no existe.

---

## Verificación

### Testing Commands

```bash
# Frontend dev
cd pacta_appweb && npm run dev

# Backend dev  
cd cmd/pacta && go run .

# Verificar ContractForm
# 1. Abrir http://127.0.0.1:3000/contracts/new
# 2. Con 1 empresa → auto-selecciona
# 3. Con múltiples → dropdown visible
# 4. Cambiar empresa → se limpia contraparte

# Verificar filters
# ContractsPage, SupplementsPage, ReportsPage tienen dropdown de empresa
```

---

## Estado Final

| Task | Descripción | Estado |
|------|-------------|--------|
| 1 | company_id en submit | Todo |
| 2 | Reset al cambiar empresa | Todo |
| 3 | Validación FK backend | Todo |
| 4 | ContractsPage filter | Todo |
| 5 | SupplementsPage filter | Todo |
| 6 | ReportsPage filter | Todo |

**Plan complete and saved to `docs/plans/2026-04-22-contratos-multiempresa-v2-plan.md`.**

Three execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**3. Plan-to-Issues (team workflow)** - Convert plan tasks to GitHub issues for team distribution

**Which approach?**