
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Supplement, Contract } from '@/types';
import { exportToCSV, exportToExcel, exportToPDF, formatDate, formatStatus, ExportColumn } from '@/lib/export-utils';
import ExportButtons from './ExportButtons';
import { FileEdit, History } from 'lucide-react';
import Link from 'next/link';

interface ModificationsReportProps {
  supplements: Supplement[];
  contracts: Contract[];
  title?: string;
}

export default function ModificationsReport({ 
  supplements, 
  contracts, 
  title = 'Modifications Report' 
}: ModificationsReportProps) {
  const reportData = useMemo(() => {
    // Sort by date (most recent first)
    const sortedSupplements = [...supplements].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    // Group modifications by contract
    const byContract = new Map<string, { contract: Contract | undefined; modifications: Supplement[] }>();
    sortedSupplements.forEach(s => {
      const existing = byContract.get(s.contractId) || { 
        contract: contracts.find(c => c.id === s.contractId), 
        modifications: [] 
      };
      existing.modifications.push(s);
      byContract.set(s.contractId, existing);
    });

    const contractModifications = Array.from(byContract.entries())
      .map(([contractId, data]) => ({
        contractId,
        contractNumber: data.contract?.contractNumber || 'Unknown',
        contractTitle: data.contract?.title || 'Unknown',
        modificationCount: data.modifications.length,
        modifications: data.modifications,
        latestModification: data.modifications[0],
      }))
      .sort((a, b) => b.modificationCount - a.modificationCount);

    // Chart data - top 10 contracts by modifications
    const chartData = contractModifications.slice(0, 10).map(c => ({
      name: c.contractNumber.length > 10 ? c.contractNumber.substring(0, 10) + '...' : c.contractNumber,
      count: c.modificationCount,
    }));

    return {
      sortedSupplements,
      contractModifications,
      chartData,
      totalModifications: supplements.length,
      contractsWithModifications: byContract.size,
    };
  }, [supplements, contracts]);

  const getContractInfo = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    return contract ? `${contract.contractNumber} - ${contract.title}` : 'Unknown Contract';
  };

  const columns: ExportColumn[] = [
    { key: 'supplementNumber', header: 'Supplement Number' },
    { key: 'contractInfo', header: 'Contract' },
    { key: 'modifications', header: 'Modifications Summary' },
    { key: 'effectiveDate', header: 'Effective Date' },
    { key: 'status', header: 'Status' },
    { key: 'updatedAt', header: 'Last Updated' },
  ];

  const exportData = reportData.sortedSupplements.map(s => ({
    supplementNumber: s.supplementNumber,
    contractInfo: getContractInfo(s.contractId),
    modifications: s.modifications,
    effectiveDate: formatDate(s.effectiveDate),
    status: formatStatus(s.status),
    updatedAt: formatDate(s.updatedAt),
  }));

  const summary = [
    { label: 'Total Modifications', value: reportData.totalModifications },
    { label: 'Contracts with Modifications', value: reportData.contractsWithModifications },
    { label: 'Avg Modifications per Contract', value: reportData.contractsWithModifications > 0 
      ? (reportData.totalModifications / reportData.contractsWithModifications).toFixed(1) 
      : '0' },
  ];

  const handleExportPDF = () => {
    exportToPDF(title, exportData, columns, summary);
  };

  const handleExportExcel = () => {
    exportToExcel(exportData, columns, 'modifications-report');
  };

  const handleExportCSV = () => {
    exportToCSV(exportData, columns, 'modifications-report');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <ExportButtons
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          onExportCSV={handleExportCSV}
          disabled={supplements.length === 0}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Modifications</CardTitle>
            <FileEdit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalModifications}</div>
            <p className="text-xs text-muted-foreground">All supplement modifications</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contracts Modified</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.contractsWithModifications}</div>
            <p className="text-xs text-muted-foreground">Contracts with supplements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg per Contract</CardTitle>
            <FileEdit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData.contractsWithModifications > 0 
                ? (reportData.totalModifications / reportData.contractsWithModifications).toFixed(1) 
                : '0'}
            </div>
            <p className="text-xs text-muted-foreground">Modifications per contract</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top Contracts by Modification Count</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Modifications by Contract */}
      <Card>
        <CardHeader>
          <CardTitle>Modifications by Contract</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead className="text-center">Modifications</TableHead>
                <TableHead>Latest Modification</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.contractModifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No modifications found
                  </TableCell>
                </TableRow>
              ) : (
                reportData.contractModifications.map((item) => (
                  <TableRow key={item.contractId}>
                    <TableCell>
                      <Link href={`/contracts/${item.contractId}`} className="text-blue-600 hover:underline">
                        <div className="font-medium">{item.contractNumber}</div>
                        <div className="text-sm text-muted-foreground">{item.contractTitle}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{item.modificationCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>{item.latestModification?.supplementNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(item.latestModification?.updatedAt || '')}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {item.latestModification?.modifications}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* All Modifications Detail */}
      <Card>
        <CardHeader>
          <CardTitle>All Modifications Detail</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplement</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Modifications Summary</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.sortedSupplements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No modifications found
                  </TableCell>
                </TableRow>
              ) : (
                reportData.sortedSupplements.map((supplement) => (
                  <TableRow key={supplement.id}>
                    <TableCell className="font-medium">{supplement.supplementNumber}</TableCell>
                    <TableCell>
                      <Link href={`/contracts/${supplement.contractId}`} className="text-blue-600 hover:underline">
                        {getContractInfo(supplement.contractId)}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="line-clamp-2">{supplement.modifications}</p>
                    </TableCell>
                    <TableCell>{formatDate(supplement.effectiveDate)}</TableCell>
                    <TableCell>{formatDate(supplement.updatedAt)}</TableCell>
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
