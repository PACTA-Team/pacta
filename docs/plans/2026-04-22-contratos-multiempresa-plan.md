# Contratos Multiempresa Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adaptar el formulario de contratos al sistema multiempresa: selección automática de empresa propia, filtrado de clientes/proveedores por empresa, creación inline de entidades.

**Architecture:** Añadir lógica de selección de empresa propia al ContractForm, modificar APIs para filtrar por company_id, crear modales inline para creación de clientes/proveedores/firmantes.

**Tech Stack:** React, TypeScript, Go (backend API), chi router

---

## Fase 1: Backend API - Añadir company_id filtering

### Task 1: Modificar handler de clients para filtrar por company_id

**Files:**
- Modify: `internal/handlers/clients.go` (Añadir query param company_id)

**Step 1: Añadir filtrado por company_id**

```go
// En función List, después de verificar sesión
companyID := r.URL.Query().Get("company_id")
if companyID != "" {
    cid, _ := strconv.Atoi(companyID)
    query += " AND company_id = ?"
    args = append(args, cid)
}
```

**Step 2: Probar endpoint**

```bash
curl "http://localhost:3000/api/clients?company_id=1"
```

Expected: Solo devuelve clients con company_id=1

---

### Task 2: Modificar handler de suppliers para filtrar por company_id

**Files:**
- Modify: `internal/handlers/suppliers.go`

Mismo patrón que Task 1

---

### Task 3: Modificar handler de signers para filtrar

**Files:**
- Modify: `internal/handlers/signers.go`

Filtrar por company_type + company_id

---

## Fase 2: Frontend API - Añadir métodos con company_id

### Task 4: Añadir listByCompany a clients-api

**Files:**
- Modify: `pacta_appweb/src/lib/clients-api.ts`

**Step 1: Añadir método**

