
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
const SIDEBAR_WIDTH = '16rem'; // 256px (w-64)
const SIDEBAR_COLLAPSED = '4.5rem'; // 72px

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
  { nameKey: 'settings', href: '/settings', icon: Settings, roles: ['admin'] as UserRole[] },
];

export default function AppSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { user, logout, hasPermission } = useAuth();
  const isTabletOrBelow = useIsTablet();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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
    <div
      className="flex h-screen flex-col border-r bg-card transition-all duration-300 ease-in-out"
      style={{ width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH }}
    >
      {/* Header with logo and collapse toggle */}
      <div className="flex items-center justify-between px-6 py-5">
        {!collapsed && (
          <div className="transition-opacity duration-200">
            <h1 className="text-xl font-bold tracking-tight text-primary">PACTA</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Contract Management</p>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              P
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-3 py-4">
        <nav role="navigation" aria-label="Main navigation" className="space-y-1">
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
                    ? 'bg-gradient-to-r from-primary/10 to-transparent text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                style={{ borderLeft: isActive ? '3px solid hsl(var(--primary))' : '3px solid transparent' }}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!collapsed && (
                  <span className="truncate transition-opacity duration-200">
                    {label}
                  </span>
                )}
                {item.href === '/notifications' && unreadCount > 0 && (
                  <span className={cn(
                    "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1",
                    collapsed && "ml-0"
                  )}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            );

            // Wrap in tooltip when collapsed
            if (collapsed) {
              return (
                <TooltipProvider key={item.nameKey} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="flex items-center gap-2">
                      <span>{label}</span>
                      {item.href === '/notifications' && unreadCount > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return linkContent;
          })}
        </nav>
      </ScrollArea>

      <Separator />

      {/* User profile section */}
      <div className="mt-auto border-t p-4">
        <div className={cn(
          "flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted",
          collapsed && "justify-center"
        )}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.role}</p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={logout}
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 mx-auto mt-2"
            onClick={logout}
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
}
