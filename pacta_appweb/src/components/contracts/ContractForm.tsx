
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Contract, ContractType, ContractStatus, Client, Supplier, AuthorizedSigner } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getClients, getSuppliers, getAuthorizedSigners } from '@/lib/storage';
import { toast } from 'sonner';

interface ContractFormProps {
  contract?: Contract;
  onSubmit: (data: Omit<Contract, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export default function ContractForm({ contract, onSubmit, onCancel }: ContractFormProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [clientSigners, setClientSigners] = useState<AuthorizedSigner[]>([]);
  const [supplierSigners, setSupplierSigners] = useState<AuthorizedSigner[]>([]);
  
  const [formData, setFormData] = useState({
    contractNumber: contract?.contractNumber || '',
    title: contract?.title || '',
    clientId: contract?.clientId || '',
    supplierId: contract?.supplierId || '',
    clientSignerId: contract?.clientSignerId || '',
    supplierSignerId: contract?.supplierSignerId || '',
    startDate: contract?.startDate || '',
    endDate: contract?.endDate || '',
    amount: contract?.amount || 0,
    type: contract?.type || 'service' as ContractType,
    status: contract?.status || 'pending' as ContractStatus,
    description: contract?.description || '',
  });

  useEffect(() => {
    const loadedClients = getClients();
    const loadedSuppliers = getSuppliers();
    const allSigners = getAuthorizedSigners();
    
    setClients(loadedClients);
    setSuppliers(loadedSuppliers);
    
    if (formData.clientId) {
      setClientSigners(allSigners.filter(s => s.companyId === formData.clientId && s.companyType === 'client'));
    }
    
    if (formData.supplierId) {
      setSupplierSigners(allSigners.filter(s => s.companyId === formData.supplierId && s.companyType === 'supplier'));
    }
  }, [formData.clientId, formData.supplierId]);

  const handleClientChange = (clientId: string) => {
    const allSigners = getAuthorizedSigners();
    setClientSigners(allSigners.filter(s => s.companyId === clientId && s.companyType === 'client'));
    setFormData({ ...formData, clientId, clientSignerId: '' });
  };

  const handleSupplierChange = (supplierId: string) => {
    const allSigners = getAuthorizedSigners();
    setSupplierSigners(allSigners.filter(s => s.companyId === supplierId && s.companyType === 'supplier'));
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
        <CardTitle>{contract ? 'Edit Contract' : 'Create New Contract'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="lease">Lease</SelectItem>
                  <SelectItem value="partnership">Partnership</SelectItem>
                  <SelectItem value="employment">Employment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
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
                    <SelectItem key={client.id} value={client.id}>
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
                    <SelectItem key={supplier.id} value={supplier.id}>
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
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
              Cancel
            </Button>
            <Button type="submit">
              {contract ? 'Update Contract' : 'Create Contract'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
