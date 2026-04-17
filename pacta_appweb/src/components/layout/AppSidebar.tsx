
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  FileText,
  FilePlus,
  FolderOpen,
  BarChart3,
  Building2,
  Truck,
  UserCheck,
  X,
  Building,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import CompanySelector from '@/components/CompanySelector';
import ContractIcon from '@/images/contract_icon.svg';

const TABLET_BREAKPOINT = 1024;
const MOBILE_BREAKPOINT = 768;
const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_COLLAPSED = '4.5rem';

interface AppSidebarProps {
  device?: 'desktop' | 'tablet' | 'mobile';
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  mobileMenuOpen?: boolean;
  onMobileMenuClose?: () => void;
}

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
  // Notifications moved to header — removed from sidebar
  // Users and Settings moved to UserDropdown in header — removed from sidebar
  { nameKey: 'companies', href: '/companies', icon: Building, roles: ['admin', 'manager'] as UserRole[] },
];

export default function AppSidebar({ 
  device: externalDevice, 
  collapsed: externalCollapsed, 
  onCollapsedChange,
  mobileMenuOpen,
  onMobileMenuClose
}: AppSidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const { hasPermission } = useAuth();
  
  // Use external device if provided, otherwise use internal detection
  const [internalDevice, setInternalDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const device = externalDevice ?? internalDevice;
  
  const isMobile = device === 'mobile';
  const isTablet = device === 'tablet';
  
  // Use external collapsed state if provided, otherwise use internal
  const [internalCollapsed, setInternalCollapsed] = useState(isTablet);
  const collapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  
  // Sync internal collapsed with external when it changes
  useEffect(() => {
    if (externalCollapsed !== undefined) {
      setInternalCollapsed(externalCollapsed);
    }
  }, [externalCollapsed]);

  // Update parent when collapsed changes (if callback provided)
  const handleCollapsedChange = (newCollapsed: boolean) => {
    if (onCollapsedChange) {
      onCollapsedChange(newCollapsed);
    } else {
      setInternalCollapsed(newCollapsed);
    }
  };

  // Internal device detection if no external device provided
  useEffect(() => {
    if (externalDevice === undefined) {
      const handleResize = () => {
        if (window.innerWidth <= MOBILE_BREAKPOINT) {
          setInternalDevice('mobile');
        } else if (window.innerWidth <= TABLET_BREAKPOINT) {
          setInternalDevice('tablet');
        } else {
          setInternalDevice('desktop');
        }
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
   }, [externalDevice]);
   
   // Mobile drawer state: controlled by parent if prop provided, else internal
   const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
   const sidebarOpen = mobileMenuOpen !== undefined ? mobileMenuOpen : internalSidebarOpen;

   const closeSidebar = () => {
     if (onMobileMenuClose) {
       onMobileMenuClose();
     } else {
       setInternalSidebarOpen(false);
     }
   };

    const { t } = useTranslation('common');
  const { t: tDashboard } = useTranslation('dashboard');
  const { t: tContracts } = useTranslation('contracts');
  const { t: tSupplements } = useTranslation('supplements');
  const { t: tClients } = useTranslation('clients');
  const { t: tSuppliers } = useTranslation('suppliers');
  const { t: tSigners } = useTranslation('signers');
  const { t: tDocuments } = useTranslation('documents');
   const { t: tReports } = useTranslation('reports');
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
    users: tSettings('title'),
    companies: tCompanies('title'),
    settings: tSettings('systemTitle'),
  };

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
         {sidebarOpen && (
           <div
             className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
             onClick={closeSidebar}
           >
            <div
              className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
               <div className="p-4 border-b">
                 {/* Company Selector for mobile */}
                 <div className="mb-3">
                   <CompanySelector />
                 </div>
                 <div className="flex items-center justify-between">
                   <div>
                     <h1 className="text-xl font-bold text-primary">PACTA</h1>
                     <p className="text-xs text-muted-foreground">Contract Management</p>
                   </div>
                    <Button variant="ghost" size="icon" onClick={closeSidebar}>
                     <X className="h-5 w-5" />
                   </Button>
                 </div>
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
                         onClick={closeSidebar}
                      >
                        <item.icon className="h-5 w-5" />
                        {navLabels[item.nameKey]}
                      </Link>
                    );
                  })}
                </nav>
              </ScrollArea>


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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl text-primary">
            <ContractIcon className="h-6 w-6" />
          </div>
        )}
        <button
          onClick={() => handleCollapsedChange(!collapsed)}
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


    </div>
  );
}
