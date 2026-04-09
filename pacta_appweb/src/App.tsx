import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ContractsPage from './pages/ContractsPage';
import ContractDetailsPage from './pages/ContractDetailsPage';
import ClientsPage from './pages/ClientsPage';
import SuppliersPage from './pages/SuppliersPage';
import AuthorizedSignersPage from './pages/AuthorizedSignersPage';
import DocumentsPage from './pages/DocumentsPage';
import NotificationsPage from './pages/NotificationsPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import ReportsPage from './pages/ReportsPage';
import SetupPage from './pages/SetupPage';
import SupplementsPage from './pages/SupplementsPage';
import UsersPage from './pages/UsersPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/" element={<AppLayout><DashboardPage /></AppLayout>} />
        <Route path="/dashboard" element={<AppLayout><DashboardPage /></AppLayout>} />
        <Route path="/contracts" element={<AppLayout><ContractsPage /></AppLayout>} />
        <Route path="/contracts/:id" element={<AppLayout><ContractDetailsPage /></AppLayout>} />
        <Route path="/clients" element={<AppLayout><ClientsPage /></AppLayout>} />
        <Route path="/suppliers" element={<AppLayout><SuppliersPage /></AppLayout>} />
        <Route path="/authorized-signers" element={<AppLayout><AuthorizedSignersPage /></AppLayout>} />
        <Route path="/documents" element={<AppLayout><DocumentsPage /></AppLayout>} />
        <Route path="/notifications" element={<AppLayout><NotificationsPage /></AppLayout>} />
        <Route path="/pending-approval" element={<AppLayout><PendingApprovalPage /></AppLayout>} />
        <Route path="/reports" element={<AppLayout><ReportsPage /></AppLayout>} />
        <Route path="/supplements" element={<AppLayout><SupplementsPage /></AppLayout>} />
        <Route path="/users" element={<AppLayout><UsersPage /></AppLayout>} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
