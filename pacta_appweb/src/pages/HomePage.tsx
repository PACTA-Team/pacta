"use client";

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isSetup, setIsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
      return;
    }
    // Check if setup has been completed
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.needs_setup) {
          navigate('/setup', { replace: true });
        } else {
          setIsSetup(true);
        }
      })
      .catch(() => setIsSetup(true));
  }, [isAuthenticated, navigate]);

  if (isAuthenticated || isSetup === null) {
    return null;
  }

  return (
    <div className="relative min-h-screen">
      <LandingNavbar />
      <HeroSection />
      <FeaturesSection />
    </div>
  );
}
