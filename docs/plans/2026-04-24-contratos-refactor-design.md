# Refactorización Formulario de Contratos - Diseño Técnico

**Fecha:** 2026-04-24
**Estado:** Aprobado
**Proyecto:** PACTA
**Solicitado por:** Refactorización formulario multiempresa
**Skill involucrada:** UI/UX Pro Max + Brainstorming

---

## 1. Contexto y Problema

### 1.1 Situación Actual

El sistema permite a usuarios gestionar múltiples empresas propias. Al crear un contrato, el usuario debe selectionsar:
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

### 1.2 Objetivo

Refactorizar el formulario de creación de contratos para:
- Separar responsabilidades (SOLID)
- Mostrar controles dinámicos correctos según rol
- Agregar subida obligatoria de documento de contrato
- Mejorar UX con botones compactos
- Mantener backward compatibility con edición existente

---

## 2. Arquitectura Propuesta

### 2.1 Estructura de Componentes

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

### 2.3 Componentes Existentes Reutilizados

- `ClientInlineModal` → ya existe, se usa desde `ClientContractForm`
- `SupplierInlineModal` → ya existe, se usa desde `SupplierContractForm`
- `AuthorizedSignerForm` → posible reuso para `ResponsiblePersonForm`
- API handlers: `clientsAPI`, `suppliersAPI`, `signersAPI`, `documentsAPI`, `companiesAPI`

---

## 3. Flujo de Datos

### 3.1 Estado Global (Wrapper)

```typescript
interface ContractFormWrapperState {
  ownCompanies: Company[];           // Lista empresas propias del usuario
  selectedOwnCompany: Company | null; // Empresa seleccionada
  ourRole: 'client' | 'supplier';     // Rol de NUESTRA empresa
}

// Derived:
// - contraparteType = ourRole === 'client' ? 'supplier' : 'client'
// - contraparteLabel = ourRole === 'client' ? 'Proveedor' : 'Cliente'
```

### 3.2 Flujo de Creación (nuevo contrato)

```
1. Wrapper carga ownCompanies (useEffect)
2. Si length === 1 → auto-selecciona
3. Si length > 1 → usuario selecciona empresa
4. Usuario selecciona rol (RadioGroup)
5. Wrapper renderiza formulario hijo correspondiente
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
    - Éxito: limpiar,通知, cerrar
    - Error: mostrar mensaje, mantener documento (no eliminar)
```

### 3.3 Flujo de Edición (contrato existente)

```
1. Wrapper recibe prop: contract
2.ourRole = contract.client_id ? 'client' : 'supplier'
3. selectedOwnCompany se determina desde contract.company_id (solo lectura)
4. Renderiza formulario hijo对应 rol
5. Hijo carga datos existentes en selects
6. Edición de documento: managed por ContractDocumentUpload (listar + agregar + eliminar)
7. Submit: igual que creación, pero sin company_id change
```

---

## 4. Especificación de Componentes

### 4.1 ContractFormWrapper

**Props:**
```typescript
interface ContractFormWrapperProps {
  contract?: Contract;                  // undefined = nuevo contrato
  onSubmit: (data: ContractSubmitData) => void;
  onCancel: () => void;
}
```

**Estado interno:**
```typescript
const [ownCompanies, setOwnCompanies] = useState<Company[]>([]);
const [selectedOwnCompany, setSelectedOwnCompany] = useState<Company | null>(null);
const [ourRole, setOurRole] = useState<'client' | 'supplier'>('client');
const [pendingDocument, setPendingDocument] = useState<{url: string, key: string, file: File} | null>(null);
```

**Efectos:**
```typescript
// Cargar empresas propias
useEffect(() => {
  companiesAPI.listOwnCompanies().then(setOwnCompanies);
}, []);

// Auto-seleccionar si solo hay una
useEffect(() => {
  if (ownCompanies.length === 1 && !contract) {
    setSelectedOwnCompany(ownCompanies[0]);
  }
}, [ownCompanies, contract]);

// Resetear rol si es edacción
useEffect(() => {
  if (contract) {
    setOurRole(contract.client_id ? 'client' : 'supplier');
  }
}, [contract]);
```

