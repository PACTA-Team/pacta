
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, AlertTriangle, FilePlus, DollarSign, BarChart3 } from 'lucide-react';
import { getContracts, getSupplements, getNotifications } from '@/lib/storage';
import { generateNotifications } from '@/lib/notifications';
import { Contract, ContractStatus } from '@/types';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/components/layout/AppLayout';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const STATUS_COLORS: Record<ContractStatus, string> = {
  active: '#22c55e',
  expired: '#ef4444',
  pending: '#f59e0b',
  cancelled: '#6b7280',
};

export default function DashboardPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState({
    totalActive: 0,
    expiringSoon: 0,
    pendingSupplements: 0,
    totalValue: 0,
  });
  const [statusDistribution, setStatusDistribution] = useState<Record<ContractStatus, number>>({
    active: 0,
    expired: 0,
    pending: 0,
    cancelled: 0,
  });

  useEffect(() => {
    const contractsData = getContracts();
    setContracts(contractsData);

    // Generate notifications
    generateNotifications(contractsData);

    // Calculate stats
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const activeContracts = contractsData.filter(c => c.status === 'active');
    const expiringSoon = activeContracts.filter(c => {
      const endDate = new Date(c.endDate);
      return endDate <= thirtyDaysFromNow && endDate >= now;
    });

    const supplements = getSupplements();
    const pendingSupplements = supplements.filter(s => s.status === 'draft' || s.status === 'approved');

    const totalValue = contractsData
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + c.amount, 0);

    setStats({
      totalActive: activeContracts.length,
      expiringSoon: expiringSoon.length,
      pendingSupplements: pendingSupplements.length,
      totalValue,
    });

    // Calculate status distribution
    const distribution: Record<ContractStatus, number> = {
      active: 0,
      expired: 0,
      pending: 0,
      cancelled: 0,
    };
    contractsData.forEach(c => {
      distribution[c.status]++;
    });
    setStatusDistribution(distribution);
  }, []);

  const expiringContracts = contracts
    .filter(c => {
      if (c.status !== 'active') return false;
      const now = new Date();
      const endDate = new Date(c.endDate);
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return endDate <= thirtyDaysFromNow && endDate >= now;
    })
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
    .slice(0, 5);

  const chartData = Object.entries(statusDistribution)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      status: status as ContractStatus,
    }));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Active Contracts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalActive}</div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.expiringSoon}</div>
              <p className="text-xs text-muted-foreground">Within 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Supplements</CardTitle>
              <FilePlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingSupplements}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Active contracts</p>
            </CardContent>
          </Card>
        </div>

        {/* Expiring Contracts Alert */}
        {expiringContracts.length > 0 && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
                <AlertTriangle className="h-5 w-5" />
                Contracts Expiring Soon
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expiringContracts.map(contract => {
                  const daysUntilExpiration = Math.ceil(
                    (new Date(contract.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div key={contract.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg">
                      <div>
                        <p className="font-medium">{contract.title}</p>
                        <p className="text-sm text-muted-foreground">{contract.contractNumber}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={daysUntilExpiration <= 7 ? 'destructive' : 'default'}>
                          {daysUntilExpiration} days left
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(contract.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics and Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Contracts by Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No contracts to display
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/contracts?action=create">
                <Button className="w-full justify-start" variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Create New Contract
                </Button>
              </Link>
              <Link href="/supplements?action=create">
                <Button className="w-full justify-start" variant="outline">
                  <FilePlus className="mr-2 h-4 w-4" />
                  Add New Supplement
                </Button>
              </Link>
              <Link href="/contracts">
                <Button className="w-full justify-start" variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  View All Contracts
                </Button>
              </Link>
              <Link href="/reports">
                <Button className="w-full justify-start" variant="outline">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Generate Reports
                </Button>
              </Link>
              <Link href="/documents">
                <Button className="w-full justify-start" variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Document Repository
                </Button>
              </Link>
              <Link href="/notifications">
                <Button className="w-full justify-start" variant="outline">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  View Notifications
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
