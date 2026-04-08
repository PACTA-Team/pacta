
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { Supplement, SupplementStatus, Contract } from '@/types';
import { exportToCSV, exportToExcel, exportToPDF, formatDate, formatStatus, ExportColumn } from '@/lib/export-utils';
import ExportButtons from './ExportButtons';
import { FilePlus, FileCheck, FileEdit, Calendar } from 'lucide-react';
import Link from 'next/link';

interface SupplementsReportProps {
  supplements: Supplement[];
  contracts: Contract[];
  title?: string;
  dateFrom?: string;
  dateTo?: string;
}

const STATUS_COLORS: Record<SupplementStatus, string> = {
  draft: '#6b7280',
  approved: '#f59e0b',
  active: '#22c55e',
};

export default function SupplementsReport({ 
  supplements, 
  contracts, 
  title = 'Supplements Report',
  dateFrom,
  dateTo,
}: SupplementsReportProps) {
  const reportData = useMemo(() => {
    // Filter by date range if provided
    let filteredSupplements = [...supplements];
    if (dateFrom) {
      filteredSupplements = filteredSupplements.filter(s => new Date(s.createdAt) >= new Date(dateFrom));
    }
    if (dateTo) {
      filteredSupplements = filteredSupplements.filter(s => new Date(s.createdAt) <= new Date(dateTo));
    }

    // Status distribution
    const statusCounts: Record<SupplementStatus, number> = {
      draft: 0,
      approved: 0,
      active: 0,
    };
    filteredSupplements.forEach(s => {
      statusCounts[s.status]++;
    });

    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      name: formatStatus(status),
      value: count,
      status: status as SupplementStatus,
    }));

    // By contract
    const byContract = new Map<string, { contract: Contract | undefined; supplements: Supplement[] }>();
    filteredSupplements.forEach(s => {
      const existing = byContract.get(s.contractId) || { 
        contract: contracts.find(c => c.id === s.contractId), 
        supplements: [] 
      };
      existing.supplements.push(s);
      byContract.set(s.contractId, existing);
    });

    const contractData = Array.from(byContract.entries())
      .map(([contractId, data]) => ({
        contractId,
        contractNumber: data.contract?.contractNumber || 'Unknown',
        contractTitle: data.contract?.title || 'Unknown',
        count: data.supplements.length,
        supplements: data.supplements,
      }))
      .sort((a, b) => b.count - a.count);

    // Monthly trend
    const monthlyData: Record<string, number> = {};
    filteredSupplements.forEach(s => {
      const month = new Date(s.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      monthlyData[month] = (monthlyData[month] || 0) + 1;
    });

    const trendData = Object.entries(monthlyData)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([month, count]) => ({ month, count }));

    return {
      filteredSupplements,
      statusData,
      contractData,
      trendData,
      totalSupplements: filteredSupplements.length,
      draftCount: statusCounts.draft,
      approvedCount: statusCounts.approved,
      activeCount: statusCounts.active,
    };
  }, [supplements, contracts, dateFrom, dateTo]);

  const getContractInfo = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    return contract ? `${contract.contractNumber} - ${contract.title}` : 'Unknown Contract';
  };

  const getStatusBadge = (status: SupplementStatus) => {
    const variants: Record<SupplementStatus, 'default' | 'secondary' | 'outline'> = {
      draft: 'secondary',
      approved: 'default',
      active: 'default',
    };
    const colors: Record<SupplementStatus, string> = {
      draft: '',
      approved: 'bg-yellow-500',
      active: 'bg-green-500',
    };
    return <Badge variant={variants[status]} className={colors[status]}>{formatStatus(status)}</Badge>;
  };

  const columns: ExportColumn[] = [
    { key: 'supplementNumber', header: 'Supplement Number' },
    { key: 'contractInfo', header: 'Parent Contract' },
    { key: 'description', header: 'Description' },
    { key: 'effectiveDate', header: 'Effective Date' },
    { key: 'status', header: 'Status' },
    { key: 'createdAt', header: 'Created Date' },
  ];

  const exportData = reportData.filteredSupplements.map(s => ({
    supplementNumber: s.supplementNumber,
    contractInfo: getContractInfo(s.contractId),
    description: s.description,
    effectiveDate: formatDate(s.effectiveDate),
    status: formatStatus(s.status),
    createdAt: formatDate(s.createdAt),
  }));

  const summary = [
    { label: 'Total Supplements', value: reportData.totalSupplements },
    { label: 'Draft', value: reportData.draftCount },
    { label: 'Approved', value: reportData.approvedCount },
    { label: 'Active', value: reportData.activeCount },
  ];

  const handleExportPDF = () => {
    exportToPDF(title, exportData, columns, summary);
  };

  const handleExportExcel = () => {
    exportToExcel(exportData, columns, 'supplements-report');
  };

  const handleExportCSV = () => {
    exportToCSV(exportData, columns, 'supplements-report');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <ExportButtons
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          onExportCSV={handleExportCSV}
          disabled={reportData.filteredSupplements.length === 0}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Supplements</CardTitle>
            <FilePlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalSupplements}</div>
            <p className="text-xs text-muted-foreground">All supplements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <FileEdit className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{reportData.draftCount}</div>
            <p className="text-xs text-muted-foreground">Pending review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <FileCheck className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{reportData.approvedCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting activation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <FileCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{reportData.activeCount}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reportData.statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {reportData.statusData.map((entry, index) => (
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

        <Card>
          <CardHeader>
            <CardTitle>Monthly Creation Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reportData.trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supplements by Contract */}
      <Card>
        <CardHeader>
          <CardTitle>Supplements by Contract</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead className="text-center">Supplement Count</TableHead>
                <TableHead>Latest Supplement</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.contractData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No supplements found
                  </TableCell>
                </TableRow>
              ) : (
                reportData.contractData.map((item) => {
                  const latestSupplement = item.supplements.sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  )[0];
                  return (
                    <TableRow key={item.contractId}>
                      <TableCell>
                        <Link href={`/contracts/${item.contractId}`} className="text-blue-600 hover:underline">
                          <div className="font-medium">{item.contractNumber}</div>
                          <div className="text-sm text-muted-foreground">{item.contractTitle}</div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center font-bold">{item.count}</TableCell>
                      <TableCell>
                        <div>{latestSupplement?.supplementNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(latestSupplement?.createdAt || '')}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(latestSupplement?.status || 'draft')}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* All Supplements Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Supplements ({reportData.filteredSupplements.length} records)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplement Number</TableHead>
                <TableHead>Parent Contract</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.filteredSupplements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No supplements found matching the filters
                  </TableCell>
                </TableRow>
              ) : (
                reportData.filteredSupplements.map((supplement) => (
                  <TableRow key={supplement.id}>
                    <TableCell className="font-medium">{supplement.supplementNumber}</TableCell>
                    <TableCell>
                      <Link href={`/contracts/${supplement.contractId}`} className="text-blue-600 hover:underline">
                        {getContractInfo(supplement.contractId)}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{supplement.description}</TableCell>
                    <TableCell>{formatDate(supplement.effectiveDate)}</TableCell>
                    <TableCell>{getStatusBadge(supplement.status)}</TableCell>
                    <TableCell>{formatDate(supplement.createdAt)}</TableCell>
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
