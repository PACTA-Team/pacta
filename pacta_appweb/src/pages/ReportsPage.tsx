import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PieChart,
  Users,
  FilePlus,
  AlertTriangle,
  DollarSign,
  FileEdit
} from 'lucide-react';
import { contractsAPI } from '@/lib/contracts-api';
import { supplementsAPI } from '@/lib/supplements-api';
import { clientsAPI } from '@/lib/clients-api';
import { suppliersAPI } from '@/lib/suppliers-api';
import { companiesAPI } from '@/lib/companies-api';
import { Company } from '@/types';
import ReportFiltersComponent, { ReportFilters, defaultFilters } from '@/components/reports/ReportFilters';
import ContractStatusReport from '@/components/reports/ContractStatusReport';
import FinancialReport from '@/components/reports/FinancialReport';
import ExpirationReport from '@/components/reports/ExpirationReport';
import ClientSupplierReport from '@/components/reports/ClientSupplierReport';
import SupplementsReport from '@/components/reports/SupplementsReport';
import ModificationsReport from '@/components/reports/ModificationsReport';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

type ReportType =
  | 'status'
  | 'financial'
  | 'expiration'
  | 'client-supplier'
  | 'supplements'
  | 'modifications';

interface SavedPreset {
  name: string;
  filters: ReportFilters;
}

