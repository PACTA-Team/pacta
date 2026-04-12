import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { runSetup } from '@/lib/setup-api';
import { useAuth } from '@/contexts/AuthContext';
import { StepWelcome } from './StepWelcome';
import SetupModeSelector from './SetupModeSelector';
import StepCompany from './StepCompany';
import type { CompanyFormData } from './StepCompany';
import { StepAdmin } from './StepAdmin';
import { StepClient } from './StepClient';
import { StepSupplier } from './StepSupplier';
import { StepReview } from './StepReview';
import type { AdminFormData, PartyFormData } from '@/lib/setup-validation';

const STEPS = [
  'Welcome',
  'Company Mode',
  'Company Info',
  'Admin Account',
  'First Client',
  'First Supplier',
  'Review',
] as const;

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const [companyMode, setCompanyMode] = useState<'single' | 'multi'>('single');
  const [company, setCompany] = useState<CompanyFormData>({ name: '', address: '', tax_id: '' });
  const [admin, setAdmin] = useState<AdminFormData>({
    name: '', email: '', password: '', confirmPassword: '',
  });
  const [client, setClient] = useState<PartyFormData>({ name: '', address: '', reu_code: '', contacts: '' });
  const [supplier, setSupplier] = useState<PartyFormData>({ name: '', address: '', reu_code: '', contacts: '' });

  const next = useCallback(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), []);
  const prev = useCallback(() => setStep(s => Math.max(s - 1, 0)), []);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    try {
      await runSetup({
        company_mode: companyMode,
        company: {
          name: company.name,
          address: company.address || undefined,
          tax_id: company.tax_id || undefined,
        },
        admin: { name: admin.name, email: admin.email, password: admin.password },
        client: {
          name: client.name,
          address: client.address || undefined,
          reu_code: client.reu_code || undefined,
          contacts: client.contacts || undefined,
        },
        supplier: {
          name: supplier.name,
          address: supplier.address || undefined,
          reu_code: supplier.reu_code || undefined,
          contacts: supplier.contacts || undefined,
        },
      });
      toast.success('Setup complete! Logging you in...');
      const user = await login(admin.email, admin.password);
      if (user) {
        setTimeout(() => navigate('/dashboard'), 1000);
      } else {
        setTimeout(() => navigate('/'), 1500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Setup failed. Please restart the application.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [companyMode, company, admin, client, supplier, login, navigate]);

  const renderStep = () => {
    switch (step) {
      case 0: return <StepWelcome onNext={next} />;
      case 1: return <SetupModeSelector mode={companyMode} onChange={setCompanyMode} onSelect={next} />;
      case 2: return <StepCompany data={company} onChange={setCompany} onNext={next} onPrev={prev} companyMode={companyMode} />;
      case 3: return <StepAdmin data={admin} onChange={setAdmin} onNext={next} onPrev={prev} />;
      case 4: return <StepClient data={client} onChange={setClient} onNext={next} onPrev={prev} />;
      case 5: return <StepSupplier data={supplier} onChange={setSupplier} onNext={next} onPrev={prev} />;
      case 6: return (
        <StepReview
          companyMode={companyMode}
          company={company}
          admin={admin}
          client={client}
          supplier={supplier}
          onPrev={prev}
          onSubmit={handleSubmit}
          loading={loading}
        />
      );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
                aria-label={`Step ${i + 1}: ${label}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
        {renderStep()}
      </div>
    </div>
  );
}
