
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Contract } from '@/types';
import { exportToCSV, exportToExcel, exportToPDF, formatCurrency, formatStatus, ExportColumn } from '@/lib/export-utils';
import ExportButtons from './ExportButtons';
import { Users, Building2 } from 'lucide-react';

interface ClientSupplierReportProps {
  contracts: Contract[];
  title?: string;
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function ClientSupplierReport({ contracts, title = 'Client/Supplier Report' }: ClientSupplierReportProps) {
  const reportData = useMemo(() => {
    // Group by client
    const clientMap = new Map<string, { count: number; totalValue: number; contracts: Contract[] }>();
    // Group by supplier
    const supplierMap = new Map<string, { count: number; totalValue: number; contracts: Contract[] }>();

    contracts.forEach(contract => {
      if (contract.client) {
        // Client aggregation
        const clientData = clientMap.get(contract.client) || { count: 0, totalValue: 0, contracts: [] };
        clientData.count++;
        clientData.totalValue += contract.amount;
        clientData.contracts.push(contract);
        clientMap.set(contract.client, clientData);
      }

      if (contract.supplier) {
        // Supplier aggregation
        const supplierData = supplierMap.get(contract.supplier) || { count: 0, totalValue: 0, contracts: [] };
        supplierData.count++;
        supplierData.totalValue += contract.amount;
        supplierData.contracts.push(contract);
        supplierMap.set(contract.supplier, supplierData);
      }
    });

    // Convert to arrays and sort by value
    const clientData = Array.from(clientMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalValue - a.totalValue);

    const supplierData = Array.from(supplierMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalValue - a.totalValue);

    // Chart data (top 8)
    const clientChartData = clientData.slice(0, 8).map(c => ({
      name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
      value: c.totalValue,
      count: c.count,
    }));

    const supplierChartData = supplierData.slice(0, 8).map(s => ({
      name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name,
      value: s.totalValue,
      count: s.count,
    }));

    return {
      clientData,
      supplierData,
      clientChartData,
      supplierChartData,
      totalClients: clientMap.size,
      totalSuppliers: supplierMap.size,
    };
  }, [contracts]);

  const columns: ExportColumn[] = [
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type' },
    { key: 'contractCount', header: 'Contract Count' },
    { key: 'totalValue', header: 'Total Value' },
    { key: 'avgValue', header: 'Average Value' },
  ];

  const exportData = [
    ...reportData.clientData.map(c => ({
      name: c.name,
      type: 'Client',
      contractCount: c.count,
      totalValue: formatCurrency(c.totalValue),
      avgValue: formatCurrency(c.totalValue / c.count),
    })),
    ...reportData.supplierData.map(s => ({
      name: s.name,
      type: 'Supplier',
      contractCount: s.count,
      totalValue: formatCurrency(s.totalValue),
      avgValue: formatCurrency(s.totalValue / s.count),
    })),
  ];

  const summary = [
    { label: 'Total Clients', value: reportData.totalClients },
    { label: 'Total Suppliers', value: reportData.totalSuppliers },
    { label: 'Total Contracts', value: contracts.length },
    { label: 'Total Value', value: formatCurrency(contracts.reduce((sum, c) => sum + c.amount, 0)) },
  ];

  const handleExportPDF = () => {
    exportToPDF(title, exportData, columns, summary);
  };

  const handleExportExcel = () => {
    exportToExcel(exportData, columns, 'client-supplier-report');
  };

  const handleExportCSV = () => {
    exportToCSV(exportData, columns, 'client-supplier-report');
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalClients}</div>
            <p className="text-xs text-muted-foreground">Unique clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalSuppliers}</div>
            <p className="text-xs text-muted-foreground">Unique suppliers</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Clients by Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.clientChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Suppliers by Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.supplierChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Table */}
      <Card>
        <CardHeader>
          <CardTitle>Clients Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead className="text-center">Contracts</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead className="text-right">Average Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.clientData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No client data available
                  </TableCell>
                </TableRow>
              ) : (
                reportData.clientData.map((client) => (
                  <TableRow key={client.name}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-center">{client.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(client.totalValue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(client.totalValue / client.count)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Supplier Table */}
      <Card>
        <CardHeader>
          <CardTitle>Suppliers Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier Name</TableHead>
                <TableHead className="text-center">Contracts</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead className="text-right">Average Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.supplierData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No supplier data available
                  </TableCell>
                </TableRow>
              ) : (
                reportData.supplierData.map((supplier) => (
                  <TableRow key={supplier.name}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell className="text-center">{supplier.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(supplier.totalValue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(supplier.totalValue / supplier.count)}</TableCell>
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
