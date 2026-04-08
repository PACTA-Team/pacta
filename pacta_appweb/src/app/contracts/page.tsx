
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import { Contract, ContractStatus, ContractType, Client, Supplier } from '@/types';
import { getContracts, setContracts, getCurrentUser, getClients, getSuppliers } from '@/lib/storage';
import { addAuditLog } from '@/lib/audit';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import ContractForm from '@/components/contracts/ContractForm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ContractsPage() {
  const [contracts, setContractsState] = useState<Contract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);
  const { hasPermission } = useAuth();
  const searchParams = useSearchParams();

  useEffect(() => {
    loadData();
    if (searchParams.get('action') === 'create') {
      setShowForm(true);
    }
  }, [searchParams]);

  useEffect(() => {
    filterContracts();
  }, [contracts, searchTerm, statusFilter, typeFilter]);

  const loadData = () => {
    setContractsState(getContracts());
    setClients(getClients());
    setSuppliers(getSuppliers());
  };

  const filterContracts = () => {
    let filtered = [...contracts];

    if (searchTerm) {
      filtered = filtered.filter(c => {
        const client = clients.find(cl => cl.id === c.clientId);
        const supplier = suppliers.find(s => s.id === c.supplierId);
        return (
          c.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          supplier?.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => c.type === typeFilter);
    }

    setFilteredContracts(filtered);
  };

  const handleCreateOrUpdate = (data: Omit<Contract, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
    const user = getCurrentUser();
    if (!user) return;

    const allContracts = getContracts();

    if (editingContract) {
      const updated: Contract = {
        ...editingContract,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      const newContracts = allContracts.map(c => c.id === updated.id ? updated : c);
      setContracts(newContracts);
      addAuditLog(updated.id, 'Contract Updated', `Contract ${updated.contractNumber} was updated`);
      toast.success('Contract updated successfully');
    } else {
      const newContract: Contract = {
        ...data,
        id: Date.now().toString(),
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setContracts([...allContracts, newContract]);
      addAuditLog(newContract.id, 'Contract Created', `Contract ${newContract.contractNumber} was created`);
      toast.success('Contract created successfully');
    }

    setShowForm(false);
    setEditingContract(undefined);
    loadData();
  };

  const handleEdit = (contract: Contract) => {
    if (!hasPermission('editor')) {
      toast.error('You do not have permission to edit contracts');
      return;
    }
    setEditingContract(contract);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!hasPermission('manager')) {
      toast.error('You do not have permission to delete contracts');
      return;
    }
    setContractToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!contractToDelete) return;

    const allContracts = getContracts();
    const contract = allContracts.find(c => c.id === contractToDelete);
    const newContracts = allContracts.filter(c => c.id !== contractToDelete);
    setContracts(newContracts);
    
    if (contract) {
      addAuditLog(contract.id, 'Contract Deleted', `Contract ${contract.contractNumber} was deleted`);
    }
    
    toast.success('Contract deleted successfully');
    setDeleteDialogOpen(false);
    setContractToDelete(null);
    loadData();
  };

  const getStatusBadge = (status: ContractStatus) => {
    const variants: Record<ContractStatus, 'default' | 'destructive' | 'secondary' | 'outline'> = {
      active: 'default',
      expired: 'destructive',
      pending: 'secondary',
      cancelled: 'outline',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown';
  };

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Unknown';
  };

  if (showForm) {
    return (
      <AppLayout>
        <ContractForm
          contract={editingContract}
          onSubmit={handleCreateOrUpdate}
          onCancel={() => {
            setShowForm(false);
            setEditingContract(undefined);
          }}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contracts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="lease">Lease</SelectItem>
                <SelectItem value="partnership">Partnership</SelectItem>
                <SelectItem value="employment">Employment</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasPermission('editor') && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Contract
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Client/Supplier</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No contracts found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                      <TableCell>{contract.title}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>Client: {getClientName(contract.clientId)}</div>
                          <div className="text-muted-foreground">Supplier: {getSupplierName(contract.supplierId)}</div>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(contract.startDate).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(contract.endDate).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(contract.status)}</TableCell>
                      <TableCell>${contract.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link href={`/contracts/${contract.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {hasPermission('editor') && (
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(contract)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission('manager') && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(contract.id)}>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the contract and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
