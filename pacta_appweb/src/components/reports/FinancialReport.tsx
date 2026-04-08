
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { Contract, ContractType } from '@/types';
import { exportToCSV, exportToExcel, exportToPDF, formatCurrency, formatDate, formatStatus, ExportColumn } from '@/lib/export-utils';
import ExportButtons from './ExportButtons';
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface FinancialReportProps {
  contracts: Contract[];
  title?: string;
}

const TYPE_COLORS: Record<ContractType, string> = {
  service: '#3b82f6',
  purchase: '#22c55e',
  lease: '#f59e0b',
  partnership: '#8b5cf6',
  employment: '#ec4899',
  other: '#6b7280',
};

export default function FinancialReport({ contracts, title = 'Financial Report' }: FinancialReportProps) {
  const financialData = useMemo(() => {
    // By Type
    const byType: Record<ContractType, number> = {
      service: 0,
      purchase: 0,
      lease: 0,
      partnership: 0,
      employment: 0,
      other: 0,
    };

    contracts.forEach(c => {
      byType[c.type] += c.amount;
    });

    const typeData = Object.entries(byType)
      .filter(([_, amount]) => amount > 0)
      .map(([type, amount]) => ({
        name: formatStatus(type),
        amount,
        type: type as ContractType,
      }));

    // Monthly Trends
    const monthlyData: Record<string, number> = {};
    contracts.forEach(c => {
      const month = new Date(c.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      monthlyData[month] = (monthlyData[month] || 0) + c.amount;
    });

    const trendData = Object.entries(monthlyData)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([month, amount]) => ({ month, amount }));

    // Totals
    const totalValue = contracts.reduce((sum, c) => sum + c.amount, 0);
    const activeValue = contracts.filter(c => c.status === 'active').reduce((sum, c) => sum + c.amount, 0);
    const avgValue = contracts.length > 0 ? totalValue / contracts.length : 0;
    const maxContract = contracts.reduce((max, c) => c.amount > max.amount ? c : max, contracts[0] || { amount: 0 });
    const minContract = contracts.reduce((min, c) => c.amount < min.amount ? c : min, contracts[0] || { amount: 0 });

    return {
      typeData,
      trendData,
      totalValue,
      activeValue,
      avgValue,
      maxContract,
      minContract,
    };
  }, [contracts]);

  const columns: ExportColumn[] = [
    { key: 'contractNumber', header: 'Contract Number' },
    { key: 'title', header: 'Title' },
    { key: 'client', header: 'Client' },
    { key: 'type', header: 'Type' },
    { key: 'status', header: 'Status' },
    { key: 'amount', header: 'Amount' },
  ];

  const exportData = contracts
    .sort((a, b) => b.amount - a.amount)
    .map(c => ({
      contractNumber: c.contractNumber,
      title: c.title,
      client: c.client,
      type: formatStatus(c.type),
      status: formatStatus(c.status),
      amount: formatCurrency(c.amount),
    }));

  const summary = [
    { label: 'Total Contract Value', value: formatCurrency(financialData.totalValue) },
    { label: 'Active Contracts Value', value: formatCurrency(financialData.activeValue) },
    { label: 'Average Contract Value', value: formatCurrency(financialData.avgValue) },
    { label: 'Total Contracts', value: contracts.length },
  ];

  const handleExportPDF = () => {
    exportToPDF(title, exportData, columns, summary);
  };

  const handleExportExcel = () => {
    exportToExcel(exportData, columns, 'financial-report');
  };

  const handleExportCSV = () => {
    exportToCSV(exportData, columns, 'financial-report');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <ExportButtons
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          onExportCSV={handleExportCSV}
          disabled={contracts.length === 0}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financialData.totalValue)}</div>
            <p className="text-xs text-muted-foreground">All contracts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(financialData.activeValue)}</div>
            <p className="text-xs text-muted-foreground">Active contracts only</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Value</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financialData.avgValue)}</div>
            <p className="text-xs text-muted-foreground">Per contract</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Highest Contract</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(financialData.maxContract?.amount || 0)}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {financialData.maxContract?.title || 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Value by Contract Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialData.typeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    {financialData.typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.type]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Value Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={financialData.trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={{ fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contracts by Value (Top 10)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Contract Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No contracts found matching the filters
                  </TableCell>
                </TableRow>
              ) : (
                [...contracts]
                  .sort((a, b) => b.amount - a.amount)
                  .slice(0, 10)
                  .map((contract, index) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">#{index + 1}</TableCell>
                      <TableCell>{contract.contractNumber}</TableCell>
                      <TableCell>{contract.title}</TableCell>
                      <TableCell>{contract.client}</TableCell>
                      <TableCell>{formatStatus(contract.type)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(contract.amount)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {financialData.totalValue > 0 
                          ? ((contract.amount / financialData.totalValue) * 100).toFixed(1) 
                          : 0}%
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Need to import Cell for the BarChart
import { Cell } from 'recharts';
