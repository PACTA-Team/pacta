# Refactorización Formulario de Contratos - Diseño Técnico (v3 Completo)

**Fecha:** 2026-04-24  
**Estado:** Aprobado  
**Proyecto:** PACTA  
**Solicitado por:** Refactorización formulario multiempresa  
**Skill involucrada:** UI/UX Pro Max + Brainstorming + Plan Eng Review  
**Versión:** 3.0 — Completo con testing, hooks compartidos, y robustez productiva

---

## 1. Contexto y Problema

### 1.1 Situación Actual

El sistema permite a usuarios gestionar múltiples empresas propias. Al crear un contrato, el usuario debe seleccionar:
1. Qué empresa propia actúa en el contrato (cliente o proveedor)
2. La contraparte (proveedor o cliente respectivamente)
3. Los responsables autorizados de ambas partes

**Problemas identificados:**

| # | Problema | Impacto |
|---|----------|---------|
| 1 | Formulario monolítico (`ContractForm`) maneja ambos roles → lógica confusa, difícil mantener | Alto |
| 2 | Botones "Agregar nuevo proveedor/cliente" aparecen en posiciones incorrectas según rol | Medio |
| 3 | No existe upload **obligatorio** del documento del contrato en el formulario | Alto (legal) |
| 4 | Falta botón para agregar **responsable** de la contraparte recién creada | Medio |
| 5 | Botones demasiado grandes → Poor UI/UX, desperdician espacio | Bajo |
| 6 | Auto-selección empresa funciona, pero contraparte no → usuario debe seleccionar even si hay 1 | Bajo |
| 7 | **Filtros por empresa rotos en ContractsPage y ReportsPage** | **Crítico** |
| 8 | **Actualización de contrato no valida que client/supplier pertenecen a company** | **Crítico** |
| 9 | **Sin tests automáticos** — regresiones altamente probables | **Crítico** |

### 1.2 Objetivo

Refactorizar el formulario de creación de contratos para:
- Separar responsabilidades (SOLID)
- Mostrar controles dinámicos correctos según rol
- Agregar subida obligatoria de documento de contrato
- Mejorar UX con botones compactos
- Implementar manejo de partial failure (documento temp)
- Asegurar filtros por empresa funcionan en todas las páginas
- Validar ownership en actualización de contratos
- Alcanzar ≥85% test coverage
- Mantener backward compatibility con edición existente

---

## 2. Arquitectura Propuesta

### 2.1 Estructura de Componentes (Actualizada)

```
ContractFormWrapper (orquestador)
├── Estado global (ownCompanies, selectedCompany, ourRole)
├── Selector de empresa propia (si hay >1)
├── RadioGroup: Rol (cliente | proveedor)
└── Renderizado condicional:
    ├── ClientContractForm (ourRole === 'client')
    │   ├── Cliente (contraparte) Select + [Agregar] btn (sm)
    │   ├── Responsable Cliente Select + [Agregar] btn (sm)
    │   ├── Legal fields (collapsible)
    │   ├── ContractDocumentUpload (required)
    │   └── Submit
    └── SupplierContractForm (ourRole === 'supplier')
        ├── Proveedor Select + [Agregar] btn (sm)
        ├── Responsable Proveedor Select + [Agregar] btn (sm)
        ├── Legal fields (collapsible)
        ├── ContractDocumentUpload (required)
        └── Submit

Shared Hooks (NUEVOS):
├── useOwnCompanies() → carga y cachea empresas propias
├── useCompanyFilter(items, currentCompany, companyFilter) → filtra por empresa
└── useDocumentCleanup(pendingDocument, existingDocuments) → cleanup en unmount

Backend Extensions:
├── POST /api/contracts → valida document_url required
├── PUT /api/contracts/:id → valida client/supplier ownership (nuevo)
└── DELETE /api/documents/temp/{key} → elimina archivos temporales (nuevo)
```

### 2.2 Componentes Nuevos

| Componente | Responsabilidad | Reutilizable |
|------------|----------------|--------------|
| `ContractFormWrapper` | Orquestación, estado compartido, envío unificado | No |
| `ClientContractForm` | Formulario cuando empresa propia = cliente | Sí (patrón) |
| `SupplierContractForm` | Formulario cuando empresa propia = proveedor | Sí (patrón) |
| `ContractDocumentUpload` | Upload + gestión de documento contrato (required) | Sí |
| `SignerInlineModal` | Modal para agregar responsable autorizado | Sí |
| `ResponsiblePersonForm` | Formulario campos responsable (dentro modal) | Sí |

### 2.3 Hooks Compartidos (NUEVOS)

#### `useOwnCompanies`
```typescript
// Ubicación: pacta_appweb/src/hooks/useOwnCompanies.ts
export function useOwnCompanies(): {
  ownCompanies: Company[];
  currentCompany: Company | null;
  isMultiCompany: boolean;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  // Cache en localStorage con TTL 5min
  // Retorna empresas del usuario, auto-select si solo hay 1
}
```

**Uso:** Reemplaza `ownCompanies` state en `ContractsPage`, `SupplementsPage`, `ReportsPage`, y `ContractFormWrapper`.

#### `useCompanyFilter`
```typescript
// Ubicación: pacta_appweb/src/hooks/useCompanyFilter.ts
export function useCompanyFilter<T extends { client_id: number; supplier_id: number }>(
  items: T[],
  currentCompany: Company | null,
  companyFilter: string
): T[] {
  // Acepta: 'all', 'client', 'other', o companyId numérico como string
  // Retorna items filtrados consistentemente
}
```

**Uso:** En `ContractsPage`, `SupplementsPage`, `ReportsPage` para filtrar contratos/supplements por empresa.

#### `useDocumentCleanup`
```typescript
// Ubicación: pacta_appweb/src/hooks/useDocumentCleanup.ts
export function useDocumentCleanup(
  pendingDocument: { key: string; url: string } | null,
  existingDocuments: APIDocument[]
): void {
  // useEffect que llama a DELETE /api/documents/temp/:key
  // Solo si el documento no está ya asociado a un contrato existente
}
```

