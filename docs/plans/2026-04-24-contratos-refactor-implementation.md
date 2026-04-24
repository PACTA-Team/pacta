# Refactorización Formulario de Contratos - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separar formulario de contratos en dos componentes especializados (cliente/proveedor) con upload obligatorio de documento y botones compactos.

**Architecture:** Componente Wrapper orquestador + ClientContractForm + SupplierContractForm + ContractDocumentUpload reusable + SignerInlineModal nuevo. Refactor de ContractForm.tsx monolítico a arquitectura SOLID.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui components, React Hook Form (opcional), Vite

---

## Task 1: Preparación - Crear estructura de archivos nueva

**Files:**
- Create: `pacta_appweb/src/components/contracts/ContractFormWrapper.tsx`
- Create: `pacta_appweb/src/components/contracts/ClientContractForm.tsx`
- Create: `pacta_appweb/src/components/contracts/SupplierContractForm.tsx`
- Create: `pacta_appweb/src/components/contracts/ContractDocumentUpload.tsx`
- Create: `pacta_appweb/src/components/modals/SignerInlineModal.tsx`
- Create: `pacta_appweb/src/components/modals/ResponsiblePersonForm.tsx`

... (Task 1 se mantiene igual, ver archivo original) ...

---

## Task 2: Implementar ClientContractForm completo

... (Task 2 se mantiene igual) ...

---

## Task 3: Implementar SupplierContractForm completo

... (Task 3 se mantiene igual) ...

---

## Task 4: Implementar ContractFormWrapper completo (con partial failure handling)

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractFormWrapper.tsx`

**Step 1: Expande imports** (igual)

**Step 2: Estado completo** (igual + formDataRef)

```typescript
const [ownCompanies, setOwnCompanies] = useState<Company[]>([]);
const [selectedOwnCompany, setSelectedOwnCompany] = useState<Company | null>(null);
const [ourRole, setOurRole] = useState<'client' | 'supplier'>('client');
const [pendingDocument, setPendingDocument] = useState<{url:string,key:string,file:File} | null>(null);

// NUEVO: Estado para compartir con hijos
const [clients, setClients] = useState<any[]>([]);
const [suppliers, setSuppliers] = useState<any[]>([]);
const [signers, setSigners] = useState<any[]>([]);
const [showNewClientModal, setShowNewClientModal] = useState(false);
const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
const [showNewSignerModal, setShowNewSignerModal] = useState(false);

// NUEVO: Ref para acceder a client_id/supplier_id actuales desde callbacks
const formDataRef = useRef<{client_id?: string, supplier_id?: string}>({});
```

**Step 3: useEffect cargar empresas** (igual)

**Step 4: Handlers (actualizados con partial failure handling)**

```typescript
const handleCompanyChange = (companyId: string) => {
  const company = ownCompanies.find(c => c.id === parseInt(companyId));
  setSelectedOwnCompany(company || null);
};

const handleRoleChange = (role: 'client' | 'supplier') => {
  setOurRole(role);
};

