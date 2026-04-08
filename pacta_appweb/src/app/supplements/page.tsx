
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Supplement, SupplementStatus, Contract } from '@/types';
import { getSupplements, setSupplements, getContracts, getCurrentUser } from '@/lib/storage';

type SupplementFormData = {
  contractId: string;
  supplementNumber: string;
  description: string;
  effectiveDate: string;
  modifications: string;
  status: SupplementStatus;
  documentUrl?: string;
  documentKey?: string;
  documentName?: string;
};
import { addAuditLog } from '@/lib/audit';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import SupplementForm from '@/components/supplements/SupplementForm';
import Link from 'next/link';

export default function SupplementsPage() {
  const [supplements, setSupplementsState] = useState<Supplement[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<Supplement | undefined>();
  const [formData, setFormData] = useState<SupplementFormData>({
    contractId: '',
    supplementNumber: '',
    description: '',
    effectiveDate: '',
    modifications: '',
    status: 'draft' as SupplementStatus,
    documentUrl: '',
    documentKey: '',
    documentName: '',
  });
  const { hasPermission } = useAuth();
  const searchParams = useSearchParams();

  useEffect(() => {
    loadData();
    const action = searchParams.get('action');
    const contractId = searchParams.get('contractId');
    if (action === 'create') {
      setShowForm(true);
      if (contractId) {
        setFormData(prev => ({ ...prev, contractId }));
      }
    }
  }, [searchParams]);

  const loadData = () => {
    setSupplementsState(getSupplements());
    setContracts(getContracts());
  };

  const handleSubmit = (data: Omit<Supplement, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
    const user = getCurrentUser();
    if (!user) return;

    const allSupplements = getSupplements();

    if (editingSupplement) {
      const updated: Supplement = {
        ...editingSupplement,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      const newSupplements = allSupplements.map(s => s.id === updated.id ? updated : s);
      setSupplements(newSupplements);
      addAuditLog(data.contractId, 'Supplement Updated', `Supplement ${updated.supplementNumber} was updated`);
      toast.success('Supplement updated successfully');
    } else {
      const newSupplement: Supplement = {
        ...data,
        id: Date.now().toString(),
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSupplements([...allSupplements, newSupplement]);
      addAuditLog(data.contractId, 'Supplement Created', `Supplement ${newSupplement.supplementNumber} was created`);
      toast.success('Supplement created successfully');
    }

    resetForm();
    loadData();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingSupplement(undefined);
    setFormData({
      contractId: '',
      supplementNumber: '',
      description: '',
      effectiveDate: '',
      modifications: '',
      status: 'draft',
      documentUrl: '',
      documentKey: '',
      documentName: '',
    });
  };

  const handleEdit = (supplement: Supplement) => {
    if (!hasPermission('editor')) {
      toast.error('You do not have permission to edit supplements');
      return;
    }
    setEditingSupplement(supplement);
    setFormData({
      contractId: supplement.contractId,
      supplementNumber: supplement.supplementNumber,
      description: supplement.description,
      effectiveDate: supplement.effectiveDate,
      modifications: supplement.modifications,
      status: supplement.status,
      documentUrl: supplement.documentUrl || '',
      documentKey: supplement.documentKey || '',
      documentName: supplement.documentName || '',
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!hasPermission('manager')) {
      toast.error('You do not have permission to delete supplements');
      return;
    }

    const allSupplements = getSupplements();
    const supplement = allSupplements.find(s => s.id === id);
    const newSupplements = allSupplements.filter(s => s.id !== id);
    setSupplements(newSupplements);
    
    if (supplement) {
      addAuditLog(supplement.contractId, 'Supplement Deleted', `Supplement ${supplement.supplementNumber} was deleted`);
    }
    
    toast.success('Supplement deleted successfully');
    loadData();
  };

  const getStatusBadge = (status: SupplementStatus) => {
    const variants: Record<SupplementStatus, 'default' | 'secondary' | 'outline'> = {
      draft: 'secondary',
      approved: 'default',
      active: 'default',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getContractInfo = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    return contract ? `${contract.contractNumber} - ${contract.title}` : 'Unknown';
  };

  if (showForm) {
    return (
      <AppLayout>
        <SupplementForm
          onSubmit={handleSubmit}
          editingSupplement={editingSupplement}
          contracts={contracts}
          formData={formData}
          setFormData={setFormData}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Manage contract supplements
          </p>
          {hasPermission('editor') && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Supplement
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplement Number</TableHead>
                  <TableHead>Parent Contract</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No supplements found
                    </TableCell>
                  </TableRow>
                ) : (
                  supplements.map((supplement) => (
                    <TableRow key={supplement.id}>
                      <TableCell className="font-medium">{supplement.supplementNumber}</TableCell>
                      <TableCell>
                        <Link href={`/contracts/${supplement.contractId}`} className="text-blue-600 hover:underline">
                          {getContractInfo(supplement.contractId)}
                        </Link>
                      </TableCell>
                      <TableCell>{supplement.description}</TableCell>
                      <TableCell>{new Date(supplement.effectiveDate).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(supplement.status)}</TableCell>
                      <TableCell>{new Date(supplement.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {hasPermission('editor') && (
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(supplement)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission('manager') && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(supplement.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