**Handlers:**
```typescript
const handleCompanyChange = (company: Company) => {
  setSelectedOwnCompany(company);
  // Resetear contraparte/responsable en hijo via key remount
};

const handleRoleChange = (role: 'client' | 'supplier') => {
  setOurRole(role);
};

const handleSubmit = async (formData: any) => {
  // Ensamblar payload final con documento
  await onSubmit({
    ...formData,
    company_id: selectedOwnCompany!.id,
    document_url: pendingDocument?.url,
    document_key: pendingDocument?.key,
  });
};

const handleAddDocument = (doc: {url: string, key: string, file: File}) => {
  setPendingDocument(doc);
};

const handleRemoveDocument = () => {
  setPendingDocument(null);
};
```

**Render:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>{contract ? 'Editar Contrato' : 'Nuevo Contrato'}</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Selector empresa propia (si múltiples) */}
    {ownCompanies.length > 1 && !contract && (
      <CompanySelector
        companies={ownCompanies}
        value={selectedOwnCompany}
        onChange={handleCompanyChange}
      />
    )}

    {/* Selector rol (solo nuevo contrato) */}
    {!contract && (
      <RadioGroup value={ourRole} onValueChange={handleRoleChange}>
        <Label>Esta empresa actúa como</Label>
        <div className="flex gap-6">
          <RadioItem value="client" label="Cliente (recibimos servicio)" />
          <RadioItem value="supplier" label="Proveedor (brindamos servicio)" />
        </div>
      </RadioGroup>
    )}

    {/* Formulario dinámico por rol */}
    {ourRole === 'client' ? (
      <ClientContractForm
        key={`client-${selectedOwnCompany?.id}`}
        companyId={selectedOwnCompany!.id}
        contract={contract}
        onAddClient={...}
        onAddResponsible={...}
        pendingDocument={pendingDocument}
        onDocumentChange={handleAddDocument}
        onDocumentRemove={handleRemoveDocument}
      />
    ) : (
      <SupplierContractForm
        key={`supplier-${selectedOwnCompany?.id}`}
        companyId={selectedOwnCompany!.id}
        contract={contract}
        onAddSupplier={...}
        onAddResponsible={...}
        pendingDocument={pendingDocument}
        onDocumentChange={handleAddDocument}
        onDocumentRemove={handleRemoveDocument}
      />
    )}

    {/* Botones acción */}
    <div className="flex gap-2 justify-end">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" form="contract-form">
        {contract ? 'Actualizar' : 'Crear'}
      </Button>
    </div>
  </CardContent>
