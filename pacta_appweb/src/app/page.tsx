'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from '@/components/auth/LoginForm';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if this is a first-run setup
    fetch('/next_api/setup/status')
      .then(r => r.json())
      .then(data => {
        if (data.firstRun) {
          router.replace('/setup');
        } else {
          setIsFirstRun(false);
        }
      })
      .catch(() => setIsFirstRun(false));
  }, [router]);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated || isFirstRun === null) {
    return null;
  }

  return <LoginForm />;
}
