import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import { ContractStatus, ContractType, Contract } from '@/types';
import { contractsAPI, CreateContractRequest, UpdateContractRequest } from '@/lib/contracts-api';
import { clientsAPI } from '@/lib/clients-api';
import { suppliersAPI } from '@/lib/suppliers-api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
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
  const [contracts, setContractsState] = useState<any[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<number | null>(null);
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    loadData();
    if (searchParams.get('action') === 'create') {
      setShowForm(true);
    }
  }, [searchParams]);

  useEffect(() => {
    filterContracts();
  }, [contracts, searchTerm, statusFilter, typeFilter]);

  const loadData = useCallback(async () => {
    try {
      const [contractsData, clientsData, suppliersData] = await Promise.all([
        contractsAPI.list(),
        clientsAPI.list(),
        suppliersAPI.list(),
      ]);
      setContractsState(contractsData as any[]);
      setClients(clientsData as any[]);
      setSuppliers(suppliersData as any[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load data');
    }
  }, []);

  const filterContracts = () => {
    let filtered = [...contracts];

    if (searchTerm) {
      filtered = filtered.filter(c => {
        const client = clients.find(cl => cl.id === c.client_id);
        const supplier = suppliers.find(s => s.id === c.supplier_id);
        return (
          c.contract_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleCreateOrUpdate = async (data: Omit<Contract, 'id' | 'internalId' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingContract) {
        await contractsAPI.update(editingContract.id, {
          title: data.title,
          client_id: parseInt(data.clientId),
          supplier_id: parseInt(data.supplierId),
          start_date: data.startDate,
          end_date: data.endDate,
          amount: data.amount,
          type: data.type,
          status: data.status,
        });
        toast.success('Contract updated successfully');
      } else {
        await contractsAPI.create({
          contract_number: data.contractNumber,
          title: data.title,
          client_id: parseInt(data.clientId),
          supplier_id: parseInt(data.supplierId),
          start_date: data.startDate,
          end_date: data.endDate,
          amount: data.amount,
          type: data.type,
          status: data.status,
        });
        toast.success('Contract created successfully');
      }
      setShowForm(false);
      setEditingContract(undefined);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleEdit = (contract: Contract) => {
    if (!hasPermission('editor')) {
      toast.error('You do not have permission to edit contracts');
      return;
    }
    setEditingContract(contract);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (!hasPermission('manager')) {
      toast.error('You do not have permission to delete contracts');
      return;
    }
    setContractToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!contractToDelete) return;
    try {
      await contractsAPI.delete(contractToDelete);
      toast.success('Contract deleted successfully');
      setDeleteDialogOpen(false);
      setContractToDelete(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
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

  const getClientName = (clientId: number) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown';
  };

  const getSupplierName = (supplierId: number) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Unknown';
  };

  if (showForm) {
    return (
      <>
        <ContractForm
          contract={editingContract}
          onSubmit={handleCreateOrUpdate}
          onCancel={() => {
            setShowForm(false);
            setEditingContract(undefined);
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contracts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
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
                <SelectTrigger className="w-full sm:w-40">
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
          </div>
          {hasPermission('editor') && (
            <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Create New Contract</span>
              <span className="sm:hidden">New Contract</span>
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Internal ID</TableHead>
                    <TableHead>Contract Number</TableHead>
                    <TableHead className="hidden md:table-cell">Title</TableHead>
                    <TableHead className="hidden lg:table-cell">Client/Supplier</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead className="hidden sm:table-cell">End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No contracts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{contract.internal_id || '—'}</TableCell>
                        <TableCell className="font-medium">{contract.contract_number}</TableCell>
                        <TableCell className="hidden md:table-cell">{contract.title}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="text-sm">
                            <div>Client: {getClientName(contract.client_id)}</div>
                            <div className="text-muted-foreground">Supplier: {getSupplierName(contract.supplier_id)}</div>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(contract.start_date).toLocaleDateString()}</TableCell>
                        <TableCell className="hidden sm:table-cell">{new Date(contract.end_date).toLocaleDateString()}</TableCell>
                        <TableCell>{getStatusBadge(contract.status)}</TableCell>
                        <TableCell className="hidden md:table-cell">${contract.amount?.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link to={`/contracts/${contract.id}`}>
                              <Button variant="ghost" size="sm" aria-label={`View contract ${contract.contract_number}`}>
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </Link>
                            {hasPermission('editor') && (
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(contract)} aria-label={`Edit contract ${contract.contract_number}`}>
                                <Edit className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            )}
                            {hasPermission('manager') && (
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(contract.id)} aria-label={`Delete contract ${contract.contract_number}`}>
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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
    </>
  );
}
