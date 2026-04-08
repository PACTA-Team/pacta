
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Contract } from '@/types';
import { exportToCSV, exportToExcel, exportToPDF, formatCurrency, formatDate, ExportColumn } from '@/lib/export-utils';
import ExportButtons from './ExportButtons';
import { AlertTriangle, Calendar, Clock } from 'lucide-react';

interface ExpirationReportProps {
  contracts: Contract[];
  title?: string;
}

export default function ExpirationReport({ contracts, title = 'Upcoming Expirations Report' }: ExpirationReportProps) {
  const expirationData = useMemo(() => {
    const now = new Date();
    const activeContracts = contracts.filter(c => c.status === 'active');

    // Categorize by days until expiration
    const categories = {
      expired: [] as Contract[],
      critical: [] as Contract[], // 0-7 days
      warning: [] as Contract[], // 8-15 days
      attention: [] as Contract[], // 16-30 days
      safe: [] as Contract[], // 31-60 days
      longTerm: [] as Contract[], // 60+ days
    };

    activeContracts.forEach(contract => {
      const endDate = new Date(contract.endDate);
      const daysUntil = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0) {
        categories.expired.push(contract);
      } else if (daysUntil <= 7) {
        categories.critical.push(contract);
      } else if (daysUntil <= 15) {
        categories.warning.push(contract);
      } else if (daysUntil <= 30) {
        categories.attention.push(contract);
      } else if (daysUntil <= 60) {
        categories.safe.push(contract);
      } else {
        categories.longTerm.push(contract);
      }
    });

    // Chart data
    const chartData = [
      { name: 'Expired', count: categories.expired.length, color: '#dc2626' },
      { name: '0-7 Days', count: categories.critical.length, color: '#ef4444' },
      { name: '8-15 Days', count: categories.warning.length, color: '#f59e0b' },
      { name: '16-30 Days', count: categories.attention.length, color: '#eab308' },
      { name: '31-60 Days', count: categories.safe.length, color: '#22c55e' },
      { name: '60+ Days', count: categories.longTerm.length, color: '#3b82f6' },
    ];

    // All expiring soon (within 30 days)
    const expiringSoon = [
      ...categories.expired,
      ...categories.critical,
      ...categories.warning,
      ...categories.attention,
    ].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

    return {
      categories,
      chartData,
      expiringSoon,
      totalExpiringSoon: expiringSoon.length,
      totalValue: expiringSoon.reduce((sum, c) => sum + c.amount, 0),
    };
  }, [contracts]);

  const getDaysUntil = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getUrgencyBadge = (daysUntil: number) => {
    if (daysUntil < 0) return <Badge variant="destructive">Expired</Badge>;
    if (daysUntil <= 7) return <Badge variant="destructive">{daysUntil} days</Badge>;
    if (daysUntil <= 15) return <Badge className="bg-orange-500">{daysUntil} days</Badge>;
    if (daysUntil <= 30) return <Badge className="bg-yellow-500">{daysUntil} days</Badge>;
    return <Badge variant="secondary">{daysUntil} days</Badge>;
  };

  const columns: ExportColumn[] = [
    { key: 'contractNumber', header: 'Contract Number' },
    { key: 'title', header: 'Title' },
    { key: 'client', header: 'Client' },
    { key: 'endDate', header: 'End Date' },
    { key: 'daysUntil', header: 'Days Until Expiration' },
    { key: 'amount', header: 'Amount' },
  ];

  const exportData = expirationData.expiringSoon.map(c => ({
    contractNumber: c.contractNumber,
    title: c.title,
    client: c.client,
    endDate: formatDate(c.endDate),
    daysUntil: getDaysUntil(c.endDate),
    amount: formatCurrency(c.amount),
  }));

  const summary = [
    { label: 'Total Expiring (30 days)', value: expirationData.totalExpiringSoon },
    { label: 'Critical (0-7 days)', value: expirationData.categories.critical.length },
    { label: 'Warning (8-15 days)', value: expirationData.categories.warning.length },
    { label: 'Total Value at Risk', value: formatCurrency(expirationData.totalValue) },
  ];

  const handleExportPDF = () => {
    exportToPDF(title, exportData, columns, summary);
  };

  const handleExportExcel = () => {
    exportToExcel(exportData, columns, 'expiration-report');
  };

  const handleExportCSV = () => {
    exportToCSV(exportData, columns, 'expiration-report');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <ExportButtons
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          onExportCSV={handleExportCSV}
          disabled={expirationData.expiringSoon.length === 0}
        />
      </div>

      {/* Alert Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{expirationData.categories.critical.length}</div>
            <p className="text-xs text-red-600/70">Expiring in 0-7 days</p>
          </CardContent>
        </Card>

        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">Warning</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{expirationData.categories.warning.length}</div>
            <p className="text-xs text-orange-600/70">Expiring in 8-15 days</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Attention</CardTitle>
            <Calendar className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{expirationData.categories.attention.length}</div>
            <p className="text-xs text-yellow-600/70">Expiring in 16-30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Value at Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(expirationData.totalValue)}</div>
            <p className="text-xs text-muted-foreground">Within 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Expiration Timeline Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expirationData.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {expirationData.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Expiring Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contracts Expiring Within 30 Days ({expirationData.expiringSoon.length} records)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Time Remaining</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expirationData.expiringSoon.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No contracts expiring within 30 days
                  </TableCell>
                </TableRow>
              ) : (
                expirationData.expiringSoon.map((contract) => {
                  const daysUntil = getDaysUntil(contract.endDate);
                  return (
                    <TableRow key={contract.id} className={daysUntil <= 7 ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                      <TableCell>{contract.title}</TableCell>
                      <TableCell>{contract.client}</TableCell>
                      <TableCell>{formatDate(contract.endDate)}</TableCell>
                      <TableCell>{getUrgencyBadge(daysUntil)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(contract.amount)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
