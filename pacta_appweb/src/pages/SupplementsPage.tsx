import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, CheckCircle, XCircle, ArrowUpCircle, Search } from 'lucide-react';
import { Supplement, SupplementStatus, CreateSupplementRequest } from '@/types';
import { supplementsAPI } from '@/lib/supplements-api';
import { contractsAPI } from '@/lib/contracts-api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SupplementForm from '@/components/supplements/SupplementForm';
import { Link } from 'react-router-dom';
import { Pagination, PaginationInfo } from '@/components/ui/pagination';

type ContractSummary = {
  id: number;
  internal_id: string;
  contract_number: string;
  title: string;
  client_id: number;
  supplier_id: number;
};

export default function SupplementsPage() {
  const { t } = useTranslation('supplements');
  const { t: tCommon } = useTranslation('common');
  const { i18n } = useTranslation();
  const [supplements, setSupplementsState] = useState<Supplement[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<Supplement | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [modificationTypeFilter, setModificationTypeFilter] = useState<string>('all');
  const [supplementPartyFilter, setSupplementPartyFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredSupplements = useMemo(() => {
    let filtered = [...supplements];

    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.supplement_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    if (contractFilter !== 'all') {
      filtered = filtered.filter(s => s.contract_id === parseInt(contractFilter));
    }

    if (modificationTypeFilter !== 'all') {
      filtered = filtered.filter(s => s.modification_type === modificationTypeFilter);
    }

    if (supplementPartyFilter !== 'all' && user?.company_id) {
      const companyId = user.company_id;
      if (supplementPartyFilter === 'client') {
        filtered = filtered.filter(s => {
          const contract = contracts.find(c => c.id === s.contract_id);
          return String(contract?.client_id) === companyId;
        });
      } else if (supplementPartyFilter === 'supplier') {
        filtered = filtered.filter(s => {
          const contract = contracts.find(c => c.id === s.contract_id);
          return String(contract?.supplier_id) === companyId;
        });
      }
    }

    return filtered;
  }, [supplements, searchTerm, statusFilter, contractFilter]);

  const totalPages = Math.ceil(filteredSupplements.length / itemsPerPage);
  const paginatedSupplements = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSupplements.slice(start, start + itemsPerPage);
  }, [filteredSupplements, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, contractFilter, modificationTypeFilter, supplementPartyFilter]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    const action = searchParams.get('action');
    if (action === 'create') {
      setShowForm(true);
    }
    return () => controller.abort();
  }, [searchParams]);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);
      const [supps, contrs] = await Promise.all([
        supplementsAPI.list(signal),
        contractsAPI.list(signal),
      ]);
      setSupplementsState(supps);
      setContracts(contrs as any);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = async (data: CreateSupplementRequest) => {
    try {
      if (editingSupplement) {
        await supplementsAPI.update(editingSupplement.id, data);
        toast.success('Supplement updated successfully');
      } else {
        await supplementsAPI.create(data);
        toast.success('Supplement created successfully');
      }
      resetForm();
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingSupplement(undefined);
    navigate('/supplements');
  };

  const handleEdit = (supplement: Supplement) => {
    if (!hasPermission('editor')) {
      toast.error('You do not have permission to edit supplements');
      return;
    }
    setEditingSupplement(supplement);
    setShowForm(true);
  };

  const handleDelete = async (id: number, supplementNumber: string) => {
    if (!hasPermission('manager')) {
      toast.error('You do not have permission to delete supplements');
      return;
    }
    try {
      await supplementsAPI.delete(id);
      toast.success('Supplement deleted successfully');
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleStatusChange = async (id: number, status: SupplementStatus) => {
    try {
      await supplementsAPI.transitionStatus(id, status);
      toast.success(`Supplement ${status}`);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status change failed');
    }
  };

  const getStatusBadge = (status: SupplementStatus) => {
    const variants: Record<SupplementStatus, 'default' | 'secondary' | 'outline'> = {
      draft: 'secondary',
      approved: 'default',
      active: 'default',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getContractInfo = (contractId: number) => {
    const contract = contracts.find(c => c.id === contractId);
    return contract ? `${contract.contract_number} - ${contract.title}` : `Contract #${contractId}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-label="Loading supplements">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20" role="alert">
        <p className="text-sm text-red-600 dark:text-red-400">Error loading supplements: {error}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => loadData()}>
          {tCommon('next')}
        </Button>
      </div>
    );
  }

  if (showForm) {
    return (
      <SupplementForm
        onSubmit={handleSubmit}
        editingSupplement={editingSupplement}
        contracts={contracts}
        onCancel={resetForm}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search supplements..."
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
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contractFilter} onValueChange={setContractFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Contract" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contracts</SelectItem>
                {contracts.map(contract => (
                  <SelectItem key={contract.id} value={String(contract.id)}>
                    {contract.contract_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={modificationTypeFilter} onValueChange={setModificationTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('status') === 'Estado' ? 'Todos los tipos' : 'All Types'}</SelectItem>
                <SelectItem value="modificacion">{t('modificationTypes.modificacion')}</SelectItem>
                <SelectItem value="prorroga">{t('modificationTypes.prorroga')}</SelectItem>
                <SelectItem value="concrecion">{t('modificationTypes.concrecion')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={supplementPartyFilter} onValueChange={setSupplementPartyFilter}>
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
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('addNew')}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplement Number</TableHead>
                  <TableHead className="hidden md:table-cell">Parent Contract</TableHead>
                  <TableHead className="hidden lg:table-cell">Description</TableHead>
                  <TableHead>{t('effectiveDate')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{tCommon('edit')}</TableHead>
                </TableRow>
              </TableHeader>
<TableBody>
                  {paginatedSupplements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {searchTerm || statusFilter !== 'all' || contractFilter !== 'all' ? 'No supplements match your filters' : t('noSupplements')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedSupplements.map((supplement) => (
                      <TableRow key={supplement.id}>
                        <TableCell className="font-medium">{supplement.supplement_number}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Link to={`/contracts/${supplement.contract_id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                            {getContractInfo(supplement.contract_id)}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell max-w-xs truncate">{supplement.description}</TableCell>
                        <TableCell>{new Date(supplement.effective_date).toLocaleDateString(i18n.language)}</TableCell>
                        <TableCell>{getStatusBadge(supplement.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                          {supplement.status === 'draft' && hasPermission('manager') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600"
                              onClick={() => handleStatusChange(supplement.id, 'approved')}
                              aria-label={`Approve supplement ${supplement.supplement_number}`}
                            >
                              <CheckCircle className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                          {supplement.status === 'approved' && hasPermission('manager') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600"
                                onClick={() => handleStatusChange(supplement.id, 'active')}
                                aria-label={`Activate supplement ${supplement.supplement_number}`}
                              >
                                <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusChange(supplement.id, 'draft')}
                                aria-label={`Return supplement ${supplement.supplement_number} to draft`}
                              >
                                <XCircle className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </>
                          )}
                          {hasPermission('editor') && (
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(supplement)} aria-label={`Edit supplement ${supplement.supplement_number}`}>
                              <Edit className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                          {hasPermission('manager') && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(supplement.id, supplement.supplement_number)} aria-label={`Delete supplement ${supplement.supplement_number}`}>
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

      {totalPages > 0 && (
        <div className="flex flex-col items-center gap-4 border-t py-4 sm:flex-row sm:justify-between">
          <PaginationInfo
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredSupplements.length}
            itemsPerPage={itemsPerPage}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