</Card>
```

---

### 4.2 ClientContractForm / SupplierContractForm

**Props comunes:**
```typescript
interface BaseContractFormProps {
  companyId: number;                    // Empresa propia ID
  contract?: Contract;                  // Para edición
  onAddContraparte: () => void;         // Callback abrir modal contraparte
  onAddResponsible: () => void;         // Callback abrir modal responsable
  pendingDocument: {url,key,file} | null;
  onDocumentChange: (doc) => void;
  onDocumentRemove: () => void;
}
```

**Campos comunes:**
```tsx
<form id="contract-form" onSubmit={handleSubmit} className="space-y-4">
  {/* Contrat Number + Type */}
  <div className="grid grid-cols-2 gap-4">
    <Input name="contract_number" label="Número Contrato *" required />
    <Select name="type" label="Tipo Contrato *">
      <Option value="service">Servicio</Option>
      <Option value="purchase">Compra</Option>
      <Option value="lease">Arriendo</Option>
      <Option value="employment">Empleo</Option>
      <Option value="nda">NDA</Option>
      <Option value="other">Otro</Option>
    </Select>
  </div>

  {/* CONTAPARTE (cliente o proveedor según rol) */}
  <div className="space-y-2">
    <Label>{contraparteLabel} *</Label>
    <div className="flex gap-2">
      <Select
        name="contraparte_id"
        value={formData.contraparte_id}
        onValueChange={(v) => setFormData({...formData, contraparte_id: v, responsable_id: ''})}
      >
        {contrapartes.map(c => (
          <Option key={c.id} value={c.id}>{c.name}</Option>
        ))}
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 w-8 p-0"
        onClick={onAddContraparte}
        title="Agregar nuevo {contraparteLabel}"
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  </div>

  {/* RESPONSABLE (de la contraparte) */}
  <div className="space-y-2">
    <Label>Responsable {contraparteLabel} *</Label>
    <div className="flex gap-2">
      <Select
        name="responsable_id"
        value={formData.responsable_id}
        onValueChange={(v) => setFormData({...formData, responsable_id: v})}
        disabled={!formData.contraparte_id}
      >
        {responsables.map(r => (
          <Option key={r.id} value={r.id}>
            {r.first_name} {r.last_name} - {r.position}
          </Option>
        ))}
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 w-8 p-0"
        onClick={onAddResponsible}
        disabled={!formData.contraparte_id}
        title="Agregar responsable"
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  </div>

  {/* Fechas y monto */}
  <div className="grid grid-cols-2 gap-4">
    <Input name="start_date" type="date" label="Fecha Inicio *" required />
    <Input name="end_date" type="date" label="Fecha Fin *" required />
  </div>
  <div className="grid grid-cols-2 gap-4">
    <Input name="amount" type="number" label="Monto ($) *" required />
    <Select name="status" label="Estado *">
      <Option value="active">Activo</Option>
      <Option value="pending">Pendiente</Option>
      <Option value="expired">Expirado</Option>
      <Option value="cancelled">Cancelado</Option>
    </Select>
  </div>

  {/* Descripción */}
  <Textarea name="description" label="Descripción" rows={3} />

  {/* Legal Fields Collapsible */}
  <CollapsibleSection title="Cláusulas Adicionales">
    <div className="space-y-4">
      <Textarea name="object" label="Objeto del Contrato" rows={3} />
      <Input name="fulfillment_place" label="Lugar de Cumplimiento" />
      <Input name="dispute_resolution" label="Resolución de Controversias" />
      <Textarea name="guarantees" label="Garantías" rows={2} />
      <Select name="renewal_type" label="Tipo de Renovación">
        <Option value="automatica">Automática</Option>
        <Option value="manual">Manual</Option>
        <Option value="cumplimiento">Por Cumplimiento</Option>
      </Select>
      <Checkbox name="has_confidentiality" label="Cláusula de Confidencialidad" />
    </div>
  </CollapsibleSection>

  {/* Document Upload REQUIRED */}
  <ContractDocumentUpload
    required={true}
    existingDocuments={contract ? documents : []}
    onUpload={onDocumentChange}
    onRemove={onDocumentRemove}
  />