**Uso:** En `ContractDocumentUpload` component.

### 2.4 Componentes Existentes Reutilizados

- `ClientInlineModal` → ya existe, se usa desde `ClientContractForm`
- `SupplierInlineModal` → ya existe, se usa desde `SupplierContractForm`
- `AuthorizedSignerForm` → posible reuso para `ResponsiblePersonForm`
- API handlers: `clientsAPI`, `suppliersAPI`, `signersAPI`, `documentsAPI`, `companiesAPI`

---

## 3. Flujo de Datos (Actualizado)

### 3.1 Estado Global (Wrapper)

```typescript
interface ContractFormWrapperState {
  ownCompanies: Company[];           // Lista empresas propias del usuario (desde hook)
  selectedOwnCompany: Company | null; // Empresa seleccionada
  ourRole: 'client' | 'supplier';     // Rol de NUESTRA empresa
  pendingDocument: {url, key, file} | null; // Documento pendiente
  clients: any[];                     // Clientes de la empresa (cargados dinámicamente)
  suppliers: any[];                   // Proveedores de la empresa
  signers: any[];                     // Firmantes de la contraparte
}

// Derived:
// - contraparteType = ourRole === 'client' ? 'supplier' : 'client'
// - contraparteLabel = ourRole === 'client' ? 'Proveedor' : 'Cliente'
```

### 3.2 Flujo de Creación (nuevo contrato)

```
1. Wrapper carga ownCompanies via useOwnCompanies()
2. Si length === 1 → auto-selecciona
3. Si length > 1 → usuario selecciona empresa
4. Usuario selecciona rol (RadioGroup)
5. Wrapper renderiza formulario hijo correspondiente (con key={companyId})
6. Hijo muestra:
   - Select de contraparte (vacio inicial)
   - Select de responsable (disabled hasta contraparte)
   - Botones pequeños [+] para agregar contraparte/responsable
   - Upload documento contrato (required)
7. Usuario puede:
   a) Seleccionar contraparte existente
   b) Crear nueva contraparte → modal → onSuccess recarga lista
8. Usuario puede:
   a) Seleccionar responsable existente (ya filtrado por contraparte)
   b) Crear nuevo responsable → modal → onSuccess recarga lista
9. Subir documento contrato → pendingDocument guardado
10. Submit:
    - Validar: company_id, client_id/supplier_id, signer_id, documento
    - Wrapper ensambla payload final:
      {
        ...formData,
        company_id: selectedOwnCompany.id,
        document_url: pendingDocument.url,
        document_key: pendingDocument.key
      }
    - Enviar a API
    - Éxito: limpiar pendingDocument, toast, cerrar
    - Error: mantener pendingDocument + mensaje específico
```

### 3.3 Flujo de Edición (contrato existente)

```
1. Wrapper recibe prop: contract
2. ourRole = contract.client_id ? 'client' : 'supplier'
3. selectedOwnCompany se determina desde contract.company_id (solo lectura)
4. Renderiza formulario hijo correspondiente
5. Hijo carga datos existentes en selects
6. Edición de documento: managed por ContractDocumentUpload (listar + agregar + eliminar)
7. Submit: igual que creación, pero sin company_id change
```

---

## 4. Especificación de Componentes (Actualizada)

### 4.1 ContractFormWrapper

**Props:**
```typescript
interface ContractFormWrapperProps {
  contract?: Contract;                  // undefined = nuevo contrato
  onSubmit: (data: ContractSubmitData) => void;
  onCancel: () => void;
}

interface ContractSubmitData {
  contract_number: string;
  client_id: number;
  supplier_id: number;
  client_signer_id?: number;
  supplier_signer_id?: number;
  start_date: string;
  end_date: string;
  amount: number;
  type: ContractType;
  status?: ContractStatus;
  description?: string;
  object?: string;
  fulfillment_place?: string;
  dispute_resolution?: string;
  has_confidentiality?: boolean;
  guarantees?: string;
  renewal_type?: string;
  company_id: number;                   // ← requerido
  document_url: string;                 // ← requerido
  document_key: string;                 // ← requerido
}
```

**Estado interno (usando hook):**
```typescript
const { 
  ownCompanies, 
  currentCompany, 
  isMultiCompany, 
  loading: loadingCompanies 
} = useOwnCompanies();

const [selectedOwnCompany, setSelectedOwnCompany] = useState<Company | null>(
  contract ? { id: contract.company_id, name: '', ... } : currentCompany
);

const [ourRole, setOurRole] = useState<'client' | 'supplier'>('client');
const [pendingDocument, setPendingDocument] = useState<{url:string,key:string,file:File} | null>(null);

// Manual state para clients/suppliers/signers (por company_id)
const [clients, setClients] = useState<any[]>([]);
const [suppliers, setSuppliers] = useState<any[]>([]);
const [signers, setSigners] = useState<any[]>([]);

// Modal flags
const [showNewClientModal, setShowNewClientModal] = useState(false);
const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
const [showNewSignerModal, setShowNewSignerModal] = useState(false);

// Ref para tracking de IDs actuales (para callbacks de modales)
const formDataRef = useRef<{client_id?: string, supplier_id?: string}>({});
```

