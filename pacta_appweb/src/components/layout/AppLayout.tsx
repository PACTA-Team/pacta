
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppSidebar from './AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  useEffect(() => {
    if (!isAuthenticated && pathname !== '/') {
      navigate('/');
    }
  }, [isAuthenticated, pathname, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {pathname === '/dashboard' && 'Dashboard'}
            {pathname === '/contracts' && 'Contracts Management'}
            {pathname?.startsWith('/contracts/') && 'Contract Details'}
            {pathname === '/supplements' && 'Supplements Management'}
            {pathname === '/documents' && 'Document Repository'}
            {pathname === '/notifications' && 'Notifications Center'}
            {pathname === '/users' && 'Users & Roles Management'}
          </h2>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
