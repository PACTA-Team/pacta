import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, AlertTriangle, FilePlus, DollarSign, BarChart3, Building2, Truck, FolderOpen } from 'lucide-react';
import { contractsAPI } from '@/lib/contracts-api';
import { supplementsAPI } from '@/lib/supplements-api';
import { Contract, ContractStatus, Supplement } from '@/types';
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
  const { t } = useTranslation('dashboard');
  const { t: tContracts } = useTranslation('contracts');
  const { i18n } = useTranslation();

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [contractsData, supplementsData] = await Promise.all([
          contractsAPI.list(),
          supplementsAPI.list(),
        ]);
        const contractsList = contractsData as Contract[];
        const supplementsList = supplementsData as Supplement[];
        setContracts(contractsList);

        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const activeContracts = contractsList.filter((c: Contract) => c.status === 'active');
        const expiringSoon = activeContracts.filter((c: Contract) => {
          const endDate = new Date(c.end_date);
          return endDate <= thirtyDaysFromNow && endDate >= now;
        });

        const pendingSupplements = supplementsList.filter((s: Supplement) => s.status === 'draft' || s.status === 'approved');

        const totalValue = contractsList
          .filter((c: Contract) => c.status === 'active')
          .reduce((sum: number, c: Contract) => sum + c.amount, 0);

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
        contractsList.forEach((c: Contract) => {
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
    .filter((c: Contract) => {
      if (c.status !== 'active') return false;
      const now = new Date();
      const endDate = new Date(c.end_date);
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return endDate <= thirtyDaysFromNow && endDate >= now;
    })
    .sort((a: Contract, b: Contract) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())
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
          <Card className="relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 transition-all duration-300 group-hover:bg-primary/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpi.totalContracts.title')}</CardTitle>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{stats.totalActive}</div>
              <p className="mt-1 text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-yellow-500/5 transition-all duration-300 group-hover:bg-yellow-500/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpi.expiringSoon.title')}</CardTitle>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-yellow-600 dark:text-yellow-500">{stats.expiringSoon}</div>
              <p className="mt-1 text-xs text-muted-foreground">Within 30 days</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 transition-all duration-300 group-hover:bg-primary/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpi.pendingApproval.title')}</CardTitle>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <FilePlus className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{stats.pendingSupplements}</div>
              <p className="mt-1 text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-green-500/5 transition-all duration-300 group-hover:bg-green-500/10" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpi.totalContracts.desc')}</CardTitle>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">${stats.totalValue.toLocaleString()}</div>
              <p className="mt-1 text-xs text-muted-foreground">Active contracts value</p>
            </CardContent>
          </Card>
        </div>

        {/* Expiring Contracts Alert */}
        {expiringContracts.length > 0 && (
          <Card className="border-yellow-200 dark:border-yellow-800/50 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
                <AlertTriangle className="h-5 w-5" />
                {t('expiringTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expiringContracts.map(contract => {
                  const daysUntilExpiration = Math.ceil(
                    (new Date(contract.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div key={contract.id} className="flex items-center justify-between rounded-lg border bg-card/80 p-3 backdrop-blur-sm transition-colors hover:bg-card">
                      <div>
                        <p className="font-medium">{contract.title}</p>
                        <p className="text-sm text-muted-foreground">{contract.contract_number}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={daysUntilExpiration <= 7 ? 'destructive' : 'default'}>
                          {daysUntilExpiration} {t('daysLeft')}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(contract.end_date).toLocaleDateString(i18n.language)}
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
                <BarChart3 className="h-5 w-5 text-primary" />
                {t('statusTitle')}
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
                  {t('noContracts')}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                {t('quickActions')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/contracts?action=create">
                <Button className="w-full justify-start gap-2" variant="soft">
                  <FileText className="h-4 w-4" />
                  {t('newContract')}
                </Button>
              </Link>
              <Link to="/clients">
                <Button className="w-full justify-start gap-2" variant="soft">
                  <Building2 className="h-4 w-4" />
                  {t('newClient')}
                </Button>
              </Link>
              <Link to="/suppliers">
                <Button className="w-full justify-start gap-2" variant="soft">
                  <Truck className="h-4 w-4" />
                  {t('newSupplier')}
                </Button>
              </Link>
              <Link to="/reports">
                <Button className="w-full justify-start gap-2" variant="soft">
                  <BarChart3 className="h-4 w-4" />
                  {t('viewReports')}
                </Button>
              </Link>
              <Link to="/documents">
                <Button className="w-full justify-start gap-2" variant="soft">
                  <FolderOpen className="h-4 w-4" />
                  {tContracts('documents')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

  );
}
