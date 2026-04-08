
'use client';

import { useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Contract, ContractStatus } from '@/types';
import { exportToCSV, exportToExcel, exportToPDF, formatCurrency, formatDate, formatStatus, ExportColumn } from '@/lib/export-utils';
import ExportButtons from './ExportButtons';

interface ContractStatusReportProps {
  contracts: Contract[];
  title?: string;
}

const STATUS_COLORS: Record<ContractStatus, string> = {
  active: '#22c55e',
  expired: '#ef4444',
  pending: '#f59e0b',
  cancelled: '#6b7280',
};

export default function ContractStatusReport({ contracts, title = 'Contracts by Status Report' }: ContractStatusReportProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  const statusData = useMemo(() => {
    const counts: Record<ContractStatus, number> = {
      active: 0,
      expired: 0,
      pending: 0,
      cancelled: 0,
    };
    
    contracts.forEach(c => {
      counts[c.status]++;
    });

    return Object.entries(counts).map(([status, count]) => ({
      name: formatStatus(status),
      value: count,
      status: status as ContractStatus,
    }));
  }, [contracts]);

  const columns: ExportColumn[] = [
    { key: 'contractNumber', header: 'Contract Number' },
    { key: 'title', header: 'Title' },
    { key: 'client', header: 'Client' },
    { key: 'status', header: 'Status' },
    { key: 'startDate', header: 'Start Date' },
    { key: 'endDate', header: 'End Date' },
    { key: 'amount', header: 'Amount' },
  ];

  const exportData = contracts.map(c => ({
    contractNumber: c.contractNumber,
    title: c.title,
    client: c.client,
    status: formatStatus(c.status),
    startDate: formatDate(c.startDate),
    endDate: formatDate(c.endDate),
    amount: formatCurrency(c.amount),
  }));

  const summary = statusData.map(item => ({
    label: item.name,
    value: item.value,
  }));

  const handleExportPDF = () => {
    exportToPDF(title, exportData, columns, summary);
  };

  const handleExportExcel = () => {
    exportToExcel(exportData, columns, 'contracts-by-status');
  };

  const handleExportCSV = () => {
    exportToCSV(exportData, columns, 'contracts-by-status');
  };

  const getStatusBadge = (status: ContractStatus) => {
    const variants: Record<ContractStatus, 'default' | 'destructive' | 'secondary' | 'outline'> = {
      active: 'default',
      expired: 'destructive',
      pending: 'secondary',
      cancelled: 'outline',
    };
    return <Badge variant={variants[status]}>{formatStatus(status)}</Badge>;
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={chartRef} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {statusData.map((item) => (
                <div
                  key={item.status}
                  className="p-4 rounded-lg border"
                  style={{ borderLeftColor: STATUS_COLORS[item.status], borderLeftWidth: 4 }}
                >
                  <p className="text-sm text-muted-foreground">{item.name}</p>
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="text-xs text-muted-foreground">
                    {contracts.length > 0 ? ((item.value / contracts.length) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Details ({contracts.length} records)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
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
                contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                    <TableCell>{contract.title}</TableCell>
                    <TableCell>{contract.client}</TableCell>
                    <TableCell>{getStatusBadge(contract.status)}</TableCell>
                    <TableCell>{formatDate(contract.startDate)}</TableCell>
                    <TableCell>{formatDate(contract.endDate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(contract.amount)}</TableCell>
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
