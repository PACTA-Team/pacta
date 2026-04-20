

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Contract, ContractType, ContractStatus, RenewalType, RENEWAL_TYPE_LABELS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { clientsAPI } from '@/lib/clients-api';
import { suppliersAPI } from '@/lib/suppliers-api';
import { signersAPI } from '@/lib/signers-api';
import { documentsAPI, APIDocument } from '@/lib/documents-api';
import { toast } from 'sonner';
import { ChevronDown, FileText, Upload, X, Download } from 'lucide-react';
import { FieldTooltip } from '@/components/ui/field-tooltip';

interface ContractFormProps {
  contract?: Contract;
  onSubmit: (data: Omit<Contract, 'id' | 'internalId' | 'createdBy' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export default function ContractForm({ contract, onSubmit, onCancel }: ContractFormProps) {
  const { t } = useTranslation('contracts');
  const { t: tCommon } = useTranslation('common');
  const [clients, setClients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [clientSigners, setClientSigners] = useState<any[]>([]);
  const [supplierSigners, setSupplierSigners] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    contractNumber: (contract as any)?.contract_number || contract?.contractNumber || '',
    clientId: ((contract as any)?.client_id ?? contract?.clientId)?.toString() || '',
    supplierId: ((contract as any)?.supplier_id ?? contract?.supplierId)?.toString() || '',
    clientSignerId: ((contract as any)?.client_signer_id ?? contract?.clientSignerId)?.toString() || '',
    supplierSignerId: ((contract as any)?.supplier_signer_id ?? contract?.supplierSignerId)?.toString() || '',
    startDate: (contract as any)?.start_date || contract?.startDate || '',
    endDate: (contract as any)?.end_date || contract?.endDate || '',
    amount: contract?.amount || 0,
    type: contract?.type || 'service' as ContractType,
    status: contract?.status || 'pending' as ContractStatus,
    description: contract?.description || '',
    object: (contract as any)?.object || contract?.object || '',
    fulfillmentPlace: (contract as any)?.fulfillment_place || contract?.fulfillmentPlace || '',
    disputeResolution: (contract as any)?.dispute_resolution || contract?.disputeResolution || '',
    hasConfidentiality: (contract as any)?.has_confidentiality || contract?.hasConfidentiality || false,
    guarantees: (contract as any)?.guarantees || contract?.guarantees || '',
    renewalType: (contract as any)?.renewal_type || contract?.renewalType || '' as RenewalType,
  });

  const [legalFieldsOpen, setLegalFieldsOpen] = useState(false);
  const [documents, setDocuments] = useState<APIDocument[]>([]);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (contract?.id) {
      loadDocuments();
    }
  }, [contract?.id]);

  const loadDocuments = async () => {
    if (!contract?.id) return;
    try {
      const docs = await documentsAPI.list(Number(contract.id), 'contract');
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !contract?.id) return;
    setUploading(true);
    try {
      const doc = await documentsAPI.upload(file, Number(contract.id), 'contract');
      setDocuments([...documents, doc]);
      toast.success('Document uploaded successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    try {
      await documentsAPI.delete(docId);
      setDocuments(documents.filter(d => d.id !== docId));
      toast.success('Document deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const isEditing = !!contract;
  const [ourRole, setOurRole] = useState<'client' | 'supplier'>(() => {
    if (contract) {
      return contract.clientId ? 'client' : 'supplier';
    }
    return 'client';
  });

  const counterpartType = ourRole === 'client' ? 'supplier' : 'client';
  const counterpartLabel = ourRole === 'client' ? t('supplier') : t('client');
  const ourLabel = ourRole === 'client' ? t('client') : t('supplier');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [clientsData, suppliersData, allSigners] = await Promise.all([
          clientsAPI.list(),
          suppliersAPI.list(),
          signersAPI.list(),
        ]);
        setClients(clientsData as any[]);
        setSuppliers(suppliersData as any[]);

        if (formData.clientId) {
          setClientSigners((allSigners as any[]).filter((s: any) => s.company_id === parseInt(formData.clientId) && s.company_type === 'client'));
        }

        if (formData.supplierId) {
          setSupplierSigners((allSigners as any[]).filter((s: any) => s.company_id === parseInt(formData.supplierId) && s.company_type === 'supplier'));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load form data');
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadSigners = async () => {
      const allSigners = await signersAPI.list();
      if (formData.clientId) {
        setClientSigners((allSigners as any[]).filter((s: any) => s.company_id === parseInt(formData.clientId) && s.company_type === 'client'));
      }
      if (formData.supplierId) {
        setSupplierSigners((allSigners as any[]).filter((s: any) => s.company_id === parseInt(formData.supplierId) && s.company_type === 'supplier'));
      }
    };
    loadSigners();
  }, [formData.clientId, formData.supplierId]);

  const handleClientChange = (clientId: string) => {
    const fetchSigners = async () => {
      const signers = await signersAPI.list();
      setClientSigners((signers as any[]).filter((s: any) => s.company_id === parseInt(clientId) && s.company_type === 'client'));
    };
    fetchSigners();
    setFormData({ ...formData, clientId, clientSignerId: '' });
  };

  const handleSupplierChange = (supplierId: string) => {
    const fetchSigners = async () => {
      const signers = await signersAPI.list();
      setSupplierSigners((signers as any[]).filter((s: any) => s.company_id === parseInt(supplierId) && s.company_type === 'supplier'));
    };
    fetchSigners();
    setFormData({ ...formData, supplierId, supplierSignerId: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clientId || !formData.supplierId) {
      toast.error('Please select both client and supplier');
      return;
    }
    
    if (!formData.clientSignerId || !formData.supplierSignerId) {
      toast.error('Please select authorized signers for both parties');
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{contract ? t('editContract') : t('newContract')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {contract?.internalId && (
            <div className="space-y-2">
              <Label htmlFor="internalId">Internal ID (System)</Label>
              <Input
                id="internalId"
                value={contract.internalId}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Auto-generated system identifier. Cannot be changed.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contractNumber">Contract Number *</Label>
              <Input
                id="contractNumber"
                value={formData.contractNumber}
                onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Contract Type *</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as ContractType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">{t('service')}</SelectItem>
                  <SelectItem value="purchase">{t('purchase')}</SelectItem>
                  <SelectItem value="lease">{t('lease')}</SelectItem>
                  <SelectItem value="employment">{t('employment')}</SelectItem>
                  <SelectItem value="nda">{t('nda')}</SelectItem>
                  <SelectItem value="other">{t('other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isEditing && (
            <div className="space-y-3">
              <Label>Esta empresa actúa como *</Label>
              <RadioGroup
                value={ourRole}
                onValueChange={(value) => setOurRole(value as 'client' | 'supplier')}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="client" id="our-role-client" />
                  <Label htmlFor="our-role-client" className="cursor-pointer">
                    Cliente (recibimos el servicio/producto)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="supplier" id="our-role-supplier" />
                  <Label htmlFor="our-role-supplier" className="cursor-pointer">
                    Proveedor (brindamos el servicio/producto)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">{ourLabel} *</Label>
              <Select value={formData.clientId} onValueChange={handleClientChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSignerId">{ourLabel} Authorized Signer *</Label>
              <Select 
                value={formData.clientSignerId} 
                onValueChange={(value) => setFormData({ ...formData, clientSignerId: value })}
                disabled={!formData.clientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select signer" />
                </SelectTrigger>
                <SelectContent>
                  {clientSigners.map((signer) => (
                    <SelectItem key={signer.id} value={signer.id}>
                      {signer.first_name} {signer.last_name} - {signer.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplierId">{counterpartLabel} *</Label>
              <Select value={formData.supplierId} onValueChange={handleSupplierChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplierSignerId">{counterpartLabel} Authorized Signer *</Label>
              <Select 
                value={formData.supplierSignerId} 
                onValueChange={(value) => setFormData({ ...formData, supplierSignerId: value })}
                disabled={!formData.supplierId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select signer" />
                </SelectTrigger>
                <SelectContent>
                  {supplierSigners.map((signer) => (
                    <SelectItem key={signer.id} value={signer.id}>
                      {signer.first_name} {signer.last_name} - {signer.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ($) *</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as ContractStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('active')}</SelectItem>
                  <SelectItem value="pending">{t('pending')}</SelectItem>
                  <SelectItem value="expired">{t('expired')}</SelectItem>
                  <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          {ourRole === 'client' && (
            <Collapsible open={legalFieldsOpen} onOpenChange={setLegalFieldsOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ChevronDown className={`h-4 w-4 transition-transform ${legalFieldsOpen ? 'rotate-180' : ''}`} />
                {t('additionalClauses') || 'Cláusulas Adicionales'}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <FieldTooltip content={t('objectTooltip')}>
                      <Label htmlFor="object">{t('object') || 'Objeto del Contrato'}</Label>
                    </FieldTooltip>
                    <Textarea
                      id="object"
                      value={formData.object}
                      onChange={(e) => setFormData({ ...formData, object: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <FieldTooltip content={t('fulfillmentPlaceTooltip')}>
                      <Label htmlFor="fulfillmentPlace">{t('fulfillmentPlace') || 'Lugar de Cumplimiento'}</Label>
                    </FieldTooltip>
                    <Input
                      id="fulfillmentPlace"
                      value={formData.fulfillmentPlace}
                      onChange={(e) => setFormData({ ...formData, fulfillmentPlace: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <FieldTooltip content={t('disputeResolutionTooltip')}>
                      <Label htmlFor="disputeResolution">{t('disputeResolution') || 'Resolución de Controversias'}</Label>
                    </FieldTooltip>
                    <Input
                      id="disputeResolution"
                      value={formData.disputeResolution}
                      onChange={(e) => setFormData({ ...formData, disputeResolution: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <FieldTooltip content={t('guaranteesTooltip')}>
                      <Label htmlFor="guarantees">{t('guarantees') || 'Garantías'}</Label>
                    </FieldTooltip>
                    <Textarea
                      id="guarantees"
                      value={formData.guarantees}
                      onChange={(e) => setFormData({ ...formData, guarantees: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <FieldTooltip content={t('renewalTypeTooltip')}>
                      <Label htmlFor="renewalType">{t('renewalType') || 'Tipo de Renovación'}</Label>
                    </FieldTooltip>
                    <Select
                      value={formData.renewalType}
                      onValueChange={(value) => setFormData({ ...formData, renewalType: value as RenewalType })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="automatica">{RENEWAL_TYPE_LABELS.automatica}</SelectItem>
                        <SelectItem value="manual">{RENEWAL_TYPE_LABELS.manual}</SelectItem>
                        <SelectItem value="cumplimiento">{RENEWAL_TYPE_LABELS.cumplimiento}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasConfidentiality"
                    checked={formData.hasConfidentiality}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasConfidentiality: !!checked })}
                  />
                  <FieldTooltip content={t('confidentialityClauseTooltip')}>
                    <Label htmlFor="hasConfidentiality" className="cursor-pointer">
                      {t('confidentialityClause') || 'Cláusula de Confidencialidad'}
                    </Label>
                  </FieldTooltip>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {isEditing && (
            <Collapsible open={documentsOpen} onOpenChange={setDocumentsOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ChevronDown className={`h-4 w-4 transition-transform ${documentsOpen ? 'rotate-180' : ''}`} />
                {t('documents') || 'Documentos Adjuntos'}
                {documents.length > 0 && (
                  <span className="ml-1 text-xs bg-primary/10 px-2 py-0.5 rounded-full">{documents.length}</span>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                {documents.length > 0 && (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 border rounded-md">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm truncate">{doc.filename}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => documentsAPI.download(doc.id)}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground">
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      disabled={uploading}
                    />
                    <Upload className="h-4 w-4" />
                    {uploading ? t('uploading') || 'Subiendo...' : t('uploadDocument') || 'Adjuntar documento'}
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('acceptedFormats') || 'Formatos aceptados: PDF, Word, Excel, imágenes'}
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}

          {!isEditing && (
            <p className="text-sm text-muted-foreground">
              {t('attachAfterSave') || 'Puede adjuntar documentos después de guardar el contrato.'}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit">
              {contract ? t('updateContract') : t('createContract')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
