

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Contract, ContractType, ContractStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { clientsAPI } from '@/lib/clients-api';
import { suppliersAPI } from '@/lib/suppliers-api';
import { signersAPI } from '@/lib/signers-api';
import { toast } from 'sonner';

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
    title: contract?.title || '',
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
  });

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

          <div className="space-y-2">
            <Label htmlFor="title">Contract Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client *</Label>
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
              <Label htmlFor="clientSignerId">Client Authorized Signer *</Label>
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
                      {signer.firstName} {signer.lastName} - {signer.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplierId">Supplier *</Label>
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
              <Label htmlFor="supplierSignerId">Supplier Authorized Signer *</Label>
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
                      {signer.firstName} {signer.lastName} - {signer.position}
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
