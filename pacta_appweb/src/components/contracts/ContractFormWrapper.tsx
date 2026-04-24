import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Contract, Company, Client, Supplier, AuthorizedSigner } from '@/types';
import type { ContractSubmitData } from '@/types/contract';
import { toast } from 'sonner';
import { useOwnCompanies } from '@/hooks/useOwnCompanies';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { clientsAPI } from '@/lib/clients-api';
import { suppliersAPI } from '@/lib/suppliers-api';
import { signersAPI } from '@/lib/signers-api';
import ContraparteForm from './ContraparteForm';
import { ContractDocumentUpload } from './ContractDocumentUpload';
import { ClientInlineModal } from '@/components/modals/ClientInlineModal';
import { SupplierInlineModal } from '@/components/modals/SupplierInlineModal';
import { SignerInlineModal } from '@/components/modals/SignerInlineModal';
import { upload } from '@/lib/upload';
import logger from '@/lib/logger';

interface ContractFormWrapperProps {
  contract?: Contract | null;
  onSubmit: (data: ContractSubmitData) => Promise<void>;
  onCancel: () => void;
}

/**
 * ContractFormWrapper — Orchestration component for contract creation/editing.
 *
 * Architecture:
 * - Manages global state (companies, role, document)
 * - Handles loading states for all async data
 * - Uses AbortController to cancel obsolete requests
 * - Verifies document existence via HEAD before final submit
 * - Coordinates ContraparteForm, ContractDocumentUpload, and modals
 */