export default function ReportsPage() {
  const { t } = useTranslation('reports');
  const { t: tCommon } = useTranslation('common');
  const { currentCompany, isMultiCompany } = useCompany();
  const [contracts, setContracts] = useState<any[]>([]);
  const [supplements, setSupplements] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [activeReport, setActiveReport] = useState<ReportType>('status');
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(defaultFilters);
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [ownCompanies, setOwnCompanies] = useState<Company[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [contractsData, supplementsData, clientsData, suppliersData, companiesData] = await Promise.all([
          contractsAPI.list(),
          supplementsAPI.list(),
          clientsAPI.list(),
          suppliersAPI.list(),
          companiesAPI.list(),
        ]);
        setContracts(contractsData as any[]);
        setSupplements(supplementsData as any[]);
        setClients(clientsData as any[]);
        setSuppliers(suppliersData as any[]);
        setOwnCompanies(companiesData);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : tCommon('error'));
      }
    };
    loadData();

    // Load saved presets from localStorage
    const saved = localStorage.getItem('pacta_report_presets');
    if (saved) {
      setSavedPresets(JSON.parse(saved));
    }
  }, []);

  // Enrich contracts first, then filter
  const enrichedContracts = useMemo(() => {
    const clientsMap = new Map(clients.map((c: any) => [String(c.id), c.name]));
    const suppliersMap = new Map(suppliers.map((s: any) => [String(s.id), s.name]));

    return contracts.map((contract: any) => ({
      ...contract,
      client: clientsMap.get(String(contract.client_id)) || 'Unknown Client',
      supplier: suppliersMap.get(String(contract.supplier_id)) || 'Unknown Supplier',
    }));
  }, [contracts, clients, suppliers]);

  // Filter enriched contracts based on applied filters
  const enrichedFilteredContracts = useMemo(() => {
    let result = [...enrichedContracts];

    if (appliedFilters.dateFrom) {
      result = result.filter((c: any) => new Date(c.start_date) >= new Date(appliedFilters.dateFrom));
    }
    if (appliedFilters.dateTo) {
      result = result.filter((c: any) => new Date(c.end_date) <= new Date(appliedFilters.dateTo));
    }
    if (appliedFilters.status !== 'all') {
      result = result.filter((c: any) => c.status === appliedFilters.status);
    }
    if (appliedFilters.type !== 'all') {
      result = result.filter((c: any) => c.type === appliedFilters.type);
    }
    if (appliedFilters.client) {
      result = result.filter((c: any) =>
        c.client_name?.toLowerCase().includes(appliedFilters.client?.toLowerCase())
      );
    }
    if (appliedFilters.supplier) {
      result = result.filter((c: any) =>
        c.supplier_name?.toLowerCase().includes(appliedFilters.supplier?.toLowerCase())
      );
    }
    if (appliedFilters.amountMin) {
      result = result.filter((c: any) => c.amount >= parseFloat(appliedFilters.amountMin));
    }
    if (appliedFilters.amountMax) {
      result = result.filter((c: any) => c.amount <= parseFloat(appliedFilters.amountMax));
    }

    if (companyFilter !== 'all' && currentCompany) {
      if (companyFilter === 'my') {
        result = result.filter((c: any) =>
          String(c.client_id) === String(currentCompany.id) ||
          String(c.supplier_id) === String(currentCompany.id)
        );
      }
    }

    return result;
  }, [enrichedContracts, appliedFilters, companyFilter, currentCompany]);

  // Filter supplements based on date filters
  const filteredSupplements = useMemo(() => {
    let result = [...supplements];

    if (appliedFilters.dateFrom) {
      result = result.filter((s: any) => new Date(s.created_at) >= new Date(appliedFilters.dateFrom));
    }
    if (appliedFilters.dateTo) {
      result = result.filter((s: any) => new Date(s.created_at) <= new Date(appliedFilters.dateTo));
    }

    return result;
  }, [supplements, appliedFilters]);

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  const handleSavePreset = (name: string) => {
    const newPreset: SavedPreset = { name, filters: { ...filters } };
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    localStorage.setItem('pacta_report_presets', JSON.stringify(updated));
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    setFilters(preset.filters);
    setAppliedFilters(preset.filters);
  };

  const reportTypes = [
    { id: 'status', label: t('types.status'), icon: PieChart, description: t('types.contracts') },
    { id: 'financial', label: t('types.financial'), icon: DollarSign, description: t('types.financial') },
    { id: 'expiration', label: t('types.expirations'), icon: AlertTriangle, description: t('types.expirations') },
    { id: 'client-supplier', label: t('types.clientSupplier'), icon: Users, description: t('types.clientSupplier') },
    { id: 'supplements', label: t('types.supplements'), icon: FilePlus, description: t('types.supplements') },
    { id: 'modifications', label: t('types.modifications'), icon: FileEdit, description: t('types.modifications') },
  ];

  return (
    
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? t('hideFilters') : t('showFilters')}
          </Button>
        </div>

        {/* Saved Presets */}
        {savedPresets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t('savedPresets')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {savedPresets.map((preset, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoadPreset(preset)}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        {showFilters && (
          <>
            {isMultiCompany && (
              <Card>
                <CardContent className="flex items-center gap-4 py-3">
                  <span className="text-sm font-medium">Company:</span>
                  <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      <SelectItem value="my">My Company Only</SelectItem>
                      {ownCompanies && ownCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}
            <ReportFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              onApply={handleApplyFilters}
              onReset={handleResetFilters}
              onSavePreset={handleSavePreset}
              showTypeFilter={activeReport !== 'supplements' && activeReport !== 'modifications'}
              showAmountFilter={activeReport !== 'supplements' && activeReport !== 'modifications'}
              showClientFilter={activeReport !== 'supplements' && activeReport !== 'modifications'}
            />
          </>
        )}

        {/* Report Type Selection */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {reportTypes.map((report) => (
            <Card
              key={report.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeReport === report.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setActiveReport(report.id as ReportType)}
            >
              <CardContent className="p-4 text-center">
                <report.icon className={`h-8 w-8 mx-auto mb-2 ${
                  activeReport === report.id ? 'text-primary' : 'text-muted-foreground'
                }`} />
                <h3 className="font-medium text-sm">{report.label}</h3>
                <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Report Content */}
        <div className="mt-6">
          {activeReport === 'status' && (
            <ContractStatusReport contracts={enrichedFilteredContracts} />
          )}
          {activeReport === 'financial' && (
            <FinancialReport contracts={enrichedFilteredContracts} />
          )}
          {activeReport === 'expiration' && (
            <ExpirationReport contracts={enrichedFilteredContracts} />
          )}
          {activeReport === 'client-supplier' && (
            <ClientSupplierReport contracts={enrichedFilteredContracts} />
          )}
          {activeReport === 'supplements' && (
            <SupplementsReport
              supplements={filteredSupplements}
              contracts={enrichedContracts}
              dateFrom={appliedFilters.dateFrom}
              dateTo={appliedFilters.dateTo}
            />
          )}
          {activeReport === 'modifications' && (
            <ModificationsReport
              supplements={filteredSupplements}
              contracts={enrichedContracts}
            />
          )}
        </div>
      </div>
    
  );
}