const handleSubmit = async (formData: any) => {
  if (!selectedOwnCompany) {
    toast.error('Seleccione una empresa');
    return;
  }
  try {
    await onSubmit({
      ...formData,
      company_id: selectedOwnCompany.id,
      document_url: pendingDocument?.url,
      document_key: pendingDocument?.key,
    });
    // Éxito total: limpiar documento
    setPendingDocument(null);
  } catch (err) {
    // Partial failure: mantener pendingDocument para reintento
    const message = err instanceof Error ? err.message : 'Error al guardar contrato';
    if (message.toLowerCase().includes('document') || message.includes('document_url')) {
      toast.error('El contrato se creó, pero hubo un problema con el documento. Por favor reintente la carga.');
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

// NUEVO: Callbacks para hijos
const handleClientIdChange = (clientId: string) => {
  formDataRef.current.client_id = clientId;
};

const handleSupplierIdChange = (supplierId: string) => {
  formDataRef.current.supplier_id = supplierId;
};
```

**Step 5: Render (actualizado con modals y callbacks)**

```tsx
return (
  <Card>
    <CardHeader>
      <CardTitle>{contract ? t('editContract') : t('newContract')}</CardTitle>
    </CardHeader>
    <CardContent>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ... selector empresa, rol ... */}

        {/* Formulario dinámico */}
        {selectedOwnCompany && (
          <>
            {ourRole === 'client' ? (
              <ClientContractForm
                key={`client-${selectedOwnCompany.id}`}
                companyId={selectedOwnCompany.id}
                contract={contract}
                onAddClient={() => setShowNewClientModal(true)}
                onAddResponsible={() => setShowNewSignerModal(true)}
                onClientIdChange={handleClientIdChange}
                pendingDocument={pendingDocument}
                onDocumentChange={handleAddDocument}
                onDocumentRemove={handleRemoveDocument}
              />
            ) : (
              <SupplierContractForm
                key={`supplier-${selectedOwnCompany.id}`}
                companyId={selectedOwnCompany.id}
                contract={contract}
                onAddSupplier={() => setShowNewSupplierModal(true)}
                onAddResponsible={() => setShowNewSignerModal(true)}
                onSupplierIdChange={handleSupplierIdChange}
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

      {/* Modals */}
      {showNewClientModal && selectedOwnCompany && (
        <ClientInlineModal
          companyId={selectedOwnCompany.id}
          open={showNewClientModal}
          onOpenChange={setShowNewClientModal}
          onSuccess={() => {
            clientsAPI.listByCompany(selectedOwnCompany.id).then(setClients);
          }}
        />
      )}

      {showNewSupplierModal && selectedOwnCompany && (
        <SupplierInlineModal
          companyId={selectedOwnCompany.id}
          open={showNewSupplierModal}
          onOpenChange={setShowNewSupplierModal}
          onSuccess={() => {
            suppliersAPI.listByCompany(selectedOwnCompany.id).then(setSuppliers);
          }}
        />
      )}

      {showNewSignerModal && selectedOwnCompany && (
        <SignerInlineModal
          companyId={selectedOwnCompany.id}
          companyType={ourRole === 'client' ? 'client' : 'supplier'}
          open={showNewSignerModal}
          onOpenChange={setShowNewSignerModal}
          onSuccess={() => {
            // Recargar signers según el rol actual
            if (ourRole === 'client' && formDataRef.current.client_id) {
              signersAPI.list().then((all) => {
                const filtered = (all as any[]).filter(
                  (s: any) => s.company_id === parseInt(formDataRef.current.client_id!) && s.company_type === 'client'
                );
                setSigners(filtered);
              });
            } else if (ourRole === 'supplier' && formDataRef.current.supplier_id) {
              signersAPI.list().then((all) => {
                const filtered = (all as any[]).filter(
                  (s: any) => s.company_id === parseInt(formDataRef.current.supplier_id!) && s.company_type === 'supplier'
                );
                setSigners(filtered);
              });
            }
          }}
        />
      )}
    </CardContent>
  </Card>
);
```

**Step 6: Propagar `setClients`, `setSuppliers`, `setSigners` a hijos**

En ClientContractForm y SupplierContractForm, pasar `setClients`, `setSuppliers`, `setSigners` como props para que los modals en Wrapper puedan actualizar estado.

**Step 7: Commit Wrapper**

```bash
git add pacta_appweb/src/components/contracts/ContractFormWrapper.tsx
git commit -m "feat(contracts): add ContractFormWrapper orchestrator with role-based rendering and partial failure handling"
```

---

## Task 5: Document Cleanup Implementation

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractDocumentUpload.tsx`
- Read: `pacta_appweb/src/lib/upload.ts`
- Create/Modify: `internal/handlers/documents.go` (backend cleanup endpoint)

**Step 1: Verificar/implementar `upload.cleanupTemporary` en frontend**

```typescript
// En upload.ts
export const upload = {
  uploadWithPresignedUrl: ...,
  cleanupTemporary: async (key: string): Promise<void> => {
    try {
      await fetch(`/api/documents/temp/${key}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to cleanup temp document:', err);
    }
  },
};
```

**Step 2: Agregar cleanup effect en ContractDocumentUpload**

```typescript
import { useEffect } from 'react';

export default function ContractDocumentUpload({
  required,
  existingDocuments = [],
  pendingDocument,
  onUpload,
  onRemove,
}) {
  const [uploading, setUploading] = useState(false);

  // Cleanup: eliminar archivo temporal si el componente se desmonta
  // Y el documento NO está asociado a un contrato existente
  useEffect(() => {
    return () => {
      if (pendingDocument) {
        const isAlreadyAssociated = existingDocuments.some(doc => doc.url === pendingDocument.url);
        if (!isAlreadyAssociated) {
          upload.cleanupTemporary(pendingDocument.key).catch(console.error);
        }
      }
    };
  }, [pendingDocument, existingDocuments]);

  // ... resto del componente
}
```

**Step 3: Backend cleanup endpoint**

En `internal/handlers/documents.go`:

```go
func (h *DocumentHandler) deleteTempDocument(w http.ResponseWriter, r *http.Request) {
  key := chi.URLParam(r, "key")

  // Seguridad: solo permite eliminar llaves con prefix "temp/"
  if !strings.HasPrefix(key, "temp/") {
    http.Error(w, "cannot delete non-temp document", http.StatusForbidden)
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

En `router.go` o `handlers.go`:

```go
router.Delete("/api/documents/temp/{key}", h.deleteTempDocument)
```

**Step 4: Commit cleanup**

```bash
git add pacta_appweb/src/components/contracts/ContractDocumentUpload.tsx
git add pacta_appweb/src/lib/upload.ts
git add internal/handlers/documents.go
git commit -m "feat(contracts): add document cleanup on form cancel and partial failure handling"
```

---

## Task 6: Eliminar/Refactor ContractForm.tsx original

**Files:**
- Modify: `pacta_appweb/src/components/contracts/ContractForm.tsx`

**Step 1: Backup → Rename**

```bash
mv pacta_appweb/src/components/contracts/ContractForm.tsx pacta_appweb/src/components/contracts/ContractForm.legacy.tsx
git add pacta_appweb/src/components/contracts/ContractForm.legacy.tsx
git commit -m "refactor(contracts): backup old ContractForm to legacy"
```

**Step 2: Crear nuevo ContractForm.tsx que re-export Wrapper**

```typescript
// pacta_appweb/src/components/contracts/ContractForm.tsx
export { default } from './ContractFormWrapper';
```

**Step 3: Commit refactor**

```bash
git add pacta_appweb/src/components/contracts/ContractForm.tsx
git commit -m "refactor(contracts): replace monolithic ContractForm with Wrapper re-export (backward compatible)"
```

---

## Task 7: Backend - Validar documento en createContract

... (Task 7 se mantiene igual) ...

---

## Task 8: Tests Frontend (unitarios) - AÑADIR tests de cleanup/partial failure

**Files:**
- Modify: `pacta_appweb/src/components/contracts/__tests__/ContractFormWrapper.test.tsx`
- Modify: `pacta_appweb/src/components/contracts/__tests__/ContractDocumentUpload.test.tsx` (nuevo)

**Step 1: ContractFormWrapper - test partial failure**

```typescript
describe('ContractFormWrapper - partial failure', () => {
  it('preserves pendingDocument when onSubmit throws document error', async () => {
    const mockOnSubmit = jest.fn().mockRejectedValue(new Error('document upload failed'));
    render(
      <ContractFormWrapper
        onSubmit={mockOnSubmit}
        onCancel={jest.fn()}
      />
    );

    // Simular: llenar campos mínimos + pendingDocument
    // (usar userEvent o mock de hijos)
    // Submit
    await userEvent.click(screen.getByRole('button', { name: /crear contrato/i }));

    expect(mockOnSubmit).toHaveBeenCalled();
    // Verificar que pendingDocument NO se limpió (se mantiene en estado)
    // Necesitamos acceder al estado interno → re-render o exposer via testid
    expect(screen.getByTestId('document-preview')).toBeInTheDocument();
  });

  it('clears pendingDocument on successful submit', async () => {
    const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
    render(<ContractFormWrapper onSubmit={mockOnSubmit} onCancel={jest.fn()} />);

    // Llenar + subir doc
    await userEvent.click(screen.getByRole('button', { name: /crear contrato/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          document_url: expect.any(String),
          document_key: expect.any(String),
        })
      );
    });
    // Verificar que pendingDocument fue limpiado
  });
});
```

**Step 2: ContractDocumentUpload - test cleanup**

```typescript
import { upload } from '@/lib/upload';

jest.mock('@/lib/upload');

describe('ContractDocumentUpload - cleanup', () => {
  beforeEach(() => {
    upload.cleanupTemporary = jest.fn().mockResolvedValue(undefined);
  });

  it('calls cleanup on unmount when document is pending and not associated', async () => {
    const { unmount } = render(
      <ContractDocumentUpload
        pendingDocument={{ url: 's3://temp/doc.pdf', key: 'temp/doc.pdf', file: new File([''], 'doc.pdf') }}
        existingDocuments={[]}
        onUpload={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    unmount();

    await waitFor(() => {
      expect(upload.cleanupTemporary).toHaveBeenCalledWith('temp/doc.pdf');
    });
  });

  it('does NOT call cleanup when document already associated with contract', async () => {
    const existingDocs = [{ url: 's3://temp/doc.pdf' }];
    const { unmount } = render(
      <ContractDocumentUpload
        pendingDocument={{ url: 's3://temp/doc.pdf', key: 'temp/doc.pdf', file: new File([''], 'doc.pdf') }}
        existingDocuments={existingDocs}
        onUpload={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    unmount();

    await waitFor(() => {
      expect(upload.cleanupTemporary).not.toHaveBeenCalled();
    });
  });
});
```

**Step 3: Commit tests**

```bash
git add pacta_appweb/src/components/contracts/__tests__/
git commit -m "test(contracts): add cleanup and partial failure unit tests"
```

---

## Task 9: E2E Tests (Playwright) - EXTENDIDO (actualizar con scenarios de partial failure)

... (agregar los tests descritos en brainstorming) ...

---

## Task 10: API - Endpoint cleanup temporal (si no existe)

... (ya incluido arriba) ...

---

## Task 11: Final - Re-export ContractForm

... (ya incluido arriba) ...

---

## Task 12: Code Review & Merge

... (mantener) ...

---

## Cambios en docs vs diseño original

### Diseño (`design.md`) actualizado:
1. Sección **7.2 Document Cleanup Strategy** (nueva)
2. Sección **7.3 Coupling Mitigation** (nueva)
3. Tabla **11. Riesgos y Mitigaciones** extendida con 2 nuevos riesgos:
   - Partial failure (documento)
   - ContractsPage coupling

### Implementation (`implementation.md`) actualizado:
1. **Task 4** extendido: `handleSubmit` con try/catch, `pendingDocument` cleanup en éxito, mantenimiento en fallo.
2. **Task 5** NUEVO: Document Cleanup Implementation (useEffect cleanup + backend endpoint).
3. **Task 8** extendido: tests unitarios para cleanup y partial failure.
4. **Task 9** extendido: E2E tests para flujos parciales.

---

**Estado:** Plan actualizado. Listo para ejecución con `executing-plans`.
