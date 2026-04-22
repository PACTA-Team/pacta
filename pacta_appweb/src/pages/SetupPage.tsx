"use client";

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SetupWizard from '@/components/setup/SetupWizard';

export default function SetupPage() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const { t } = useTranslation('setup');

  useEffect(() => {
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((data) => {
        if (!data.needs_setup) {
          navigate('/403', { replace: true });
        } else {
          setIsInitialSetup(true);
          setChecked(true);
        }
      })
      .catch(() => setChecked(true));
  }, [navigate]);

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
          <p className="mt-4 text-sm text-muted-foreground">{t('checkingStatus')}</p>
        </div>
      </div>
    );
  }

  if (!isInitialSetup) {
    navigate('/setup/profile', { replace: true });
    return null;
  }

  return <SetupWizard />;
}