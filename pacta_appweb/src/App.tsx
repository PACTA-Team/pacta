import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import SetupPage from './pages/SetupPage';
import ForbiddenPage from './pages/ForbiddenPage';

// Lazy-loaded page components for code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ContractsPage = lazy(() => import('./pages/ContractsPage'));
const ContractDetailsPage = lazy(() => import('./pages/ContractDetailsPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const AuthorizedSignersPage = lazy(() => import('./pages/AuthorizedSignersPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const PendingApprovalPage = lazy(() => import('./pages/PendingApprovalPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SupplementsPage = lazy(() => import('./pages/SupplementsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'));

// Loading fallback component
const PageLoadingFallback = () => (
  <div className="flex h-screen items-center justify-center" role="status" aria-live="polite">
    <div className="text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
      <p className="mt-4 text-sm text-muted-foreground">Loading page...</p>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/" element={<HomePage />} />

        {/* Protected routes with authentication guards */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <AppLayout><DashboardPage /></AppLayout>
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/contracts" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <AppLayout><ContractsPage /></AppLayout>
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/contracts/:id" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <AppLayout><ContractDetailsPage /></AppLayout>
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/clients" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <AppLayout><ClientsPage /></AppLayout>
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/suppliers" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <AppLayout><SuppliersPage /></AppLayout>
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/authorized-signers" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <AppLayout><AuthorizedSignersPage /></AppLayout>
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/documents" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <AppLayout><DocumentsPage /></AppLayout>
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <AppLayout><NotificationsPage /></AppLayout>
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/pending-approval" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <AppLayout><PendingApprovalPage /></AppLayout>
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <AppLayout><ReportsPage /></AppLayout>
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/supplements" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <AppLayout><SupplementsPage /></AppLayout>
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute requiredRole="admin">
            <Suspense fallback={<PageLoadingFallback />}>
              <AppLayout><UsersPage /></AppLayout>
            </Suspense>
          </ProtectedRoute>
        } />
        <Route path="/companies" element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <AppLayout><CompaniesPage /></AppLayout>
            </Suspense>
          </ProtectedRoute>
        } />
      </Routes>
      </CompanyProvider>
    </AuthProvider>
  );
}

export default App;
