
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PieChart,
  Users,
  FilePlus,
  AlertTriangle,
  DollarSign,
  FileEdit
} from 'lucide-react';
import { Contract, Supplement } from '@/types';
import { getContracts, getSupplements } from '@/lib/storage';
import AppLayout from '@/components/layout/AppLayout';
import ReportFiltersComponent, { ReportFilters, defaultFilters } from '@/components/reports/ReportFilters';
import ContractStatusReport from '@/components/reports/ContractStatusReport';
import FinancialReport from '@/components/reports/FinancialReport';
import ExpirationReport from '@/components/reports/ExpirationReport';
import ClientSupplierReport from '@/components/reports/ClientSupplierReport';
import SupplementsReport from '@/components/reports/SupplementsReport';
import ModificationsReport from '@/components/reports/ModificationsReport';

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
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [activeReport, setActiveReport] = useState<ReportType>('status');
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(defaultFilters);
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    setContracts(getContracts());
    setSupplements(getSupplements());

    // Load saved presets from localStorage
    const saved = localStorage.getItem('pacta_report_presets');
    if (saved) {
      setSavedPresets(JSON.parse(saved));
    }
  }, []);

  // Filter contracts based on applied filters
  const filteredContracts = useMemo(() => {
    let result = [...contracts];

    if (appliedFilters.dateFrom) {
      result = result.filter(c => new Date(c.startDate) >= new Date(appliedFilters.dateFrom));
    }
    if (appliedFilters.dateTo) {
      result = result.filter(c => new Date(c.endDate) <= new Date(appliedFilters.dateTo));
    }
    if (appliedFilters.status !== 'all') {
      result = result.filter(c => c.status === appliedFilters.status);
    }
    if (appliedFilters.type !== 'all') {
      result = result.filter(c => c.type === appliedFilters.type);
    }
    if (appliedFilters.client) {
      result = result.filter(c =>
        c.client?.toLowerCase().includes(appliedFilters.client?.toLowerCase())
      );
    }
    if (appliedFilters.supplier) {
      result = result.filter(c =>
        c.supplier?.toLowerCase().includes(appliedFilters.supplier?.toLowerCase())
      );
    }
    if (appliedFilters.amountMin) {
      result = result.filter(c => c.amount >= parseFloat(appliedFilters.amountMin));
    }
    if (appliedFilters.amountMax) {
      result = result.filter(c => c.amount <= parseFloat(appliedFilters.amountMax));
    }

    return result;
  }, [contracts, appliedFilters]);

  // Filter supplements based on date filters
  const filteredSupplements = useMemo(() => {
    let result = [...supplements];

    if (appliedFilters.dateFrom) {
      result = result.filter(s => new Date(s.createdAt) >= new Date(appliedFilters.dateFrom));
    }
    if (appliedFilters.dateTo) {
      result = result.filter(s => new Date(s.createdAt) <= new Date(appliedFilters.dateTo));
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
    { id: 'status', label: 'By Status', icon: PieChart, description: 'Contract distribution by status' },
    { id: 'financial', label: 'Financial', icon: DollarSign, description: 'Financial analysis and trends' },
    { id: 'expiration', label: 'Expirations', icon: AlertTriangle, description: 'Upcoming contract expirations' },
    { id: 'client-supplier', label: 'Client/Supplier', icon: Users, description: 'Analysis by client and supplier' },
    { id: 'supplements', label: 'Supplements', icon: FilePlus, description: 'Supplements overview and status' },
    { id: 'modifications', label: 'Modifications', icon: FileEdit, description: 'Contract modifications history' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground">
              Generate and export comprehensive reports for contracts and supplements
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>

        {/* Saved Presets */}
        {savedPresets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Saved Filter Presets</CardTitle>
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
            <ContractStatusReport contracts={filteredContracts} />
          )}
          {activeReport === 'financial' && (
            <FinancialReport contracts={filteredContracts} />
          )}
          {activeReport === 'expiration' && (
            <ExpirationReport contracts={filteredContracts} />
          )}
          {activeReport === 'client-supplier' && (
            <ClientSupplierReport contracts={filteredContracts} />
          )}
          {activeReport === 'supplements' && (
            <SupplementsReport 
              supplements={filteredSupplements} 
              contracts={contracts}
              dateFrom={appliedFilters.dateFrom}
              dateTo={appliedFilters.dateTo}
            />
          )}
          {activeReport === 'modifications' && (
            <ModificationsReport 
              supplements={filteredSupplements} 
              contracts={contracts} 
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