export default function ContractFormWrapper({ contract, onSubmit, onCancel }: ContractFormWrapperProps) {
  const { t } = useTranslation('contracts');

  // ─── Global State ───
  const { ownCompanies, selectedOwnCompany, setSelectedOwnCompany, loading: loadingCompanies } = useOwnCompanies();

  const [ourRole, setOurRole] = useState<'client' | 'supplier'>('client');
  const [pendingDocument, setPendingDocument] = useState<{url:string; key:string; file:File} | null>(null);

  // ─── Loading States (for parallel fetch coordination) ───
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingSigners, setLoadingSigners] = useState(false);

  // ─── Data Arrays ───
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [signers, setSigners] = useState<AuthorizedSigner[]>([]);

  // ─── Modal States ───
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [showNewSignerModal, setShowNewSignerModal] = useState(false);

   // ─── Ref for tracking form fields ───
   type FormField = keyof ContractSubmitData;
   const formDataRef = useRef<Partial<ContractSubmitData>>({});

  // ─── AbortController for cancelling stale requests ───
  const loadAbortRef = useRef<AbortController | null>(null);

  const isMultiCompany = ownCompanies.length > 1;
  const isEditing = !!contract;

  // ─── Effect: Load clients/suppliers for selected company ───
  useEffect(() => {
    if (!selectedOwnCompany) {
      setClients([]);
      setSuppliers([]);
      return;
    }

    // Cancel any in-flight request
    if (loadAbortRef.current) {
      loadAbortRef.current.abort();
    }
    loadAbortRef.current = new AbortController();

    const loadCounterparts = async () => {
      try {
        if (ourRole === 'client') {
          setLoadingClients(true);
          setLoadingSuppliers(false);
          const data = await suppliersAPI.listByCompany(selectedOwnCompany.id, loadAbortRef.current?.signal);
          setSuppliers(data);
          setClients([]); // Clear opposite side
        } else {
          setLoadingSuppliers(true);
          setLoadingClients(false);
          const data = await clientsAPI.listByCompany(selectedOwnCompany.id, loadAbortRef.current?.signal);
          setClients(data);
          setSuppliers([]); // Clear opposite side
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          toast.error('Failed to load counterparties');
        }
      } finally {
        setLoadingClients(false);
        setLoadingSuppliers(false);
      }
    };

    loadCounterparts();

    return () => {
      if (loadAbortRef.current) {
        loadAbortRef.current.abort();
      }
    };
  }, [selectedOwnCompany, ourRole]);

  // ─── Effect: Load signers for selected counterpart ───
  useEffect(() => {
    const loadSigners = async () => {
      if (!selectedOwnCompany) {
        setSigners([]);
        return;
      }

      const counterpartId = ourRole === 'client'
        ? formDataRef.current.client_id
        : formDataRef.current.supplier_id;

      if (!counterpartId) {
        setSigners([]);
        return;
      }

      setLoadingSigners(true);
      try {
        // Use optimized endpoint that filters by company_id AND company_type
        const data = await signersAPI.listByCompany(counterpartId, ourRole, loadAbortRef.current?.signal);
        setSigners(data);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          toast.error('Failed to load authorized signers');
        }
      } finally {
        setLoadingSigners(false);
      }
    };

    loadSigners();

    return () => {
      if (loadAbortRef.current) {
        loadAbortRef.current.abort();
      }
    };
  }, [selectedOwnCompany, ourRole, formDataRef.current.client_id, formDataRef.current.supplier_id]);

   // ─── Handlers ───
   const handleCompanyChange = (value: string) => {
      const company = ownCompanies.find(c => c.id === parseInt(value));
      if (company) {
        setSelectedOwnCompany(company);
        // Reset form state
        formDataRef.current = {};
        setPendingDocument(null);
        toast.success('Documento reiniciado por cambio de empresa');
        setClients([]);
        setSuppliers([]);
        setSigners([]);
      }
    };

  const handleRoleChange = (value: 'client' | 'supplier') => {
    setOurRole(value);
    formDataRef.current = {};
    setClients([]);
    setSuppliers([]);
    setSigners([]);
  };

  const handleClientIdChange = (clientId: string) => {
    formDataRef.current.client_id = clientId ? Number(clientId) : undefined;
    formDataRef.current.supplier_id = undefined;
    // Reload signers for this client
    setSigners([]); // Will be repopulated by effect
  };

    const handleSupplierIdChange = (supplierId: string) => {
      formDataRef.current.supplier_id = supplierId ? Number(supplierId) : undefined;
      formDataRef.current.client_id = undefined;
      // Reload signers for this supplier
      setSigners([]); // Will be repopulated by effect
    };

    const handleClientSignerIdChange = (clientSignerId: string) => {
      formDataRef.current.client_signer_id = clientSignerId ? Number(clientSignerId) : undefined;
      formDataRef.current.supplier_signer_id = undefined;
    };

    const handleSupplierSignerIdChange = (supplierSignerId: string) => {
      formDataRef.current.supplier_signer_id = supplierSignerId ? Number(supplierSignerId) : undefined;
      formDataRef.current.client_signer_id = undefined;
    };

    const handleFieldChange = useCallback((field: keyof ContractSubmitData, value: any) => {
      formDataRef.current[field] = value;
    }, []);

    const handleAddDocument = (doc: {url:string; key:string; file:File}) => {
      setPendingDocument(doc);
    };

    const handleRemoveDocument = () => {
      if (pendingDocument) {
        upload.cleanupTemporary(pendingDocument.key).catch(err =>
          logger.error('Failed to cleanup temp document on remove:', err)
        );
      }
      setPendingDocument(null);
    };

    // ─── Submit with Document Verification ───
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedOwnCompany) {
        toast.error('Seleccione una empresa');
        return;
      }

      // Validate required contract fields
      const requiredFields: (keyof ContractSubmitData)[] = [
        'contract_number', 'start_date', 'end_date', 'amount', 'type', 'status'
      ];
      for (const field of requiredFields) {
        const value = formDataRef.current[field];
        if (value === undefined || value === '' || value === null) {
          toast.error(`Field ${field} is required`);
          return;
        }
      }

      // Validate counterparty and signer based on role
      if (ourRole === 'client') {
        if (!formDataRef.current.supplier_id) {
          toast.error('Seleccione un proveedor');
          return;
        }
        if (!formDataRef.current.client_signer_id) {
          toast.error('Seleccione un representante autorizado del cliente');
          return;
        }
      } else {
        if (!formDataRef.current.client_id) {
          toast.error('Seleccione un cliente');
          return;
        }
        if (!formDataRef.current.supplier_signer_id) {
          toast.error('Seleccione un representante autorizado del proveedor');
          return;
        }
      }

      // Verify pending document still exists (prevents TTL expiry issues)
      if (pendingDocument) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        try {
          const response = await fetch(pendingDocument.url, {
            method: 'HEAD',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            // Document expired or was deleted
            setPendingDocument(null);
            toast.error('El documento ha expirado. Por favor, súbalo nuevamente.');
            return;
          }
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            toast.error('Document verification timed out');
          } else {
            toast.error('Error al verificar documento. Intente nuevamente.');
          }
          return;
        }
      }

      setIsSubmitting(true);
      try {
        // Build contract submit data from ref
        const submitData: Partial<ContractSubmitData> = {
          ...formDataRef.current,
          company_id: selectedOwnCompany.id,
          document_url: pendingDocument?.url,
          document_key: pendingDocument?.key,
          // Ensure numeric types where needed
          client_id: formDataRef.current.client_id ? Number(formDataRef.current.client_id) : undefined,
          supplier_id: formDataRef.current.supplier_id ? Number(formDataRef.current.supplier_id) : undefined,
          client_signer_id: formDataRef.current.client_signer_id ? Number(formDataRef.current.client_signer_id) : undefined,
          supplier_signer_id: formDataRef.current.supplier_signer_id ? Number(formDataRef.current.supplier_signer_id) : undefined,
          amount: typeof formDataRef.current.amount === 'number' ? formDataRef.current.amount : Number(formDataRef.current.amount),
        };

        await onSubmit(submitData as ContractSubmitData);

        // Cleanup temporary document after successful submit (non-blocking)
        if (pendingDocument) {
          try {
            await upload.cleanupTemporary(pendingDocument.key);
          } catch (cleanupErr) {
            logger.error('Failed to cleanup temp document after submit:', cleanupErr);
            // Don't block success flow on cleanup failure
          }
        }
        setPendingDocument(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al guardar contrato';
        if (message.toLowerCase().includes('document') || message.includes('document_url')) {
          toast.error('El contrato se creó, pero hubo un problema con el documento. Por favor reintente la carga.');
        } else {
          toast.error(message);
        }
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    };

   // ─── Derived State ───
   const [isSubmitting, setIsSubmitting] = useState(false);

   // Determine which counterpart data to show based on ourRole
  const displayClients = ourRole === 'supplier' ? clients : [];
  const displaySuppliers = ourRole === 'client' ? suppliers : [];
  const counterpartSigners = signers.filter(s => s.company_type === ourRole);

  // Current counterpart ID from contract or form state
  const getCounterpartId = () => {
    if (contract) {
      return ourRole === 'client' ? contract.supplier_id.toString() : contract.client_id.toString();
    }
    return ourRole === 'client' 
      ? formDataRef.current.supplier_id 
      : formDataRef.current.client_id;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{contract ? t('editContract') : t('newContract')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6" id="contract-form">
          {/* Company Selector (multi-company only, new contracts) */}
          {isMultiCompany && !isEditing && (
            <div className="space-y-2">
              <Label>Seleccionar Empresa *</Label>
              <RadioGroup
                value={selectedOwnCompany?.id?.toString() || ''}
                onValueChange={handleCompanyChange}
                className="flex flex-col gap-2"
              >
                {ownCompanies.map((company) => (
                  <div key={company.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={company.id.toString()} id={`company-${company.id}`} />
                    <Label htmlFor={`company-${company.id}`} className="cursor-pointer">
                      {company.name}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Role Selector (only for new contracts) */}
          {!isEditing && selectedOwnCompany && (
            <div className="space-y-2">
              <Label>Esta empresa actúa como *</Label>
              <RadioGroup value={ourRole} onValueChange={(v) => handleRoleChange(v as 'client' | 'supplier')}>
                <div className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="client" id="our-role-client" />
                    <Label htmlFor="our-role-client" className="cursor-pointer">
                      Cliente (recibimos servicio)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="supplier" id="our-role-supplier" />
                    <Label htmlFor="our-role-supplier" className="cursor-pointer">
                      Proveedor (brindamos servicio)
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Unified ContraparteForm */}
          {selectedOwnCompany && (
           <ContraparteForm
               key={`${ourRole}-${selectedOwnCompany.id}`} // Reset when role or company changes
               type={ourRole}
               companyId={selectedOwnCompany.id}
               contract={contract}
               clients={displayClients}
               suppliers={displaySuppliers}
               signers={counterpartSigners}
               onContraparteIdChange={
                 ourRole === 'client' 
                   ? handleSupplierIdChange 
                   : handleClientIdChange
               }
               onSignerIdChange={
                 ourRole === 'client'
                   ? handleClientSignerIdChange
                   : handleSupplierSignerIdChange
               }
               onAddContraparte={() => {
                 if (ourRole === 'client') {
                   setShowNewSupplierModal(true);
                 } else {
                   setShowNewClientModal(true);
                 }
               }}
               onAddResponsible={() => setShowNewSignerModal(true)}
               pendingDocument={pendingDocument}
               onDocumentChange={handleAddDocument}
               onDocumentRemove={handleRemoveDocument}
                isLoading={ourRole === 'client' ? loadingClients : loadingSuppliers}
                loadingSigners={loadingSigners}
                onFieldChange={handleFieldChange}
              />
          )}

           {/* Action Buttons */}
           <div className="flex gap-2 justify-end pt-4">
             <Button type="button" variant="outline" onClick={onCancel}>
               Cancelar
             </Button>
             <Button type="submit" form="contract-form" disabled={isSubmitting}>
               {isSubmitting ? 'Saving...' : (contract ? 'Actualizar Contrato' : 'Crear Contrato')}
             </Button>
           </div>
        </form>

        {/* Modals */}
          {showNewClientModal && selectedOwnCompany && (
            <ClientInlineModal
              companyId={selectedOwnCompany.id}
              open={showNewClientModal}
              onOpenChange={setShowNewClientModal}
              onSuccess={async () => {
                try {
                  const data = await clientsAPI.listByCompany(selectedOwnCompany.id);
                  setClients(data);
                } catch (error) {
                  logger.error('Failed to load clients after creation:', error);
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
                } catch (error) {
                  logger.error('Failed to load suppliers after creation:', error);
                }
              }}
            />
          )}

        {showNewSignerModal && selectedOwnCompany && (
          <SignerInlineModal
            companyId={selectedOwnCompany.id}
            companyType={ourRole}
            open={showNewSignerModal}
            onOpenChange={setShowNewSignerModal}
            onSuccess={async () => {
              const counterpartId = ourRole === 'client'
                ? formDataRef.current.supplier_id
                : formDataRef.current.client_id;

                if (counterpartId) {
                  try {
                    const data = await signersAPI.listByCompany(counterpartId, ourRole);
                    setSigners(data);
                } catch (err) {
                  toast.error('Error al cargar responsables');
                }
              }
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
