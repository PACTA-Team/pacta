
import { useState } from 'react';
import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import AppSidebar from './AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import CompanySelector from '@/components/CompanySelector';

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const mainRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('common');
  
  // Device size detection for responsive sidebar
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = device === 'mobile';
  const sidebarWidth = isMobile ? 0 : (sidebarCollapsed ? 80 : 256); // 0 for mobile drawer, 80px for collapsed, 256px for expanded

  // Update document title on route change
  useEffect(() => {
    const title = pathname.startsWith('/contracts/') ? 'Contract Details' : (PAGE_TITLES[pathname] || 'PACTA');
    document.title = `${title} - PACTA`;
    // Focus main content on route change for accessibility
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
      />
      <div 
        className="flex-1 flex flex-col overflow-hidden"
        style={{ marginLeft: isMobile ? 0 : (sidebarCollapsed ? 80 : 256) }}
      >
        <header role="banner" className="border-b bg-card px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CompanySelector />
            <h1 className="text-xl font-semibold tracking-tight">
              {pathname.startsWith('/contracts/') ? 'Contract Details' : (PAGE_TITLES[pathname] || '')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
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