**Efectos:**
```typescript
// Cargar clients/suppliers cuando company y rol cambian
useEffect(() => {
  if (!selectedOwnCompany) return;
  
  const loadCounterparts = async () => {
    try {
      if (ourRole === 'client') {
        const data = await suppliersAPI.listByCompany(selectedOwnCompany.id);
        setSuppliers(data);
      } else {
        const data = await clientsAPI.listByCompany(selectedOwnCompany.id);
        setClients(data);
      }
    } catch (err) {
      toast.error('Failed to load counterparts');
    }
  };
  loadCounterparts();
}, [selectedOwnCompany, ourRole]);

// Cargar signers cuando contraparte seleccionada
useEffect(() => {
  const loadSigners = async () => {
    const all = await signersAPI.list();
    const counterpartId = ourRole === 'client' 
      ? formDataRef.current.client_id 
      : formDataRef.current.supplier_id;
    
    if (counterpartId) {
      const filtered = (all as any[]).filter(
        (s: any) => 
          s.company_id === parseInt(counterpartId) && 
          s.company_type === ourRole === 'client' ? 'client' : 'supplier'
      );
      setSigners(filtered);
    } else {
      setSigners([]);
    }
  };
  loadSigners();
}, [formDataRef.current.client_id, formDataRef.current.supplier_id, ourRole]);
```

**Handlers:**
```typescript
const handleCompanyChange = (companyId: string) => {
  const company = ownCompanies.find(c => c.id === parseInt(companyId));
  setSelectedOwnCompany(company || null);
  // Limpiar pendingDocument al cambiar empresa
  if (pendingDocument) {
    setPendingDocument(null);
    toast.info('Se ha limpiado el documento debido al cambio de empresa');
  }
};

const handleRoleChange = (role: 'client' | 'supplier') => {
  setOurRole(role);
};

const handleSubmit = async (formData: any) => {
  if (!selectedOwnCompany) {
    toast.error('Seleccione una empresa');
    return;
  }
  if (!pendingDocument) {
    toast.error('Adjunte el documento del contrato');
    return;
  }
  
  try {
    await onSubmit({
      ...formData,
      company_id: selectedOwnCompany.id,
      document_url: pendingDocument.url,
      document_key: pendingDocument.key,
    });
    // Éxito total: limpiar documento
    setPendingDocument(null);
  } catch (err: any) {
    // Partial failure: mantener pendingDocument para reintento
    const message = err instanceof Error ? err.message : 'Error al guardar contrato';
    
    // Detectar error de validación de documento
    if (err.response?.status === 400 && message.toLowerCase().includes('document')) {
      toast.error('El documento es obligatorio. Por favor adjunte el contrato.');
      // No limpiar pendingDocument — usuario puede reintentar
    } else {
      toast.error(message);
    }
    
    // NO limpiar pendingDocument → UI mantiene preview
    throw err;
  }
};

const handleAddDocument = (doc: {url:string,key:string,file:File}) => {
  setPendingDocument(doc);
};

const handleRemoveDocument = () => {
  setPendingDocument(null);
};

// Callbacks para hijos
const handleClientIdChange = (clientId: string) => {
  formDataRef.current.client_id = clientId;
};

const handleSupplierIdChange = (supplierId: string) => {
  formDataRef.current.supplier_id = supplierId;
};
```

