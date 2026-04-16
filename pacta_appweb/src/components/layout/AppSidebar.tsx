
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
  Building,
  ChevronLeft,
  ChevronRight,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { notificationsAPI } from '@/lib/notifications-api';
import CompanySelector from '@/components/CompanySelector';

const TABLET_BREAKPOINT = 1024;
const MOBILE_BREAKPOINT = 768;
const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_COLLAPSED = '4.5rem';

function useDeviceSize() {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= MOBILE_BREAKPOINT) {
        setDevice('mobile');
      } else if (window.innerWidth <= TABLET_BREAKPOINT) {
        setDevice('tablet');
      } else {
        setDevice('desktop');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return device;
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
  { nameKey: 'settings', href: '/settings', icon: Settings, roles: ['admin'] as UserRole[] },
];

export default function AppSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { user, logout, hasPermission } = useAuth();
  const deviceSize = useDeviceSize();
  const isMobile = deviceSize === 'mobile';
  const isTablet = deviceSize === 'tablet';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(isTablet);
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
    settings: tSettings('systemTitle'),
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

  // Mobile drawer sidebar
  if (isMobile) {
    return (
      <>
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 left-4 z-40"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          >
            <div
              className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 flex items-center justify-between border-b">
                <div>
                  <h1 className="text-xl font-bold text-primary">PACTA</h1>
                  <p className="text-xs text-muted-foreground">Contract Management</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <ScrollArea className="flex-1 p-3">
                <nav className="space-y-1">
                  {filteredNavigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.nameKey}
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-muted-foreground hover:bg-muted'
                        )}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="h-5 w-5" />
                        {navLabels[item.nameKey]}
                      </Link>
                    );
                  })}
                </nav>
              </ScrollArea>

              <div className="p-4 border-t">
                <div className="flex items-center gap-3 p-2">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user?.name}</p>
                    <p className="truncate text-xs text-muted-foreground capitalize">{user?.role}</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-3" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('logout')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Tablet/Desktop floating sidebar with glassmorphism
  return (
    <div
      className={cn(
        'fixed left-4 top-4 bottom-4 flex flex-col rounded-2xl border shadow-lg backdrop-blur-md bg-background/80 transition-all duration-300',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Header with logo and collapse toggle */}
      <div className={cn('flex items-center justify-between p-4', collapsed ? 'justify-center' : '')}>
        {!collapsed ? (
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-primary">PACTA</h1>
            <p className="text-xs text-muted-foreground truncate">Contract Management</p>
          </div>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
            P
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn('flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors', collapsed && 'hidden')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <Separator className="mx-3" />

      {/* Navigation with scroll */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href;
            const label = navLabels[item.nameKey];

            const linkContent = (
              <Link
                key={item.nameKey}
                to={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary border-l-2 border-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{label}</span>}
                {item.href === '/notifications' && unreadCount > 0 && (
                  <span className={cn('ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white', collapsed && 'absolute -top-1 -right-1')}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <TooltipProvider key={item.nameKey} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right">
                      <span>{label}</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return linkContent;
          })}
        </nav>
      </ScrollArea>

      <Separator className="mx-3" />

      {/* User profile section */}
      <div className={cn('p-3', collapsed ? 'items-center' : '')}>
        <div className={cn('flex items-center gap-3 rounded-lg p-2 hover:bg-muted transition-colors', collapsed ? 'justify-center' : '')}>
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          className={cn('w-full mt-2', collapsed ? 'h-9 w-9' : '')}
          onClick={logout}
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">{t('logout')}</span>}
        </Button>
      </div>
    </div>
  );
}