</form>
```

---

### 4.3 ContractDocumentUpload

**Props:**
```typescript
interface ContractDocumentUploadProps {
  required?: boolean;
  existingDocuments?: APIDocument[]; // para edición
  onUpload: (doc: {url:string, key:string, file:File}) => void;
  onRemove: (docId?: number) => void; // docId undefined = pendiente
}
```

**Estado:**
```typescript
const [uploading, setUploading] = useState(false);
```

**Render:**
```tsx
<div className="space-y-2">
  <Label>
    Documento del Contrato {required && <span className="text-destructive">*</span>}
  </Label>

  {/* Lista documentos existentes (solo edición) */}
  {existingDocuments?.length > 0 && (
    <div className="space-y-2">
      {existingDocuments.map(doc => (
        <DocumentItem
          key={doc.id}
          document={doc}
          onRemove={() => onRemove(doc.id)}
        />
      ))}
    </div>
  )}

  {/* Upload area */}
  {!pendingDocument ? (
    <div className="border-2 border-dashed rounded-lg p-6 text-center">
      <input
        type="file"
        id="contract-doc-upload"
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <label htmlFor="contract-doc-upload" className="cursor-pointer">
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">
          {uploading ? 'Subiendo...' : 'Haz clic o arrastra el documento'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, Word, imágenes (máx. 5MB)
        </p>
      </label>
    </div>
  ) : (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
      <FileText className="h-5 w-5 text-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{pendingDocument.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {(pendingDocument.file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onRemove()}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )}

  {required && !hasDocument && (
    <p className="text-xs text-destructive">
      El documento del contrato es obligatorio
    </p>
  )}
</div>
```

---

### 4.4 SignerInlineModal (Nuevo)

**Similar a** `ClientInlineModal` y `SupplierInlineModal`, pero para `authorized_signers`.

**Campos:**
```typescript
interface SignerFormData {
  first_name: string;
  last_name: string;
  position: string;
  email: string;
  phone: string;
  company_id: number;
  company_type: 'client' | 'supplier';
}
```

**UI:**
```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Agregar Responsable Autorizado</DialogTitle>
      <DialogDescription>
        Complete los datos del responsable de la {companyType}.
      </DialogDescription>
    </DialogHeader>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input name="first_name" label="Nombre *" required />
        <Input name="last_name" label="Apellido *" required />
      </div>
      <Input name="position" label="Cargo *" required />
      <Input name="email" type="email" label="Email *" required />
      <Input name="phone" label="Teléfono" />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          Crear
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

**Nota:** Este modal reutiliza lógica de `AuthorizedSignerForm` pero en versión inline modal. Se puede extraer a componente compartido si se desea.

---

## 5. Validación

### 5.1 Frontend (ClientContractForm / SupplierContractForm)

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

**Ya existe validación en `internal/handlers/contracts.go`**, pero agregar:
- Validar `document_url` presente en create (no NULL)
- Validar FK: contraparte belongs to company correcta (ya planeado en v2 design)

---

## 6. UI/UX Spec (UI/UX Pro Max Applied)

### 6.1 Estilo Visual

**Producto:** B2B SaaS - Gestión de Contratos Empresariales  
**Tono:** Profesional, eficiente,limpio, denso en información pero no recargado

**Diseño system aplicado:**

| Atributo | Valor | Rationale |
|----------|-------|-----------|
| **Pattern** | Form-centric | Focus en completar datos rápido |
| **Style** | Minimal Business | Sin distracciones, alta confianza |
| **Color Palette** | Slate + Primary Blue (`blue-600`) | Neutral + acción distinguishable |
| **Typography** | Inter (UI) + system para datos | Legibilidad, familiar empresarial |
| **Spacing** | 8px grid: gap-2, gap-4, gap-6 | Ritmo visual consistente |
| **Button Size** | `size="sm"` (h-8, px-2) para [+], `size="default"` para acciones principales | Tap target ≥44px con hitbox expandida |
| **Icons** | Lucide React (consistent) | Variant weight 2px stroke |
| **Feedback** | Toast + inline error | Immediate + persistent |

### 6.2 Botones Pequeños (size="sm")

**Implementación:**
```tsx
<Button
  type="button"
  size="sm"
  variant="outline"
  className="h-8 w-8 p-0 flex-shrink-0"
  onClick={...}
>
  <Plus className="h-3 w-3" />
</Button>
```

**Tooltip (mejora accesibilidad):**
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button ...>...</Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Agregar nuevo {contraparteLabel}</p>
  </TooltipContent>
</Tooltip>
```

**Hitbox:** El button `w-8 h-8` + padding del tooltip → cumple 44×44

### 6.3 Layout Responsive

```css
/* Móvil: stacked */
.grid-cols-2 → grid-cols-1 en <768px

/* Tablet/Desktop: 2-columnas */
@media (min-width: 768px) {
  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}
```

**Safe areas:** Ya manejado por `AppLayout` → no necesario en formulario.

### 6.4 Accesibilidad

- Labels visibles (no placeholder-only) ✓
- Inputs asociados con `htmlFor`/`id` ✓
- Error messages cerca del campo ✓
- Keyboard navigation (tab order natural) ✓
- `aria-describedby` para helper text ✓
- `required` attribute + asterisco visual ✓

---

## 7. Plan de Migración

### 7.1 roadmap

**Fase 0:** Preparación (sin impacto usuario)
- [ ] Crear `SignerInlineModal` (copiando estructura de Supplier/ClientInlineModal)
- [ ] Crear `ContractDocumentUpload` componente base
- [ ] Crear `ClientContractForm` y `SupplierContractForm` vacíos (solo estructura)
- [ ] Escribir tests unitarios básicos (render)

**Fase 1:** Wrapper y lógica (backward compatible)
- [ ] Crear `ContractFormWrapper`
- [ ] Mover lógica de rol + empresa de `ContractForm` a Wrapper
- [ ] Actualizar `ContractsPage` para usar Wrapper en lugar de `ContractForm`
- [ ] Verificar que creación y edición funcionan igual que antes
- [ ] No desplegar a producción hasta Fase 2

**Fase 2:** Implementar ClientContractForm
- [ ] Extraer todos los campos de `ContractForm` que aplican a rol client
- [ ] Integrar `ContractDocumentUpload` (required)
- [ ] Integrar botones pequeños [+] con tooltips
- [ ] Conectar modales: `ClientInlineModal` y `SignerInlineModal`
- [ ] Probar flujo completo: crear cliente desde modal → select actualiza
- [ ] Probar flujo completo: crear responsable → select actualiza

**Fase 3:** Implementar SupplierContractForm
- [ ] Espejo de Fase 2 pero para rol supplier
- [ ] Conectar `SupplierInlineModal`
- [ ] Mismos tests que Fase 2

**Fase 4:** Validación y Documentación
- [ ] Validaciones frontend (required fields, documento, fechas)
- [ ] Mensajes de error claros
- [ ] Actualizar `docs/contracts.md` si existe
- [ ] Commit con mensaje descriptivo
- [ ] PR con checklist

---

## 8. Preguntas Abiertas

### Q1: `AuthorizedSigner` vs `ResponsiblePerson`
El modelo usa `authorized_signers` tabla. ¿El "responsable" de contraparte es **siempre** un `authorized_signer`? 
- **Respuesta esperada:** Sí, el responsable es un `authorized_signer` con `company_type` matching contraparte.

### Q2: Documento del contrato → ¿asociar múltiple?
¿Debe permitir adjuntar **más de un** documento al contrato (como está ahora en edición)?
- **Respuesta esperada:** Sí, en edición se permite múltiple. En creación, al menos 1 obligatorio.

### Q3: `pendingDocument` cleanup
Si usuario sube documento pero NO crea contrato (cancela), ¿debemos eliminar el archivo temporal de S3?
- **Respuesta esperada:** Sí, cleanup inmediato al cancelar/cerrar formulario sin submit.

### Q4: `SignerInlineModal` → ¿reutilizar `AuthorizedSignerForm`?
`AuthorizedSignerForm` es un componente page-level. ¿Prefieres crear `SignerInlineModal` independiente o extraer `AuthorizedSignerFormFields` shared?
- **Respuesta esperada:** Crear `SignerInlineModal` independiente (simplicidad). Ya existe patrón en Supplier/ClientInlineModal.

---

## 9. Criterios de Aceptación (DoD)

### Nuevo Contrato (cliente rol)

- [ ] Empresa propia auto-selecciona si solo hay 1
- [ ] Si hay múltiples, dropdown visible y funciona
- [ ] Al cambiar empresa → limpiar contraparte y responsable
- [ ] Rol "cliente" seleccionado por defecto
- [ ] Select de **cliente** (contraparte) muestra solo clientes de la empresa
- [ ] Botón pequeño [+] al lado del select → abre `ClientInlineModal`
- [ ] Al crear cliente → select se actualiza automáticamente
- [ ] Select de **responsable** muestra responsables del cliente seleccionado
- [ ] Botón pequeño [+] al lado → abre `SignerInlineModal`
- [ ] Al crear responsable → select se actualiza
- [ ] Upload de documento contrato es **obligatorio** (valida antes submit)
- [ ] Upload muestra preview (nombre, tamaño, eliminar)
- [ ] Legal fields abren/cierran correctamente
- [ ] Submit exitoso → toast + limpieza + close
- [ ] Submit falla → mantener datos + documento + mensaje error

### Nuevo Contrato (proveedor rol)

Espejo de cliente pero con:
- Contraparte = proveedor
- Modal = `SupplierInlineModal`
- Responsables filtrados por `supplier_id`

### Edición de Contrato

- [ ] Carga datos existentes en todos los campos
- [ ] Documentos existentes se listan (puede eliminar)
- [ ] Puede agregar documentos nuevos
- [ ] Botones [+] funcionan para agregar contraparte/responsable
- [ ] No permite cambiar empresa propia (solo lectura)
- [ ] Submit actualiza correctamente

### UI/UX

- [ ] Botones [+] size="sm" h-8 w-8 p-0 con icono Plus h-3 w-3
- [ ] Tooltip en cada botón [+] (accessibility)
- [ ] Touch target ≥44×44 efectivo (con hitbox expandida)
- [ ] Spacing 8px entre elementos close, 16px entre secciones
- [ ] No hay horizontal scroll en móvil (375px)
- [ ] Contraste texto ≥4.5:1 (WCAG AA)
- [ ] Labels visibles, no placeholder-only
- [ ] Focus visible en todos los controles

---

## 10. Testing Strategy

### Unit Tests (Jest + React Testing Library)

```typescript
// ContractFormWrapper
- renders own companies list
- auto-selects when single company
- shows role selector when new contract
- renders ClientContractForm when role=client
- renders SupplierContractForm when role=supplier
- calls onSubmit with correct payload

// ClientContractForm
- renders client select with options filtered by company
- shows add client button
- opens ClientInlineModal on click
- disables responsible select until client selected
- shows add responsible button
- opens SignerInlineModal on click
- requires document upload before submit
- validates required fields

// ContractDocumentUpload
- accepts file upload
- shows file preview
- removes file on click
- requires when required=true
```

### E2E Tests (Playwright)

```gherkin
Scenario: Crear contrato como cliente
  Given hay 1 empresa propia
  When voy a /contracts/new
  Then empresa auto-seleccionada
  And rol "cliente" seleccionado por defecto

  When selecciono cliente existente
  Then responsable select se habilita
  And muestra responsables de ese cliente

  When hago clic en [+] responsable
  Then modal SignerInlineModal se abre
  When completo formulario y creo
  Then responsable aparece en select

  When subo documento PDF
  Then preview se muestra
  When submit formulario
  Then contrato creado + redirect

Scenario: Crear contrato como proveedor (espejo)
  # Similar pero rol supplier

Scenario: Documento obligatorio
  When intento submit sin documento
  Then error "Documento es obligatorio" aparece
  And submit bloqueado

Scenario: Cambiar empresa limpia contraparte
  Given hay 2 empresas propias
  When selecciono empresa A
  And selecciono cliente X
  When cambio a empresa B
  Then cliente select se resetea (vacío)
  And responsable select se resetea (vacío)
```

---

## 11. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Backend no acepta `document_url` en create | Medium | High | Coordinar con backend team, agregar campo si falta |
| `SignerInlineModal` duplica `AuthorizedSignerForm` código | Medium | Medium | Extraer hook `useAuthorizedSignerForm` compartido |
| Upload temporal S3 no se limpia si usuario cierra modal | **Low** | **Medium** | **useEffect cleanup en ContractDocumentUpload + API DELETE /documents/temp/:key** |
| Responsive breakpoints rompen layout en tablet | Low | Low | Test en 768px, 1024px antes de PR |
| Selectores muy lentos (muchas options) | Low | Low | Virtualize si >50 opciones (no esperado) |
| **Partial failure: documento sube pero contrato no se crea** | **Medium** | **Medium** | **Mantener `pendingDocument` en estado, mostrar mensaje claro, permitir reintento sin re-subir** |
| **ContractsPage coupling al cambiar ContractForm** | **Low** | **Low** | **Re-export pattern: ContractForm.tsx → export default from './ContractFormWrapper'. Props idénticas, sin cambios en ContractsPage** |

---

### 11.1 Document Cleanup Execution Details

**Cleanup trigger:** `ContractDocumentUpload` se desmonta cuando:
- Formulario se cierra (Cancelar)
- Paso a otro rol (cambio de `ourRole`)
- Submit falla y se recarga la página

**Temporary document lifecycle:**
1. Upload → S3 presigned URL devuelve `key` temporal (prefix: `temp/`)
2. `pendingDocument` guarda `{url, key, file}` en estado Wrapper
3. Submit exitoso: backend recibe `document_url` y `document_key`, marcar como permanente
4. Submit fallido: **no** se llama cleanup → usuario puede reintentar
5. Desmontar sin submit: cleanup → `DELETE /documents/temp/:key`

**API requirement:** Endpoint `DELETE /documents/temp/:key` (o `POST /documents/cleanup-temp` con key). Ya existe en `documentsAPI`? Verificar y agregar si falta.

---

### 11.2 Coupling Mitigation Execution

**File:** `pacta_appweb/src/components/contracts/ContractForm.tsx`

```typescript
// ANTES (legacy):
// Contenido monolítico de ContractForm

// DESPUÉS:
export { default } from './ContractFormWrapper';
```

**ContractsPage:** No changes. Import path remains `@/components/contracts/ContractForm`.

---

## 12. Entregables

### Código

```
pacta_appweb/src/components/contracts/
├── ContractFormWrapper.tsx      (NUEVO - 200 loc)
├── ClientContractForm.tsx       (NUEVO - 150 loc)
├── SupplierContractForm.tsx      (NUEVO - 150 loc)
├── ContractDocumentUpload.tsx    (NUEVO - 100 loc)
└── (mover/eliminar ContractForm.tsx original)

pacta_appweb/src/components/modals/
├── SignerInlineModal.tsx         (NUEVO - 120 loc)
└── ResponsiblePersonForm.tsx     (NUEVO - extract de AuthorizedSignerForm?)

pacta_appweb/src/lib/
└── (sin cambios)

pacta_appweb/src/types/
└── (agregar tipos si falta: ContractSubmitData, DocumentUpload)
```

### Documentación

- `docs/plans/2026-04-24-contratos-refactor-implementation.md` → plan detallado tareas
- `docs/plans/2026-04-24-contratos-refactor-design.md` → este documento
- CHANGELOG entry

---

## 13. Métricas de Éxito

| Métrica | Antes | Después | Target |
|---------|-------|---------|--------|
| Tiempo completar formulario nuevo contrato | ~180s | ~120s | -33% |
| Errores por documento faltante | alto | 0 | 0 |
| User-reported bugs relacionados contraparte | 3/mes | 0/mes | 0 |
| File sizeContractForm component | 670 loc | 3×200 loc | Mejor mantenibilidad |
| Accesibilidad botones [+] | ❌ tooltip | ✅ tooltip + aria-label | 100% |

---

## 14. Preguntas Abiertas (Decisiones Pendientes)

1. **¿`SignerInlineModal` debe incluir campo `document_url`?**  
   → Actualmente `ClientInlineModal` y `SupplierInlineModal` Sí incluyen. `AuthorizedSignerForm` en Admin NO incluye. ¿Consistencia?

2. **¿Documento del contrato puede ser múltiple?**  
   → En edición ya permite múltiple. En creación debe permitir múltiple también o solo 1?

3. **¿Backend valida `document_url` required en create?**  
   → Necesita cambio en handler `createContract` para no permitir NULL.

4. **¿`ContractDocumentUpload` soporta múltiple Archivos?**  
   → Diseño actual solo 1. ¿Ampliarlo a múltiple?

---

**Documento aprobado.** Proceder a generar plan de implementación con `writing-plans` skill.
