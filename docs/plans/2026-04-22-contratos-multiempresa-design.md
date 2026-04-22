# Diseño: Refactorización de Contratos con Multiempresa

**Fecha:** 2026-04-22
**Estado:** Aprobado
**Proyecto:** PACTA

---

## 1. Contexto y Requisitos

El formulario de creación de contratos necesita adaptarse al sistema de multiempresa:

- **Esta empresa actúa como Cliente:** La empresa propia (del sistema multiempresa) recibe servicios/productos
- **Esta empresa actúa como Proveedor:** La empresa propia brinda servicios/productos

### Reglas de Negocio

1. **Selección de empresa propia:**
   - Si hay 1 empresa → selección automática
   - Si hay múltiples empresas → dropdown para seleccionar

2. **Clientes/Proveedores mostrados:**
   - Son específicos de la empresa propia seleccionada
   - Filtrados por `company_id`

3. **Creación en línea:**
   - Si el cliente/proveedor no existe → botón para crear desde el formulario
   - Auto-seleccionar después de crear

4. **Firmantes (Personas autorizadas):**
   - Para empresa propia: usar firmantes del Company Context
   - Para cliente/proveedor tercero: usar sus firmantes asociados
   - Si no existe → posibilidad de crear desde el formulario

---

## 2. Arquitectura

### Flujo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│              ContractForm (Multiempresa)                   │
├─────────────────────────────────────────────────────────────┤
│  1. "Esta empresa actúa como..." → RadioGroup             │
│     └── 'client' | 'supplier'                             │
│                                                          │
│  2. Selector de empresa propia                           │
│     └── 1 empresa → auto-select                         │
│         └── múltiples → dropdown                        │
│                                                          │
│  3. Cargar lista de contrapartes                        │
│     └── client→ suppliers API.list(company_id)           │
│         └── supplier → clients API.list(company_id)      │
│                                                          │
│  4. Selector de contraparte                            │
│     └── Si no existe → botón "Nuevo..." → Modal           │
│         └── Crear → auto-seleccionar                      │
│                                                          │
│  5. Selector de firmante                               │
│     └── signers API.list() filtrado por company            │
│         └── Si no existe → crear firmante                │
└─────────────────────────────────────────────────────────────┘
```

### Componentes a Modificar

| Archivo | Acción |
|---------|--------|
| `pacta_appweb/src/components/contracts/ContractForm.tsx` | Refactorizar con lógica multiempresa |
| `pacta_appweb/src/components/CompanySelector.tsx` | Usar para selector de empresa propia |
| `pacta_appweb/src/lib/companies-api.ts` | Añadir `listOwncompanies()` |
| `pacta_appweb/src/lib/clients-api.ts` | Añadir `listByCompany(companyId)` |
| `pacta_appweb/src/lib/suppliers-api.ts` | Añadir `listByCompany(companyId)` |
| `pacta_appweb/src/components/modals/SupplierModal.tsx` | Crear/Mover para creación inline |
| `pacta_appweb/src/components/modals/ClientModal.tsx` | Crear/Mover para creación inline |
| `pacta_appweb/src/components/modals/SignerModal.tsx` | Crear para firmantes |
| Backend handlers | Asegurar filtrado por `company_id` |

---

## 3. Detalles de Implementación

### ContractForm.tsx - Nuevos Estados

```typescript
interface ContractFormState {
  // Empresa propia
  ourRole: 'client' | 'supplier';
  ownCompanyId: number | null;

  // Contraparte
  counterpartId: number | null;
  counterpartType: 'client' | 'supplier';

  // Firmantes
  ourSignerId: number | null;
  counterpartSignerId: number | null;
}
```

### Lógica de Selección Automática

```typescript
// Al montar el formulario
useEffect(() => {
  companiesAPI.listOwnCompanies().then(companies => {
    if (companies.length === 1) {
      setOwnCompanyId(companies[0].id);
    } else if (companies.length > 1) {
      // Mostrar dropdown para seleccionar
      setShowCompanySelector(true);
    }
  });
}, []);

// Al cambiar ourRole, recargar contrapartes
useEffect(() => {
  if (!ownCompanyId) return;

  if (ourRole === 'client') {
    // Somos cliente → mostrar proveedores
    suppliersAPI.listByCompany(ownCompanyId).then(setSuppliers);
  } else {
    // Somos proveedor → mostrar clientes
    clientsAPI.listByCompany(ownCompanyId).then(setClients);
  }
}, [ourRole, ownCompanyId]);
```

### Modal de Creación inline

```typescript
interface CreateEntityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  type: 'client' | 'supplier';
  onCreated: (entity: Client | Supplier) => void;
}
```

---

## 4. Casos de Uso

### UC1: Crear contrato donde somos cliente (1 empresa)

1. Usuario abre formulario
2. Sistema detecta 1 empresa propia → auto-selecciona
3. Usuario selecciona "Esta empresa actúa como Cliente"
4. Sistema carga proveedores de ESA empresa
5. Usuario selecciona proveedor
6. Si no existe →click "Nuevo proveedor" → crea → auto-selecciona
7. Sistema carga firmantes del proveedor
8. Si no hay firmante → crear desde el modal
9. Continuar con el resto del formulario

### UC2: Crear contrato donde somos proveedor (multiempresa)

1. Usuario abre formulario
2. Sistema detecta múltiples empresas → mostrar dropdown
3. Usuario selecciona empresa propia
4. Usuario selecciona "Esta empresa actúa como Proveedor"
5. Sistema carga clientes de ESA empresa
6. Continuar como UC1...

---

## 5. Consideraciones de Backend

### API Requirements

- `GET /api/companies` → empresas propias del usuario
- `GET /api/clients?company_id=X` → clientes de empresa X
- `GET /api/suppliers?company_id=X` → proveedores de empresa X
- `POST /api/clients` → crear cliente (requiere company_id)
- `POST /api/suppliers` → crear proveedor (requiere company_id)

### Middleware

- El `company_id` debe viajar en cada	request
- Usar sesión actual o header `X-Company-ID`

---

## 6. Extensiones Requeridas

### ContractsPage.tsx

- Filter por empresa activa
- Mostrar empresa en tabla de contratos

### SupplementsPage.tsx

- Filter por empresa activa
- Mostrar empresa en tabla

### ReportsPage.tsx

- Filter por empresa activa

### Settings/Sesión

- Configurar empresa activa por defecto
-记忆 última empresa seleccionada

---

## 7. Fallback (Backward Compatibility)

Si no hay multiempresa (1 sola empresa):

- Comportamiento original (sin cambios visibles)
- Selección automática de la única empresa