**Render:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>{contract ? t('editContract') : t('newContract')}</CardTitle>
  </CardHeader>
  <CardContent>
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Selector empresa propia (si múltiples) */}
      {isMultiCompany && !contract && (
        <div className="space-y-2">
          <Label>Seleccionar Empresa *</Label>
          <Select
            value={selectedOwnCompany?.id?.toString() || ''}
            onValueChange={handleCompanyChange}
            disabled={loadingCompanies}
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

      {/* Selector rol (solo nuevo contrato) */}
      {!contract && (
        <RadioGroup value={ourRole} onValueChange={(v) => handleRoleChange(v as 'client' | 'supplier')}>
          <Label>Esta empresa actúa como</Label>
          <div className="flex gap-6">
            <RadioItem value="client" label="Cliente (recibimos servicio)" />
            <RadioItem value="supplier" label="Proveedor (brindamos servicio)" />
          </div>
        </RadioGroup>
      )}

      {/* Formulario dinámico por rol — remonta con key al cambiar empresa */}
      {selectedOwnCompany && (
        <>
          {ourRole === 'client' ? (
            <ClientContractForm
              key={`client-${selectedOwnCompany.id}`}
              companyId={selectedOwnCompany.id}
              contract={contract}
              clients={clients}
              signers={signers}
              onClientIdChange={handleClientIdChange}
              onAddClient={() => setShowNewClientModal(true)}
              onAddResponsible={() => setShowNewSignerModal(true)}
              pendingDocument={pendingDocument}
              onDocumentChange={handleAddDocument}
              onDocumentRemove={handleRemoveDocument}
            />
          ) : (
            <SupplierContractForm
              key={`supplier-${selectedOwnCompany.id}`}
              companyId={selectedOwnCompany.id}
              contract={contract}
              suppliers={suppliers}
              signers={signers}
              onSupplierIdChange={handleSupplierIdChange}
              onAddSupplier={() => setShowNewSupplierModal(true)}
              onAddResponsible={() => setShowNewSignerModal(true)}
              pendingDocument={pendingDocument}
              onDocumentChange={handleAddDocument}
              onDocumentRemove={handleRemoveDocument}
            />
          )}
        </>
      )}

      {/* Botones acción */}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" form="contract-form">
          {contract ? 'Actualizar Contrato' : 'Crear Contrato'}
        </Button>
      </div>
    </form>

    {/* Modals inline */}
    {showNewClientModal && selectedOwnCompany && (
      <ClientInlineModal
        companyId={selectedOwnCompany.id}
        open={showNewClientModal}
        onOpenChange={setShowNewClientModal}
        onSuccess={async () => {
          try {
            const data = await clientsAPI.listByCompany(selectedOwnCompany.id);
            setClients(data);
          } catch (err) {
            toast.error('Error al cargar clientes');
          }
        }}
      />
    )}

    {showNewSupplierModal && selectedOwnCompany && (
      <SupplierInlineModal
        companyId={selectedOwnCompany.id}
        open={showNewSupplierModal}
        onOpenChange={setShowNewSupplierModal}
        onSuccess={async () => {
          try {
            const data = await suppliersAPI.listByCompany(selectedOwnCompany.id);
            setSuppliers(data);
          } catch (err) {
            toast.error('Error al cargar proveedores');
          }
        }}
      />
    )}

    {showNewSignerModal && selectedOwnCompany && (
      <SignerInlineModal
        companyId={selectedOwnCompany.id}
        companyType={ourRole === 'client' ? 'client' : 'supplier'}
        open={showNewSignerModal}
        onOpenChange={setShowNewSignerModal}
        onSuccess={async () => {
          try {
            const counterpartId = ourRole === 'client'
              ? formDataRef.current.client_id
              : formDataRef.current.supplier_id;
            
            if (counterpartId) {
              const all = await signersAPI.list();
              const filtered = (all as any[]).filter(
                (s: any) => 
                  s.company_id === parseInt(counterpartId) && 
                  s.company_type === (ourRole === 'client' ? 'client' : 'supplier')
              );
              setSigners(filtered);
            }
          } catch (err) {
            toast.error('Error al cargar responsables');
          }
        }}
      />
    )}
  </CardContent>
</Card>
```

---

## 5. Validación (Actualizada)

### 5.1 Frontend

```typescript
const validate = () => {
  const errors: string[] = [];

  if (!selectedOwnCompany) {
    errors.push('Seleccione una empresa');
  }
  if (!formData.contraparte_id) {
    errors.push('Seleccione la contraparte');
  }
  if (!formData.responsable_id) {
    errors.push('Seleccione el responsable');
  }
  if (!pendingDocument && !contract) {
    errors.push('Adjunte el documento del contrato');
  }
  if (!formData.start_date || !formData.end_date) {
    errors.push('Complete las fechas');
  }
  if (!formData.contract_number) {
    errors.push('Ingrese número de contrato');
  }
  if (formData.amount <= 0) {
    errors.push('Monto debe ser mayor a 0');
  }

  return errors;
};
```

### 5.2 Backend (Go handler)

**En `createContract` (internal/handlers/contracts.go:153-267):**

```go
// Ya existe validación de client/supplier company match

// AÑADIR: validar documento presente
if req.DocumentURL == nil || *req.DocumentURL == "" {
    h.Error(w, http.StatusBadRequest, "document is required")
    return
}

// AÑADIR: validar formato URL (debe ser S3 URL válida)
if req.DocumentURL != nil && !strings.HasPrefix(*req.DocumentURL, "https://") {
    h.Error(w, http.StatusBadRequest, "invalid document URL")
    return
}
```

**En `updateContract` (internal/handlers/contracts.go:296-402):**

```go
// AÑADIR: validar ownership de client/supplier
var currentCompanyID int
err := h.DB.QueryRow("SELECT company_id FROM contracts WHERE id = ? AND deleted_at IS NULL", id).Scan(&currentCompanyID)
if err != nil {
    h.Error(w, http.StatusNotFound, "contract not found")
    return
}

// Validate new client belongs to contract's company
if req.ClientID > 0 {
    var clientCompanyID int
    err := h.DB.QueryRow("SELECT company_id FROM clients WHERE id = ?", req.ClientID).Scan(&clientCompanyID)
    if err != nil || clientCompanyID != currentCompanyID {
        h.Error(w, http.StatusBadRequest, "client does not belong to contract company")
        return
    }
}

// Validate new supplier belongs to contract's company
if req.SupplierID > 0 {
    var supplierCompanyID int
    err := h.DB.QueryRow("SELECT company_id FROM suppliers WHERE id = ?", req.SupplierID).Scan(&supplierCompanyID)
    if err != nil || supplierCompanyID != currentCompanyID {
        h.Error(w, http.StatusBadRequest, "supplier does not belong to contract company")
        return
    }
}

// AÑADIR: permitir actualizar document_url si se proporciona
if req.DocumentURL != nil && *req.DocumentURL != "" {
    // Incluir en UPDATE statement
}
```

---

## 6. UI/UX Spec (UI/UX Pro Max Applied) — Sin cambios

*( Mantiene same especificación visual que diseño original )*

---

## 7. Plan de Migración (Actualizado — Fases Expandidas)

### Fase 0: Preparación (sin impacto usuario)

**Tasks:**
- [ ] Crear/types faltantes: `ContractSubmitData`, `PendingDocument` en `types/contract.ts`
- [ ] Crear hook `useOwnCompanies.ts` con cache en localStorage
- [ ] Crear hook `useCompanyFilter.ts` (usado en 3 páginas)
- [ ] Crear hook `useDocumentCleanup.ts`
- [ ] Añadir migration SQL: 
  ```sql
  ALTER TABLE contracts ADD COLUMN document_url TEXT NULL;
  ALTER TABLE contracts ADD COLUMN document_key TEXT NULL;
  ```
- [ ] Implementar backend endpoint `DELETE /api/documents/temp/{key}` con ownership validation
- [ ] Añadir validación `document_url required` en `createContract` handler
- [ ] Añadir validación ownership en `updateContract` handler
- [ ] Crear `ContractDocumentUpload.tsx` (componente base con cleanup)
- [ ] Crear `SignerInlineModal.tsx` (copiando patrón de Client/SupplierInlineModal)
- [ ] Crear `ContractFormWrapper.tsx`, `ClientContractForm.tsx`, `SupplierContractForm.tsx` (estructura vacía)
- [ ] Escribir tests unitarios básicos (render) para TODOS los nuevos componentes

**Commit:** "chore(contracts): prepare refactor — add types, hooks, and cleanup infrastructure"

---

### Fase 1: Wrapper y lógica (backward compatible)

- [ ] Implementar lógica completa de `ContractFormWrapper` con state management
- [ ] Implementar `ClientContractForm` con todos los campos (como `ContractForm` actual)
- [ ] Implementar `SupplierContractForm` espejo
- [ ] Integrar `ContractDocumentUpload` en ambos formularios (required)
- [ ] Pasar `pendingDocument` state y handlers desde Wrapper
- [ ] Conectar modales: `ClientInlineModal`, `SupplierInlineModal`, `SignerInlineModal`
- [ ] Añadir botones [+] compactos (size="sm", h-8 w-8) con Tooltip
- [ ] Implementar `handleCompanyChange` que limpia `pendingDocument`
- [ ] Actualizar `ContractsPage` para usar nuevo `ContractForm` (import unchanged)
- [ ] Verificar que creación y edición funcionan igual que antes
- [ ] NO desplegar a producción hasta Fase 2

**Commit:** "feat(contracts): refactor ContractForm to Wrapper architecture with role-based rendering"

---

### Fase 2: Validación y Partial Failure

- [ ] Añadir validación frontend en `ClientContractForm` y `SupplierContractForm` (required fields, documento)
- [ ] Implementar `handleSubmit` en Wrapper con try/catch para partial failure
- [ ] Test manual: submit sin documento → error → documento se mantiene
- [ ] Test manual: submit con error 500 → documento se mantiene
- [ ] Test manual: submit exitoso → documento limpia
- [ ] Añadir mensajes de error específicos (detectar 400 con document error)
- [ ] Commit

---

### Fase 3: Filtros por Empresa — Extensión a Otras Páginas

**Objetivo:** Asegurar que `ContractsPage`, `SupplementsPage`, `ReportsPage` usen `useOwnCompanies` y `useCompanyFilter` hooks.

**Tasks:**
- [ ] Extraer `useOwnCompanies` de Wrapper a hook compartido (`src/hooks/useOwnCompanies.ts`)
- [ ] Extraer `useCompanyFilter` a hook compartido (`src/hooks/useCompanyFilter.ts`)
- [ ] Refactor `ContractsPage`:
  - Reemplazar `ownCompanies` state + useEffect por `useOwnCompanies()`
  - Reemplazar `filteredContracts` lógica por `useCompanyFilter(contracts, currentCompany, companyFilter)`
  - Verificar dropdown de empresa muestra per-company options (ya existe)
  - Test manual: filtrar por empresa específica → muestra solo contratos donde client/supplier == esa empresa
- [ ] Refactor `SupplementsPage` (ya tiene lógica correcta, pero reemplazar state por hook)
- [ ] Refactor `ReportsPage`:
  - Reemplazar `ownCompanies` state por hook
  - Reemplazar `enrichedFilteredContracts` lógica por hook `useCompanyFilter`
  - Añadir opciones per-company en dropdown si no existen (ya existen en diseño)
  - Verificar filtrado funciona igual que `SupplementsPage`
- [ ] Commit

**Nota:** Esta phase **no estaba en diseño original v2** — es crítica para bugs P1.

---

### Fase 4: Tests Automáticos (Unit + Integration)

**Framework:** Vitest + React Testing Library + `@testing-library/user-event`

**Unit tests — `ContractFormWrapper.test.tsx`:**
```typescript
describe('ContractFormWrapper', () => {
  it('renders own companies list from hook', () => {});
  it('auto-selects company when single', () => {});
  it('shows role selector only for new contracts', () => {});
  it('renders ClientContractForm when role=client', () => {});
  it('renders SupplierContractForm when role=supplier', () => {});
  it('calls onSubmit with company_id and document_url on success', () => {});
  it('preserves pendingDocument when onSubmit throws', () => {});
  it('clears pendingDocument on successful submit', () => {});
  it('clears pendingDocument when company changes', () => {});
  it('shows error when trying to submit without document', () => {});
  it('loads counterparts when company/role changes', () => {});
  it('loads signers when counterpart is selected', () => {});
  it('handles modal onSuccess with error fallback', () => {});
});
```

**Unit tests — `ContractDocumentUpload.test.tsx`:**
```typescript
describe('ContractDocumentUpload', () => {
  it('accepts file and calls onUpload', () => {});
  it('shows file preview with name and size', () => {});
  it('calls onRemove when remove button clicked', () => {});
  it('displays required error when required=true and no file', () => {});
  it('calls cleanup on unmount for temp documents', async () => {});
  it('does NOT call cleanup for existing contract documents', () => {});
});
```

**Unit tests — `useOwnCompanies.test.ts`:**
```typescript
describe('useOwnCompanies', () => {
  it('loads companies and sets currentCompany', () => {});
  it('auto-selects when single company', () => {});
  it('caches results in localStorage', () => {});
  it('refetch ignores cache', () => {});
});
```

**Unit tests — `useCompanyFilter.test.ts`:**
```typescript
describe('useCompanyFilter', () => {
  it('filters contracts by client company match', () => {});
  it('filters contracts by supplier company match', () => {});
  it('filters by numeric companyId (both parties)', () => {});
  it('returns all when filter=all', () => {});
  it('returns all when currentCompany null', () => {});
});
```

**Integration tests — modals:**
```typescript
describe('ContractForm + Modals integration', () => {
  it('creates client from modal and updates select', async () => {});
  it('creates supplier from modal and updates select', async () => {});
  it('creates signer from modal and updates select', async () => {});
  it('handles modal onSuccess error gracefully', async () => {});
});
```

**Coverage target:** ≥85% lines, ≥90% branches.

**Commit:** "test(contracts): add comprehensive unit tests for refactored components"

---

### Fase 5: E2E Tests (Playwright)

**Archivo:** `e2e/tests/contracts/contract-form.spec.ts`

```typescript
describe('Contract Form Refactor', () => {
  beforeEach(async () => {
    await page.goto('/contracts/new');
    await page.waitForLoadState('networkidle');
  });

  describe('New Contract as Client', () => {
    it('auto-selects company when single', async () => {
      // Verify auto-selection
    });

    it('shows client role selected by default', async () => {
      // Verify radio default
    });

    it('loads suppliers when company selected', async () => {
      // Select company → suppliers dropdown populated
    });

    it('creates new supplier from modal and updates dropdown', async () => {
      // Click [+] → fill modal → submit → appears in select
    });

    it('loads signers after selecting supplier', async () => {
      // Select supplier → signers dropdown populated
    });

    it('creates new signer from modal and updates dropdown', async () => {
      // Click [+] signer → fill modal → appears
    });

    it('requires document upload before submit', async () => {
      // Try submit without doc → error toast
    });

    it('submits successfully with all fields + document', async () => {
      // Fill all → upload → submit → success + redirect
    });

    it('handles partial failure: maintains document on API error', async () => {
      // Mock API 500 → document preview stays visible
    });

    it('clears document when company changes', async () => {
      // Upload doc → change company → doc cleared + toast info
    });
  });

  describe('New Contract as Supplier', () => {
    // Mirror of client tests
  });

  describe('Edit Existing Contract', () => {
    it('loads all existing data correctly', async () => {});
    it('allows document management (list + remove)', async () => {});
    it('allows adding new signer via modal', async () => {});
    it('updates successfully', async () => {});
  });

  describe('Accessibility', () => {
    it('all buttons have accessible labels', async () => {});
    it('tooltips appear on focus for [+] buttons', async () => {});
    it('form submits with Enter key', async () => {});
    it('tab order is logical', async () => {});
  });
});
```

**Commit:** "test(contracts): add E2E tests for contract form refactor"

---

### Fase 6: Backend — Validaciones y Cleanup

#### Task 6.1: Migration — document_url/document_key columns

```sql
-- migrations/20260424_add_contract_document_url.sql
ALTER TABLE contracts ADD COLUMN document_url TEXT NULL;
ALTER TABLE contracts ADD COLUMN document_key TEXT NULL;

-- Para nuevos contratos, required por handler
-- Contratos existientes: NULL permitido (backward compatible)
```

**Commit:** "db(contracts): add document_url and document_key columns"

#### Task 6.2: createContract — validate document_url

**File:** `internal/handlers/contracts.go:153-267`

```go
// Después de validar client/supplier (línea 199), añadir:
if req.DocumentURL == nil || strings.TrimSpace(*req.DocumentURL) == "" {
    h.Error(w, http.StatusBadRequest, "contract document is required")
    return
}

// Añadir DocumentURL y DocumentKey al INSERT (líneas 229-238):
_, err = h.DB.Exec(`
    INSERT INTO contracts (
        internal_id, contract_number, title, client_id, supplier_id,
        client_signer_id, supplier_signer_id, start_date, end_date, amount,
        type, status, description, object, fulfillment_place, dispute_resolution,
        has_confidentiality, guarantees, renewal_type, created_by, company_id,
        document_url, document_key               -- NUEVOS
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`, internalID, req.ContractNumber, req.Title, req.ClientID, req.SupplierID,
    req.ClientSignerID, req.SupplierSignerID, req.StartDate, req.EndDate,
    req.Amount, req.Type, req.Status, req.Description, req.Object, req.FulfillmentPlace,
    req.DisputeResolution, req.HasConfidentiality, req.Guarantees, req.RenewalType,
    userID, actualCompanyID,
    req.DocumentURL, req.DocumentKey);  // NUEVOS
```

**Actualizar struct `createContractRequest`** (líneas 113-133):
```go
type createContractRequest struct {
    ContractNumber      string  `json:"contract_number"`
    Title             *string `json:"title"`
    ClientID          int     `json:"client_id"`
    CompanyID         *int    `json:"company_id,omitempty"`
    SupplierID        int     `json:"supplier_id"`
    ClientSignerID    *int    `json:"client_signer_id"`
    SupplierSignerID *int    `json:"supplier_signer_id"`
    StartDate         string  `json:"start_date"`
    EndDate           string  `json:"end_date"`
    Amount            float64 `json:"amount"`
    Type              string  `json:"type"`
    Status            string  `json:"status"`
    Description       *string `json:"description"`
    Object            *string `json:"object"`
    FulfillmentPlace *string `json:"fulfillment_place"`
    DisputeResolution *string `json:"dispute_resolution"`
    HasConfidentiality *bool  `json:"has_confidentiality,omitempty"`
    Guarantees        *string `json:"guarantees"`
    RenewalType       *string `json:"renewal_type"`
    DocumentURL       *string `json:"document_url"`       // NUEVO
    DocumentKey       *string `json:"document_key"`       // NUEVO
}
```

**Commit:** "feat(contracts): enforce document upload on contract creation"

#### Task 6.3: updateContract — validate ownership + update document

**File:** `internal/handlers/contracts.go:296-402`

1. Añadir validación de ownership (como se describió arriba).
2. Añadir `document_url`, `document_key` al UPDATE si se提供:
```go
_, err = h.DB.Exec(`
    UPDATE contracts SET 
        title=?, client_id=?, supplier_id=?,
        client_signer_id=?, supplier_signer_id=?, start_date=?, end_date=?,
        amount=?, type=?, status=?, description=?, object=?, fulfillment_place=?,
        dispute_resolution=?, has_confidentiality=?, guarantees=?, renewal_type=?,
        document_url=?, document_key=?,               -- NUEVOS
        updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND deleted_at IS NULL AND company_id = ?
`, 
    req.Title, req.ClientID, req.SupplierID, req.ClientSignerID, req.SupplierSignerID,
    req.StartDate, req.EndDate, req.Amount, req.Type, req.Status, req.Description,
    req.Object, req.FulfillmentPlace, req.DisputeResolution, req.HasConfidentiality,
    req.Guarantees, req.RenewalType,
    req.DocumentURL, req.DocumentKey,  // NUEVOS
    id, companyID)
```
3. Actualizar `createContractRequest` struct (ya incluye nuevos campos).

**Commit:** "feat(contracts): validate client/supplier ownership on update; allow document update"

#### Task 6.4: Documents cleanup endpoint

**File:** `internal/handlers/documents.go` (nuevo o existente)

```go
package handlers

import (
    "net/http"
    "strings"
    "fmt"
    // ... otros imports
)

func (h *Handler) deleteTempDocument(w http.ResponseWriter, r *http.Request) {
    key := chi.URLParam(r, "key")
    userID := h.getUserID(r)
    
    // Seguridad: verificar que key tiene formato temp/{userID}/{uuid}
    expectedPrefix := fmt.Sprintf("temp/%d/", userID)
    if !strings.HasPrefix(key, expectedPrefix) {
        http.Error(w, "forbidden: can only delete your own temp files", http.StatusForbidden)
        return
    }
    
    // Delete de S3
    err := h.S3Client.DeleteObject(&s3.DeleteObjectInput{
        Bucket: aws.String(h.S3Bucket),
        Key:    aws.String(key),
    })
    if err != nil {
        h.Error(w, http.StatusInternalServerError, "failed to delete temp file")
        return
    }
    
    w.WriteHeader(http.StatusNoContent)
}
```

**Router:** Añadir en `router.go` o `handlers.go`:
```go
router.Delete("/api/documents/temp/{key}", h.deleteTempDocument)
```

**Frontend — actualizar `upload.ts`:**
```typescript
export const upload = {
    uploadWithPresignedUrl: ...,
    cleanupTemporary: async (key: string): Promise<void> => {
        try {
            await fetch(`/api/documents/temp/${encodeURIComponent(key)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
        } catch (err) {
            console.error('Failed to cleanup temp document:', err);
        }
    },
};
```

**Commit:** "feat(documents): add temp document cleanup endpoint with ownership validation"

---

### Fase 7: Code Review & Merge

- [ ] Lint frontend (`npm run lint`) — sin errores
- [ ] Lint backend (`go vet ./...`) — sin warnings
- [ ] Tests unitarios pasan (`npm test`)
- [ ] Tests E2E pasan (`npm run test:e2e`)
- [ ] Build frontend (`npm run build`) — sin errores
- [ ] Build backend (`go build ./...`) — sin errores
- [ ] PR con checklist completa
- [ ] Code review por al menos 1 reviewer
- [ ] Merge a `main` con squash
- [ ] Despliegue a staging
- [ ] QA manual en staging
- [ ] Promote to production

---

## 8. Entregables

### Código

```
pacta_appweb/src/components/contracts/
├── ContractFormWrapper.tsx      (NUEVO - ~220 LOC)
├── ClientContractForm.tsx       (NUEVO - ~180 LOC)
├── SupplierContractForm.tsx     (NUEVO - ~180 LOC)
├── ContractDocumentUpload.tsx   (NUEVO - ~120 LOC)
└── ContractForm.tsx             (re-export)

pacta_appweb/src/components/modals/
├── SignerInlineModal.tsx        (NUEVO - ~120 LOC)
└── ResponsiblePersonForm.tsx    (OPCIONAL - extract de AuthorizedSignerForm)

pacta_appweb/src/hooks/
├── useOwnCompanies.ts           (NUEVO - ~60 LOC)
├── useCompanyFilter.ts          (NUEVO - ~40 LOC)
└── useDocumentCleanup.ts        (NUEVO - ~25 LOC)

pacta_appweb/src/types/
└── contracts.ts                 (MODIFICADO - añadir types)

pacta_appweb/src/lib/
└── upload.ts                    (MODIFICADO - añadir cleanupTemporary)

internal/handlers/
├── contracts.go                 (MODIFICADO - validaciones)
└── documents.go                (MODIFICADO/AÑADIDO - cleanup endpoint)

internal/db/migrations/
└── 20260424_add_contract_document_url.sql  (NUEVO)
```

### Tests

```
pacta_appweb/src/components/contracts/__tests__/
├── ContractFormWrapper.test.tsx
├── ClientContractForm.test.tsx
├── SupplierContractForm.test.tsx
├── ContractDocumentUpload.test.tsx

pacta_appweb/src/hooks/__tests__/
├── useOwnCompanies.test.ts
├── useCompanyFilter.test.ts
└── useDocumentCleanup.test.ts

e2e/tests/contracts/
├── contract-form.spec.ts
└── contract-form-partial-failure.spec.ts
```

### Documentación

- `docs/plans/2026-04-24-contratos-refactor-design.md` (este archivo)
- `docs/plans/2026-04-24-contratos-refactor-implementation.md` (actualizado)
- `docs/contracts.md` (si existe — actualizar flujo)
- `CHANGELOG.md` entry

---

## 9. Métricas de Éxito (Actualizadas)

| Métrica | Antes | Después | Target |
|---------|-------|---------|--------|
| Tiempo completar formulario nuevo contrato | ~180s | ~120s | -33% |
| Errores por documento faltante | alto | 0 | 0 |
| User-reported bugs relacionados contraparte | 3/mes | 0/mes | 0 |
| File size ContractForm component | 670 LOC | 3×200 LOC | Mejor mantenibilidad |
| Accesibilidad botones [+] | ❌ tooltip | ✅ tooltip + aria-label | 100% |
| **Test coverage frontend** | **0%** | **≥85%** | **≥85% lines** |
| **Tasa de regresiones post-deploy** | **N/A** | **<5%** | **<5%** |
| **Cleanup de archivos temp huérfanos** | **0%** | **100%** | **100%** |

---

## 10. Riesgos y Mitigaciones (Completo)

| # | Riesgo | Prob | Impacto | Mitigación | Estado |
|---|--------|------|---------|------------|--------|
| R1 | Backend no acepta `document_url` en create | M | H | ✅ Añadir campo + validación en task 6.2 | **Planificado** |
| R2 | Temp document no se limpia (S3 cost) | M | M | ✅ Cleanup en unmount + endpoint DELETE | **Planificado** |
| R3 | Partial failure: documento sube, contrato falla → huérfano | M | M | ✅ `pendingDocument` se mantiene → reintento posible | **Planificado** |
| R4 | Modales no recargan listas post-creación | L | M | ✅ `onSuccess` con try/catch + toast | **Planificado** |
| R5 | TypeScript types des sincronizados | L | M | ✅ `ContractSubmitData` definido en types | **Planificado** |
| R6 | Accesibilidad: botones [+] sin aria-label | L | L | ✅ Tooltip implementado | **Planificado** |
| R7 | **Filtros por empresa no funcionan enContractsPage/ReportsPage** | **H** | **H** | ✅ **Task 3: refactoring with useCompanyFilter** | **NUEVO** |
| R8 | **updateContract permite cambiar client a otra company** | **H** | **H** | ✅ **Task 6.3: ownership validation** | **NUEVO** |
| R9 | **Tests faltantes → regresiones** | **H** | **H** | ✅ **Fases 4 & 5: tests unit + e2e obligatorios** | **NUEVO** |
| R10 | **useOwnCompanies duplicado en múltiples Components** | M | M | ✅ **Extraer a hook compartido en Fase 3** | **NUEVO** |
| R11 | **Document cleanup race condition** | L | M | ✅ Flag `isSubmitted` en Wrapper para no borrar accidentalmente | **Planificado** |

---

## 11. Checklist de Implementación (Secuencial)

**Fase 0 — Preparation**
- [ ] Types: `ContractSubmitData`, `PendingDocument` added to `types/contract.ts`
- [ ] Hook `useOwnCompanies.ts` created + tests
- [ ] Hook `useCompanyFilter.ts` created + tests
- [ ] Hook `useDocumentCleanup.ts` created + tests
- [ ] Migration SQL created & reviewed
- [ ] Cleanup endpoint implementado + ownership validation
- [ ] `createContract` valida `document_url`
- [ ] `updateContract` valida ownership + actualiza `document_url`
- [ ] `upload.ts` tiene `cleanupTemporary`

**Fase 1 — Wrapper Core**
- [ ] `ContractFormWrapper.tsx` completo con state management
- [ ] `ClientContractForm.tsx` completo con todos los campos
- [ ] `SupplierContractForm.tsx` completo espejo
- [ ] `ContractDocumentUpload.tsx` con cleanup effect
- [ ] Modals conectados con `onSuccess` + error handling
- [ ] Botones [+] compactos con Tooltip
- [ ] `handleCompanyChange` limpia `pendingDocument`
- [ ] Tests unitarios de render mínimo pasan

**Fase 2 — Partial Failure**
- [ ] `handleSubmit` con try/catch y detección de errores específicos
- [ ] Toast messages diferenciados
- [ ] `pendingDocument` preservado en fallos
- [ ] Manual QA: submit fail → reintento exitoso

**Fase 3 — Filtros por Empresa (CRÍTICO)**
- [ ] Refactor ContractsPage: reemplaza state por `useOwnCompanies`
- [ ] Refactor ContractsPage: reemplaza filter logic por `useCompanyFilter`
- [ ] Refactor SupplementsPage: reemplaza state por hook (lógica de filter ya correcta)
- [ ] Refactor ReportsPage: reemplaza state + filter logic por hook
- [ ] Verificar que dropdowns muestran per-company options
- [ ] Tests unitarios para `useCompanyFilter` cubren todos los casos
- [ ] Manual QA: filtrar por empresa A/B/todas en las 3 páginas

**Fase 4 — Tests Unitarios**
- [ ] `ContractFormWrapper.test.tsx` — 12+ tests
- [ ] `ContractDocumentUpload.test.tsx` — 6+ tests  
- [ ] `useOwnCompanies.test.ts` — 4+ tests
- [ ] `useCompanyFilter.test.ts` — 5+ tests
- [ ] `useDocumentCleanup.test.ts` — 3+ tests
- [ ] Coverage ≥85% lines

**Fase 5 — Tests E2E**
- [ ] Playwright spec con 8+ escenarios
- [ ] Todos pasan en CI
- [ ] Accesibilidad audit (axe-core) sin violations

**Fase 6 — Backend**
- [ ] Migration applied to DB
- [ ] `createContract` valida `document_url`
- [ ] `updateContract` valida ownership + actualiza documento
- [ ] Cleanup endpoint deployed + tested

**Fase 7 — Merge & Deploy**
- [ ] PR approvals (2+ reviewers)
- [ ] CI green (frontend + backend)
- [ ] Staging QA firmado
- [ ] Changelog actualizado
- [ ] Despliegue a producción

---

## 12. Preguntas Abiertas (Resueltas)

### Q1: ¿`SignerInlineModal` debe incluir campo `document_url`?

**Respuesta:** No necesariamente. `AuthorizedSigner` no requiere documento en modelo actual. Mantener simple: solo campos básicos (first_name, last_name, position, email, phone). Documento se agrega después si se necesita.

### Q2: ¿Documento del contrato puede ser múltiple?

**Respuesta:** Sí, en edición ya existe lista múltiple. En creación, al menos 1 obligatorio, pero puede subir múltiples en el mismo form. `ContractDocumentUpload` debe soportar múltiple archivos (array de `pendingDocuments`).

**Implementación:** Cambiar `pendingDocument` (single) → `pendingDocuments: DocumentUpload[]`. UI muestra lista con opción eliminar cada uno. Submit envía array de `{url, key}`.

### Q3: `pendingDocument` cleanup — ¿limpiar al cambiar empresa?

**Respuesta:** **SÍ.** Al cambiar empresa, el documento pendiente ya no es válido (debe subirse en contexto de nueva empresa). Limpiar automáticamente con toast informativo.

### Q4: ¿`SignerInlineModal` reutilizar `AuthorizedSignerForm`?

**Respuesta:** No. Crear `SignerInlineModal` independiente (simplicidad). Patrón existente en `ClientInlineModal`/`SupplierInlineModal` es suficiente.

### Q5: ¿Mantener `ContractForm.legacy.tsx` después de merge?

**Respuesta:** No. Borrar inmediatamente después de merge exitoso. Rollback puede hacerse desde git history.

---

**Documento aprobado.**  
Proceder a implementación con `executing-plans` skill.