```typescript
static async listByCompany(companyId: number): Promise<Client[]> {
  const res = await fetch(`${API_URL}/clients?company_id=${companyId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch clients');
  return res.json();
}
```

---

### Task 5: Añadir listByCompany a suppliers-api

**Files:**
- Modify: `pacta_appweb/src/lib/suppliers-api.ts`

Mismo patrón que Task 4

---

### Task 6: Añadir listOwnCompanies a companies-api

**Files:**
- Modify: `pacta_appweb/src/lib/companies-api.ts`

```typescript
static async listOwnCompanies(): Promise<Company[]> {
  const res = await fetch(`${API_URL}/companies?own=true`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch companies');
  return res.json();
}
```

---

## Fase 3: ContractForm - Lógica multiempresa

### Task 7: Añadir estados para empresa propia y counterpart

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractForm.tsx`

**Step 1: Añadir estados**

```typescript
const [ownCompanies, setOwnCompanies] = useState<Company[]>([]);
const [selectedOwnCompany, setSelectedOwnCompany] = useState<Company | null>(null);
const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
const [showNewClientModal, setShowNewClientModal] = useState(false);
```

**Step 2: Cargar empresas propias al montar**

```typescript
useEffect(() => {
  const loadOwnCompanies = async () => {
    const companies = await companiesAPI.listOwnCompanies();
    setOwnCompanies(companies);
    if (companies.length === 1) {
      setSelectedOwnCompany(companies[0]);
    }
  };
  loadOwnCompanies();
}, []);
```

---

### Task 8: Modificar lógica de carga de contrapartes

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractForm.tsx:115-151`

**Step 1: Cambiar carga según rol**

```typescript
useEffect(() => {
  const loadCounterparts = async () => {
    if (!selectedOwnCompany) return;
    
    if (ourRole === 'client') {
      // Somos cliente → cargar proveedores de nuestra empresa
      const suppliersData = await suppliersAPI.listByCompany(selectedOwnCompany.id);
      setSuppliers(suppliersData);
    } else {
      // Somos proveedor → cargar clientes de nuestra empresa
      const clientsData = await clientsAPI.listByCompany(selectedOwnCompany.id);
      setClients(clientsData);
    }
  };
  loadCounterparts();
}, [selectedOwnCompany, ourRole]);
```

---

### Task 9: Añadir selector de empresa propia (modo multiempresa)

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractForm.tsx:236-258`

**Step 1: Añadir dropdown conditional**

```typescript
{!isEditing && ownCompanies.length > 1 && (
  <div className="space-y-2">
    <Label>Seleccionar Empresa *</Label>
    <Select 
      value={selectedOwnCompany?.id?.toString()} 
      onValueChange={(value) => {
        const company = ownCompanies.find(c => c.id === parseInt(value));
        setSelectedOwnCompany(company);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Seleccionar empresa" />
      </SelectTrigger>
      <SelectContent>
        {ownCompanies.map((company) => (
          <SelectItem key={company.id} value={company.id.toString()}>
            {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

---

### Task 10: Añadir botón "Nuevo proveedor" y "Nuevo cliente"

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractForm.tsx`

En el selector de supplier (línea ~301) y client (línea ~263):

```typescript
// Después del último SelectItem
<Button 
  type="button" 
  variant="outline" 
  className="w-full mt-2"
  onClick={() => setShowNewSupplierModal(true)}
>
  + Nuevo Proveedor
</Button>
```

Igual para cliente

---

## Fase 4: Modales inline para creación

### Task 11: Crear SupplierInlineModal

**Files:**
- Create: `pacta_appweb/src/components/modals/SupplierInlineModal.tsx`

Basado en el formulario existente de supplier, simplificar para uso inline

```typescript
interface SupplierInlineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  onCreated: (supplier: Supplier) => void;
}
```

---

### Task 12: Crear ClientInlineModal

**Files:**
- Create: `pacta_appweb/src/components/modals/ClientInlineModal.tsx`

Mismo patrón que Task 11

---

### Task 13: Crear SignerInlineModal

**Files:**
- Create: `pacta_appweb/src/components/modals/SignerInlineModal.tsx`

Para crear firmante asociado a client/supplier

---

## Fase 5: Integración de modales en ContractForm

### Task 14: Integrar SupplierInlineModal

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractForm.tsx`

**Step 1: Importar modal**

```typescript
import SupplierInlineModal from '@/components/modals/SupplierInlineModal';
```

**Step 2: Añadir en JSX**

```typescript
<SupplierInlineModal
  open={showNewSupplierModal}
  onOpenChange={setShowNewSupplierModal}
  companyId={selectedOwnCompany?.id}
  onCreated={(supplier) => {
    setSuppliers([...suppliers, supplier]);
    setFormData({ ...formData, supplier_id: supplier.id.toString() });
  }}
/>
```

---

### Task 15: Integrar ClientInlineModal

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractForm.tsx`

Mismo patrón que Task 14

---

## Fase 6: Extensiones a otras páginas

### Task 16: ContractsPage - Añadir filter por empresa

**Files:**
- Modify: `pacta_appweb/src/pages/ContractsPage.tsx`

Añadir columna "Empresa" en tabla y filter dropdown

---

### Task 17: SupplementsPage - Filter por empresa

**Files:**
- Modify: `pacta_appweb/src/pages/SupplementsPage.tsx`

Añadir filter por empresa activa

---

### Task 18: ReportsPage - Filter por empresa

**Files:**
- Modify: `pacta_appweb/src/pages/ReportsPage.tsx`

Añadir filter por empresa activa

---

## Fallback/Testing

### Task 19: Verificar backward compatibility

Si solo hay 1 empresa:
- Selección automática
- Funcionamiento idéntico al anterior

---

**Plan Execution:**

Three execution options:

1. **Subagent-Driven (this session)** - Dispacho subagentes por tarea, revisión entre tareas
2. **Parallel Session (separate)** - Nueva sesión con executing-plans
3. **Plan-to-Issues** - Convertir a GitHub issues

**Which approach?**