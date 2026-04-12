import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, AlertTriangle, FilePlus, DollarSign, BarChart3 } from 'lucide-react';
import { contractsAPI } from '@/lib/contracts-api';
import { supplementsAPI } from '@/lib/supplements-api';
import { Contract, ContractStatus } from '@/types';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { toast } from 'sonner';

const STATUS_COLORS: Record<ContractStatus, string> = {
  active: '#22c55e',
  expired: '#ef4444',
  pending: '#f59e0b',
  cancelled: '#6b7280',
};

export default function DashboardPage() {
  const [contracts, setContracts] = useState<any[]>([]);
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
    const loadDashboard = async () => {
      try {
        const [contractsData, supplementsData] = await Promise.all([
          contractsAPI.list(),
          supplementsAPI.list(),
        ]);
        const contractsList = contractsData as any[];
        const supplementsList = supplementsData as any[];
        setContracts(contractsList);

        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const activeContracts = contractsList.filter((c: any) => c.status === 'active');
        const expiringSoon = activeContracts.filter((c: any) => {
          const endDate = new Date(c.end_date);
          return endDate <= thirtyDaysFromNow && endDate >= now;
        });

        const pendingSupplements = supplementsList.filter((s: any) => s.status === 'draft' || s.status === 'approved');

        const totalValue = contractsList
          .filter((c: any) => c.status === 'active')
          .reduce((sum: number, c: any) => sum + c.amount, 0);

        setStats({
          totalActive: activeContracts.length,
          expiringSoon: expiringSoon.length,
          pendingSupplements: pendingSupplements.length,
          totalValue,
        });

        const distribution: Record<ContractStatus, number> = {
          active: 0,
          expired: 0,
          pending: 0,
          cancelled: 0,
        };
        contractsList.forEach((c: any) => {
          distribution[c.status as ContractStatus] = (distribution[c.status as ContractStatus] || 0) + 1;
        });
        setStatusDistribution(distribution);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load dashboard data');
      }
    };
    loadDashboard();
  }, []);

  const expiringContracts = contracts
    .filter((c: any) => {
      if (c.status !== 'active') return false;
      const now = new Date();
      const endDate = new Date(c.end_date);
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return endDate <= thirtyDaysFromNow && endDate >= now;
    })
    .sort((a: any, b: any) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())
    .slice(0, 5);

  const chartData = Object.entries(statusDistribution)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      status: status as ContractStatus,
    }));

  return (
    
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
                    (new Date(contract.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div key={contract.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg">
                      <div>
                        <p className="font-medium">{contract.title}</p>
                        <p className="text-sm text-muted-foreground">{contract.contract_number}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={daysUntilExpiration <= 7 ? 'destructive' : 'default'}>
                          {daysUntilExpiration} days left
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(contract.end_date).toLocaleDateString()}
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
              <Link to="/contracts?action=create">
                <Button className="w-full justify-start" variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Create New Contract
                </Button>
              </Link>
              <Link to="/supplements?action=create">
                <Button className="w-full justify-start" variant="outline">
                  <FilePlus className="mr-2 h-4 w-4" />
                  Add New Supplement
                </Button>
              </Link>
              <Link to="/contracts">
                <Button className="w-full justify-start" variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  View All Contracts
                </Button>
              </Link>
              <Link to="/reports">
                <Button className="w-full justify-start" variant="outline">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Generate Reports
                </Button>
              </Link>
              <Link to="/documents">
                <Button className="w-full justify-start" variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Document Repository
                </Button>
              </Link>
              <Link to="/notifications">
                <Button className="w-full justify-start" variant="outline">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  View Notifications
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    
  );
}
