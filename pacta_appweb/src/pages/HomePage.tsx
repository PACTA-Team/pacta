import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from '@/components/auth/LoginForm';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if this is a first-run setup
    fetch('/api/setup/status')
      .then(r => r.json())
      .then(data => {
        if (data.firstRun) {
          navigate('/setup', { replace: true });
        } else {
          setIsFirstRun(false);
        }
      })
      .catch(() => setIsFirstRun(false));
  }, [navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated || isFirstRun === null) {
    return null;
  }

  return <LoginForm />;
}
