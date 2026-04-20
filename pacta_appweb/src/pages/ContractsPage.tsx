import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import { Contract, Client, Supplier } from '@/types';
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
  const [contracts, setContractsState] = useState<Contract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [partyFilter, setPartyFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<number | null>(null);
  const { user, hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation('contracts');
  const { t: tCommon } = useTranslation('common');

  useEffect(() => {
    loadData();
    if (searchParams.get('action') === 'create') {
      setShowForm(true);
    }
  }, [searchParams]);

  useEffect(() => {
    filterContracts();
  }, [contracts, searchTerm, statusFilter, typeFilter, partyFilter]);

  const loadData = useCallback(async () => {
    try {
      const [contractsData, clientsData, suppliersData] = await Promise.all([
        contractsAPI.list(),
        clientsAPI.list(),
        suppliersAPI.list(),
      ]);
      setContractsState(contractsData as Contract[]);
      setClients(clientsData as Client[]);
      setSuppliers(suppliersData as Supplier[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load data');
    }
  }, []);

  const filterContracts = () => {
    let filtered = [...contracts];

    if (searchTerm) {
      filtered = filtered.filter(c => {
        const client = clients.find(cl => Number(cl.id) === c.client_id);
        const supplier = suppliers.find(s => Number(s.id) === c.supplier_id);
        return (
          c.contract_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

    if (partyFilter !== 'all' && user?.company_id) {
      const companyId = user.company_id;
      if (partyFilter === 'client') {
        filtered = filtered.filter(c => String(c.client_id) === companyId);
      } else if (partyFilter === 'supplier') {
        filtered = filtered.filter(c => String(c.supplier_id) === companyId);
      }
    }

    setFilteredContracts(filtered);
  };

  const handleCreateOrUpdate = async (data: Omit<Contract, 'id' | 'internal_id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    try {
      if (editingContract) {
        await contractsAPI.update(editingContract.id, {
          contract_number: data.contract_number,
          client_id: parseInt(data.client_id),
          supplier_id: parseInt(data.supplier_id),
          client_signer_id: data.client_signer_id ? parseInt(data.client_signer_id) : undefined,
          supplier_signer_id: data.supplier_signer_id ? parseInt(data.supplier_signer_id) : undefined,
          start_date: data.start_date,
          end_date: data.end_date,
          amount: data.amount,
          type: data.type,
          status: data.status,
          description: data.description,
          object: data.object,
          fulfillment_place: data.fulfillment_place,
          dispute_resolution: data.dispute_resolution,
          has_confidentiality: data.has_confidentiality,
          guarantees: data.guarantees,
          renewal_type: data.renewal_type,
        });
        toast.success(t('updateSuccess'));
      } else {
        await contractsAPI.create({
          contract_number: data.contract_number,
          client_id: parseInt(data.client_id),
          supplier_id: parseInt(data.supplier_id),
          client_signer_id: data.client_signer_id ? parseInt(data.client_signer_id) : undefined,
          supplier_signer_id: data.supplier_signer_id ? parseInt(data.supplier_signer_id) : undefined,
          start_date: data.start_date,
          end_date: data.end_date,
          amount: data.amount,
          type: data.type,
          status: data.status,
          description: data.description,
          object: data.object,
          fulfillment_place: data.fulfillment_place,
          dispute_resolution: data.dispute_resolution,
          has_confidentiality: data.has_confidentiality,
          guarantees: data.guarantees,
          renewal_type: data.renewal_type,
        });
        toast.success(t('createSuccess'));
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
      toast.success(t('deleteSuccess'));
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
    return <Badge variant={variants[status]}>{t(status)}</Badge>;
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
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder={t('status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">{t('active')}</SelectItem>
                  <SelectItem value="pending">{t('pending')}</SelectItem>
                  <SelectItem value="expired">{t('expired')}</SelectItem>
                  <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder={t('type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('status') === 'Estado' ? 'Todos' : 'All'}</SelectItem>
                  <SelectItem value="compraventa">{t('contractTypes.compraventa')}</SelectItem>
                  <SelectItem value="suministro">{t('contractTypes.suministro')}</SelectItem>
                  <SelectItem value="permuta">{t('contractTypes.permuta')}</SelectItem>
                  <SelectItem value="donacion">{t('contractTypes.donacion')}</SelectItem>
                  <SelectItem value="deposito">{t('contractTypes.deposito')}</SelectItem>
                  <SelectItem value="prestacion_servicios">{t('contractTypes.prestacion_servicios')}</SelectItem>
                  <SelectItem value="agencia">{t('contractTypes.agencia')}</SelectItem>
                  <SelectItem value="comision">{t('contractTypes.comision')}</SelectItem>
                  <SelectItem value="consignacion">{t('contractTypes.consignacion')}</SelectItem>
                  <SelectItem value="comodato">{t('contractTypes.comodato')}</SelectItem>
                  <SelectItem value="arrendamiento">{t('contractTypes.arrendamiento')}</SelectItem>
                  <SelectItem value="leasing">{t('contractTypes.leasing')}</SelectItem>
                  <SelectItem value="cooperacion">{t('contractTypes.cooperacion')}</SelectItem>
                  <SelectItem value="administracion">{t('contractTypes.administracion')}</SelectItem>
                  <SelectItem value="transporte">{t('contractTypes.transporte')}</SelectItem>
                  <SelectItem value="otro">{t('contractTypes.otro')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={partyFilter} onValueChange={setPartyFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Party" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('partyFilter.all')}</SelectItem>
                  <SelectItem value="client">{t('partyFilter.client')}</SelectItem>
                  <SelectItem value="supplier">{t('partyFilter.supplier')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasPermission('editor') && (
            <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">{t('createNew')}</span>
              <span className="sm:hidden">{t('newContract')}</span>
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('contractNumber', 'Contract Number')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('client')}/{t('supplier')}</TableHead>
                    <TableHead>{t('startDate')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('endDate')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('amount')}</TableHead>
                    <TableHead>{tCommon('edit')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {t('noContracts')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContracts.map((contract) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">{contract.contract_number}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="text-sm">
                            <div>{t('client')}: {getClientName(contract.client_id)}</div>
                            <div className="text-muted-foreground">{t('supplier')}: {getSupplierName(contract.supplier_id)}</div>
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
            <AlertDialogTitle>{tCommon('areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{tCommon('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
