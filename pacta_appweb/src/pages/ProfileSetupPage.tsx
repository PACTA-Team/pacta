"use client";

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import StepSelectCompany from '@/components/setup/StepSelectCompany';
import StepRoleSelection from '@/components/setup/StepRoleSelection';
import StepAuthorizedSigners from '@/components/setup/StepAuthorizedSigners';
import type { SelectCompanyFormData } from '@/components/setup/StepSelectCompany';
import type { RoleFormData } from '@/components/setup/StepRoleSelection';
import type { AuthorizedSignersFormData } from '@/components/setup/StepAuthorizedSigners';

const STEPS = ['Select Company', 'Role', 'Authorized Signers'] as const;

const initialCompanyData = {
  mode: 'existing' as const,
  companyId: undefined as number | undefined,
  companyName: undefined as string | undefined,
};

const initialRoleData: RoleFormData = {
  role: 'viewer',
};

const initialSignersData: AuthorizedSignersFormData = {
  authorizedSigners: [],
};

export default function ProfileSetupPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { submitSetup } = useAuth();

  const [companyData, setCompanyData] = useState<SelectCompanyFormData>(initialCompanyData);
  const [roleData, setRoleData] = useState<RoleFormData>(initialRoleData);
  const [signersData, setSignersData] = useState<AuthorizedSignersFormData>(initialSignersData);

  const next = useCallback(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), []);
  const prev = useCallback(() => setStep(s => Math.max(s - 1, 0)), []);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    try {
      await submitSetup({
        company_id: companyData.companyId,
        company_name: companyData.companyName,
        role_at_company: roleData.role || 'viewer',
        first_supplier_id: undefined,
        first_client_id: undefined,
        authorized_signers: signersData.authorizedSigners,
      });
      toast.success('Profile setup completed');
      navigate('/pending-profile');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete setup';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [companyData, roleData, signersData, submitSetup, navigate]);

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <StepSelectCompany
            data={companyData}
            onChange={setCompanyData}
            onNext={next}
            onPrev={prev}
          />
        );
      case 1:
        return (
          <StepRoleSelection
            data={roleData}
            onChange={setRoleData}
            onNext={next}
            onPrev={prev}
          />
        );
      case 2:
        return (
          <StepAuthorizedSigners
            data={signersData}
            onChange={setSignersData}
            onNext={next}
            onPrev={prev}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Configura tu Perfil</h1>
          <p className="text-muted-foreground">Completa tu información para comenzar a usar el sistema</p>
        </div>
        <div className="mb-6" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  i <= step ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground'
                }`}
                aria-label={`Step ${i + 1}: ${label}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-purple-600 transition-all"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
        {renderStep()}
      </div>
    </div>
  );
}