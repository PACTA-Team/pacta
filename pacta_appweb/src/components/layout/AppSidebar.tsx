
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  FileText,
  FilePlus,
  FolderOpen,
  Bell,
  Users,
  LogOut,
  BarChart3,
  Building2,
  Truck,
  UserCheck,
  Menu,
  X,
  Building
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { notificationsAPI } from '@/lib/notifications-api';
import CompanySelector from '@/components/CompanySelector';

const TABLET_BREAKPOINT = 1024;

function useIsTablet() {
  const [isTablet, setIsTablet] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT}px)`);
    const onChange = () => setIsTablet(window.innerWidth <= TABLET_BREAKPOINT);
    mql.addEventListener('change', onChange);
    setIsTablet(window.innerWidth <= TABLET_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isTablet;
}

const navigation = [
  { nameKey: 'dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'editor', 'viewer'] as UserRole[] },
  { nameKey: 'contracts', href: '/contracts', icon: FileText, roles: ['admin', 'manager', 'editor', 'viewer'] as UserRole[] },
  { nameKey: 'supplements', href: '/supplements', icon: FilePlus, roles: ['admin', 'manager', 'editor', 'viewer'] as UserRole[] },
  { nameKey: 'clients', href: '/clients', icon: Building2, roles: ['admin', 'manager', 'editor', 'viewer'] as UserRole[] },
  { nameKey: 'suppliers', href: '/suppliers', icon: Truck, roles: ['admin', 'manager', 'editor', 'viewer'] as UserRole[] },
  { nameKey: 'signers', href: '/authorized-signers', icon: UserCheck, roles: ['admin', 'manager', 'editor', 'viewer'] as UserRole[] },
  { nameKey: 'documents', href: '/documents', icon: FolderOpen, roles: ['admin', 'manager', 'editor', 'viewer'] as UserRole[] },
  { nameKey: 'reports', href: '/reports', icon: BarChart3, roles: ['admin', 'manager', 'editor', 'viewer'] as UserRole[] },
  { nameKey: 'notifications', href: '/notifications', icon: Bell, roles: ['admin', 'manager', 'editor', 'viewer'] as UserRole[] },
  { nameKey: 'users', href: '/users', icon: Users, roles: ['admin'] as UserRole[] },
  { nameKey: 'companies', href: '/companies', icon: Building, roles: ['admin', 'manager'] as UserRole[] },
];

export default function AppSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { user, logout, hasPermission } = useAuth();
  const isTabletOrBelow = useIsTablet();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { t } = useTranslation('common');
  const { t: tDashboard } = useTranslation('dashboard');
  const { t: tContracts } = useTranslation('contracts');
  const { t: tSupplements } = useTranslation('supplements');
  const { t: tClients } = useTranslation('clients');
  const { t: tSuppliers } = useTranslation('suppliers');
  const { t: tSigners } = useTranslation('signers');
  const { t: tDocuments } = useTranslation('documents');
  const { t: tReports } = useTranslation('reports');
  const { t: tNotifications } = useTranslation('notifications');
  const { t: tSettings } = useTranslation('settings');
  const { t: tCompanies } = useTranslation('companies');

  const navLabels: Record<string, string> = {
    dashboard: tDashboard('title'),
    contracts: tContracts('title'),
    supplements: tSupplements('title'),
    clients: tClients('title'),
    suppliers: tSuppliers('title'),
    signers: tSigners('title'),
    documents: tDocuments('title'),
    reports: tReports('title'),
    notifications: tNotifications('title'),
    users: tSettings('title'),
    companies: tCompanies('title'),
  };

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const data = await notificationsAPI.count();
        setUnreadCount(data.unread);
      } catch {
        // Silently fail - badge is non-critical
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredNavigation = useMemo(() =>
    navigation.filter(item =>
      item.roles.some(role => hasPermission(role))
    ),
    [hasPermission]
  );

  // Mobile sidebar with proper dialog semantics
  if (isTabletOrBelow) {
    return (
      <>
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 left-4 z-40"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={sidebarOpen}
          aria-controls="mobile-sidebar"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          >
            <div
              id="mobile-sidebar"
              className="fixed left-0 top-0 h-full w-64 flex-col border-r bg-card"
              role="dialog"
              aria-label="Navigation menu"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-primary">PACTA Web</h1>
                  <p className="text-sm text-muted-foreground">Contract Management</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close navigation menu"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              <Separator />

              <CompanySelector />

              <ScrollArea className="flex-1 px-3 py-4">
                <nav role="navigation" aria-label="Main navigation" className="space-y-1">
                  {filteredNavigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.nameKey}
                        to={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="h-5 w-5" aria-hidden="true" />
                        {navLabels[item.nameKey]}
                        {item.href === '/notifications' && unreadCount > 0 && (
                          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>

                <Separator />

                <div className="p-4 space-y-2">
                  <div className="px-3 py-2 text-sm">
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-1">
                      {t('role')}: {user?.role}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => { logout(); setSidebarOpen(false); }}
                  >
                    <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t('logout')}
                  </Button>
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop sidebar
  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary">PACTA Web</h1>
        <p className="text-sm text-muted-foreground">Contract Management</p>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-3 py-4">
        <nav role="navigation" aria-label="Main navigation" className="space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.nameKey}
                to={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                {navLabels[item.nameKey]}
                {item.href === '/notifications' && unreadCount > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator />

      <div className="p-4 space-y-2">
        <div className="px-3 py-2 text-sm">
          <p className="font-medium">{user?.name}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          <p className="text-xs text-muted-foreground capitalize mt-1">
            {t('role')}: {user?.role}
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('logout')}
        </Button>
      </div>
    </div>
  );
}
