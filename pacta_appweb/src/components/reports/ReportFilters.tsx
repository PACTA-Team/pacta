
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, RotateCcw, Save } from 'lucide-react';
import { ContractStatus, ContractType } from '@/types';

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  status: ContractStatus | 'all';
  type: ContractType | 'all';
  client: string;
  supplier: string;
  amountMin: string;
  amountMax: string;
}

interface ReportFiltersProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  onApply: () => void;
  onReset: () => void;
  onSavePreset?: (name: string) => void;
  showTypeFilter?: boolean;
  showAmountFilter?: boolean;
  showClientFilter?: boolean;
}

const defaultFilters: ReportFilters = {
  dateFrom: '',
  dateTo: '',
  status: 'all',
  type: 'all',
  client: '',
  supplier: '',
  amountMin: '',
  amountMax: '',
};

export default function ReportFiltersComponent({
  filters,
  onFiltersChange,
  onApply,
  onReset,
  onSavePreset,
  showTypeFilter = true,
  showAmountFilter = true,
  showClientFilter = true,
}: ReportFiltersProps) {
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  const handleChange = (key: keyof ReportFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleSavePreset = () => {
    if (presetName && onSavePreset) {
      onSavePreset(presetName);
      setPresetName('');
      setShowSavePreset(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="h-5 w-5" />
          Report Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dateFrom">From Date</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleChange('dateFrom', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateTo">To Date</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleChange('dateTo', e.target.value)}
            />
          </div>
        </div>

        {/* Status and Type */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => handleChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showTypeFilter && (
            <div className="space-y-2">
              <Label>Contract Type</Label>
              <Select
                value={filters.type}
                onValueChange={(value) => handleChange('type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
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
          )}
        </div>

        {/* Client and Supplier */}
        {showClientFilter && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Input
                id="client"
                placeholder="Filter by client..."
                value={filters.client}
                onChange={(e) => handleChange('client', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                placeholder="Filter by supplier..."
                value={filters.supplier}
                onChange={(e) => handleChange('supplier', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Amount Range */}
        {showAmountFilter && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amountMin">Min Amount ($)</Label>
              <Input
                id="amountMin"
                type="number"
                placeholder="0"
                value={filters.amountMin}
                onChange={(e) => handleChange('amountMin', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amountMax">Max Amount ($)</Label>
              <Input
                id="amountMax"
                type="number"
                placeholder="No limit"
                value={filters.amountMax}
                onChange={(e) => handleChange('amountMax', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Button onClick={onApply}>
              <Filter className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
          {onSavePreset && (
            <div className="flex items-center gap-2">
              {showSavePreset ? (
                <>
                  <Input
                    placeholder="Preset name..."
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    className="w-40"
                  />
                  <Button size="sm" onClick={handleSavePreset}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowSavePreset(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowSavePreset(true)}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Preset
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { defaultFilters };
