'use client';

import { useEffect } from 'react';
import { getContracts } from '@/lib/storage';
import { generateNotifications } from '@/lib/notifications';

export default function GlobalClientEffects() {
  useEffect(() => {
    // Generate notifications on app load
    const contracts = getContracts();
    generateNotifications(contracts);

    // Set up periodic notification generation (every hour)
    const interval = setInterval(() => {
      const updatedContracts = getContracts();
      generateNotifications(updatedContracts);
    }, 60 * 60 * 1000); // 1 hour

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  // This component doesn't render anything
  return null;
}