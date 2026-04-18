  
import { useState } from 'react';
import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import AppSidebar from './AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import CompanySelector from '@/components/CompanySelector';
import NotificationsDropdown from '@/components/notifications/NotificationsDropdown';
import UserDropdown from '@/components/header/UserDropdown';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TABLET_BREAKPOINT = 1024;
const MOBILE_BREAKPOINT = 768;

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/contracts': 'Contracts Management',
  '/clients': 'Clients',
  '/suppliers': 'Suppliers',
  '/authorized-signers': 'Authorized Signers',
  '/documents': 'Document Repository',
  '/notifications': 'Notifications Center',
  '/users': 'Users & Roles Management',
  '/reports': 'Reports',
  '/supplements': 'Supplements Management',
};

const getInitialDevice = (): 'desktop' | 'tablet' | 'mobile' => {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth <= MOBILE_BREAKPOINT) return 'mobile';
  if (window.innerWidth <= TABLET_BREAKPOINT) return 'tablet';
  return 'desktop';
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const mainRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('common');

  // Device size detection for responsive sidebar
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>(getInitialDevice);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(device !== 'desktop');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= MOBILE_BREAKPOINT) {
        setDevice('mobile');
      } else if (window.innerWidth <= TABLET_BREAKPOINT) {
        setDevice('tablet');
        setSidebarCollapsed(true);
      } else {
        setDevice('desktop');
        setSidebarCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = device === 'mobile';
  const sidebarWidth = isMobile ? 0 : (sidebarCollapsed ? 80 : 256);

  // Update document title on route change
  useEffect(() => {
    const title = pathname.startsWith('/contracts/') ? 'Contract Details' : (PAGE_TITLES[pathname] || 'PACTA');
    document.title = `${title} - PACTA`;
    mainRef.current?.focus();
  }, [pathname]);

    // Redirect if not authenticated (backup guard)
    useEffect(() => {
      if (!isAuthenticated && pathname !== '/') {
        navigate('/login', { replace: true });
      }
    }, [isAuthenticated, pathname, navigate]);

    if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
          <p className="mt-4 text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Skip navigation link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>

      <AppSidebar 
        device={device} 
        collapsed={sidebarCollapsed} 
        onCollapsedChange={setSidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuClose={() => setMobileMenuOpen(false)}
      />
      <div 
        className="flex-1 flex flex-col overflow-hidden"
        style={{ marginLeft: isMobile ? 0 : (sidebarCollapsed ? 80 : 256) }}
      >
         <header role="banner" className="border-b bg-card px-4 md:px-6 py-3 flex items-center gap-3 md:gap-4">
           {/* Mobile: Menu button (visible solo <768px) */}
           <Button
             variant="ghost"
             size="icon"
             className="md:hidden flex-shrink-0"
             onClick={() => setMobileMenuOpen(true)}
             aria-label="Open navigation menu"
           >
             <Menu className="h-5 w-5" aria-hidden="true" />
           </Button>

           {/* CompanySelector - Desktop/Tablet only (≥768px) */}
           <div className="hidden md:flex flex-shrink-0">
             <CompanySelector />
           </div>

           {/* Título de página - ocupa espacio restante */}
           <h1 className="flex-1 text-base md:text-lg lg:text-xl font-semibold tracking-tight truncate">
             {pathname.startsWith('/contracts/') ? 'Contract Details' : (PAGE_TITLES[pathname] || '')}
           </h1>

           {/* Acciones Desktop/Tablet (≥768px) - Notifications, Theme, Language */}
           <div className="hidden md:flex items-center gap-2 flex-shrink-0">
             <NotificationsDropdown />
             <LanguageToggle />
             <ThemeToggle />
           </div>

{/* UserDropdown - siempre visible (mobile y desktop) */}
            <div className="flex items-center gap-1">
              {/* Mobile: Notifications button (visible solo <768px) */}
              <div className="md:hidden">
                <NotificationsDropdown />
              </div>
              <UserDropdown />
            </div>
         </header>
        <main
          ref={mainRef}
          id="main-content"
          role="main"
          tabIndex={-1}
          className="flex-1 overflow-auto bg-background p-6 outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
