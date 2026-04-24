import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import { Contract, Client, Supplier, Company, ContractType, ContractStatus } from '@/types';
import { contractsAPI, CreateContractRequest, UpdateContractRequest } from '@/lib/contracts-api';
import { clientsAPI } from '@/lib/clients-api';
import { suppliersAPI } from '@/lib/suppliers-api';
import { companiesAPI } from '@/lib/companies-api';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import ContractForm from '@/components/contracts/ContractForm';
import { useOwnCompanies } from '@/hooks/useOwnCompanies';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
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
  const { hasPermission } = useAuth();
  const { t } = useTranslation('contracts');
  const { t: tCommon } = useTranslation('common');
  const [searchParams] = useSearchParams();
  const { currentCompany, isMultiCompany } = useCompany();

  const [contracts, setContracts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [partyFilter, setPartyFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [viewRole, setViewRole] = useState<'client' | 'supplier' | null>(null);
  const { ownCompanies, selectedOwnCompany, setSelectedOwnCompany, loading: loadingCompanies } = useOwnCompanies();
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [contractsData, clientsData, suppliersData] = await Promise.all([
        contractsAPI.list(),
        clientsAPI.list(),
        suppliersAPI.list(),
      ]);
      setContracts(contractsData as any[]);
      setClients(clientsData as any[]);
      setSuppliers(suppliersData as any[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load data');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  // Determine effective company filter: viewRole takes precedence over specific company ID
  const effectiveCompanyFilter = viewRole || companyFilter;

  // Use the useCompanyFilter hook with ourRole parameter
  const filteredContracts = useCompanyFilter(
    contracts,
    currentCompany,
    effectiveCompanyFilter,
    viewRole || undefined
  );

  const handleCreateOrUpdate = async (data: Omit<Contract, 'id' | 'internal_id' | 'created_by' | 'created_at' | 'updated_at'>) => {
    try {
      if (editingContract) {
        const updateData: UpdateContractRequest = {
          client_id: Number(data.client_id),
          supplier_id: Number(data.supplier_id),
          client_signer_id: data.client_signer_id ? Number(data.client_signer_id) : undefined,
          supplier_signer_id: data.supplier_signer_id ? Number(data.supplier_signer_id) : undefined,
          start_date: data.start_date,
          end_date: data.end_date,
          amount: Number(data.amount),
          type: data.type as ContractType,
          status: data.status as ContractStatus,
          description: data.description,
          object: data.object,
          fulfillment_place: data.fulfillment_place,
          dispute_resolution: data.dispute_resolution,
          has_confidentiality: data.has_confidentiality,
          guarantees: data.guarantees,
          renewal_type: data.renewal_type,
          document_url: data.document_url ? String(data.document_url) : undefined,
          document_key: data.document_key ? String(data.document_key) : undefined,
        };
        await contractsAPI.update(editingContract.id, updateData);
        toast.success(t('updateSuccess'));
      } else {
        const createData: CreateContractRequest = {
          contract_number: data.contract_number || '',
          client_id: Number(data.client_id),
          supplier_id: Number(data.supplier_id),
          client_signer_id: data.client_signer_id ? Number(data.client_signer_id) : undefined,
          supplier_signer_id: data.supplier_signer_id ? Number(data.supplier_signer_id) : undefined,
          start_date: data.start_date,
          end_date: data.end_date,
          amount: Number(data.amount),
          type: data.type as ContractType,
          status: data.status as ContractStatus,
          description: data.description,
          object: data.object,
          fulfillment_place: data.fulfillment_place,
          dispute_resolution: data.dispute_resolution,
          has_confidentiality: data.has_confidentiality,
          guarantees: data.guarantees,
          renewal_type: data.renewal_type,
          document_url: data.document_url ? String(data.document_url) : undefined,
          document_key: data.document_key ? String(data.document_key) : undefined,
        };
        await contractsAPI.create(createData);
        toast.success(t('createSuccess'));
      }
      setShowForm(false);
      setEditingContract(undefined);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleEdit = (contract: any) => {
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
      active: 'default',
      expired: 'destructive',
      pending: 'secondary',
      cancelled: 'outline',
    };
    return <Badge variant={variants[status] || 'secondary'}>{t(status)}</Badge>;
  };

  const getClientName = (clientId: number) => {
    const client = clients.find((c: any) => c.id === clientId);
    return client?.name || 'Unknown';
  };

  const getSupplierName = (supplierId: number) => {
    const supplier = suppliers.find((s: any) => s.id === supplierId);
    return supplier?.name || 'Unknown';
  };

  return (
    <>
      {showForm ? (
        <ContractForm
          contract={editingContract}
          onSubmit={handleCreateOrUpdate}
          onCancel={() => {
            setShowForm(false);
            setEditingContract(undefined);
          }}
        />
      ) : (
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
                    <SelectItem value="all">{t('allParties')}</SelectItem>
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
                    <SelectItem value="all">{t('allTypes')}</SelectItem>
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
                <Select value={partyFilter} onValueChange={(value) => {
                  setPartyFilter(value);
                  // When selecting "Como cliente" or "Como proveedor", set viewRole accordingly
                  if (value === 'client') {
                    setViewRole('client');
                  } else if (value === 'supplier') {
                    setViewRole('supplier');
                  } else {
                    setViewRole(null);
                  }
                }}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Party" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('partyFilter.all')}</SelectItem>
                    <SelectItem value="client">{t('partyFilter.client')}</SelectItem>
                    <SelectItem value="supplier">{t('partyFilter.supplier')}</SelectItem>
                  </SelectContent>
                </Select>
                {isMultiCompany && (
                  <Select value={companyFilter} onValueChange={(value) => {
                    setCompanyFilter(value);
                    setViewRole(null); // Clear viewRole when selecting specific company
                  }}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder={t('company')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allCompanies')}</SelectItem>
                      {ownCompanies && ownCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
                      {isMultiCompany && <TableHead className="hidden md:table-cell">Company</TableHead>}
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
                        <TableCell colSpan={isMultiCompany ? 8 : 7} className="text-center text-muted-foreground py-8">
                          {t('noContracts')}
                        </TableCell>
                      </TableRow>
) : (
                      filteredContracts.map((contract: any) => {
                        const isClient = String(contract.client_id) === String(currentCompany?.id);
                        const isSupplier = String(contract.supplier_id) === String(currentCompany?.id);
                        const contractCompany = isClient ? 'Client' : isSupplier ? 'Supplier' : 'Other';
                        return (
                          <TableRow key={contract.id}>
                            <TableCell className="font-medium">{contract.contract_number}</TableCell>
                            {isMultiCompany && (
                              <TableCell className="hidden md:table-cell text-sm">
                                {contractCompany}
                              </TableCell>
                            )}
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
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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